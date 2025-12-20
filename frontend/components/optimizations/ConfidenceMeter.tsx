
import React from 'react';

interface ConfidenceMeterProps {
    score: number; // 0-100
}

export const ConfidenceMeter: React.FC<ConfidenceMeterProps> = ({ score }) => {
    // Color gradient logic based on score
    const getColor = (s: number) => {
        if (s >= 80) return 'bg-emerald-500';
        if (s >= 50) return 'bg-yellow-500';
        return 'bg-red-500';
    };

    const color = getColor(score);
    const width = Math.min(Math.max(score, 5), 100); // Clamp between 5 and 100 for visibility

    return (
        <div className="flex items-center gap-2" title={`AI Confidence: ${score}%`}>
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                AI Confidence
            </div>
            <div className="h-2 w-24 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-500 ease-out ${color}`}
                    style={{ width: `${width}%` }}
                />
            </div>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                {score}%
            </span>
        </div>
    );
};
