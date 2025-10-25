
import React, { useState, useMemo, useCallback } from 'react';
import type { ExcelData, ColumnSelectionA, ColumnSelectionB } from './types';
import { parseExcelFile, exportToExcel } from './services/excelService';
import FileUploader from './components/FileUploader';
import ColumnSelector from './components/ColumnSelector';
import ResultsTable from './components/ResultsTable';
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
        setIsLoading(true);
        setError(null);
        setMergedData(null);
        try {
            const data = await parseExcelFile(file);
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

        setTimeout(() => {
            try {
                const sheetAData = fileA.sheets[selectionA.sheet!];
                const headerA = sheetAData[0];
                const dataA = sheetAData.slice(1);

                const lookupMaps = dataSources.map((dataSource, index) => {
                    if (!dataSource) return new Map<string, string>();
                    const selection = dataSourceSelections[index];
                    const sheetData = dataSource.sheets[selection.sheet!];
                    const lookupMap = new Map<string, string>();
                    for (const row of sheetData.slice(1)) {
                        const key = row[selection.lookupColumn!];
                        const value = row[selection.returnColumn!];
                        if (key !== undefined && key !== null) {
                            lookupMap.set(String(key), value);
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
                        const matchedValue = lookupMap.get(String(lookupValue)) ?? 'N/A';
                        newRow.push(matchedValue);
                    });
                    return newRow;
                });

                setMergedData([newHeaders, ...resultData]);
            } catch (err) {
                setError('An error occurred during the merge process. Please check your column selections.');
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        }, 50);
    }, [fileA, dataSources, selectionA, dataSourceSelections]);

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
                    <FileUploader id="file-a" title="Step 1: Upload Lookup File (File A)" onFileSelect={(file) => handleFile(file, 'A')} />
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
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                
                {fileA && dataSources.some(ds => ds !== null) && (
                    <div className="bg-white p-6 rounded-lg shadow-md mb-8">
                        <h2 className="text-2xl font-semibold mb-4 text-gray-800">Step 3: Configure Columns</h2>
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
                
                {isLoading && !mergedData && (
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
