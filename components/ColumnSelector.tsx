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
            setSelection({ sheet: newSheet, columns: [] });
        } else {
            setSelection({ sheet: newSheet, lookupColumns: [], returnColumns: [] });
        }
    };

    const handleColumnToggle = (field: 'columns' | 'lookupColumns', index: number) => {
        const currentSelection = selection as any;
        const currentCols = currentSelection[field] || [];
        const newCols = currentCols.includes(index)
            ? currentCols.filter((i: number) => i !== index)
            : [...currentCols, index];
        
        setSelection({ ...currentSelection, [field]: newCols });
    };

    const handleReturnColumnToggle = (index: number) => {
        const currentSelection = selection as ColumnSelectionB;
        const currentReturnColumns = currentSelection.returnColumns || [];
        const newReturnColumns = currentReturnColumns.includes(index)
            ? currentReturnColumns.filter(i => i !== index)
            : [...currentReturnColumns, index];
        
        setSelection({ ...currentSelection, returnColumns: newReturnColumns });
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
                    <label className="block text-sm font-medium text-slate-600 mb-1">
                        {customLabel || "Lookup Columns"}
                    </label>
                    <div className="w-full p-2 border border-slate-300 rounded-lg shadow-sm bg-white max-h-48 overflow-y-auto">
                        {headers.length > 0 ? (
                            <div className="space-y-1">
                                {headers.map((header, i) => (
                                    <label key={`${header}-${i}`} className="flex items-center space-x-2 p-1 hover:bg-slate-50 rounded cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={(selectionA.columns || []).includes(i)}
                                            onChange={() => handleColumnToggle('columns', i)}
                                            className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                                        />
                                        <span className="text-sm text-slate-700">{header || `Column ${i + 1}`}</span>
                                    </label>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-slate-400 italic">No columns available</p>
                        )}
                    </div>
                </div>
            )}
            
            {selection.sheet && type === 'B' && selectionB && (
                <>
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Lookup Columns (to match)</label>
                        <div className="w-full p-2 border border-slate-300 rounded-lg shadow-sm bg-white max-h-48 overflow-y-auto">
                            {headers.length > 0 ? (
                                <div className="space-y-1">
                                    {headers.map((header, i) => (
                                        <label key={`${header}-${i}`} className="flex items-center space-x-2 p-1 hover:bg-slate-50 rounded cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={(selectionB.lookupColumns || []).includes(i)}
                                                onChange={() => handleColumnToggle('lookupColumns', i)}
                                                className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                                            />
                                            <span className="text-sm text-slate-700">{header || `Column ${i + 1}`}</span>
                                        </label>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-slate-400 italic">No columns available</p>
                            )}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Return Columns (values to add)</label>
                        <div className="w-full p-2 border border-slate-300 rounded-lg shadow-sm bg-white max-h-48 overflow-y-auto">
                            {headers.length > 0 ? (
                                <div className="space-y-1">
                                    {headers.map((header, i) => (
                                        <label key={`${header}-${i}`} className="flex items-center space-x-2 p-1 hover:bg-slate-50 rounded cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={(selectionB.returnColumns || []).includes(i)}
                                                onChange={() => handleReturnColumnToggle(i)}
                                                className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                                            />
                                            <span className="text-sm text-slate-700">{header || `Column ${i + 1}`}</span>
                                        </label>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-slate-400 italic">No columns available</p>
                            )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Select one or more columns to add to your result.</p>
                    </div>
                </>
            )}
        </div>
    );
};

export default ColumnSelector;