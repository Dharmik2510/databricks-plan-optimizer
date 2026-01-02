import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '../../../design-system/utils';

interface ActionCardProps {
    title: string;
    description: string;
    icon: LucideIcon;
    color: 'blue' | 'indigo';
    onClick: () => void;
}

export const ActionCard: React.FC<ActionCardProps> = ({ title, description, icon: Icon, color, onClick }) => {
    const bgColors = {
        blue: 'hover:bg-blue-50 dark:hover:bg-blue-900/10 hover:border-blue-200 dark:hover:border-blue-800',
        indigo: 'hover:bg-indigo-50 dark:hover:bg-indigo-900/10 hover:border-indigo-200 dark:hover:border-indigo-800',
    };
    const iconColors = {
        blue: 'text-blue-600 dark:text-blue-400',
        indigo: 'text-indigo-600 dark:text-indigo-400',
    };

    return (
        <button
            onClick={onClick}
            className={cn(
                "bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm text-left transition-all duration-300 group w-full",
                bgColors[color]
            )}
        >
            <div className="flex items-center gap-4">
                <div className={cn(
                    "p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl group-hover:scale-110 transition-transform",
                    iconColors[color]
                )}>
                    <Icon className="w-8 h-8" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{title}</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">{description}</p>
                </div>
            </div>
        </button>
    );
};
