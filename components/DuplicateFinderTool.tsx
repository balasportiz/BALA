
import React, { useState, useCallback, useMemo } from 'react';
import type { ExcelData } from '../types';
import { parseExcelFile, exportToExcel, exportMultipleSheetsToExcel } from '../services/excelService';
import FileUploader from './FileUploader';
import ResultsTable from './ResultsTable';
import Slider from './Slider';
import { DownloadIcon, DocumentDuplicateIcon, AlertIcon, PlusCircleIcon, TrashIcon } from './Icons';

const AnimatedSection: React.FC<{ isVisible: boolean; children: React.ReactNode; className?: string }> = ({ isVisible, children, className = '' }) => (
    <div className={`${className} transition-all duration-700 ease-in-out ${isVisible ? 'opacity-100 max-h-[5000px]' : 'opacity-0 max-h-0 overflow-hidden'}`}>
      {children}
    </div>
);

type MatchMode = 'exact' | 'normalized' | 'fuzzy';

const DuplicateFinderTool: React.FC = () => {
    const [file, setFile] = useState<ExcelData | null>(null);
    const [selectedSheet, setSelectedSheet] = useState<string>('');
    const [selectedColumns, setSelectedColumns] = useState<number[]>([]);

    const [results, setResults] = useState<{
        original: string[][];
        unique: string[][];
        removed: string[][];
        flagged?: string[][];
        grouped?: string[][];
        duplicateIndices?: Set<number>;
    } | null>(null);

    const [activeView, setActiveView] = useState<'original' | 'unique' | 'removed' | 'flagged' | 'grouped'>('unique');
    
    const [stats, setStats] = useState<{ original: number; unique: number; removed: number } | null>(null);
    
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState<number | undefined>(undefined);

    const [matchMode, setMatchMode] = useState<MatchMode>('normalized');
    const [matchTolerance, setMatchTolerance] = useState<number>(1);
    
    const [keepLogic, setKeepLogic] = useState<'first' | 'last'>('first');
    const [actionOption, setActionOption] = useState<'remove' | 'flag'>('remove');
    const [checkEntireRow, setCheckEntireRow] = useState<boolean>(false);

    const handleFile = useCallback(async (file: File) => {
        setIsLoading(true);
        setError(null);
        setResults(null);
        setStats(null);

        try {
            const data = await parseExcelFile(file, setUploadProgress);
            setFile(data);
            setSelectedSheet('');
            setSelectedColumns([]);
        } catch (err) {
            setError('Failed to parse the Excel file. Please ensure it is a valid .xlsx or .xls file.');
            console.error(err);
        } finally {
            setIsLoading(false);
            setUploadProgress(undefined);
        }
    }, []);

    const handleSheetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedSheet(e.target.value);
        setSelectedColumns([]);
        setResults(null);
    };

    const toggleColumn = (index: number) => {
        setSelectedColumns(prev => 
            prev.includes(index) 
                ? prev.filter(i => i !== index)
                : [...prev, index]
        );
        setResults(null);
    };

    const handleFindDuplicates = useCallback(() => {
        const sheetData = file && selectedSheet ? file.sheets[selectedSheet] || [] : [];
        const maxCols = sheetData.reduce((max, row) => Math.max(max, row.length), 0);
        const validColumns = checkEntireRow 
            ? Array.from({ length: maxCols }, (_, i) => i) 
            : selectedColumns;

        if (!file || !selectedSheet || validColumns.length === 0) {
            setError('Please select a sheet and at least one column to check for duplicates.');
            return;
        }

        setIsLoading(true);
        setError(null);

        const levenshteinDistance = (a: string, b: string): number => {
            if (a.length === 0) return b.length;
            if (b.length === 0) return a.length;
            const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
            for (let i = 0; i <= a.length; i++) { matrix[0][i] = i; }
            for (let j = 0; j <= b.length; j++) { matrix[j][0] = j; }
            for (let j = 1; j <= b.length; j++) {
                for (let i = 1; i <= a.length; i++) {
                    const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                    matrix[j][i] = Math.min(
                        matrix[j][i - 1] + 1,
                        matrix[j - 1][i] + 1,
                        matrix[j - 1][i - 1] + cost,
                    );
                }
            }
            return matrix[b.length][a.length];
        };

        // Helper to generate the comparison string based on mode
        const getComparisonKey = (row: string[], cols: number[], mode: 'exact' | 'normalized' | 'fuzzy'): string => {
            return cols.map(colIndex => {
                let val = String(row[colIndex] ?? ''); 
                
                if (mode === 'exact') {
                    return val; 
                }
                
                // Remove common currency symbols and commas before checking if it's a number
                let cleanVal = val.replace(/[$,€£]/g, '').trim();
                if (/^-?\d*\.?\d+$/.test(cleanVal)) {
                    return String(parseFloat(cleanVal));
                }
                
                // For normalized and fuzzy strings, lowercase, remove accents, and normalize spaces
                return val.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
            }).join('|_|');
        };

        // Use timeout to allow UI to update to "processing" state
        setTimeout(() => {
            try {
                const sheetData = file.sheets[selectedSheet];
                if (!sheetData || sheetData.length === 0) throw new Error(`Sheet "${selectedSheet}" is empty.`);
                
                const header = sheetData[0];
                const rows = sheetData.slice(1);

                const groups = new Map<string, number[]>();
                
                if (matchMode === 'fuzzy') {
                    rows.forEach((row, index) => {
                        const currentKey = getComparisonKey(row, validColumns, 'normalized'); 
                        let foundMatchKey: string | null = null;

                        // Check against existing unique keys
                        for (const existingKey of groups.keys()) {
                            if (levenshteinDistance(currentKey, existingKey) <= matchTolerance) {
                                foundMatchKey = existingKey;
                                break;
                            }
                        }

                        if (!foundMatchKey) {
                            groups.set(currentKey, [index]);
                        } else {
                            groups.get(foundMatchKey)!.push(index);
                        }
                    });
                } else {
                    // Exact or Normalized
                    rows.forEach((row, index) => {
                        const key = getComparisonKey(row, validColumns, matchMode);
                        if (!groups.has(key)) {
                            groups.set(key, [index]);
                        } else {
                            groups.get(key)!.push(index);
                        }
                    });
                }

                const uniqueRows: string[][] = [];
                const duplicateRows: string[][] = [];
                const flaggedRows: string[][] = [];
                const groupedRows: string[][] = [];

                const duplicateIndices = new Set<number>();
                let groupId = 1;

                for (const [key, indices] of groups.entries()) {
                    if (indices.length === 0) continue;
                    
                    let keptIndex = indices[0];
                    if (keepLogic === 'last') {
                        keptIndex = indices[indices.length - 1];
                    }
                    
                    for (const idx of indices) {
                        if (idx !== keptIndex) {
                            duplicateIndices.add(idx);
                        }
                    }

                    // If it's a duplicate group, add to groupedRows
                    if (indices.length > 1) {
                        for (const idx of indices) {
                            groupedRows.push([String(idx + 2), `Group ${groupId}`, ...rows[idx]]);
                        }
                        groupId++;
                    }
                }

                rows.forEach((row, index) => {
                    const isDup = duplicateIndices.has(index);
                    if (actionOption === 'flag') {
                        flaggedRows.push([...row, isDup ? 'TRUE' : 'FALSE']);
                    }
                    
                    if (isDup) {
                        duplicateRows.push(row);
                    } else {
                        uniqueRows.push(row);
                    }
                });

                setResults({
                    original: [header, ...rows],
                    unique: [header, ...uniqueRows],
                    removed: [header, ...duplicateRows],
                    ...(actionOption === 'flag' ? { flagged: [[...header, 'Is_Duplicate'], ...flaggedRows] } : {}),
                    grouped: [['Original_Row', 'Group_ID', ...header], ...groupedRows],
                    duplicateIndices
                });
                
                setStats({
                    original: rows.length,
                    unique: uniqueRows.length,
                    removed: duplicateRows.length
                });

                // Default to showing grouped review if duplicates exist
                if (duplicateRows.length > 0) {
                    setActiveView('grouped');
                } else {
                    setActiveView(actionOption === 'flag' ? 'flagged' : 'unique');
                }

            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'An error occurred while processing duplicates.';
                setError(errorMessage);
            } finally {
                setIsLoading(false);
            }
        }, 50);
    }, [file, selectedSheet, selectedColumns, matchMode, matchTolerance, keepLogic, actionOption, checkEntireRow]);

    const handleDownload = () => {
        if (!results) {
            setError('No data available to download.');
            return;
        }
        
        let data = results[activeView as keyof typeof results];
        if (!data) return;

        let fileName = 'Cleaned_Data.xlsx';
        
        switch (activeView) {
            case 'original':
                fileName = 'Original_Data.xlsx';
                break;
            case 'unique':
                fileName = 'Cleaned_Data_No_Duplicates.xlsx';
                break;
            case 'removed':
                fileName = 'Removed_Duplicates.xlsx';
                break;
            case 'flagged':
                fileName = 'Flagged_Data.xlsx';
                break;
            case 'grouped':
                fileName = 'Grouped_Duplicates_Review.xlsx';
                break;
        }
        
        exportToExcel(data as string[][], fileName);
    };

    const handleDownloadAll = () => {
        if (!results) {
            setError('No data available to download.');
            return;
        }

        const sheets = [
            { name: 'Unique Data', data: results.unique },
            { name: 'Removed Duplicates', data: results.removed },
            { name: 'Grouped Review', data: results.grouped || [] }
        ].filter(s => s.data.length > 1);

        exportMultipleSheetsToExcel(sheets, 'Cleaned_Data_Full_Report.xlsx');
    };

    const isProcessDisabled = useMemo(() => {
        const sheetData = file && selectedSheet ? file.sheets[selectedSheet] || [] : [];
        const maxCols = sheetData.reduce((max, row) => Math.max(max, row.length), 0);
        const validColumns = checkEntireRow 
            ? Array.from({ length: maxCols }, (_, i) => i) 
            : selectedColumns;
        return isLoading || !file || !selectedSheet || validColumns.length === 0;
    }, [isLoading, file, selectedSheet, selectedColumns, checkEntireRow]);

    const headers = file && selectedSheet ? file.sheets[selectedSheet]?.[0] || [] : [];

    return (
        <div className="space-y-12">
             <section className="max-w-3xl mx-auto">
                <FileUploader 
                    id="dup-file" 
                    title="Upload Data File" 
                    subtitle="Upload the Excel file you want to clean"
                    onFileSelect={handleFile} 
                    progress={uploadProgress}
                />
            </section>

            <AnimatedSection isVisible={!!file && !results}>
                <div className="bg-white/60 backdrop-blur-sm border border-slate-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300 max-w-3xl mx-auto">
                    <div className="flex flex-col mb-6 gap-4">
                         <h2 className="text-2xl font-bold text-slate-800">Configure Duplicate Settings</h2>
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                            <div className="flex items-center gap-2">
                                <label htmlFor="dup-match-mode" className="text-sm font-medium text-slate-600 whitespace-nowrap">Matching Logic:</label>
                                <select
                                    id="dup-match-mode"
                                    value={matchMode}
                                    onChange={(e) => setMatchMode(e.target.value as MatchMode)}
                                    className="p-2 w-full border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                                >
                                    <option value="normalized">Normalized (Flexible)</option>
                                    <option value="fuzzy">Fuzzy (Approximate)</option>
                                    <option value="exact">Exact (Case-Sensitive)</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <label htmlFor="dup-keep-logic" className="text-sm font-medium text-slate-600 whitespace-nowrap">Keep Logic:</label>
                                <select
                                    id="dup-keep-logic"
                                    value={keepLogic}
                                    onChange={(e) => setKeepLogic(e.target.value as 'first' | 'last')}
                                    className="p-2 w-full border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                                >
                                    <option value="first">Keep First Occurrence</option>
                                    <option value="last">Keep Last Occurrence</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <label htmlFor="dup-action-option" className="text-sm font-medium text-slate-600 whitespace-nowrap">Action:</label>
                                <select
                                    id="dup-action-option"
                                    value={actionOption}
                                    onChange={(e) => setActionOption(e.target.value as 'remove' | 'flag')}
                                    className="p-2 w-full border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                                >
                                    <option value="remove">Remove Duplicates</option>
                                    <option value="flag">Flag Duplicates (Add Column)</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="flex items-center gap-2 text-sm font-medium text-slate-600 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={checkEntireRow} 
                                        onChange={(e) => setCheckEntireRow(e.target.checked)}
                                        className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 w-4 h-4"
                                    />
                                    Check Entire Row
                                </label>
                            </div>
                            {matchMode === 'fuzzy' && (
                                <div className="sm:col-span-2">
                                    <Slider
                                        id="dup-fuzzy-tolerance"
                                        label="Tolerance"
                                        min={0} max={5} step={1}
                                        value={matchTolerance}
                                        onChange={setMatchTolerance}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="space-y-6">
                        {/* Sheet Selection */}
                        <div>
                            <div className="min-w-0 mb-2">
                                <h4 className="font-bold text-slate-700 text-md">Source File</h4>
                                <p className="font-medium text-sky-700 text-sm truncate">{file?.fileName}</p>
                            </div>
                             <label htmlFor="sheet-select" className="block text-sm font-medium text-slate-600 mb-1">Select Sheet</label>
                             <select 
                                id="sheet-select"
                                value={selectedSheet} 
                                onChange={handleSheetChange}
                                className="w-full p-2 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                            >
                                <option value="">-- Choose a sheet --</option>
                                {file?.sheetNames.map(name => <option key={name} value={name}>{name}</option>)}
                            </select>
                        </div>

                        {/* Columns Selection */}
                        {selectedSheet && !checkEntireRow && (
                            <div className="space-y-3">
                                <div className="flex justify-between items-end">
                                    <label className="block text-sm font-medium text-slate-600">Columns to check for uniqueness</label>
                                    {headers.length > 0 && (
                                        <div className="flex gap-2 text-xs">
                                            <button 
                                                onClick={() => setSelectedColumns(headers.map((_, i) => i))}
                                                className="text-sky-600 hover:text-sky-800 font-medium"
                                            >
                                                Select All
                                            </button>
                                            <span className="text-slate-300">|</span>
                                            <button 
                                                onClick={() => setSelectedColumns([])}
                                                className="text-slate-500 hover:text-slate-700 font-medium"
                                            >
                                                Clear
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="w-full p-2 border border-slate-300 rounded-lg shadow-sm bg-white max-h-64 overflow-y-auto">
                                    {headers.length > 0 ? (
                                        <div className="space-y-1">
                                            {headers.map((header, i) => (
                                                <label key={`${header}-${i}`} className="flex items-center space-x-2 p-2 hover:bg-slate-50 rounded cursor-pointer transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedColumns.includes(i)}
                                                        onChange={() => toggleColumn(i)}
                                                        className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 w-4 h-4"
                                                    />
                                                    <span className="text-sm text-slate-700">{header || `Column ${i + 1}`}</span>
                                                </label>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-slate-400 italic p-2">No columns available</p>
                                    )}
                                </div>
                                <p className="text-xs text-slate-500 italic mt-2">
                                    * Rows are considered duplicates only if <strong>ALL</strong> selected columns match.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </AnimatedSection>

            {error && (
                <div className="max-w-3xl mx-auto bg-red-100 border-l-4 border-red-500 text-red-800 p-4 rounded-r-lg flex items-start shadow-md" role="alert">
                    <AlertIcon className="w-6 h-6 mr-3 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-bold">Oops! Something went wrong.</p>
                        <p className="text-sm">{error}</p>
                    </div>
                </div>
            )}

            <AnimatedSection isVisible={!!file && !results}>
                <div className="text-center">
                    <button 
                        onClick={handleFindDuplicates} 
                        disabled={isProcessDisabled} 
                        className="group w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-sky-500 to-cyan-500 text-white font-bold text-lg rounded-xl shadow-lg hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-sky-500/50 disabled:from-slate-400 disabled:to-slate-400 disabled:cursor-not-allowed transition-all transform hover:scale-105 disabled:scale-100"
                    >
                        <DocumentDuplicateIcon className="w-6 h-6" />
                        {isLoading ? 'Processing...' : 'Find & Remove Duplicates'}
                    </button>
                </div>
            </AnimatedSection>

             <AnimatedSection isVisible={!!results}>
                <div className="max-w-5xl mx-auto">
                    <h2 className="text-3xl sm:text-4xl font-extrabold text-center text-transparent bg-clip-text bg-gradient-to-r from-sky-500 to-cyan-500 mb-6 pb-1">
                        {activeView === 'removed' ? 'Duplicate Rows Found' : activeView === 'original' ? 'Original Data' : activeView === 'flagged' ? 'Data Flagged!' : activeView === 'grouped' ? 'Review Duplicates' : 'Duplicates Removed!'}
                    </h2>
                    
                    {stats && (
                        <div className={`grid grid-cols-1 gap-4 mb-8 ${actionOption === 'flag' ? 'sm:grid-cols-3' : 'sm:grid-cols-4'}`}>
                            {actionOption === 'flag' ? (
                                <>
                                    <button 
                                        onClick={() => setActiveView('original')}
                                        className={`p-4 rounded-xl shadow-md text-center border-2 transition-all duration-200 focus:outline-none transform ${
                                            activeView === 'original' 
                                            ? 'bg-white border-blue-400 ring-4 ring-blue-100 scale-105' 
                                            : 'bg-white/80 border-slate-100 hover:bg-white hover:border-blue-200 hover:-translate-y-1'
                                        }`}
                                    >
                                        <p className={`text-sm uppercase font-bold tracking-wider ${activeView === 'original' ? 'text-blue-600' : 'text-slate-500'}`}>Original Rows</p>
                                        <p className={`text-4xl font-extrabold mt-2 ${activeView === 'original' ? 'text-slate-800' : 'text-slate-600'}`}>{stats.original.toLocaleString()}</p>
                                    </button>
                                    <button 
                                        onClick={() => setActiveView('flagged')}
                                        className={`p-4 rounded-xl shadow-md text-center border-2 transition-all duration-200 focus:outline-none transform ${
                                            activeView === 'flagged' 
                                            ? 'bg-purple-50 border-purple-400 ring-4 ring-purple-100 scale-105' 
                                            : 'bg-white/80 border-slate-100 hover:bg-white hover:border-purple-200 hover:-translate-y-1'
                                        }`}
                                    >
                                        <p className={`text-sm uppercase font-bold tracking-wider ${activeView === 'flagged' ? 'text-purple-600' : 'text-purple-600/70'}`}>Flagged Data</p>
                                        <p className="text-4xl font-extrabold text-purple-600 mt-2">{stats.original.toLocaleString()}</p>
                                        <p className="text-xs text-purple-500 mt-1">({stats.removed.toLocaleString()} duplicates found)</p>
                                    </button>
                                    <button 
                                        onClick={() => setActiveView('grouped')}
                                        className={`p-4 rounded-xl shadow-md text-center border-2 transition-all duration-200 focus:outline-none transform ${
                                            activeView === 'grouped' 
                                            ? 'bg-rose-50 border-rose-400 ring-4 ring-rose-100 scale-105' 
                                            : 'bg-white/80 border-slate-100 hover:bg-white hover:border-rose-200 hover:-translate-y-1'
                                        }`}
                                    >
                                        <p className={`text-sm uppercase font-bold tracking-wider ${activeView === 'grouped' ? 'text-rose-600' : 'text-rose-600/70'}`}>Review Duplicates</p>
                                        <p className="text-4xl font-extrabold text-rose-600 mt-2">{stats.removed.toLocaleString()}</p>
                                        <p className="text-xs text-rose-500 mt-1">Grouped together</p>
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button 
                                        onClick={() => setActiveView('original')}
                                        className={`p-4 rounded-xl shadow-md text-center border-2 transition-all duration-200 focus:outline-none transform ${
                                            activeView === 'original' 
                                            ? 'bg-white border-blue-400 ring-4 ring-blue-100 scale-105' 
                                            : 'bg-white/80 border-slate-100 hover:bg-white hover:border-blue-200 hover:-translate-y-1'
                                        }`}
                                    >
                                        <p className={`text-sm uppercase font-bold tracking-wider ${activeView === 'original' ? 'text-blue-600' : 'text-slate-500'}`}>Original Rows</p>
                                        <p className={`text-4xl font-extrabold mt-2 ${activeView === 'original' ? 'text-slate-800' : 'text-slate-600'}`}>{stats.original.toLocaleString()}</p>
                                    </button>
                                    
                                    <button 
                                        onClick={() => setActiveView('unique')}
                                        className={`p-4 rounded-xl shadow-md text-center border-2 transition-all duration-200 focus:outline-none transform ${
                                            activeView === 'unique' 
                                            ? 'bg-emerald-50 border-emerald-400 ring-4 ring-emerald-100 scale-105' 
                                            : 'bg-white/80 border-slate-100 hover:bg-white hover:border-emerald-200 hover:-translate-y-1'
                                        }`}
                                    >
                                        <p className={`text-sm uppercase font-bold tracking-wider ${activeView === 'unique' ? 'text-emerald-600' : 'text-emerald-600/70'}`}>Unique Rows</p>
                                        <p className="text-4xl font-extrabold text-emerald-600 mt-2">{stats.unique.toLocaleString()}</p>
                                    </button>
                                    
                                    <button 
                                        onClick={() => setActiveView('removed')}
                                        className={`p-4 rounded-xl shadow-md text-center border-2 transition-all duration-200 focus:outline-none transform ${
                                            activeView === 'removed' 
                                            ? 'bg-amber-50 border-amber-400 ring-4 ring-amber-100 scale-105' 
                                            : 'bg-white/80 border-slate-100 hover:bg-white hover:border-amber-200 hover:-translate-y-1'
                                        }`}
                                    >
                                        <p className={`text-sm uppercase font-bold tracking-wider ${activeView === 'removed' ? 'text-amber-600' : 'text-amber-600/70'}`}>Duplicates Removed</p>
                                        <p className="text-4xl font-extrabold text-amber-600 mt-2">{stats.removed.toLocaleString()}</p>
                                    </button>

                                    <button 
                                        onClick={() => setActiveView('grouped')}
                                        className={`p-4 rounded-xl shadow-md text-center border-2 transition-all duration-200 focus:outline-none transform ${
                                            activeView === 'grouped' 
                                            ? 'bg-rose-50 border-rose-400 ring-4 ring-rose-100 scale-105' 
                                            : 'bg-white/80 border-slate-100 hover:bg-white hover:border-rose-200 hover:-translate-y-1'
                                        }`}
                                    >
                                        <p className={`text-sm uppercase font-bold tracking-wider ${activeView === 'grouped' ? 'text-rose-600' : 'text-rose-600/70'}`}>Review Duplicates</p>
                                        <p className="text-4xl font-extrabold text-rose-600 mt-2">{stats.removed.toLocaleString()}</p>
                                        <p className="text-xs text-rose-500 mt-1">Grouped together</p>
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    <ResultsTable 
                        data={results ? results[activeView as keyof typeof results] as string[][] || [] : []} 
                        highlightIndices={(activeView === 'original' || activeView === 'flagged') ? results?.duplicateIndices : undefined}
                    />
                    
                    <div className="flex flex-col sm:flex-row justify-center gap-4 pt-8">
                        <button onClick={handleDownload} className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 bg-teal-600 text-white font-bold text-lg rounded-xl shadow-lg hover:bg-teal-700 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-teal-500/50 disabled:bg-slate-400 disabled:cursor-not-allowed transition-all transform hover:scale-105 disabled:scale-100">
                            <DownloadIcon className="w-6 h-6" />
                            {activeView === 'removed' ? 'Download Duplicates' : activeView === 'original' ? 'Download Original' : activeView === 'flagged' ? 'Download Flagged Data' : activeView === 'grouped' ? 'Download Grouped Review' : 'Download Unique Data'}
                        </button>
                        
                        {actionOption !== 'flag' && (
                            <button onClick={handleDownloadAll} className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 bg-indigo-600 text-white font-bold text-lg rounded-xl shadow-lg hover:bg-indigo-700 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-indigo-500/50 disabled:bg-slate-400 disabled:cursor-not-allowed transition-all transform hover:scale-105 disabled:scale-100">
                                <DownloadIcon className="w-6 h-6" />
                                Download Full Report (2 Sheets)
                            </button>
                        )}
                    </div>
                </div>
            </AnimatedSection>
        </div>
    );
};

export default DuplicateFinderTool;
