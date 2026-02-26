import React, { useState, useMemo, useCallback } from 'react';
import type { ExcelData } from '../types';
import { parseExcelFile, exportToExcel } from '../services/excelService';
import FileUploader from './FileUploader';
import ResultsTable from './ResultsTable';
import StepIndicator from './StepIndicator';
import { DownloadIcon, MagicWandIcon, AlertIcon } from './Icons';

const AnimatedSection: React.FC<{ isVisible: boolean; children: React.ReactNode; className?: string }> = ({ isVisible, children, className = '' }) => (
    <div className={`${className} transition-all duration-700 ease-in-out ${isVisible ? 'opacity-100 max-h-[5000px]' : 'opacity-0 max-h-0 overflow-hidden'}`}>
      {children}
    </div>
);

const SheetMatchingTool: React.FC = () => {
    const [fileA, setFileA] = useState<ExcelData | null>(null);
    const [fileB, setFileB] = useState<ExcelData | null>(null);

    const [sheetA, setSheetA] = useState<string>('');
    const [keyColA, setKeyColA] = useState<number | null>(null);

    const [sheetB, setSheetB] = useState<string>('');
    const [keyColB, setKeyColB] = useState<number | null>(null);

    const [compareCols, setCompareCols] = useState<string[]>([]);

    const [results, setResults] = useState<{
        data: string[][];
        highlightCells: Set<string>;
        stats: { total: number; matched: number; differences: number; missing: number };
    } | null>(null);

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState<{ [id: string]: number }>({});

    const handleFile = useCallback(async (file: File, type: 'A' | 'B') => {
        const uploaderId = type === 'A' ? 'file-a' : 'file-b';
        setIsLoading(true);
        setError(null);
        setResults(null);

        const progressCallback = (progress: number) => {
            setUploadProgress(prev => ({ ...prev, [uploaderId]: progress }));
        };

        try {
            const data = await parseExcelFile(file, progressCallback);
            if (type === 'A') {
                setFileA(data);
                setSheetA('');
                setKeyColA(null);
                setCompareCols([]);
            } else {
                setFileB(data);
                setSheetB('');
                setKeyColB(null);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to parse the Excel file.';
            setError(errorMessage);
            console.error(err);
        } finally {
            setIsLoading(false);
            setUploadProgress(prev => {
                const newState = { ...prev };
                delete newState[uploaderId];
                return newState;
            });
        }
    }, []);

    const headersA = fileA && sheetA ? fileA.sheets[sheetA][0] || [] : [];
    const headersB = fileB && sheetB ? fileB.sheets[sheetB][0] || [] : [];

    const commonHeaders = useMemo(() => {
        if (!headersA.length || !headersB.length) return [];
        return headersA.filter(h => headersB.includes(h) && h !== headersA[keyColA ?? -1]);
    }, [headersA, headersB, keyColA]);

    const toggleCompareCol = (col: string) => {
        setCompareCols(prev => 
            prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
        );
        setResults(null);
    };

    const handleMatch = useCallback(() => {
        if (!fileA || !sheetA || keyColA === null || !fileB || !sheetB || keyColB === null) {
            setError('Please configure both files and select key columns.');
            return;
        }
        if (compareCols.length === 0) {
            setError('Please select at least one column to compare.');
            return;
        }

        setIsLoading(true);
        setError(null);

        setTimeout(() => {
            try {
                const dataA = fileA.sheets[sheetA];
                const dataB = fileB.sheets[sheetB];

                if (dataA.length <= 1) throw new Error('File A sheet is empty.');
                if (dataB.length <= 1) throw new Error('File B sheet is empty.');

                const headA = dataA[0];
                const headB = dataB[0];

                // Map File B rows by Key
                const mapB = new Map<string, string[]>();
                for (let i = 1; i < dataB.length; i++) {
                    const row = dataB[i];
                    const key = row[keyColB];
                    if (key) {
                        mapB.set(key, row); // Exact case-sensitive match
                    }
                }

                const resultHeaders = [headA[keyColA], ...compareCols, 'Match_Status'];
                const resultData: string[][] = [];
                const highlightCells = new Set<string>();

                let matchedCount = 0;
                let diffCount = 0;
                let missingCount = 0;

                for (let i = 1; i < dataA.length; i++) {
                    const rowA = dataA[i];
                    const keyA = rowA[keyColA];
                    
                    if (!keyA) continue; // Skip empty keys

                    const rowB = mapB.get(keyA);
                    const newRow = [keyA];
                    let hasDiff = false;

                    if (!rowB) {
                        missingCount++;
                        // Fill with A's data, mark as missing
                        for (const col of compareCols) {
                            const idxA = headA.indexOf(col);
                            newRow.push(rowA[idxA] ?? '');
                        }
                        newRow.push('Missing in File B');
                        highlightCells.add(`${i - 1}-${resultHeaders.length - 1}`);
                    } else {
                        for (let j = 0; j < compareCols.length; j++) {
                            const col = compareCols[j];
                            const idxA = headA.indexOf(col);
                            const idxB = headB.indexOf(col);

                            const valA = rowA[idxA] ?? '';
                            const valB = rowB[idxB] ?? '';

                            if (valA !== valB) { // Exact Case-Sensitive
                                hasDiff = true;
                                newRow.push(`${valA} (B: ${valB})`);
                                highlightCells.add(`${i - 1}-${j + 1}`); // +1 because key is at 0
                            } else {
                                newRow.push(valA);
                            }
                        }

                        if (hasDiff) {
                            diffCount++;
                            newRow.push('Differences Found');
                            highlightCells.add(`${i - 1}-${resultHeaders.length - 1}`);
                        } else {
                            matchedCount++;
                            newRow.push('Exact Match');
                        }
                    }
                    resultData.push(newRow);
                }

                setResults({
                    data: [resultHeaders, ...resultData],
                    highlightCells,
                    stats: { total: resultData.length, matched: matchedCount, differences: diffCount, missing: missingCount }
                });

            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'An error occurred during matching.';
                setError(errorMessage);
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        }, 50);
    }, [fileA, sheetA, keyColA, fileB, sheetB, keyColB, compareCols]);

    const handleDownload = () => {
        if (!results) return;
        exportToExcel(results.data, 'Sheet_Matching_Results.xlsx');
    };

    const filesUploaded = fileA && fileB;
    let currentStep = 1;
    if (filesUploaded) currentStep = 2;
    if (results) currentStep = 3;

    const isMatchDisabled = isLoading || !fileA || !sheetA || keyColA === null || !fileB || !sheetB || keyColB === null || compareCols.length === 0;

    return (
        <div className="space-y-12">
            <StepIndicator currentStep={currentStep} />
            
            <section>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">
                    <FileUploader 
                        id="file-a" 
                        title="File A (Base)" 
                        subtitle="The primary file to compare against"
                        onFileSelect={(file) => handleFile(file, 'A')} 
                        progress={uploadProgress['file-a']}
                    />
                    <FileUploader 
                        id="file-b" 
                        title="File B (Compare)" 
                        subtitle="The file to check for differences"
                        onFileSelect={(file) => handleFile(file, 'B')} 
                        progress={uploadProgress['file-b']}
                    />
                </div>
            </section>

            <AnimatedSection isVisible={!!filesUploaded && !results}>
                <div className="bg-white/60 backdrop-blur-sm border border-slate-200 p-6 rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300">
                    <h2 className="text-2xl font-bold text-slate-800 mb-6">Configure Matching</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* File A Config */}
                        <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <h3 className="font-bold text-slate-700">File A Settings</h3>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Sheet</label>
                                <select 
                                    value={sheetA} 
                                    onChange={(e) => { setSheetA(e.target.value); setKeyColA(null); setCompareCols([]); setResults(null); }}
                                    className="w-full p-2 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-sky-500"
                                >
                                    <option value="">-- Choose a sheet --</option>
                                    {fileA?.sheetNames.map(name => <option key={name} value={name}>{name}</option>)}
                                </select>
                            </div>
                            {sheetA && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Key Column (ID)</label>
                                    <select 
                                        value={keyColA ?? ''} 
                                        onChange={(e) => { setKeyColA(e.target.value === '' ? null : parseInt(e.target.value)); setCompareCols([]); setResults(null); }}
                                        className="w-full p-2 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-sky-500"
                                    >
                                        <option value="">-- Choose key column --</option>
                                        {headersA.map((h, i) => <option key={i} value={i}>{h || `Column ${i+1}`}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>

                        {/* File B Config */}
                        <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <h3 className="font-bold text-slate-700">File B Settings</h3>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Sheet</label>
                                <select 
                                    value={sheetB} 
                                    onChange={(e) => { setSheetB(e.target.value); setKeyColB(null); setResults(null); }}
                                    className="w-full p-2 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-sky-500"
                                >
                                    <option value="">-- Choose a sheet --</option>
                                    {fileB?.sheetNames.map(name => <option key={name} value={name}>{name}</option>)}
                                </select>
                            </div>
                            {sheetB && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Key Column (ID)</label>
                                    <select 
                                        value={keyColB ?? ''} 
                                        onChange={(e) => { setKeyColB(e.target.value === '' ? null : parseInt(e.target.value)); setResults(null); }}
                                        className="w-full p-2 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-sky-500"
                                    >
                                        <option value="">-- Choose key column --</option>
                                        {headersB.map((h, i) => <option key={i} value={i}>{h || `Column ${i+1}`}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Compare Columns */}
                    {keyColA !== null && keyColB !== null && commonHeaders.length > 0 && (
                        <div className="mt-8">
                            <div className="flex justify-between items-end mb-2">
                                <label className="block text-sm font-medium text-slate-600">Columns to Compare</label>
                                <div className="flex gap-2 text-xs">
                                    <button onClick={() => setCompareCols(commonHeaders)} className="text-sky-600 hover:text-sky-800 font-medium">Select All</button>
                                    <span className="text-slate-300">|</span>
                                    <button onClick={() => setCompareCols([])} className="text-slate-500 hover:text-slate-700 font-medium">Clear</button>
                                </div>
                            </div>
                            <div className="w-full p-4 border border-slate-300 rounded-lg shadow-sm bg-white max-h-64 overflow-y-auto">
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                    {commonHeaders.map((header) => (
                                        <label key={header} className="flex items-center space-x-2 p-2 hover:bg-slate-50 rounded cursor-pointer transition-colors border border-transparent hover:border-slate-200">
                                            <input
                                                type="checkbox"
                                                checked={compareCols.includes(header)}
                                                onChange={() => toggleCompareCol(header)}
                                                className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 w-4 h-4"
                                            />
                                            <span className="text-sm text-slate-700 truncate" title={header}>{header}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <p className="text-xs text-slate-500 italic mt-2">
                                * Only columns that exist in both sheets are shown. Matching is Exact (Case-Sensitive).
                            </p>
                        </div>
                    )}
                </div>
            </AnimatedSection>

            {error && (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-800 p-4 rounded-r-lg flex items-start shadow-md" role="alert">
                    <AlertIcon className="w-6 h-6 mr-3 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-bold">Oops! Something went wrong.</p>
                        <p className="text-sm">{error}</p>
                    </div>
                </div>
            )}

            <AnimatedSection isVisible={!!filesUploaded && !results}>
                <div className="text-center">
                    <button onClick={handleMatch} disabled={isMatchDisabled} className="group w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-sky-500 to-cyan-500 text-white font-bold text-lg rounded-xl shadow-lg hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-sky-500/50 disabled:from-slate-400 disabled:to-slate-400 disabled:cursor-not-allowed transition-all transform hover:scale-105 disabled:scale-100">
                        <MagicWandIcon className="w-6 h-6 transition-transform group-hover:rotate-12" />
                        {isLoading ? 'Comparing...' : 'Compare Sheets'}
                    </button>
                </div>
            </AnimatedSection>

            {isLoading && !results && Object.keys(uploadProgress).length === 0 && (
                <div className="flex justify-center items-center p-10">
                    <div className="animate-spin rounded-full h-20 w-20 border-t-4 border-b-4 border-sky-500"></div>
                    <p className="ml-4 text-slate-600 font-semibold">Comparing Sheets...</p>
                </div>
            )}

            <AnimatedSection isVisible={!!results}>
                <div>
                    <h2 className="text-3xl sm:text-4xl font-extrabold text-center text-transparent bg-clip-text bg-gradient-to-r from-sky-500 to-cyan-500 mb-6 pb-1">Comparison Complete</h2>
                    
                    {results?.stats && (
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8 max-w-5xl mx-auto">
                            <div className="p-4 rounded-xl shadow-md text-center border-2 bg-white/80 border-slate-100">
                                <p className="text-sm uppercase font-bold tracking-wider text-slate-500">Total Rows</p>
                                <p className="text-4xl font-extrabold mt-2 text-slate-800">{results.stats.total.toLocaleString()}</p>
                            </div>
                            <div className="p-4 rounded-xl shadow-md text-center border-2 bg-emerald-50 border-emerald-400 ring-4 ring-emerald-100">
                                <p className="text-sm uppercase font-bold tracking-wider text-emerald-600">Exact Match</p>
                                <p className="text-4xl font-extrabold text-emerald-600 mt-2">{results.stats.matched.toLocaleString()}</p>
                            </div>
                            <div className="p-4 rounded-xl shadow-md text-center border-2 bg-rose-50 border-rose-400 ring-4 ring-rose-100">
                                <p className="text-sm uppercase font-bold tracking-wider text-rose-600">Differences</p>
                                <p className="text-4xl font-extrabold text-rose-600 mt-2">{results.stats.differences.toLocaleString()}</p>
                            </div>
                            <div className="p-4 rounded-xl shadow-md text-center border-2 bg-amber-50 border-amber-400 ring-4 ring-amber-100">
                                <p className="text-sm uppercase font-bold tracking-wider text-amber-600">Missing in B</p>
                                <p className="text-4xl font-extrabold text-amber-600 mt-2">{results.stats.missing.toLocaleString()}</p>
                            </div>
                        </div>
                    )}

                    <ResultsTable data={results?.data || []} highlightCells={results?.highlightCells} />
                    
                    <div className="text-center pt-8">
                        <button onClick={handleDownload} className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 bg-teal-600 text-white font-bold text-lg rounded-xl shadow-lg hover:bg-teal-700 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-teal-500/50 disabled:bg-slate-400 disabled:cursor-not-allowed transition-all transform hover:scale-105 disabled:scale-100">
                            <DownloadIcon className="w-6 h-6" />
                            Download Results
                        </button>
                    </div>
                </div>
            </AnimatedSection>
        </div>
    );
};

export default SheetMatchingTool;
