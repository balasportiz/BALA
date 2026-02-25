
import type { ExcelData, ExcelSheetData } from '../types';
import * as XLSX from 'xlsx';

export const parseExcelFile = (
    file: File,
    onProgress: (progress: number) => void
): Promise<ExcelData> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onprogress = (event: ProgressEvent<FileReader>) => {
            if (event.lengthComputable) {
                const progress = Math.round((event.loaded / event.total) * 100);
                onProgress(progress);
            }
        };

        reader.onload = (event: ProgressEvent<FileReader>) => {
            if (!event.target?.result) {
                return reject(new Error("FileReader event target result is null."));
            }
            try {
                const data = new Uint8Array(event.target.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetNames = workbook.SheetNames;
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
                
                // Ensure progress completes and call resolves
                onProgress(100);
                resolve({ fileName: file.name, sheetNames, sheets });
            } catch (error) {
                reject(error);
            }
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
