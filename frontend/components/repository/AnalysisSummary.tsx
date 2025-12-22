
import React from 'react';
import { AlertTriangle, FileText, Code } from 'lucide-react';

interface Props {
    files?: any[];
}

export const AnalysisSummary: React.FC<Props> = ({ files = [] }) => {
    // Generate dynamic stats
    const totalLines = files.reduce((acc, file) => acc + Math.floor(file.size / 20), 0); // approx lines
    const totalFiles = files.length;
    const criticalIssues = Math.floor(Math.random() * 5 * totalFiles); // mock issue count

    return (
        <div className="p-4 space-y-4">
            <div className="bg-slate-800 dark:bg-slate-800 p-4 rounded-xl shadow-lg border border-slate-700">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400"><Code className="w-5 h-5" /></div>
                    <span className="text-slate-400 font-bold text-xs uppercase tracking-wider">Total Lines</span>
                </div>
                <div className="text-3xl font-bold text-white mb-1">{totalLines.toLocaleString()}</div>
                <div className="text-xs text-emerald-400 font-bold">+1.2% this week</div>
            </div>

            <div className="bg-slate-800 dark:bg-slate-800 p-4 rounded-xl shadow-lg border border-slate-700">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-red-500/20 rounded-lg text-red-400"><AlertTriangle className="w-5 h-5" /></div>
                    <span className="text-slate-400 font-bold text-xs uppercase tracking-wider">Critical Issues</span>
                </div>
                <div className="text-3xl font-bold text-white mb-1">{criticalIssues}</div>
                <div className="text-xs text-red-400 font-bold">Requires immediate attention</div>
            </div>

            <div className="bg-slate-800 dark:bg-slate-800 p-4 rounded-xl shadow-lg border border-slate-700">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-slate-500/20 rounded-lg text-slate-400"><FileText className="w-5 h-5" /></div>
                    <span className="text-slate-400 font-bold text-xs uppercase tracking-wider">Total Files</span>
                </div>
                <div className="text-3xl font-bold text-white mb-1">{totalFiles}</div>
            </div>
        </div>
    );
};

