import React from 'react';

interface StepProps {
    number: number;
    title: string;
    isActive: boolean;
    isCompleted: boolean;
}

const Step: React.FC<StepProps> = ({ number, title, isActive, isCompleted }) => {
    const getStatusClasses = () => {
        if (isActive) return 'bg-sky-500 text-white border-sky-600 shadow-lg';
        if (isCompleted) return 'bg-teal-500 text-white border-teal-600';
        return 'bg-slate-200 text-slate-500 border-slate-300';
    };
    return (
        <div className="flex flex-col items-center text-center w-24 z-10">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg border-2 transition-all duration-300 ${getStatusClasses()}`}>
                {isCompleted ? '✓' : number}
            </div>
            <h3 className={`mt-2 font-semibold text-sm transition-colors duration-300 ${isActive || isCompleted ? 'text-slate-800' : 'text-slate-500'}`}>{title}</h3>
        </div>
    );
};


interface StepIndicatorProps {
    currentStep: number;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep }) => {
    const steps = [
        { number: 1, title: 'Upload Files' },
        { number: 2, title: 'Configure' },
        { number: 3, title: 'Download' },
    ];
    
    const progress = Math.max(0, (currentStep - 1.5) / (steps.length - 2)) * 100;

    return (
        <div className="w-full mb-10 sm:mb-16">
            <div className="relative max-w-xs sm:max-w-sm mx-auto">
                <div className="absolute top-5 left-0 w-full h-1 bg-slate-200 rounded-full">
                    <div className="h-1 bg-gradient-to-r from-sky-400 to-teal-400 rounded-full transition-all duration-500" style={{width: `${progress}%`}}></div>
                </div>
                <div className="relative flex items-start justify-between">
                    {steps.map((step) => (
                        <Step
                            key={step.number}
                            number={step.number}
                            title={step.title}
                            isActive={currentStep === step.number}
                            isCompleted={currentStep > step.number}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default StepIndicator;
