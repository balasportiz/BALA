import React, { useState, useCallback, useRef } from 'react';
import { UploadIcon, CheckCircleIcon } from './Icons';

interface FileUploaderProps {
    id: string;
    title: string;
    subtitle?: string;
    onFileSelect: (file: File) => void;
    progress?: number;
    compact?: boolean;
}

const FileUploader: React.FC<FileUploaderProps> = ({ id, title, subtitle, onFileSelect, progress, compact = false }) => {
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

    // Fix: Moved isParsing to the component scope to be accessible by all return paths.
    const isParsing = typeof progress === 'number';

    const renderContent = () => {
        if (isDragging) {
            return (
                <>
                    <UploadIcon className="w-12 h-12 mb-3 text-sky-500 animate-bounce" />
                    <p className="text-lg font-semibold text-sky-600">Drop file to upload</p>
                </>
            );
        }

        if (isParsing) {
            return (
                <div className="w-full px-4">
                    <p className="text-sm font-semibold text-sky-700 mb-2">{`Parsing: ${progress}%`}</p>
                    <div className="w-full bg-slate-200 rounded-full h-2.5">
                        <div 
                            className="bg-sky-600 h-2.5 rounded-full" 
                            style={{ width: `${progress}%`, transition: 'width 0.1s linear' }}
                        ></div>
                    </div>
                    <p className="text-xs text-slate-500 max-w-full truncate px-2 mt-2">{fileName}</p>
                </div>
            );
        }

        if (fileName) {
            return (
                <>
                    <CheckCircleIcon className="w-10 h-10 mb-2 text-teal-500" />
                    <p className="mb-1 text-sm font-semibold text-slate-700 max-w-full truncate px-2">{fileName}</p>
                    <p className="text-xs text-slate-500">Click or drag to replace</p>
                </>
            );
        }

        return (
            <>
                <UploadIcon className="w-10 h-10 mb-3 text-slate-400" />
                <p className="mb-2 text-sm text-slate-500"><span className="font-semibold text-sky-600">Click to upload</span> or drag & drop</p>
                <p className="text-xs text-slate-400">XLSX or XLS files</p>
            </>
        );
    }
    
    if (compact) {
        return (
             <div className="bg-white/60 backdrop-blur-sm border border-slate-200 rounded-xl w-full">
                <div className="flex items-center gap-4 p-3">
                     <label
                        htmlFor={id}
                        className={`flex flex-col items-center justify-center flex-shrink-0 w-24 h-24 border-2 border-dashed rounded-lg cursor-pointer transition-colors
                            ${isDragging ? 'border-sky-500 bg-sky-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'}`}
                        onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop}
                    >
                         {fileName && !isParsing ? <CheckCircleIcon className="w-8 h-8 text-teal-500" /> : <UploadIcon className="w-8 h-8 text-slate-400" />}
                        <input id={id} ref={fileInputRef} type="file" className="hidden" accept=".xlsx, .xls" onChange={(e) => handleFileChange(e.target.files)} />
                    </label>
                    <div className="flex-grow min-w-0">
                         <h3 className="text-md font-semibold text-slate-800 truncate">{title}</h3>
                        {isParsing ? (
                             <div className="w-full pr-4 mt-2">
                                <p className="text-xs text-slate-500 max-w-full truncate mb-1">{fileName}</p>
                                <div className="w-full bg-slate-200 rounded-full h-1.5">
                                    <div className="bg-sky-600 h-1.5 rounded-full" style={{ width: `${progress}%`, transition: 'width 0.1s linear' }}></div>
                                </div>
                            </div>
                        ) : (
                             <p className="text-sm text-slate-500 truncate">{fileName || 'No file selected'}</p>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white/60 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-lg p-6 w-full">
            <div className="text-center">
                <h3 className="text-xl font-bold text-slate-800">{title}</h3>
                {subtitle && <p className="text-sm text-slate-500 mb-4">{subtitle}</p>}
            </div>
            <label
                htmlFor={id}
                className={`mt-4 flex flex-col items-center justify-center w-full h-52 border-2 border-dashed rounded-xl cursor-pointer transition-colors
                    ${isDragging ? 'border-sky-500 bg-sky-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'}`}
                onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop}
            >
                <div className="flex flex-col items-center justify-center w-full text-center">
                    {renderContent()}
                </div>
                <input id={id} ref={fileInputRef} type="file" className="hidden" accept=".xlsx, .xls" onChange={(e) => handleFileChange(e.target.files)} />
            </label>
        </div>
    );
};

export default FileUploader;