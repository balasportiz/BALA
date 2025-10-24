
import React from 'react';

interface ResultsTableProps {
    data: string[][];
}

const ResultsTable: React.FC<ResultsTableProps> = ({ data }) => {
    if (!data || data.length === 0) {
        return <p className="text-center text-gray-500">No data to display.</p>;
    }

    const header = data[0];
    const rows = data.slice(1);

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800">Results</h2>
            <div className="overflow-x-auto max-h-[60vh] relative border border-gray-200 rounded-lg">
                <table className="w-full text-sm text-left text-gray-500">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-100 sticky top-0 z-10">
                        <tr>
                            {header.map((col, index) => (
                                <th key={index} scope="col" className="px-6 py-3 whitespace-nowrap">
                                    {col}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, rowIndex) => (
                            <tr key={rowIndex} className="bg-white border-b hover:bg-gray-50">
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
             <p className="text-sm text-gray-500 mt-4">
                Showing {rows.length} rows.
            </p>
        </div>
    );
};

export default ResultsTable;
