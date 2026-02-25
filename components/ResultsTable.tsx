
import React from 'react';

interface ResultsTableProps {
    data: string[][];
    highlightIndices?: Set<number>;
}

const ResultsTable: React.FC<ResultsTableProps> = ({ data, highlightIndices }) => {
    if (!data || data.length === 0) {
        return <p className="text-center text-slate-500">No data to display.</p>;
    }

    const header = data[0];
    const rows = data.slice(1);

    // Identify "Magic" columns to highlight them
    const isMagicColumn = (colName: string) => {
        const lower = colName.toLowerCase();
        return lower.includes('fixed_date') || 
               lower.includes('calculated_age') || 
               lower.includes('matched_') || 
               lower.includes('cleaned_') ||
               lower.includes('is_duplicate') ||
               lower.includes('original_row') ||
               lower.includes('group_id');
    };

    return (
        <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-xl hover:shadow-2xl transition-shadow duration-300 p-4 sm:p-6">
            <div className="overflow-x-auto max-h-[60vh] rounded-xl border border-slate-200/80">
                <table className="w-full text-sm text-left text-slate-700">
                    <thead className="text-xs text-slate-500 uppercase bg-white/80 backdrop-blur-md sticky top-0 z-10">
                        <tr>
                            {header.map((col, index) => {
                                const magic = isMagicColumn(col);
                                return (
                                    <th 
                                        key={index} 
                                        scope="col" 
                                        className={`px-6 py-3 font-bold whitespace-nowrap border-b border-slate-200 ${
                                            magic ? 'bg-indigo-50 text-indigo-700' : ''
                                        }`}
                                    >
                                        {col}
                                        {magic && <span className="ml-1 text-[10px] bg-indigo-200 text-indigo-800 px-1 rounded">MAGIC</span>}
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, rowIndex) => {
                            const isHighlighted = highlightIndices?.has(rowIndex);
                            return (
                                <tr key={rowIndex} className={`transition-colors duration-150 group ${isHighlighted ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-sky-50/50'}`}>
                                    {row.map((cell, cellIndex) => {
                                        const magic = isMagicColumn(header[cellIndex]);
                                        return (
                                            <td 
                                                key={cellIndex} 
                                                className={`px-6 py-4 whitespace-nowrap border-t border-slate-200/60 ${
                                                    magic ? 'bg-indigo-50/30 font-semibold text-indigo-900 group-hover:bg-indigo-100/50' : ''
                                                } ${isHighlighted ? 'text-red-900' : ''}`}
                                            >
                                                {cell}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
             <p className="text-sm text-slate-500 mt-4 text-center">
                Showing {rows.length.toLocaleString()} rows. Scroll right to see the <span className="text-indigo-600 font-bold underline">Magic Results</span>.
            </p>
        </div>
    );
};

export default ResultsTable;
