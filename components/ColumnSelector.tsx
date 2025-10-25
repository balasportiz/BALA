
import React from 'react';
import type { ExcelData, ColumnSelectionA, ColumnSelectionB } from '../types';

interface ColumnSelectorProps {
    fileData: ExcelData;
    selection: ColumnSelectionA | ColumnSelectionB;
    setSelection: (selection: ColumnSelectionA | ColumnSelectionB) => void;
    type: 'A' | 'B';
    fileIdentifier?: string;
}

const ColumnSelector: React.FC<ColumnSelectorProps> = ({ fileData, selection, setSelection, type, fileIdentifier }) => {
    
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
        <div className="space-y-4 p-4 border border-gray-200 rounded-lg">
            <h4 className="font-semibold text-gray-700">
                {`File ${fileIdentifier || type}: `}
                <span className="font-normal text-indigo-600 truncate">{fileData.fileName}</span>
            </h4>
            
            <div>
                <label htmlFor={`sheet-select-${uniqueId}`} className="block text-sm font-medium text-gray-700 mb-1">Select Sheet</label>
                <select 
                    id={`sheet-select-${uniqueId}`}
                    value={selection.sheet} 
                    onChange={handleSheetChange}
                    className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                >
                    <option value="">-- Choose a sheet --</option>
                    {fileData.sheetNames.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
            </div>
            
            {selection.sheet && type === 'A' && selectionA && (
                <div>
                    <label htmlFor={`lookup-column-a-${uniqueId}`} className="block text-sm font-medium text-gray-700 mb-1">Lookup Column</label>
                    <select 
                        id={`lookup-column-a-${uniqueId}`}
                        value={selectionA.column ?? ''}
                        onChange={(e) => handleColumnChange('column', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    >
                        <option value="">-- Choose a column --</option>
                        {headers.map((header, i) => <option key={`${header}-${i}`} value={i}>{header}</option>)}
                    </select>
                </div>
            )}
            
            {selection.sheet && type === 'B' && selectionB && (
                <>
                    <div>
                        <label htmlFor={`lookup-column-b-${uniqueId}`} className="block text-sm font-medium text-gray-700 mb-1">Lookup Column (to match against)</label>
                        <select 
                            id={`lookup-column-b-${uniqueId}`}
                            value={selectionB.lookupColumn ?? ''}
                            onChange={(e) => handleColumnChange('lookupColumn', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="">-- Choose a column --</option>
                            {headers.map((header, i) => <option key={`${header}-${i}`} value={i}>{header}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor={`return-column-b-${uniqueId}`} className="block text-sm font-medium text-gray-700 mb-1">Return Column (value to add)</label>
                        <select 
                            id={`return-column-b-${uniqueId}`}
                            value={selectionB.returnColumn ?? ''}
                            onChange={(e) => handleColumnChange('returnColumn', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="">-- Choose a column --</option>
                            {headers.map((header, i) => <option key={`${header}-${i}`} value={i}>{header}</option>)}
                        </select>
                    </div>
                </>
            )}
        </div>
    );
};

export default ColumnSelector;
