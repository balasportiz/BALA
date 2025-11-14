import React from 'react';

interface ToggleSwitchProps {
    id: string;
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ id, label, checked, onChange }) => {
    return (
        <div className="flex items-center justify-start">
            <label htmlFor={id} className="flex items-center cursor-pointer">
                <span className="mr-3 text-sm font-medium text-gray-700">{label}</span>
                <div className="relative">
                    <input 
                        id={id} 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={checked} 
                        onChange={e => onChange(e.target.checked)} 
                    />
                    <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-sky-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
                </div>
            </label>
        </div>
    );
};

export default ToggleSwitch;