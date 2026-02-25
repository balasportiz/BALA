import React, { useState, useMemo, useCallback } from 'react';
import type { ExcelData, ColumnSelectionA, ColumnSelectionB } from '../types';
import { parseExcelFile, exportToExcel } from '../services/excelService';
import FileUploader from './FileUploader';
import ColumnSelector from './ColumnSelector';
import ResultsTable from './ResultsTable';
import Slider from './Slider';
import StepIndicator from './StepIndicator';
import { DownloadIcon, MagicWandIcon, AlertIcon } from './Icons';

type MatchMode = 'exact' | 'normalized' | 'fuzzy';

const AnimatedSection: React.FC<{ isVisible: boolean; children: React.ReactNode; className?: string }> = ({ isVisible, children, className = '' }) => (
    <div className={`${className} transition-all duration-700 ease-in-out ${isVisible ? 'opacity-100 max-h-[5000px]' : 'opacity-0 max-h-0 overflow-hidden'}`}>
      {children}
    </div>
);

const VLookupTool: React.FC = () => {
    const [fileA, setFileA] = useState<ExcelData | null>(null);
    const [dataSourceCount, setDataSourceCount] = useState(1);
    const [dataSources, setDataSources] = useState<(ExcelData | null)[]>([null]);

    const [selectionA, setSelectionA] = useState<ColumnSelectionA>({ sheet: '', column: null });
    const [dataSourceSelections, setDataSourceSelections] = useState<ColumnSelectionB[]>([{ sheet: '', lookupColumn: null, returnColumns: [] }]);
    
    const [mergedData, setMergedData] = useState<string[][] | null>(null);
    const [stats, setStats] = useState<{ total: number; matched: number; unmatched: number } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [matchMode, setMatchMode] = useState<MatchMode>('normalized');
    const [matchTolerance, setMatchTolerance] = useState<number>(1);
    const [uploadProgress, setUploadProgress] = useState<{ [id: string]: number }>({});

    const handleDataSourceCountChange = (count: number) => {
        const newCount = Math.max(1, Math.min(10, count)); // Cap at 10 for sanity
        setDataSourceCount(newCount);

        setDataSources(current => {
            const newArr = [...current];
            newArr.length = newCount;
            if (newCount > current.length) {
                newArr.fill(null, current.length);
            }
            return newArr;
        });

        setDataSourceSelections(current => {
            const newArr = [...current];
            newArr.length = newCount;
            const initialSelection = { sheet: '', lookupColumn: null, returnColumns: [] };
            if (newCount > current.length) {
                newArr.fill(initialSelection, current.length);
            }
            return newArr;
        });
        setMergedData(null); // Reset results
        setStats(null);
    };

    const handleFile = useCallback(async (file: File, type: 'A' | 'B', index: number = 0) => {
        const uploaderId = type === 'A' ? 'file-a' : `file-b-${index}`;
        setIsLoading(true);
        setError(null);
        setMergedData(null);
        setStats(null);

        const progressCallback = (progress: number) => {
            setUploadProgress(prev => ({ ...prev, [uploaderId]: progress }));
        };
        
        if (type === 'A') {
            setFileA(null);
        } else {
             setDataSources(current => {
                const newArr = [...current];
                newArr[index] = null;
                return newArr;
            });
        }

        try {
            const data = await parseExcelFile(file, progressCallback);
            if (type === 'A') {
                setFileA(data);
                setSelectionA({ sheet: '', column: null });
            } else {
                setDataSources(current => {
                    const newArr = [...current];
                    newArr[index] = data;
                    return newArr;
                });
                setDataSourceSelections(current => {
                    const newArr = [...current];
                    newArr[index] = { sheet: '', lookupColumn: null, returnColumns: [] };
                    return newArr;
                });
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to parse the Excel file. Please ensure it is a valid .xlsx or .xls file.';
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

    const handleDataSourceSelectionChange = (index: number, newSelection: ColumnSelectionB) => {
        setDataSourceSelections(current => {
            const newArr = [...current];
            newArr[index] = newSelection;
            return newArr;
        });
    };

    const handleMerge = useCallback(() => {
        if (!fileA || !selectionA.sheet || selectionA.column === null) {
            setError('Please select your main lookup file and configure its columns.');
            return;
        }
        if (dataSources.some(ds => ds === null)) {
            setError('Please upload all required data source files.');
            return;
        }
        if (dataSourceSelections.some(sel => !sel.sheet || sel.lookupColumn === null || !sel.returnColumns || sel.returnColumns.length === 0)) {
            setError('Please configure all sheets and columns for your data source files.');
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
        
        const getComparisonKey = (value: string, mode: 'exact' | 'normalized'): string => {
            let key = String(value || '');
            if (mode === 'exact') {
                return key.replace(/\s+/g, ' ').trim();
            }
            if (/^-?\d*\.?\d+$/.test(key)) {
                key = String(parseFloat(key));
            }
            return key.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/gi, '');
        };

        setTimeout(() => {
            try {
                const sheetAData = fileA.sheets[selectionA.sheet!];
                if (!sheetAData || sheetAData.length === 0) throw new Error(`Sheet "${selectionA.sheet}" in File A is empty.`);
                if (selectionA.column! >= (sheetAData[0]?.length ?? 0)) throw new Error(`Invalid lookup column for File A.`);
                const headerA = sheetAData[0];
                const dataA = sheetAData.slice(1);
                const mapNormalizationMode = matchMode === 'exact' ? 'exact' : 'normalized';
                const lookupMaps = dataSources.map((dataSource, index) => {
                    if (!dataSource) return new Map<string, string[]>();
                    const selection = dataSourceSelections[index];
                    const sheetData = dataSource.sheets[selection.sheet!];
                    const fileId = `Data Source ${String.fromCharCode(66 + index)}`;
                    if (!sheetData || sheetData.length === 0) throw new Error(`Sheet "${selection.sheet}" in ${fileId} is empty.`);
                    if (selection.lookupColumn! >= (sheetData[0]?.length ?? 0)) throw new Error(`Invalid lookup column in ${fileId}.`);
                    if (selection.returnColumns.some(col => col >= (sheetData[0]?.length ?? 0))) throw new Error(`Invalid return column in ${fileId}.`);
                    
                    const lookupMap = new Map<string, string[]>();
                    for (const row of sheetData.slice(1)) {
                        const key = row[selection.lookupColumn!];
                        const values = selection.returnColumns.map(colIndex => row[colIndex]);
                        if (key) {
                           const finalKey = getComparisonKey(key, mapNormalizationMode);
                           if (!lookupMap.has(finalKey)) {
                               lookupMap.set(finalKey, values);
                           }
                        }
                    }
                    return lookupMap;
                });

                const newHeaders = [...headerA];
                dataSources.forEach((dataSource, index) => {
                    if (!dataSource) return;
                    const selection = dataSourceSelections[index];
                    const sheetData = dataSource.sheets[selection.sheet!];
                    selection.returnColumns.forEach(colIndex => {
                        const returnColumnHeader = sheetData[0][colIndex];
                        newHeaders.push(`Matched_${returnColumnHeader}`);
                    });
                });

                let matchedCount = 0;
                let unmatchedCount = 0;

                const resultData = dataA.map(row => {
                    const lookupValue = row[selectionA.column!];
                    const newRow = [...row];
                    let hasAnyMatch = false;

                    lookupMaps.forEach((lookupMap, index) => {
                        const selection = dataSourceSelections[index];
                        let matchedValues = Array(selection.returnColumns.length).fill('N/A');
                        if (lookupValue) {
                            if (matchMode === 'fuzzy') {
                                const normalizedLookup = getComparisonKey(lookupValue, 'normalized');
                                let minDistance = Infinity;
                                let bestMatchKey: string | null = null;
                                for (const key of lookupMap.keys()) {
                                    const distance = levenshteinDistance(normalizedLookup, key);
                                    if (distance < minDistance) {
                                        minDistance = distance;
                                        bestMatchKey = key;
                                    }
                                    if (minDistance === 0) break;
                                }
                                if (bestMatchKey !== null && minDistance <= matchTolerance) {
                                    matchedValues = lookupMap.get(bestMatchKey) ?? Array(selection.returnColumns.length).fill('N/A');
                                    hasAnyMatch = true;
                                }
                            } else {
                                const finalLookupValue = getComparisonKey(lookupValue, matchMode);
                                if (lookupMap.has(finalLookupValue)) {
                                    matchedValues = lookupMap.get(finalLookupValue)!;
                                    hasAnyMatch = true;
                                }
                            }
                        }
                        newRow.push(...matchedValues);
                    });

                    if (hasAnyMatch) {
                        matchedCount++;
                    } else {
                        unmatchedCount++;
                    }

                    return newRow;
                });

                if (matchedCount === 0) {
                    setError('No matches were found. Please check your column selections or try a different matching logic (e.g., Normalized or Fuzzy).');
                }

                setStats({
                    total: dataA.length,
                    matched: matchedCount,
                    unmatched: unmatchedCount
                });

                setMergedData([newHeaders, ...resultData]);
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'An error occurred during the merge process.';
                setError(errorMessage);
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        }, 50);
    }, [fileA, dataSources, selectionA, dataSourceSelections, matchMode, matchTolerance]);

    const handleDownload = () => {
        if (!mergedData) {
            setError('No data available to download.');
            return;
        }
        exportToExcel(mergedData, 'VLookup_Results.xlsx');
    };

    const filesUploaded = fileA && dataSources.every(ds => ds !== null);
    
    let currentStep = 1;
    if (filesUploaded) currentStep = 2;
    if (mergedData) currentStep = 3;

    const isMergeDisabled = useMemo(() => {
        if (isLoading || !fileA || !selectionA.sheet || selectionA.column === null) return true;
        if (dataSources.some(ds => ds === null)) return true;
        if (dataSourceSelections.some(sel => !sel.sheet || sel.lookupColumn === null || !sel.returnColumns || sel.returnColumns.length === 0)) return true;
        return false;
    }, [isLoading, fileA, dataSources, selectionA, dataSourceSelections]);

    const isDownloadDisabled = useMemo(() => isLoading || !mergedData, [isLoading, mergedData]);

    return (
        <div className="space-y-12">
            <StepIndicator currentStep={currentStep} />
            
            <section>
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12 items-start">
                    <div className="lg:col-span-2">
                        <FileUploader 
                            id="file-a" 
                            title="Lookup File" 
                            subtitle="This is your main file (File A)"
                            onFileSelect={(file) => handleFile(file, 'A')} 
                            progress={uploadProgress['file-a']}
                        />
                    </div>
                    <div className="lg:col-span-3">
                        <div className="bg-white/60 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300 p-6 w-full">
                            <div className="flex flex-col sm:flex-row items-center justify-between mb-4 gap-4">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800">Data Sources</h3>
                                    <p className="text-sm text-slate-500">Files containing the data to lookup (File B, C...)</p>
                                </div>
                                <div className="flex items-center gap-2 self-start sm:self-center">
                                    <label htmlFor="data-source-count" className="text-sm font-medium text-slate-600">Files:</label>
                                    <select
                                        id="data-source-count"
                                        value={dataSourceCount}
                                        onChange={(e) => handleDataSourceCountChange(parseInt(e.target.value))}
                                        className="p-2 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                                    >
                                        {Array.from({ length: 10 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-4">
                                {Array.from({ length: dataSourceCount }).map((_, index) => (
                                    <FileUploader 
                                        key={`uploader-b-${index}`}
                                        id={`file-b-${index}`} 
                                        title={`Data Source ${String.fromCharCode(66 + index)}`} 
                                        onFileSelect={(file) => handleFile(file, 'B', index)} 
                                        progress={uploadProgress[`file-b-${index}`]}
                                        compact
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>
            
            <AnimatedSection isVisible={filesUploaded && !mergedData}>
                <div className="bg-white/60 backdrop-blur-sm border border-slate-200 p-6 rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4">
                        <h2 className="text-2xl font-bold text-slate-800">Configure Columns & Logic</h2>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full sm:w-auto">
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <label htmlFor="match-mode" className="text-sm font-medium text-slate-600 whitespace-nowrap">Matching Logic:</label>
                                <select
                                    id="match-mode"
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
                                    id="fuzzy-tolerance"
                                    label="Tolerance"
                                    min={0} max={5} step={1}
                                    value={matchTolerance}
                                    onChange={setMatchTolerance}
                                />
                            )}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {fileA && <ColumnSelector fileData={fileA} selection={selectionA} setSelection={(sel) => setSelectionA(sel as ColumnSelectionA)} type="A" fileIdentifier="A"/>}
                        {dataSources.map((dataSource, index) => dataSource && <ColumnSelector key={`selector-b-${index}`} fileData={dataSource} selection={dataSourceSelections[index]} setSelection={(sel) => handleDataSourceSelectionChange(index, sel as ColumnSelectionB)} type="B" fileIdentifier={String.fromCharCode(66 + index)} />)}
                    </div>
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
            
            <AnimatedSection isVisible={filesUploaded && !mergedData}>
                    <div className="text-center">
                        <button onClick={handleMerge} disabled={isMergeDisabled} className="group w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-sky-500 to-cyan-500 text-white font-bold text-lg rounded-xl shadow-lg hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-sky-500/50 disabled:from-slate-400 disabled:to-slate-400 disabled:cursor-not-allowed transition-all transform hover:scale-105 disabled:scale-100">
                        <MagicWandIcon className="w-6 h-6 transition-transform group-hover:rotate-12" />
                        {isLoading ? 'Processing...' : 'Work Your Magic'}
                    </button>
                </div>
            </AnimatedSection>

            {isLoading && !mergedData && Object.keys(uploadProgress).length === 0 && (
                <div className="flex justify-center items-center p-10">
                    <div className="animate-spin rounded-full h-20 w-20 border-t-4 border-b-4 border-sky-500"></div>
                    <p className="ml-4 text-slate-600 font-semibold">Performing V-Lookup Magic...</p>
                </div>
            )}

            <AnimatedSection isVisible={!!mergedData}>
                <div>
                    <h2 className="text-3xl sm:text-4xl font-extrabold text-center text-transparent bg-clip-text bg-gradient-to-r from-sky-500 to-cyan-500 mb-6 pb-1">Voilà! Your Merged Data is Ready.</h2>
                    
                    {stats && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 max-w-4xl mx-auto">
                            <div className="p-4 rounded-xl shadow-md text-center border-2 bg-white/80 border-slate-100">
                                <p className="text-sm uppercase font-bold tracking-wider text-slate-500">Total Rows</p>
                                <p className="text-4xl font-extrabold mt-2 text-slate-800">{stats.total.toLocaleString()}</p>
                            </div>
                            <div className="p-4 rounded-xl shadow-md text-center border-2 bg-emerald-50 border-emerald-400 ring-4 ring-emerald-100">
                                <p className="text-sm uppercase font-bold tracking-wider text-emerald-600">Successfully Matched</p>
                                <p className="text-4xl font-extrabold text-emerald-600 mt-2">{stats.matched.toLocaleString()}</p>
                            </div>
                            <div className="p-4 rounded-xl shadow-md text-center border-2 bg-amber-50 border-amber-400 ring-4 ring-amber-100">
                                <p className="text-sm uppercase font-bold tracking-wider text-amber-600">Unmatched (N/A)</p>
                                <p className="text-4xl font-extrabold text-amber-600 mt-2">{stats.unmatched.toLocaleString()}</p>
                            </div>
                        </div>
                    )}

                    <ResultsTable data={mergedData!} />
                    <div className="text-center pt-8">
                        <button onClick={handleDownload} disabled={isDownloadDisabled} className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 bg-teal-600 text-white font-bold text-lg rounded-xl shadow-lg hover:bg-teal-700 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-teal-500/50 disabled:bg-slate-400 disabled:cursor-not-allowed transition-all transform hover:scale-105 disabled:scale-100">
                            <DownloadIcon className="w-6 h-6" />
                            Download Results
                        </button>
                    </div>
                </div>
            </AnimatedSection>
        </div>
    );
};

export default VLookupTool;