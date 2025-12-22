
import React from 'react';
import { useTheme } from '../../ThemeContext';

interface HotspotProps {
    data: any[]; // Placeholder for now
    files?: any[];
    onSelect?: (file: any) => void;
}

export const HotspotMap: React.FC<HotspotProps> = ({ files = [], onSelect }) => {
    const { theme } = useTheme();
    // Verify D3 or similar is needed, but for now implementing a CSS Grid Layout mockup
    // Generate simulated hotspots from files
    const hotspots = files.map(file => ({
        name: file.path.split('/').pop(),
        path: file.path,
        complexity: Math.min(100, Math.floor(file.size / 100)), // dynamic complexity
        risk: ['Critical', 'High', 'Medium', 'Safe'][Math.floor(Math.random() * 4)], // mock risk for now
        issues: Math.floor(Math.random() * 15) // mock issue count
    })).slice(0, 8); // Limit to top 8 for UI

    const getColor = (risk: string) => {
        switch (risk) {
            case 'Critical': return 'bg-red-500 hover:bg-red-400';
            case 'High': return 'bg-orange-500 hover:bg-orange-400';
            case 'Medium': return 'bg-amber-400 hover:bg-amber-300';
            case 'Safe': return 'bg-emerald-400 hover:bg-emerald-300';
            default: return 'bg-slate-300 dark:bg-slate-700';
        }
    };

    return (
        <div className="w-full h-full p-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Codebase Hotspots (Complexity vs Risk)</h3>
            <div className="grid grid-cols-4 gap-2 h-[400px]">
                {hotspots.map((file, i) => (
                    <div
                        key={i}
                        className={`
                            relative rounded-xl shadow-lg transition-all cursor-pointer transform hover:scale-[1.02] 
                            ${getColor(file.risk)} ${file.complexity > 50 ? 'col-span-2 row-span-2' : 'col-span-1'}
                        `}
                        onClick={() => onSelect && onSelect(file)}
                    >
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                            <div className="font-bold text-white text-lg drop-shadow-md break-all">{file.name}</div>
                            <div className="text-white/90 font-medium text-sm mt-1">{file.issues} Issues</div>
                        </div>
                    </div>
                ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-4 text-sm text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded-full"></div>Critical Risk</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-orange-500 rounded-full"></div>High Risk</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-amber-400 rounded-full"></div>Medium Risk</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-emerald-400 rounded-full"></div>Safe</div>
            </div>
        </div>
    );
};
