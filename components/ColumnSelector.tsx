import React from 'react';
import type { ExcelData, ColumnSelectionA, ColumnSelectionB } from '../types';

interface ColumnSelectorProps {
    fileData: ExcelData;
    selection: ColumnSelectionA | ColumnSelectionB;
    setSelection: (selection: ColumnSelectionA | ColumnSelectionB) => void;
    type: 'A' | 'B';
    fileIdentifier?: string;
    customLabel?: string;
}

const ColumnSelector: React.FC<ColumnSelectorProps> = ({ fileData, selection, setSelection, type, fileIdentifier, customLabel }) => {
    
    const headers = fileData.sheets[selection.sheet] ? fileData.sheets[selection.sheet][0] : [];

    const handleSheetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newSheet = e.target.value;
        if (type === 'A') {
            setSelection({ sheet: newSheet, column: null });
        } else {
            setSelection({ sheet: newSheet, lookupColumn: null, returnColumn: null });
        }
    };

    const handleColumnChange = (field: 'column' | 'lookupColumn' | 'returnColumn', value: string) => {
        const newSelection = { ...selection, [field]: value === '' ? null : parseInt(value) };
        setSelection(newSelection as ColumnSelectionA | ColumnSelectionB);
    };

    const selectionA = type === 'A' ? (selection as ColumnSelectionA) : null;
    const selectionB = type === 'B' ? (selection as ColumnSelectionB) : null;
    const uniqueId = `${type}-${fileIdentifier || ''}`.replace(/\s+/g, '-');

    return (
        <div className="space-y-4 bg-white/60 backdrop-blur-sm border border-slate-200 rounded-xl p-4">
            <div className="min-w-0">
                <h4 className="font-bold text-slate-700 text-md">
                    {`File ${fileIdentifier || type}`}
                </h4>
                <p className="font-medium text-sky-700 text-sm truncate">{fileData.fileName}</p>
            </div>
            
            <div>
                <label htmlFor={`sheet-select-${uniqueId}`} className="block text-sm font-medium text-slate-600 mb-1">Sheet</label>
                <select 
                    id={`sheet-select-${uniqueId}`}
                    value={selection.sheet} 
                    onChange={handleSheetChange}
                    className="w-full p-2 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                >
                    <option value="">-- Choose a sheet --</option>
                    {fileData.sheetNames.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
            </div>
            
            {selection.sheet && type === 'A' && selectionA && (
                <div>
                    <label htmlFor={`lookup-column-a-${uniqueId}`} className="block text-sm font-medium text-slate-600 mb-1">
                        {customLabel || "Lookup Column"}
                    </label>
                    <select 
                        id={`lookup-column-a-${uniqueId}`}
                        value={selectionA.column ?? ''}
                        onChange={(e) => handleColumnChange('column', e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    >
                        <option value="">-- Choose a column --</option>
                        {headers.map((header, i) => <option key={`${header}-${i}`} value={i}>{header || `Column ${i + 1}`}</option>)}
                    </select>
                </div>
            )}
            
            {selection.sheet && type === 'B' && selectionB && (
                <>
                    <div>
                        <label htmlFor={`lookup-column-b-${uniqueId}`} className="block text-sm font-medium text-slate-600 mb-1">Lookup Column (to match)</label>
                        <select 
                            id={`lookup-column-b-${uniqueId}`}
                            value={selectionB.lookupColumn ?? ''}
                            onChange={(e) => handleColumnChange('lookupColumn', e.target.value)}
                            className="w-full p-2 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                        >
                            <option value="">-- Choose a column --</option>
                            {headers.map((header, i) => <option key={`${header}-${i}`} value={i}>{header || `Column ${i + 1}`}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor={`return-column-b-${uniqueId}`} className="block text-sm font-medium text-slate-600 mb-1">Return Column (value to add)</label>
                        <select 
                            id={`return-column-b-${uniqueId}`}
                            value={selectionB.returnColumn ?? ''}
                            onChange={(e) => handleColumnChange('returnColumn', e.target.value)}
                            className="w-full p-2 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                        >
                            <option value="">-- Choose a column --</option>
                            {headers.map((header, i) => <option key={`${header}-${i}`} value={i}>{header || `Column ${i + 1}`}</option>)}
                        </select>
                    </div>
                </>
            )}
        </div>
    );
};

export default ColumnSelector;