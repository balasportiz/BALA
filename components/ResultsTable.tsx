import React from 'react';

interface ResultsTableProps {
    data: string[][];
}

const ResultsTable: React.FC<ResultsTableProps> = ({ data }) => {
    if (!data || data.length === 0) {
        return <p className="text-center text-slate-500">No data to display.</p>;
    }

    const header = data[0];
    const rows = data.slice(1);

    return (
        <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-xl p-4 sm:p-6">
            <div className="overflow-x-auto max-h-[60vh] relative border border-slate-200 rounded-xl">
                <table className="w-full text-sm text-left text-slate-600">
                    <thead className="text-xs text-slate-700 uppercase bg-slate-200/80 backdrop-blur-md sticky top-0 z-10 border-b-2 border-slate-300">
                        <tr>
                            {header.map((col, index) => (
                                <th key={index} scope="col" className="px-6 py-3 font-semibold whitespace-nowrap">
                                    {col}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, rowIndex) => (
                            <tr key={rowIndex} className="even:bg-slate-50/60 hover:bg-sky-100/60 transition-colors duration-150">
                                {row.map((cell, cellIndex) => (
                                    <td key={cellIndex} className="px-6 py-4 whitespace-nowrap">
                                        {cell}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
             <p className="text-sm text-slate-500 mt-4 px-2">
                Showing {rows.length.toLocaleString()} rows of magical results.
            </p>
        </div>
    );
};

export default ResultsTable;