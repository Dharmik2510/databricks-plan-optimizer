
import React from 'react';
import { Info } from 'lucide-react';

interface AnalysisDisclaimerProps {
    className?: string;
}

export const AnalysisDisclaimer: React.FC<AnalysisDisclaimerProps> = ({ className }) => (
    <div className={`flex items-start gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 ${className || ''}`}>
        <Info className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
        <span>
            Impact assessment is based on plan structure analysis only.
            Connect runtime metrics to quantify actual savings.
        </span>
    </div>
);
