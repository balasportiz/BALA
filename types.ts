
export interface ExcelSheetData {
    [sheetName: string]: string[][];
}

export interface ExcelData {
    fileName: string;
    sheetNames: string[];
    sheets: ExcelSheetData;
}

export interface ColumnSelectionA {
    sheet: string;
    column: number | null;
}

export interface ColumnSelectionB {
    sheet: string;
    lookupColumn: number | null;
    returnColumn: number | null;
}

export type ColumnSelection = ColumnSelectionA | ColumnSelectionB;
