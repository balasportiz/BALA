import React from 'react';

interface SliderProps {
    id: string;
    label: string;
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    step?: number;
}

const Slider: React.FC<SliderProps> = ({ id, label, value, onChange, min = 0, max = 100, step = 1 }) => {
    return (
        <div className="flex items-center gap-4 w-full sm:max-w-xs">
            <label htmlFor={id} className="text-sm font-medium text-slate-600 whitespace-nowrap">{label}:</label>
            <div className="flex items-center gap-3 w-full">
                <input
                    id={id}
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={e => onChange(parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <span className="text-sm font-bold text-sky-700 w-10 text-center bg-sky-100 rounded-lg py-1">{value}</span>
            </div>
        </div>
    );
};

export default Slider;