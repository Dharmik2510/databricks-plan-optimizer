
import React from 'react';
import { Zap, TrendingUp, Minus, ArrowDown } from 'lucide-react';

type ImpactLevel = 'Very High' | 'High' | 'Medium' | 'Low';

interface ImpactBadgeProps {
    level?: ImpactLevel;
    compact?: boolean;
}

const config: Record<ImpactLevel, { icon: any; bg: string; text: string; border: string }> = {
    'Very High': {
        icon: Zap,
        bg: 'bg-red-50 dark:bg-red-900/20',
        text: 'text-red-700 dark:text-red-400',
        border: 'border-red-200 dark:border-red-800',
    },
    'High': {
        icon: TrendingUp,
        bg: 'bg-orange-50 dark:bg-orange-900/20',
        text: 'text-orange-700 dark:text-orange-400',
        border: 'border-orange-200 dark:border-orange-800',
    },
    'Medium': {
        icon: Minus,
        bg: 'bg-yellow-50 dark:bg-yellow-900/20',
        text: 'text-yellow-700 dark:text-yellow-400',
        border: 'border-yellow-200 dark:border-yellow-800',
    },
    'Low': {
        icon: ArrowDown,
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        text: 'text-blue-700 dark:text-blue-400',
        border: 'border-blue-200 dark:border-blue-800',
    },
};

export const ImpactBadge: React.FC<ImpactBadgeProps> = ({ level, compact = false }) => {
    if (!level) return null;

    const { icon: Icon, bg, text, border } = config[level];

    return (
        <div
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border ${bg} ${border} ${text}`}
            title={`${level} Impact`}
        >
            <Icon className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
            <span className={`font-bold ${compact ? 'text-xs' : 'text-sm'}`}>
                {level} Impact
            </span>
        </div>
    );
};
