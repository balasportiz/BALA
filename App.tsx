
import React, { useState } from 'react';
import VLookupTool from './components/VLookupTool';
import DuplicateFinderTool from './components/DuplicateFinderTool';
import DateWizardTool from './components/DateWizardTool';
import { MagicWandIcon, DocumentDuplicateIcon, CalendarIcon } from './components/Icons';

const App: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'vlookup' | 'dedup' | 'date'>('vlookup');

    return (
        <div className="min-h-screen w-full bg-gradient-to-br from-white via-sky-50 to-cyan-100 text-slate-800 p-4 sm:p-6 lg:p-10">
            <div className="max-w-6xl mx-auto">
                <header className="text-center mb-8">
                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-sky-500 to-cyan-500 pb-2">
                        Excel Wizardry
                    </h1>
                    <p className="mt-2 text-lg text-slate-500 max-w-2xl mx-auto">
                        Perform magical operations on your Excel files effortlessly.
                    </p>
                </header>

                <div className="flex justify-center mb-10 overflow-x-auto pb-2">
                    <div className="bg-white/50 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 shadow-sm inline-flex whitespace-nowrap">
                        <button
                            onClick={() => setActiveTab('vlookup')}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
                                activeTab === 'vlookup' 
                                ? 'bg-white text-sky-600 shadow-md transform scale-105' 
                                : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                            }`}
                        >
                            <MagicWandIcon className="w-5 h-5" />
                            V-Lookup Magic
                        </button>
                        <button
                            onClick={() => setActiveTab('dedup')}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
                                activeTab === 'dedup' 
                                ? 'bg-white text-emerald-600 shadow-md transform scale-105' 
                                : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                            }`}
                        >
                            <DocumentDuplicateIcon className="w-5 h-5" />
                            Duplicate Finder
                        </button>
                        <button
                            onClick={() => setActiveTab('date')}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
                                activeTab === 'date' 
                                ? 'bg-white text-indigo-600 shadow-md transform scale-105' 
                                : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                            }`}
                        >
                            <CalendarIcon className="w-5 h-5" />
                            Date & Age Wizard
                        </button>
                    </div>
                </div>

                <main>
                    {activeTab === 'vlookup' && (
                        <div className="animate-fadeIn">
                            <VLookupTool />
                        </div>
                    )}
                    {activeTab === 'dedup' && (
                        <div className="animate-fadeIn">
                            <DuplicateFinderTool />
                        </div>
                    )}
                    {activeTab === 'date' && (
                        <div className="animate-fadeIn">
                            <DateWizardTool />
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default App;
