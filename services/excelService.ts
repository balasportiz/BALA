
import type { ExcelData, ExcelSheetData } from '../types';

declare const XLSX: any;

export const parseExcelFile = (file: File): Promise<ExcelData> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
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
                    sheets[name] = json as string[][];
                });
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
