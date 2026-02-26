
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
    columns: number[];
}

export interface ColumnSelectionB {
    sheet: string;
    lookupColumns: number[];
    returnColumns: number[];
}

export type ColumnSelection = ColumnSelectionA | ColumnSelectionB;
