
import React, { useState, useCallback } from 'react';
import type { ExcelData } from '../types';
import { parseExcelFile, exportToExcel } from '../services/excelService';
import FileUploader from './FileUploader';
import ResultsTable from './ResultsTable';
import ToggleSwitch from './ToggleSwitch';
import { DownloadIcon, CalendarIcon, AlertIcon, SparklesIcon } from './Icons';

const AnimatedSection: React.FC<{ isVisible: boolean; children: React.ReactNode; className?: string }> = ({ isVisible, children, className = '' }) => (
    <div className={`${className} transition-all duration-700 ease-in-out ${isVisible ? 'opacity-100 max-h-[5000px]' : 'opacity-0 max-h-0 overflow-hidden'}`}>
      {children}
    </div>
);

const DateWizardTool: React.FC = () => {
    const [file, setFile] = useState<ExcelData | null>(null);
    const [selectedSheet, setSelectedSheet] = useState<string>('');
    const [selectedColumn, setSelectedColumn] = useState<number | null>(null);

    const [fixDateFormat, setFixDateFormat] = useState(true);
    const [calculateAge, setCalculateAge] = useState(true);

    const [processedData, setProcessedData] = useState<string[][] | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState<number | undefined>(undefined);

    const handleFile = useCallback(async (file: File) => {
        setIsLoading(true);
        setError(null);
        setProcessedData(null);
        try {
            const data = await parseExcelFile(file, setUploadProgress);
            setFile(data);
            setSelectedSheet('');
            setSelectedColumn(null);
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
        setSelectedColumn(null);
        setProcessedData(null);
    };

    const handleProcess = useCallback(() => {
        if (!file || !selectedSheet || selectedColumn === null) {
            setError('Please select a sheet and the DOB/Date column.');
            return;
        }

        setIsLoading(true);
        setError(null);

        // --- Logic Helpers ---

        const parseDate = (val: string | number): { day: number, month: number, year: number } | null => {
            if (val === undefined || val === null || val === '') return null;

            // 1. Handle Excel Serial Numbers
            if (typeof val === 'number' || !isNaN(Number(val))) {
                const serial = Number(val);
                // Excel dates usually start > 1 (1900-01-01). 
                // Sometimes headers or IDs look like numbers, ignore small ones if they don't make sense as dates (e.g. < 10000 roughly 1927).
                // But specifically for DOB, let's be permissible but careful.
                if (serial > 2000) { 
                    const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
                    return { day: date.getDate(), month: date.getMonth() + 1, year: date.getFullYear() };
                }
            }

            // 2. Handle Strings
            const dateStr = String(val).trim();
            // Regex to catch DD-MM-YYYY, MM-DD-YYYY, YYYY-MM-DD with various separators
            const match = dateStr.match(/^(\d{1,4})[\s-/.](\d{1,2})[\s-/.](\d{1,4})$/);
            if (!match) return null;

            let p1 = parseInt(match[1]); // First part
            let p2 = parseInt(match[2]); // Second part
            let p3 = parseInt(match[3]); // Third part

            let day, month, year;

            // Check if Year is at the start (YYYY-MM-DD)
            if (p1 > 31) { 
                year = p1;
                month = p2;
                day = p3;
            } else {
                // Year is at the end
                year = p3;
                // Handle 2-digit years
                if (year < 100) year += (year > 30 ? 1900 : 2000);

                // --- SMART SWAP LOGIC ---
                // The user specifically has MM-DD-YYYY (e.g., 11-28-1989) where header implies DD-MM.
                // If p2 (2nd number) > 12, it CANNOT be a month. It MUST be the day.
                // Therefore, p1 must be the month.
                
                if (fixDateFormat && p2 > 12 && p1 <= 12) {
                    day = p2;   // The big number is the day
                    month = p1; // The small number is the month
                } else {
                    // Default assumption: First is Day, Second is Month (DD-MM-YYYY)
                    // unless we want to enforce US format, but the tool is "Fixing" to DD-MM.
                    // If both are <= 12 (e.g. 05-06-1990), it's ambiguous. We leave as is (DD-MM).
                    day = p1;
                    month = p2;
                }
            }

            // Validation
            if (month > 12 || day > 31 || month < 1 || day < 1) return null;

            return { day, month, year };
        };

        const calcAge = (dob: { day: number, month: number, year: number }) => {
            const today = new Date();
            let age = today.getFullYear() - dob.year;
            const m = today.getMonth() - (dob.month - 1);
            if (m < 0 || (m === 0 && today.getDate() < dob.day)) {
                age--;
            }
            return age < 0 ? 0 : age;
        };

        const formatFixedDate = (d: { day: number, month: number, year: number }) => {
            return `${String(d.day).padStart(2, '0')}-${String(d.month).padStart(2, '0')}-${d.year}`;
        };

        setTimeout(() => {
            try {
                const sheetData = file.sheets[selectedSheet];
                if (!sheetData || sheetData.length === 0) throw new Error(`Sheet "${selectedSheet}" is empty.`);
                
                const originalHeader = sheetData[0];
                const rows = sheetData.slice(1);

                // Check if "AGE" column exists to overwrite
                const ageColumnIndex = originalHeader.findIndex(h => h && h.toLowerCase() === 'age');
                
                // Construct New Header
                const newHeader: string[] = [];
                originalHeader.forEach((h, idx) => {
                    newHeader.push(h);
                    // Insert Fixed Date Column right after the source column
                    if (idx === selectedColumn && fixDateFormat) {
                        newHeader.push('Fixed_Date_Magic');
                    }
                    // If we need to calculate age but there is no Age column, insert it after the date (and fixed date)
                    if (idx === selectedColumn && calculateAge && ageColumnIndex === -1) {
                         newHeader.push('Calculated_Age_Magic');
                    }
                });

                // Process Rows
                const newRows = rows.map(row => {
                    const newRow: string[] = [];
                    const rawVal = row[selectedColumn];
                    const dateObj = parseDate(rawVal as any);
                    
                    let fixedDateStr = 'Invalid Date';
                    let ageStr = 'N/A';

                    if (dateObj) {
                        if (fixDateFormat) fixedDateStr = formatFixedDate(dateObj);
                        if (calculateAge) ageStr = String(calcAge(dateObj));
                    } else if (!rawVal) {
                        fixedDateStr = '';
                        ageStr = '';
                    }

                    // Rebuild row based on columns
                    for (let i = 0; i < originalHeader.length; i++) {
                        let cellValue = row[i] !== undefined ? row[i] : '';
                        
                        // If this is the Age column and we found a valid age, OVERWRITE it
                        if (i === ageColumnIndex && calculateAge && dateObj) {
                            cellValue = ageStr;
                        }

                        newRow.push(cellValue);

                        // Insert Fixed Date
                        if (i === selectedColumn && fixDateFormat) {
                            newRow.push(fixedDateStr);
                        }
                        
                        // Insert Age if column didn't exist
                        if (i === selectedColumn && calculateAge && ageColumnIndex === -1) {
                            newRow.push(ageStr);
                        }
                    }
                    return newRow;
                });

                setProcessedData([newHeader, ...newRows]);
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'An error occurred while processing dates.';
                setError(errorMessage);
            } finally {
                setIsLoading(false);
            }
        }, 100);
    }, [file, selectedSheet, selectedColumn, fixDateFormat, calculateAge]);

    const handleDownload = () => {
        if (!processedData) return;
        exportToExcel(processedData, 'Date_Wizard_Results.xlsx');
    };

    const isProcessDisabled = isLoading || !file || !selectedSheet || selectedColumn === null;
    const headers = file && selectedSheet ? file.sheets[selectedSheet]?.[0] || [] : [];

    return (
        <div className="space-y-12">
             <section className="max-w-3xl mx-auto">
                <FileUploader 
                    id="date-file" 
                    title="Upload Date/DOB File" 
                    subtitle="Automatically fix MM-DD-YYYY and fill Age column"
                    onFileSelect={handleFile} 
                    progress={uploadProgress}
                />
            </section>

            <AnimatedSection isVisible={!!file && !processedData}>
                <div className="bg-white/60 backdrop-blur-sm border border-slate-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300 max-w-3xl mx-auto">
                    <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <SparklesIcon className="w-6 h-6 text-indigo-500" />
                        Configure Wizard
                    </h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Target Sheet</label>
                                <select 
                                    value={selectedSheet} 
                                    onChange={handleSheetChange}
                                    className="w-full p-2 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="">-- Choose a sheet --</option>
                                    {file?.sheetNames.map(name => <option key={name} value={name}>{name}</option>)}
                                </select>
                            </div>
                            
                            {selectedSheet && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Date of Birth / Date Column</label>
                                    <select 
                                        value={selectedColumn ?? ''} 
                                        onChange={(e) => setSelectedColumn(e.target.value === '' ? null : parseInt(e.target.value))}
                                        className="w-full p-2 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="">-- Select Column --</option>
                                        {headers.map((h, idx) => <option key={`${h}-${idx}`} value={idx}>{h || `Column ${idx+1}`}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>

                        <div className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-100 space-y-4">
                            <h4 className="font-bold text-indigo-800 text-sm uppercase tracking-wider">Magic Options</h4>
                            <ToggleSwitch 
                                id="fix-date" 
                                label="Create Fixed Date Column (DD-MM-YYYY)" 
                                checked={fixDateFormat} 
                                onChange={setFixDateFormat} 
                            />
                            <ToggleSwitch 
                                id="calc-age" 
                                label="Calculate & Fill Age" 
                                checked={calculateAge} 
                                onChange={setCalculateAge} 
                            />
                            <div className="text-xs text-slate-500 space-y-1 mt-2">
                                <p>✅ Creates a <b>new fixed column</b> next to your original date.</p>
                                <p>✅ <b>Fills the AGE column</b> if it exists, or creates one.</p>
                                <p>✅ Automatically swaps <b>MM-DD</b> to <b>DD-MM</b> if month {'>'} 12.</p>
                            </div>
                        </div>
                    </div>

                    <div className="text-center">
                        <button 
                            onClick={handleProcess} 
                            disabled={isProcessDisabled} 
                            className="group w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold text-lg rounded-xl shadow-lg hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-indigo-500/50 disabled:from-slate-400 disabled:to-slate-400 disabled:cursor-not-allowed transition-all transform hover:scale-105"
                        >
                            <CalendarIcon className="w-6 h-6" />
                            {isLoading ? 'Processing Magic...' : 'Run Date Wizard'}
                        </button>
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

            <AnimatedSection isVisible={!!processedData}>
                <div className="max-w-6xl mx-auto">
                    <h2 className="text-3xl sm:text-4xl font-extrabold text-center text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-500 mb-6 pb-1">
                        Magic Complete!
                    </h2>
                    
                    <ResultsTable data={processedData!} />
                    
                    <div className="text-center pt-8">
                        <button onClick={handleDownload} className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 bg-teal-600 text-white font-bold text-lg rounded-xl shadow-lg hover:bg-teal-700 transition-all transform hover:scale-105">
                            <DownloadIcon className="w-6 h-6" />
                            Download Results
                        </button>
                    </div>
                </div>
            </AnimatedSection>
        </div>
    );
};

export default DateWizardTool;
