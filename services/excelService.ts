
import type { ExcelData, ExcelSheetData } from '../types';
import * as XLSX from 'xlsx';

export const parseExcelFile = (
    file: File,
    onProgress: (progress: number) => void
): Promise<ExcelData> => {
    return new Promise((resolve, reject) => {
        // Basic file validation
        if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
            return reject(new Error("Invalid file format. Please upload a .xlsx, .xls, or .csv file."));
        }
        if (file.size === 0) {
            return reject(new Error("The uploaded file is empty."));
        }

        const reader = new FileReader();

        reader.onprogress = (event: ProgressEvent<FileReader>) => {
            if (event.lengthComputable) {
                // Cap at 99% during file read. 100% will be set right before parsing.
                const progress = Math.min(99, Math.round((event.loaded / event.total) * 100));
                onProgress(progress);
            }
        };

        reader.onload = (event: ProgressEvent<FileReader>) => {
            if (!event.target?.result) {
                return reject(new Error("FileReader event target result is null."));
            }
            
            // Set to 100% to indicate file is loaded into memory, now we parse
            onProgress(100);

            // Yield to the browser so it can render the 100% progress bar 
            // before the main thread is blocked by the heavy XLSX.read operation.
            setTimeout(() => {
                try {
                    const data = new Uint8Array(event.target!.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetNames = workbook.SheetNames;
                    
                    if (!sheetNames || sheetNames.length === 0) {
                        throw new Error("The Excel file does not contain any sheets.");
                    }

                    const sheets: ExcelSheetData = {};
                    sheetNames.forEach(name => {
                        const worksheet = workbook.Sheets[name];
                        // Using header: 1 to get an array of arrays, which is easier to work with indices
                        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
                        // Convert all cell data to trimmed strings to ensure robust matching.
                        // Case sensitivity will be handled in the merge logic.
                        sheets[name] = (json as any[][]).map(row => 
                            row.map(cell => String(cell ?? '').trim())
                        );
                    });
                    
                    resolve({ fileName: file.name, sheetNames, sheets });
                } catch (error) {
                    reject(error);
                }
            }, 50);
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
};


export const exportToExcel = (data: string[][], fileName: string): void => {
    try {
        const worksheet = XLSX.utils.aoa_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'MergedData');
        XLSX.writeFile(workbook, fileName);
    } catch (error) {
        console.error("Failed to export to Excel:", error);
        alert("An error occurred while creating the Excel file.");
    }
};

export const exportMultipleSheetsToExcel = (sheets: { name: string, data: string[][] }[], fileName: string): void => {
    try {
        const workbook = XLSX.utils.book_new();
        sheets.forEach(sheet => {
            const worksheet = XLSX.utils.aoa_to_sheet(sheet.data);
            XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
        });
        XLSX.writeFile(workbook, fileName);
    } catch (error) {
        console.error("Failed to export to Excel:", error);
        alert("An error occurred while creating the Excel file.");
    }
};
