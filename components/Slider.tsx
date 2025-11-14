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
            <label htmlFor={id} className="text-sm font-medium text-gray-700 whitespace-nowrap">{label}:</label>
            <div className="flex items-center gap-2 w-full">
                <input
                    id={id}
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={e => onChange(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-sm font-semibold text-indigo-600 w-8 text-center bg-indigo-100 rounded-md py-1">{value}</span>
            </div>
        </div>
    );
};

export default Slider;
