
import React from 'react';
import { Clock, DollarSign } from 'lucide-react';

interface ImpactMetricsProps {
    timeSaved?: number; // in minutes
    costSaved?: number; // in dollars
    compact?: boolean;
}

export const ImpactMetrics: React.FC<ImpactMetricsProps> = ({ timeSaved, costSaved, compact = false }) => {
    if (!timeSaved && !costSaved) return null;

    const formatTime = (min: number) => {
        if (min < 1) return '< 1m';
        if (min >= 60) {
            const h = Math.floor(min / 60);
            const m = Math.round(min % 60);
            return `${h}h ${m}m`;
        }
        return `${Math.round(min)}m`;
    };

    return (
        <div className={`flex items-center gap-3 ${compact ? 'text-xs' : 'text-sm'}`}>
            {timeSaved !== undefined && timeSaved > 0 && (
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium" title="Estimated Time Savings">
                    <Clock className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
                    <span>-{formatTime(timeSaved)}</span>
                </div>
            )}

            {costSaved !== undefined && costSaved > 0 && (
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium" title="Estimated Cost Savings">
                    <DollarSign className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
                    <span>-${costSaved.toFixed(2)}</span>
                </div>
            )}
        </div>
    );
};
