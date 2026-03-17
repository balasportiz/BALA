import React, { useState, useCallback } from 'react';
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

const SequenceFinderTool: React.FC = () => {
    const [file, setFile] = useState<ExcelData | null>(null);
    const [sheet, setSheet] = useState<string>('');
    const [column, setColumn] = useState<number | null>(null);

    const [results, setResults] = useState<{
        data: string[][];
        stats: { totalSequences: number; totalNumbers: number; singleNumbers: number };
    } | null>(null);

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);

    const handleFile = useCallback(async (selectedFile: File) => {
        setIsLoading(true);
        setError(null);
        setResults(null);
        setUploadProgress(0);

        try {
            const data = await parseExcelFile(selectedFile, setUploadProgress);
            setFile(data);
            setSheet('');
            setColumn(null);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to parse the Excel file.';
            setError(errorMessage);
            console.error(err);
        } finally {
            setIsLoading(false);
            setUploadProgress(0);
        }
    }, []);

    const headers = file && sheet ? file.sheets[sheet][0] || [] : [];

    const handleFindSequences = useCallback(() => {
        if (!file || !sheet || column === null) {
            setError('Please configure the file, sheet, and column.');
            return;
        }

        setIsLoading(true);
        setError(null);

        setTimeout(() => {
            try {
                const data = file.sheets[sheet];
                if (data.length <= 1) throw new Error('The selected sheet is empty.');

                // Extract and parse numbers
                const rawNumbers: number[] = [];
                for (let i = 1; i < data.length; i++) {
                    const val = data[i][column];
                    if (val !== undefined && val !== null && val !== '') {
                        const num = Number(val);
                        if (!isNaN(num)) {
                            rawNumbers.push(num);
                        }
                    }
                }

                if (rawNumbers.length === 0) {
                    throw new Error('No valid numbers found in the selected column.');
                }

                // Remove duplicates and sort ascending
                const uniqueNumbers = [...new Set(rawNumbers)].sort((a, b) => a - b);

                const resultHeaders = ['Sequence', 'Start', 'End', 'Count', 'Type'];
                const resultData: string[][] = [];

                let start = uniqueNumbers[0];
                let prev = uniqueNumbers[0];
                let count = 1;
                let sequenceCount = 0;
                let singleCount = 0;

                const addResult = (s: number, p: number, c: number) => {
                    if (s === p) {
                        singleCount++;
                        resultData.push([s.toString(), s.toString(), s.toString(), '1', 'Single Number']);
                    } else {
                        sequenceCount++;
                        resultData.push([`${s} to ${p}`, s.toString(), p.toString(), c.toString(), 'Sequence']);
                    }
                };

                for (let i = 1; i < uniqueNumbers.length; i++) {
                    if (uniqueNumbers[i] === prev + 1) {
                        count++;
                        prev = uniqueNumbers[i];
                    } else {
                        addResult(start, prev, count);
                        start = uniqueNumbers[i];
                        prev = uniqueNumbers[i];
                        count = 1;
                    }
                }
                // Push the last sequence
                addResult(start, prev, count);

                setResults({
                    data: [resultHeaders, ...resultData],
                    stats: { 
                        totalSequences: sequenceCount, 
                        totalNumbers: uniqueNumbers.length,
                        singleNumbers: singleCount
                    }
                });

            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'An error occurred during sequence finding.';
                setError(errorMessage);
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        }, 50);
    }, [file, sheet, column]);

    const handleDownload = () => {
        if (!results) return;
        exportToExcel(results.data, 'Number_Sequences.xlsx');
    };

    let currentStep = 1;
    if (file) currentStep = 2;
    if (results) currentStep = 3;

    const isProcessDisabled = isLoading || !file || !sheet || column === null;

    return (
        <div className="space-y-12">
            <StepIndicator currentStep={currentStep} />
            
            <section>
                <div className="max-w-2xl mx-auto">
                    <FileUploader 
                        id="file-upload" 
                        title="Upload Excel File" 
                        subtitle="Select the file containing the numbers"
                        onFileSelect={handleFile} 
                        progress={uploadProgress}
                    />
                </div>
            </section>

            <AnimatedSection isVisible={!!file && !results}>
                <div className="max-w-2xl mx-auto bg-white/60 backdrop-blur-sm border border-slate-200 p-6 rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300">
                    <h2 className="text-2xl font-bold text-slate-800 mb-6">Configure Sequence Finder</h2>
                    
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Select Sheet</label>
                            <select 
                                value={sheet} 
                                onChange={(e) => { setSheet(e.target.value); setColumn(null); setResults(null); }}
                                className="w-full p-3 border border-slate-300 rounded-xl shadow-sm focus:ring-2 focus:ring-sky-500 bg-white"
                            >
                                <option value="">-- Choose a sheet --</option>
                                {file?.sheetNames.map(name => <option key={name} value={name}>{name}</option>)}
                            </select>
                        </div>
                        
                        {sheet && (
                            <div className="animate-fadeIn">
                                <label className="block text-sm font-medium text-slate-600 mb-1">Select Number Column</label>
                                <select 
                                    value={column ?? ''} 
                                    onChange={(e) => { setColumn(e.target.value === '' ? null : parseInt(e.target.value)); setResults(null); }}
                                    className="w-full p-3 border border-slate-300 rounded-xl shadow-sm focus:ring-2 focus:ring-sky-500 bg-white"
                                >
                                    <option value="">-- Choose column --</option>
                                    {headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i+1}`}</option>)}
                                </select>
                            </div>
                        )}
                    </div>
                </div>
            </AnimatedSection>

            {error && (
                <div className="max-w-2xl mx-auto bg-red-100 border-l-4 border-red-500 text-red-800 p-4 rounded-r-lg flex items-start shadow-md" role="alert">
                    <AlertIcon className="w-6 h-6 mr-3 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-bold">Oops! Something went wrong.</p>
                        <p className="text-sm">{error}</p>
                    </div>
                </div>
            )}

            <AnimatedSection isVisible={!!file && !results}>
                <div className="text-center">
                    <button onClick={handleFindSequences} disabled={isProcessDisabled} className="group w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-sky-500 to-cyan-500 text-white font-bold text-lg rounded-xl shadow-lg hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-sky-500/50 disabled:from-slate-400 disabled:to-slate-400 disabled:cursor-not-allowed transition-all transform hover:scale-105 disabled:scale-100 mx-auto">
                        <MagicWandIcon className="w-6 h-6 transition-transform group-hover:rotate-12" />
                        {isLoading ? 'Processing...' : 'Find Sequences'}
                    </button>
                </div>
            </AnimatedSection>

            {isLoading && !results && uploadProgress === 0 && (
                <div className="flex justify-center items-center p-10">
                    <div className="animate-spin rounded-full h-20 w-20 border-t-4 border-b-4 border-sky-500"></div>
                    <p className="ml-4 text-slate-600 font-semibold">Finding Sequences...</p>
                </div>
            )}

            <AnimatedSection isVisible={!!results}>
                <div>
                    <h2 className="text-3xl sm:text-4xl font-extrabold text-center text-transparent bg-clip-text bg-gradient-to-r from-sky-500 to-cyan-500 mb-6 pb-1">Sequences Found</h2>
                    
                    {results?.stats && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8 max-w-4xl mx-auto">
                            <div className="p-6 rounded-2xl shadow-md text-center border-2 bg-white/80 border-slate-100">
                                <p className="text-sm uppercase font-bold tracking-wider text-slate-500">Total Sequences</p>
                                <p className="text-5xl font-extrabold mt-2 text-sky-600">{results.stats.totalSequences.toLocaleString()}</p>
                            </div>
                            <div className="p-6 rounded-2xl shadow-md text-center border-2 bg-white/80 border-slate-100">
                                <p className="text-sm uppercase font-bold tracking-wider text-slate-500">Single Numbers</p>
                                <p className="text-5xl font-extrabold mt-2 text-rose-600">{results.stats.singleNumbers.toLocaleString()}</p>
                            </div>
                            <div className="p-6 rounded-2xl shadow-md text-center border-2 bg-white/80 border-slate-100">
                                <p className="text-sm uppercase font-bold tracking-wider text-slate-500">Unique Numbers</p>
                                <p className="text-5xl font-extrabold mt-2 text-indigo-600">{results.stats.totalNumbers.toLocaleString()}</p>
                            </div>
                        </div>
                    )}

                    <ResultsTable data={results?.data || []} />
                    
                    <div className="text-center pt-8">
                        <button onClick={handleDownload} className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 bg-teal-600 text-white font-bold text-lg rounded-xl shadow-lg hover:bg-teal-700 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-teal-500/50 disabled:bg-slate-400 disabled:cursor-not-allowed transition-all transform hover:scale-105 disabled:scale-100 mx-auto">
                            <DownloadIcon className="w-6 h-6" />
                            Download Results
                        </button>
                    </div>
                </div>
            </AnimatedSection>
        </div>
    );
};

export default SequenceFinderTool;
