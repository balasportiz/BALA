
import React from 'react';
import type { ExcelData, ColumnSelection } from '../types';

interface ColumnSelectorProps {
    fileData: ExcelData;
    selection: any;
    setSelection: React.Dispatch<React.SetStateAction<ColumnSelection>>;
    type: 'A' | 'B';
}

const ColumnSelector: React.FC<ColumnSelectorProps> = ({ fileData, selection, setSelection, type }) => {
    
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
        setSelection(prev => ({ ...prev, [field]: value === '' ? null : parseInt(value) }));
    };

    return (
        <div className="space-y-4 p-4 border border-gray-200 rounded-lg">
            <h4 className="font-semibold text-gray-700">
                {`File ${type}: `}
                <span className="font-normal text-indigo-600 truncate">{fileData.fileName}</span>
            </h4>
            
            <div>
                <label htmlFor={`sheet-select-${type}`} className="block text-sm font-medium text-gray-700 mb-1">Select Sheet</label>
                <select 
                    id={`sheet-select-${type}`}
                    value={selection.sheet} 
                    onChange={handleSheetChange}
                    className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                >
                    <option value="">-- Choose a sheet --</option>
                    {fileData.sheetNames.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
            </div>
            
            {selection.sheet && type === 'A' && (
                <div>
                    <label htmlFor="lookup-column-a" className="block text-sm font-medium text-gray-700 mb-1">Lookup Column</label>
                    <select 
                        id="lookup-column-a"
                        value={selection.column ?? ''}
                        onChange={(e) => handleColumnChange('column', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    >
                        <option value="">-- Choose a column --</option>
                        {headers.map((header, i) => <option key={`${header}-${i}`} value={i}>{header}</option>)}
                    </select>
                </div>
            )}
            
            {selection.sheet && type === 'B' && (
                <>
                    <div>
                        <label htmlFor="lookup-column-b" className="block text-sm font-medium text-gray-700 mb-1">Lookup Column (to match against)</label>
                        <select 
                            id="lookup-column-b"
                            value={selection.lookupColumn ?? ''}
                            onChange={(e) => handleColumnChange('lookupColumn', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="">-- Choose a column --</option>
                            {headers.map((header, i) => <option key={`${header}-${i}`} value={i}>{header}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="return-column-b" className="block text-sm font-medium text-gray-700 mb-1">Return Column (value to add)</label>
                        <select 
                            id="return-column-b"
                            value={selection.returnColumn ?? ''}
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
