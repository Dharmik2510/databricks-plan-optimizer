
import React from 'react';
import { PieChart, AlertOctagon, FileText, Code } from 'lucide-react';

export const AnalysisSummary: React.FC = () => {
    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg"><Code className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /></div>
                    <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Lines</span>
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white">142,893</div>
                <div className="text-xs text-emerald-500 font-medium mt-1">+1.2% this week</div>
            </div>

            <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-lg"><AlertOctagon className="w-5 h-5 text-red-600 dark:text-red-400" /></div>
                    <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Critical Issues</span>
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white">23</div>
                <div className="text-xs text-red-500 font-medium mt-1">Requires immediate attention</div>
            </div>

            <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg"><FileText className="w-5 h-5 text-slate-600 dark:text-slate-400" /></div>
                    <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Files</span>
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white">482</div>
            </div>
        </div>
    );
};
