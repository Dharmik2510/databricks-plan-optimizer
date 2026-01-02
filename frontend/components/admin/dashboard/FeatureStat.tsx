import React from 'react';
import { LucideIcon } from 'lucide-react';

interface FeatureStatProps {
    icon: LucideIcon;
    label: string;
    value: string | number;
    detail: string;
    color: 'violet' | 'pink' | 'cyan';
}

export const FeatureStat: React.FC<FeatureStatProps> = ({ icon: Icon, label, value, detail, color }) => {
    const colors = {
        violet: 'text-violet-600 bg-violet-50 dark:text-violet-400 dark:bg-violet-900/20',
        pink: 'text-pink-600 bg-pink-50 dark:text-pink-400 dark:bg-pink-900/20',
        cyan: 'text-cyan-600 bg-cyan-50 dark:text-cyan-400 dark:bg-cyan-900/20',
    };

    return (
        <div className="flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
            <div className={`p-3 rounded-xl ${colors[color]}`}>
                <Icon className="w-6 h-6" />
            </div>
            <div>
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{label}</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">{detail}</p>
            </div>
        </div>
    );
};
