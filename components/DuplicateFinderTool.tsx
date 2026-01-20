
import React, { useState, useCallback, useMemo } from 'react';
import type { ExcelData } from '../types';
import { parseExcelFile, exportToExcel } from '../services/excelService';
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
    const [selectedColumns, setSelectedColumns] = useState<(number | null)[]>([null]);

    const [results, setResults] = useState<{
        original: string[][];
        unique: string[][];
        removed: string[][];
    } | null>(null);

    const [activeView, setActiveView] = useState<'original' | 'unique' | 'removed'>('unique');
    
    const [stats, setStats] = useState<{ original: number; unique: number; removed: number } | null>(null);
    
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState<number | undefined>(undefined);

    const [matchMode, setMatchMode] = useState<MatchMode>('normalized');
    const [matchTolerance, setMatchTolerance] = useState<number>(1);

    const handleFile = useCallback(async (file: File) => {
        setIsLoading(true);
        setError(null);
        setResults(null);
        setStats(null);

        try {
            const data = await parseExcelFile(file, setUploadProgress);
            setFile(data);
            setSelectedSheet('');
            setSelectedColumns([null]);
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
        setSelectedColumns([null]);
        setResults(null);
    };

    const handleColumnChange = (index: number, value: string) => {
        const newCols = [...selectedColumns];
        newCols[index] = value === '' ? null : parseInt(value);
        setSelectedColumns(newCols);
        setResults(null);
    };

    const addColumn = () => {
        if (selectedColumns.length < 6) {
            setSelectedColumns([...selectedColumns, null]);
        }
    };

    const removeColumn = (index: number) => {
        const newCols = selectedColumns.filter((_, i) => i !== index);
        setSelectedColumns(newCols);
        setResults(null);
    };

    const handleFindDuplicates = useCallback(() => {
        const validColumns = selectedColumns.filter(c => c !== null) as number[];

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
                const val = String(row[colIndex] || ''); 
                // Note: 'val' is already trimmed by excelService.
                
                if (mode === 'exact') {
                    // Strictly return the value. 
                    // Do NOT collapse internal spaces (replace /\s+/g) as that causes 
                    // "John Doe" and "John  Doe" to match, which Excel considers different.
                    return val; 
                }
                // For normalized and fuzzy, we strip down the string more aggressively
                return val.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/gi, '');
            }).join('|_|');
        };

        // Use timeout to allow UI to update to "processing" state
        setTimeout(() => {
            try {
                const sheetData = file.sheets[selectedSheet];
                if (!sheetData || sheetData.length === 0) throw new Error(`Sheet "${selectedSheet}" is empty.`);
                
                const header = sheetData[0];
                const rows = sheetData.slice(1);

                const uniqueRows: string[][] = [];
                const duplicateRows: string[][] = [];
                
                if (matchMode === 'fuzzy') {
                    const uniqueKeys: string[] = [];
                    
                    rows.forEach(row => {
                        const currentKey = getComparisonKey(row, validColumns, 'normalized'); 
                        let isDuplicate = false;

                        // Check against existing unique keys
                        for (const existingKey of uniqueKeys) {
                            if (levenshteinDistance(currentKey, existingKey) <= matchTolerance) {
                                isDuplicate = true;
                                break;
                            }
                        }

                        if (!isDuplicate) {
                            uniqueRows.push(row);
                            uniqueKeys.push(currentKey);
                        } else {
                            duplicateRows.push(row);
                        }
                    });
                } else {
                    // Exact or Normalized
                    const seen = new Set<string>();
                    rows.forEach(row => {
                        const key = getComparisonKey(row, validColumns, matchMode);
                        if (!seen.has(key)) {
                            seen.add(key);
                            uniqueRows.push(row);
                        } else {
                            duplicateRows.push(row);
                        }
                    });
                }

                setResults({
                    original: [header, ...rows],
                    unique: [header, ...uniqueRows],
                    removed: [header, ...duplicateRows]
                });
                
                setStats({
                    original: rows.length,
                    unique: uniqueRows.length,
                    removed: duplicateRows.length
                });

                // Default to showing the unique data after processing
                setActiveView('unique');

            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'An error occurred while processing duplicates.';
                setError(errorMessage);
            } finally {
                setIsLoading(false);
            }
        }, 50);
    }, [file, selectedSheet, selectedColumns, matchMode, matchTolerance]);

    const handleDownload = () => {
        if (!results) {
            setError('No data available to download.');
            return;
        }
        
        let data = results[activeView];
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
        }
        
        exportToExcel(data, fileName);
    };

    const isProcessDisabled = useMemo(() => {
        const validColumns = selectedColumns.filter(c => c !== null);
        return isLoading || !file || !selectedSheet || validColumns.length === 0;
    }, [isLoading, file, selectedSheet, selectedColumns]);

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
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4">
                         <h2 className="text-2xl font-bold text-slate-800">Configure Duplicate Settings</h2>
                         <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full sm:w-auto">
                            <div className="flex items-center gap-2 w-full sm:w-auto">
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
                            {matchMode === 'fuzzy' && (
                                <Slider
                                    id="dup-fuzzy-tolerance"
                                    label="Tolerance"
                                    min={0} max={5} step={1}
                                    value={matchTolerance}
                                    onChange={setMatchTolerance}
                                />
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
                        {selectedSheet && (
                            <div className="space-y-3">
                                <label className="block text-sm font-medium text-slate-600">Columns to check for uniqueness</label>
                                <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-200 space-y-3">
                                    {selectedColumns.map((colIndex, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <select 
                                                value={colIndex ?? ''} 
                                                onChange={(e) => handleColumnChange(i, e.target.value)}
                                                className="w-full p-2 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                                            >
                                                <option value="">{i === 0 ? '-- Select Primary Column --' : '-- Select Additional Column (Optional) --'}</option>
                                                {headers.map((h, idx) => <option key={`${h}-${idx}`} value={idx}>{h || `Column ${idx+1}`}</option>)}
                                            </select>
                                            {i > 0 && (
                                                <button 
                                                    onClick={() => removeColumn(i)} 
                                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Remove column"
                                                >
                                                    <TrashIcon className="w-5 h-5" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    
                                    {selectedColumns.length < 6 && (
                                        <button 
                                            onClick={addColumn} 
                                            className="flex items-center text-sky-600 text-sm font-semibold hover:text-sky-700 hover:bg-sky-50 px-3 py-2 rounded-lg transition-colors"
                                        >
                                            <PlusCircleIcon className="w-4 h-4 mr-2" /> 
                                            Add another column criteria
                                        </button>
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
                        {activeView === 'removed' ? 'Duplicate Rows Found' : activeView === 'original' ? 'Original Data' : 'Duplicates Removed!'}
                    </h2>
                    
                    {stats && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
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
                        </div>
                    )}

                    <ResultsTable data={results ? results[activeView] : []} />
                    
                    <div className="text-center pt-8">
                        <button onClick={handleDownload} className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 bg-teal-600 text-white font-bold text-lg rounded-xl shadow-lg hover:bg-teal-700 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-teal-500/50 disabled:bg-slate-400 disabled:cursor-not-allowed transition-all transform hover:scale-105 disabled:scale-100">
                            <DownloadIcon className="w-6 h-6" />
                            {activeView === 'removed' ? 'Download Duplicates' : activeView === 'original' ? 'Download Original' : 'Download Unique Data'}
                        </button>
                    </div>
                </div>
            </AnimatedSection>
        </div>
    );
};

export default DuplicateFinderTool;
