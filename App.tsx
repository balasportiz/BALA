import React, { useState, useMemo, useCallback } from 'react';
import type { ExcelData, ColumnSelectionA, ColumnSelectionB } from './types';
import { parseExcelFile, exportToExcel } from './services/excelService';
import FileUploader from './components/FileUploader';
import ColumnSelector from './components/ColumnSelector';
import ResultsTable from './components/ResultsTable';
import Slider from './components/Slider';
import { DownloadIcon, MergeIcon, AlertIcon } from './components/Icons';

type MatchMode = 'exact' | 'normalized' | 'fuzzy';

const App: React.FC = () => {
    const [fileA, setFileA] = useState<ExcelData | null>(null);
    const [dataSourceCount, setDataSourceCount] = useState(1);
    const [dataSources, setDataSources] = useState<(ExcelData | null)[]>([null]);

    const [selectionA, setSelectionA] = useState<ColumnSelectionA>({ sheet: '', column: null });
    const [dataSourceSelections, setDataSourceSelections] = useState<ColumnSelectionB[]>([{ sheet: '', lookupColumn: null, returnColumn: null }]);
    
    const [mergedData, setMergedData] = useState<string[][] | null>(null);
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
            // Fill new spots with null if array grows
            if (newCount > current.length) {
                newArr.fill(null, current.length);
            }
            return newArr;
        });

        setDataSourceSelections(current => {
            const newArr = [...current];
            newArr.length = newCount;
            const initialSelection = { sheet: '', lookupColumn: null, returnColumn: null };
            // Fill new spots with initial selection if array grows
            if (newCount > current.length) {
                newArr.fill(initialSelection, current.length);
            }
            return newArr;
        });
        setMergedData(null); // Reset results
    };

    const handleFile = useCallback(async (file: File, type: 'A' | 'B', index: number = 0) => {
        const uploaderId = type === 'A' ? 'file-a' : `file-b-${index}`;

        setIsLoading(true);
        setError(null);
        setMergedData(null);

        const progressCallback = (progress: number) => {
            setUploadProgress(prev => ({ ...prev, [uploaderId]: progress }));
        };
        
        // Reset specific file state before parsing a new one
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
                    newArr[index] = { sheet: '', lookupColumn: null, returnColumn: null };
                    return newArr;
                });
            }
        } catch (err) {
            setError('Failed to parse the Excel file. Please ensure it is a valid .xlsx or .xls file.');
            console.error(err);
        } finally {
            setIsLoading(false);
            // Clear progress for this uploader
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
            setError('Please select File A and configure its columns.');
            return;
        }
        if (dataSources.some(ds => ds === null)) {
            setError('Please upload all required data source files.');
            return;
        }
        if (dataSourceSelections.some(sel => !sel.sheet || sel.lookupColumn === null || sel.returnColumn === null)) {
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
                        matrix[j][i - 1] + 1,        // deletion
                        matrix[j - 1][i] + 1,        // insertion
                        matrix[j - 1][i - 1] + cost, // substitution
                    );
                }
            }
            return matrix[b.length][a.length];
        };
        
        const getComparisonKey = (value: string, mode: 'exact' | 'normalized'): string => {
            let key = value; // The value is already a trimmed string from excelService.
            if (mode === 'exact') {
                return key.replace(/\s+/g, ' ');
            }

            // 'normalized' mode is used for both Normalized and Fuzzy matching
            if (/^-?\d*\.?\d+$/.test(key)) {
                key = String(parseFloat(key));
            }

            return key
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase()
                .replace(/[^a-z0-9]/gi, '');
        };

        setTimeout(() => {
            try {
                const sheetAData = fileA.sheets[selectionA.sheet!];
                if (!sheetAData || sheetAData.length === 0) {
                    throw new Error(`Sheet "${selectionA.sheet}" in File A (${fileA.fileName}) is empty.`);
                }
                const headerLengthA = sheetAData[0]?.length ?? 0;
                if (selectionA.column! >= headerLengthA) {
                    throw new Error(`Invalid lookup column selection for File A (${fileA.fileName}). The sheet only has ${headerLengthA} columns.`);
                }

                const headerA = sheetAData[0];
                const dataA = sheetAData.slice(1);

                const mapNormalizationMode = matchMode === 'exact' ? 'exact' : 'normalized';
                const lookupMaps = dataSources.map((dataSource, index) => {
                    if (!dataSource) return new Map<string, string>(); // Should not happen due to initial checks
                    const selection = dataSourceSelections[index];
                    const sheetData = dataSource.sheets[selection.sheet!];
                    const fileId = `Data Source ${String.fromCharCode(66 + index)} (${dataSource.fileName})`;

                    if (!sheetData || sheetData.length === 0) {
                        throw new Error(`Sheet "${selection.sheet}" in ${fileId} is empty.`);
                    }

                    const headerLength = sheetData[0]?.length ?? 0;
                    if (selection.lookupColumn! >= headerLength) {
                        throw new Error(`Invalid lookup column in ${fileId}. The sheet only has ${headerLength} columns.`);
                    }
                    if (selection.returnColumn! >= headerLength) {
                        throw new Error(`Invalid return column in ${fileId}. The sheet only has ${headerLength} columns.`);
                    }
                    
                    const lookupMap = new Map<string, string>();
                    for (const row of sheetData.slice(1)) {
                        const key = row[selection.lookupColumn!];
                        const value = row[selection.returnColumn!];
                        if (key) {
                           const finalKey = getComparisonKey(key, mapNormalizationMode);
                           if (!lookupMap.has(finalKey)) {
                               lookupMap.set(finalKey, value);
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
                    const returnColumnHeader = sheetData[0][selection.returnColumn!];
                    newHeaders.push(`Matched_${dataSource.fileName.split('.')[0]}_${returnColumnHeader}`);
                });

                const resultData = dataA.map(row => {
                    const lookupValue = row[selectionA.column!];
                    const newRow = [...row];
                    
                    lookupMaps.forEach(lookupMap => {
                        let matchedValue = 'N/A';
                        if (matchMode === 'fuzzy') {
                            const normalizedLookup = getComparisonKey(lookupValue, 'normalized');
                            if (normalizedLookup) {
                                let minDistance = Infinity;
                                let bestMatchKey: string | null = null;
                                for (const key of lookupMap.keys()) {
                                    const distance = levenshteinDistance(normalizedLookup, key);
                                    if (distance < minDistance) {
                                        minDistance = distance;
                                        bestMatchKey = key;
                                    }
                                    if (minDistance === 0) break; // Perfect match found
                                }
                                if (bestMatchKey !== null && minDistance <= matchTolerance) {
                                    matchedValue = lookupMap.get(bestMatchKey) ?? 'N/A';
                                }
                            }
                        } else {
                            const finalLookupValue = getComparisonKey(lookupValue, matchMode);
                            matchedValue = lookupMap.get(finalLookupValue) ?? 'N/A';
                        }
                        newRow.push(matchedValue);
                    });
                    return newRow;
                });

                setMergedData([newHeaders, ...resultData]);
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'An error occurred during the merge process. Please check your column selections and file contents.';
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

    const isMergeDisabled = useMemo(() => {
        if (isLoading || !fileA || !selectionA.sheet || selectionA.column === null) return true;
        if (dataSources.some(ds => ds === null)) return true;
        if (dataSourceSelections.some(sel => !sel.sheet || sel.lookupColumn === null || sel.returnColumn === null)) return true;
        return false;
    }, [isLoading, fileA, dataSources, selectionA, dataSourceSelections]);

    const isDownloadDisabled = useMemo(() => {
        return isLoading || !mergedData;
    }, [isLoading, mergedData]);

    return (
        <div className="min-h-screen bg-gray-50 text-gray-800 p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
                <header className="text-center mb-8">
                    <h1 className="text-4xl sm:text-5xl font-bold text-gray-900">Excel V-Lookup Assistant</h1>
                    <p className="mt-2 text-lg text-gray-600">Merge data between multiple Excel sheets, effortlessly.</p>
                </header>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <FileUploader 
                        id="file-a" 
                        title="Step 1: Upload Lookup File (File A)" 
                        onFileSelect={(file) => handleFile(file, 'A')} 
                        progress={uploadProgress['file-a']}
                    />
                    <div className="space-y-4">
                        <div className="bg-white p-6 rounded-lg shadow-md w-full">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-800">Step 2: Upload Data Source File(s)</h3>
                                <div className="flex items-center gap-2">
                                    <label htmlFor="data-source-count" className="text-sm font-medium text-gray-700">How many?</label>
                                    <select
                                        id="data-source-count"
                                        value={dataSourceCount}
                                        onChange={(e) => handleDataSourceCountChange(parseInt(e.target.value))}
                                        className="p-1 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                    >
                                        {Array.from({ length: 10 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
                                    </select>
                                </div>
                            </div>
                            {Array.from({ length: dataSourceCount }).map((_, index) => (
                                <div key={`uploader-container-${index}`} className={index > 0 ? 'mt-4' : ''}>
                                    <FileUploader 
                                        id={`file-b-${index}`} 
                                        title={`Data Source ${String.fromCharCode(66 + index)}`} 
                                        onFileSelect={(file) => handleFile(file, 'B', index)} 
                                        progress={uploadProgress[`file-b-${index}`]}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                
                {fileA && dataSources.some(ds => ds !== null) && (
                    <div className="bg-white p-6 rounded-lg shadow-md mb-8">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-4">
                            <h2 className="text-2xl font-semibold text-gray-800 mb-2 sm:mb-0">Step 3: Configure Columns</h2>
                             <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <label htmlFor="match-mode" className="text-sm font-medium text-gray-700 whitespace-nowrap">Matching Logic:</label>
                                    <select
                                        id="match-mode"
                                        value={matchMode}
                                        onChange={(e) => setMatchMode(e.target.value as MatchMode)}
                                        className="p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                    >
                                        <option value="normalized">Normalized (Case-Insensitive)</option>
                                        <option value="fuzzy">Fuzzy (Approximate)</option>
                                        <option value="exact">Exact (Case-Sensitive)</option>
                                    </select>
                                </div>
                                {matchMode === 'fuzzy' && (
                                    <Slider
                                        id="fuzzy-tolerance"
                                        label="Match Tolerance"
                                        min={0}
                                        max={5}
                                        step={1}
                                        value={matchTolerance}
                                        onChange={setMatchTolerance}
                                    />
                                )}
                             </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {fileA && (
                                <ColumnSelector 
                                    fileData={fileA} 
                                    selection={selectionA} 
                                    setSelection={(sel) => setSelectionA(sel as ColumnSelectionA)}
                                    type="A" 
                                    fileIdentifier="A"
                                />
                            )}
                            {dataSources.map((dataSource, index) => 
                                dataSource && (
                                    <ColumnSelector 
                                        key={`selector-b-${index}`}
                                        fileData={dataSource}
                                        selection={dataSourceSelections[index]}
                                        setSelection={(sel) => handleDataSourceSelectionChange(index, sel as ColumnSelectionB)}
                                        type="B"
                                        fileIdentifier={String.fromCharCode(66 + index)}
                                    />
                                )
                            )}
                        </div>
                    </div>
                )}

                {error && (
                    <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-8 rounded-md flex items-center" role="alert">
                        <AlertIcon className="w-6 h-6 mr-3" />
                        <div>
                          <p className="font-bold">Error</p>
                          <p>{error}</p>
                        </div>
                    </div>
                )}
                
                <div className="bg-white p-6 rounded-lg shadow-md mb-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                    <button 
                        onClick={handleMerge} 
                        disabled={isMergeDisabled}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                        <MergeIcon className="w-5 h-5" />
                        {isLoading ? 'Processing...' : 'Run V-Lookup'}
                    </button>
                    <button 
                        onClick={handleDownload}
                        disabled={isDownloadDisabled}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                        <DownloadIcon className="w-5 h-5" />
                        Download Results
                    </button>
                </div>
                
                {isLoading && !mergedData && Object.keys(uploadProgress).length === 0 && (
                    <div className="flex justify-center items-center p-8">
                        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-500"></div>
                    </div>
                )}

                {mergedData && (
                    <ResultsTable data={mergedData} />
                )}
            </div>
        </div>
    );
};

export default App;