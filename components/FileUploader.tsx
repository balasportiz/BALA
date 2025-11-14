
import React, { useState, useCallback, useRef } from 'react';
import { UploadIcon, CheckCircleIcon } from './Icons';

interface FileUploaderProps {
    id: string;
    title: string;
    onFileSelect: (file: File) => void;
    progress?: number;
}

const FileUploader: React.FC<FileUploaderProps> = ({ id, title, onFileSelect, progress }) => {
    const [fileName, setFileName] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = useCallback((files: FileList | null) => {
        if (files && files.length > 0) {
            const file = files[0];
            if (file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || file.type === "application/vnd.ms-excel") {
                setFileName(file.name);
                onFileSelect(file);
            } else {
                setFileName(null);
                alert("Please upload a valid Excel file (.xlsx or .xls)");
            }
        }
    }, [onFileSelect]);

    const handleDragEnter = (e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        handleFileChange(e.dataTransfer.files);
    };

    const renderContent = () => {
        const isParsing = typeof progress === 'number';

        if (isDragging) {
            return (
                <>
                    <UploadIcon className="w-12 h-12 mb-3 text-indigo-500 animate-bounce" />
                    <p className="text-lg font-semibold text-indigo-600">Drop file to upload</p>
                </>
            );
        }

        if (isParsing) {
            return (
                <div className="w-full px-4">
                    <p className="text-sm font-semibold text-indigo-700 mb-2">{`Parsing: ${progress}%`}</p>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div 
                            className="bg-indigo-600 h-2.5 rounded-full" 
                            style={{ width: `${progress}%`, transition: 'width 0.1s linear' }}
                        ></div>
                    </div>
                    <p className="text-xs text-gray-500 max-w-full truncate px-2 mt-2">{fileName}</p>
                </div>
            );
        }

        if (fileName) {
            return (
                <>
                    <CheckCircleIcon className="w-10 h-10 mb-3 text-green-500" />
                    <p className="mb-2 text-sm font-semibold text-gray-700 max-w-full truncate px-2">{fileName}</p>
                    <p className="text-xs text-gray-500">Click or drag to replace</p>
                </>
            );
        }

        return (
            <>
                <UploadIcon className="w-10 h-10 mb-3 text-gray-400" />
                <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                <p className="text-xs text-gray-500">XLSX or XLS files</p>
            </>
        );
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow-md w-full">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
            <label
                htmlFor={id}
                className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer transition-colors
                    ${isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}`}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                <div className="flex flex-col items-center justify-center w-full text-center">
                    {renderContent()}
                </div>
                <input
                    id={id}
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".xlsx, .xls"
                    onChange={(e) => handleFileChange(e.target.files)}
                />
            </label>
        </div>
    );
};

export default FileUploader;
