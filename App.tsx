import React, { useState, useMemo, useCallback } from 'react';
import type { ExcelData, ColumnSelectionA, ColumnSelectionB } from './types';
import { parseExcelFile, exportToExcel } from './services/excelService';
import FileUploader from './components/FileUploader';
import ColumnSelector from './components/ColumnSelector';
import ResultsTable from './components/ResultsTable';
import Slider from './components/Slider';
import StepIndicator from './components/StepIndicator';
import { DownloadIcon, MagicWandIcon, AlertIcon } from './components/Icons';

type MatchMode = 'exact' | 'normalized' | 'fuzzy';

const AnimatedSection: React.FC<{ isVisible: boolean; children: React.ReactNode; className?: string }> = ({ isVisible, children, className = '' }) => (
    <div className={`${className} transition-all duration-700 ease-in-out ${isVisible ? 'opacity-100 max-h-[5000px] mt-12' : 'opacity-0 max-h-0 mt-0 overflow-hidden'}`}>
      {children}
    </div>
);

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
            if (newCount > current.length) {
                newArr.fill(null, current.length);
            }
            return newArr;
        });

        setDataSourceSelections(current => {
            const newArr = [...current];
            newArr.length = newCount;
            const initialSelection = { sheet: '', lookupColumn: null, returnColumn: null };
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
                    if (!dataSource) return new Map<string, string>();
                    const selection = dataSourceSelections[index];
                    const sheetData = dataSource.sheets[selection.sheet!];
                    const fileId = `Data Source ${String.fromCharCode(66 + index)}`;
                    if (!sheetData || sheetData.length === 0) throw new Error(`Sheet "${selection.sheet}" in ${fileId} is empty.`);
                    if (selection.lookupColumn! >= (sheetData[0]?.length ?? 0)) throw new Error(`Invalid lookup column in ${fileId}.`);
                    if (selection.returnColumn! >= (sheetData[0]?.length ?? 0)) throw new Error(`Invalid return column in ${fileId}.`);
                    
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
                    newHeaders.push(`Matched_${returnColumnHeader}`);
                });

                const resultData = dataA.map(row => {
                    const lookupValue = row[selectionA.column!];
                    const newRow = [...row];
                    lookupMaps.forEach(lookupMap => {
                        let matchedValue = 'N/A';
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
                                    matchedValue = lookupMap.get(bestMatchKey) ?? 'N/A';
                                }
                            } else {
                                const finalLookupValue = getComparisonKey(lookupValue, matchMode);
                                matchedValue = lookupMap.get(finalLookupValue) ?? 'N/A';
                            }
                        }
                        newRow.push(matchedValue);
                    });
                    return newRow;
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
        if (dataSourceSelections.some(sel => !sel.sheet || sel.lookupColumn === null || sel.returnColumn === null)) return true;
        return false;
    }, [isLoading, fileA, dataSources, selectionA, dataSourceSelections]);

    const isDownloadDisabled = useMemo(() => isLoading || !mergedData, [isLoading, mergedData]);

    return (
        <div className="min-h-screen w-full bg-gradient-to-br from-white via-sky-50 to-cyan-100 text-slate-800 p-4 sm:p-6 lg:p-10">
            <div className="max-w-7xl mx-auto">
                <header className="text-center mb-10">
                    <h1 className="text-5xl sm:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-sky-500 to-cyan-500 pb-2">
                        V-Lookup Magic
                    </h1>
                    <p className="mt-2 text-lg text-slate-500 max-w-2xl mx-auto">Merge data between multiple Excel sheets, effortlessly and intelligently.</p>
                </header>

                <main>
                    <StepIndicator currentStep={currentStep} />
                    
                    <section>
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
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
                                <div className="bg-white/60 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-xl p-6 w-full">
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
                       <div className="bg-white/60 backdrop-blur-sm border border-slate-200 p-6 rounded-2xl shadow-xl">
                           <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4">
                               <h2 className="text-2xl font-bold text-slate-800">Configure Columns & Logic</h2>
                               <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                   <div className="flex items-center gap-2">
                                       <label htmlFor="match-mode" className="text-sm font-medium text-slate-600 whitespace-nowrap">Matching Logic:</label>
                                       <select
                                           id="match-mode"
                                           value={matchMode}
                                           onChange={(e) => setMatchMode(e.target.value as MatchMode)}
                                           className="p-2 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
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
                        <div className="mt-8 bg-red-100 border-l-4 border-red-500 text-red-800 p-4 rounded-r-lg flex items-center shadow-md" role="alert">
                            <AlertIcon className="w-6 h-6 mr-3 flex-shrink-0" />
                            <div>
                              <p className="font-bold">Oops! Something went wrong.</p>
                              <p className="text-sm">{error}</p>
                            </div>
                        </div>
                    )}
                    
                    <AnimatedSection isVisible={filesUploaded && !mergedData}>
                         <div className="text-center pt-8">
                             <button onClick={handleMerge} disabled={isMergeDisabled} className="group w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-sky-500 to-cyan-500 text-white font-bold text-lg rounded-xl shadow-lg hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-sky-500/50 disabled:from-slate-400 disabled:to-slate-400 disabled:cursor-not-allowed transition-all transform hover:scale-105 disabled:scale-100">
                                <MagicWandIcon className="w-6 h-6 transition-transform group-hover:rotate-12" />
                                {isLoading ? 'Processing...' : 'Work Your Magic'}
                            </button>
                        </div>
                    </AnimatedSection>

                    {isLoading && !mergedData && Object.keys(uploadProgress).length === 0 && (
                        <div className="flex justify-center items-center p-10 mt-8">
                            <div className="animate-spin rounded-full h-20 w-20 border-t-4 border-b-4 border-sky-500"></div>
                            <p className="ml-4 text-slate-600 font-semibold">Performing V-Lookup Magic...</p>
                        </div>
                    )}

                    <AnimatedSection isVisible={!!mergedData}>
                       <div>
                           <h2 className="text-3xl font-bold text-center text-slate-800 mb-4">Voilà! Your Merged Data is Ready.</h2>
                           <ResultsTable data={mergedData!} />
                           <div className="text-center pt-8">
                               <button onClick={handleDownload} disabled={isDownloadDisabled} className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 bg-teal-600 text-white font-bold text-lg rounded-xl shadow-lg hover:bg-teal-700 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-teal-500/50 disabled:bg-slate-400 disabled:cursor-not-allowed transition-all transform hover:scale-105 disabled:scale-100">
                                   <DownloadIcon className="w-6 h-6" />
                                   Download Results
                               </button>
                           </div>
                       </div>
                    </AnimatedSection>
                </main>
            </div>
        </div>
    );
};

export default App;