
import React, { useState, useMemo, useCallback } from 'react';
import type { ExcelData, ColumnSelection } from './types';
import { parseExcelFile, exportToExcel } from './services/excelService';
import FileUploader from './components/FileUploader';
import ColumnSelector from './components/ColumnSelector';
import ResultsTable from './components/ResultsTable';
import { DownloadIcon, MergeIcon, AlertIcon } from './components/Icons';

const App: React.FC = () => {
    const [fileA, setFileA] = useState<ExcelData | null>(null);
    const [fileB, setFileB] = useState<ExcelData | null>(null);

    const [selectionA, setSelectionA] = useState<ColumnSelection>({ sheet: '', column: null });
    const [selectionB, setSelectionB] = useState<ColumnSelection>({ sheet: '', lookupColumn: null, returnColumn: null });
    
    const [mergedData, setMergedData] = useState<string[][] | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFile = useCallback(async (file: File, setter: React.Dispatch<React.SetStateAction<ExcelData | null>>) => {
        setIsLoading(true);
        setError(null);
        setMergedData(null);
        try {
            const data = await parseExcelFile(file);
            setter(data);
        } catch (err) {
            setError('Failed to parse the Excel file. Please ensure it is a valid .xlsx or .xls file.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const handleMerge = useCallback(() => {
        if (!fileA || !fileB || !selectionA.sheet || selectionA.column === null || !selectionB.sheet || selectionB.lookupColumn === null || selectionB.returnColumn === null) {
            setError('Please select files, sheets, and all required columns before merging.');
            return;
        }

        setIsLoading(true);
        setError(null);

        // Use a timeout to allow the UI to update to the loading state
        setTimeout(() => {
            try {
                const sheetAData = fileA.sheets[selectionA.sheet];
                const sheetBData = fileB.sheets[selectionB.sheet];
                const headerA = sheetAData[0];
                const dataA = sheetAData.slice(1);

                // Create a lookup map from File B for efficiency
                const lookupMap = new Map<string, string>();
                for (const row of sheetBData.slice(1)) {
                    const key = row[selectionB.lookupColumn!];
                    const value = row[selectionB.returnColumn!];
                    if (key !== undefined && key !== null) {
                        lookupMap.set(String(key), value);
                    }
                }

                const newHeader = [...headerA, `Matched_${sheetBData[0][selectionB.returnColumn!]}`];
                
                const resultData = dataA.map(row => {
                    const lookupValue = row[selectionA.column!];
                    const matchedValue = lookupMap.get(String(lookupValue)) ?? 'N/A';
                    return [...row, matchedValue];
                });

                setMergedData([newHeader, ...resultData]);
            } catch (err) {
                setError('An error occurred during the merge process. Please check your column selections.');
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        }, 50);
    }, [fileA, fileB, selectionA, selectionB]);

    const handleDownload = () => {
        if (!mergedData) {
            setError('No data available to download.');
            return;
        }
        exportToExcel(mergedData, 'VLookup_Results.xlsx');
    };

    const isMergeDisabled = useMemo(() => {
        return isLoading || !fileA || !fileB || !selectionA.sheet || selectionA.column === null || !selectionB.sheet || selectionB.lookupColumn === null || selectionB.returnColumn === null;
    }, [isLoading, fileA, fileB, selectionA, selectionB]);

    const isDownloadDisabled = useMemo(() => {
        return isLoading || !mergedData;
    }, [isLoading, mergedData]);

    return (
        <div className="min-h-screen bg-gray-50 text-gray-800 p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
                <header className="text-center mb-8">
                    <h1 className="text-4xl sm:text-5xl font-bold text-gray-900">Excel V-Lookup Assistant</h1>
                    <p className="mt-2 text-lg text-gray-600">Merge data between two Excel sheets, effortlessly.</p>
                </header>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <FileUploader id="file-a" title="Step 1: Upload Lookup File (File A)" onFileSelect={(file) => handleFile(file, setFileA)} />
                    <FileUploader id="file-b" title="Step 2: Upload Data Source File (File B)" onFileSelect={(file) => handleFile(file, setFileB)} />
                </div>
                
                {fileA && fileB && (
                    <div className="bg-white p-6 rounded-lg shadow-md mb-8">
                        <h2 className="text-2xl font-semibold mb-4 text-gray-800">Step 3: Configure Columns</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {fileA && <ColumnSelector fileData={fileA} selection={selectionA} setSelection={setSelectionA} type="A" />}
                            {fileB && <ColumnSelector fileData={fileB} selection={selectionB} setSelection={setSelectionB} type="B" />}
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
