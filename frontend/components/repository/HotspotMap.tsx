
import React from 'react';
import { useTheme } from '../../ThemeContext';

interface HotspotProps {
    data: any[]; // Placeholder for now
    onSelect: (item: any) => void;
}

export const HotspotMap: React.FC<HotspotProps> = ({ onSelect }) => {
    const { theme } = useTheme();
    // Verify D3 or similar is needed, but for now implementing a CSS Grid Layout mockup
    // Mock Data representing files with size ~ complexity and color ~ risk
    const files = [
        { name: 'AnalysisEngine.scale', size: 3, risk: 'critical', issues: 12 },
        { name: 'DataLoader.scala', size: 2, risk: 'high', issues: 8 },
        { name: 'QueryOptimizer.scala', size: 3, risk: 'high', issues: 7 },
        { name: 'UserAuth.scala', size: 1, risk: 'medium', issues: 4 },
        { name: 'Utils.scala', size: 1, risk: 'low', issues: 1 },
        { name: 'Config.scala', size: 1, risk: 'low', issues: 0 },
        { name: 'GraphLib.scala', size: 2, risk: 'medium', issues: 3 },
    ];

    const getColor = (risk: string) => {
        switch (risk) {
            case 'critical': return 'bg-red-500 hover:bg-red-400';
            case 'high': return 'bg-orange-500 hover:bg-orange-400';
            case 'medium': return 'bg-amber-400 hover:bg-amber-300';
            case 'low': return 'bg-emerald-400 hover:bg-emerald-300';
            default: return 'bg-slate-300 dark:bg-slate-700';
        }
    };

    return (
        <div className="w-full h-full p-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Codebase Hotspots (Complexity vs Risk)</h3>
            <div className="grid grid-cols-4 gap-2 h-[400px]">
                {files.map((file, i) => (
                    <div
                        key={i}
                        className={`
                            relative rounded-xl shadow-lg transition-all cursor-pointer transform hover:scale-[1.02] 
                            ${getColor(file.risk)} ${file.size > 2 ? 'col-span-2 row-span-2' : 'col-span-1'}
                        `}
                        onClick={() => onSelect(file)}
                    >
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                            <div className="font-bold text-white text-lg drop-shadow-md">{file.name}</div>
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
