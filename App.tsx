
import React, { useState, useMemo, useCallback } from 'react';
import type { ExcelData, ColumnSelectionA, ColumnSelectionB } from './types';
import { parseExcelFile, exportToExcel } from './services/excelService';
import FileUploader from './components/FileUploader';
import ColumnSelector from './components/ColumnSelector';
import ResultsTable from './components/ResultsTable';
import ToggleSwitch from './components/ToggleSwitch';
import { DownloadIcon, MergeIcon, AlertIcon } from './components/Icons';

const App: React.FC = () => {
    const [fileA, setFileA] = useState<ExcelData | null>(null);
    const [dataSourceCount, setDataSourceCount] = useState(1);
    const [dataSources, setDataSources] = useState<(ExcelData | null)[]>([null]);

    const [selectionA, setSelectionA] = useState<ColumnSelectionA>({ sheet: '', column: null });
    const [dataSourceSelections, setDataSourceSelections] = useState<ColumnSelectionB[]>([{ sheet: '', lookupColumn: null, returnColumn: null }]);
    
    const [mergedData, setMergedData] = useState<string[][] | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isCaseSensitive, setIsCaseSensitive] = useState<boolean>(false);
    const [uploadProgress, setUploadProgress] = useState<{ [id: string]: number }>({});
    
    // Validation State
    const [validateDuplicates, setValidateDuplicates] = useState<boolean>(false);
    const [validateReturnType, setValidateReturnType] = useState<'any' | 'number'>('any');

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
        // Basic configuration checks
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
                
                // --- DATA VALIDATION ---
                if (validateDuplicates) {
                    const lookupColumnIndex = selectionA.column!;
                    const seenValues = new Set<string>();
                    const duplicates = new Set<string>();
                    for (const row of dataA) {
                        const value = isCaseSensitive ? row[lookupColumnIndex] : row[lookupColumnIndex].toLowerCase();
                        if(value) { // Only check non-empty values
                           if (seenValues.has(value)) {
                                duplicates.add(`"${value}"`);
                            } else {
                                seenValues.add(value);
                            } 
                        }
                    }
                    if (duplicates.size > 0) {
                        throw new Error(`Validation Error in File A: Duplicate lookup values found: ${Array.from(duplicates).slice(0, 5).join(', ')}...`);
                    }
                }

                const lookupMaps = dataSources.map((dataSource, index) => {
                    if (!dataSource) return new Map<string, string>(); // Should not happen
                    const selection = dataSourceSelections[index];
                    const sheetData = dataSource.sheets[selection.sheet!];
                    const fileId = `Data Source ${String.fromCharCode(66 + index)} (${dataSource.fileName})`;

                    if (!sheetData || sheetData.length === 0) throw new Error(`Sheet "${selection.sheet}" in ${fileId} is empty.`);
                    const headerLength = sheetData[0]?.length ?? 0;
                    if (selection.lookupColumn! >= headerLength) throw new Error(`Invalid lookup column in ${fileId}. The sheet only has ${headerLength} columns.`);
                    if (selection.returnColumn! >= headerLength) throw new Error(`Invalid return column in ${fileId}. The sheet only has ${headerLength} columns.`);
                    
                    const dataB = sheetData.slice(1);

                    // --- RETURN TYPE VALIDATION ---
                    if (validateReturnType === 'number') {
                        const returnColIndex = selection.returnColumn!;
                        for (let i = 0; i < dataB.length; i++) {
                            const value = dataB[i][returnColIndex];
                            if (value && value.trim() !== '') {
                                const numericValue = String(value).replace(/,/g, '');
                                const isNumber = !isNaN(parseFloat(numericValue)) && isFinite(Number(numericValue));
                                if (!isNumber) {
                                    throw new Error(`Validation Error in ${dataSource.fileName} (Sheet: ${selection.sheet!}, Row: ${i + 2}): Expected a number, but found "${value}".`);
                                }
                            }
                        }
                    }
                    
                    const lookupMap = new Map<string, string>();
                    for (const row of dataB) {
                        const key = row[selection.lookupColumn!];
                        const value = row[selection.returnColumn!];
                        if (key) {
                            const finalKey = isCaseSensitive ? key : key.toLowerCase();
                            lookupMap.set(finalKey, value);
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
                    const finalLookupValue = lookupValue ? (isCaseSensitive ? lookupValue : lookupValue.toLowerCase()) : '';
                    const newRow = [...row];
                    lookupMaps.forEach(lookupMap => {
                        const matchedValue = lookupMap.get(finalLookupValue) ?? 'N/A';
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
    }, [fileA, dataSources, selectionA, dataSourceSelections, isCaseSensitive, validateDuplicates, validateReturnType]);

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
    
    const showConfig = fileA && dataSources.some(ds => ds !== null);

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
                
                {showConfig && (
                    <div className="bg-white p-6 rounded-lg shadow-md mb-8">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4">
                            <h2 className="text-2xl font-semibold text-gray-800 mb-2 sm:mb-0">Step 3: Configure Columns</h2>
                             <ToggleSwitch
                                id="case-sensitive-toggle"
                                label="Case-Sensitive Matching"
                                checked={isCaseSensitive}
                                onChange={setIsCaseSensitive}
                            />
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
                
                {showConfig && (
                    <div className="bg-white p-6 rounded-lg shadow-md mb-8">
                        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Step 4: Validation Options <span className="text-base font-normal text-gray-500">(Optional)</span></h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                                <span className="text-sm font-medium text-gray-700">Check for duplicate lookup values in File A</span>
                                <ToggleSwitch
                                    id="validate-duplicates-toggle"
                                    label=""
                                    checked={validateDuplicates}
                                    onChange={setValidateDuplicates}
                                />
                            </div>
                            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                                <label htmlFor="return-type-validation" className="text-sm font-medium text-gray-700">Ensure return values are</label>
                                <select
                                    id="return-type-validation"
                                    value={validateReturnType}
                                    onChange={(e) => setValidateReturnType(e.target.value as 'any' | 'number')}
                                    className="p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                    <option value="any">Any Type</option>
                                    <option value="number">Numeric</option>
                                </select>
                            </div>
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
