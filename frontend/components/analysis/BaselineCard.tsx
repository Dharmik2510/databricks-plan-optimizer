
import React from 'react';
import { Clock, AlertTriangle, CheckCircle2, TrendingUp } from 'lucide-react';
import { AnalysisBaseline } from '../../../shared/types';

interface BaselineCardProps {
    baseline: AnalysisBaseline;
    darkMode?: boolean;
}

export const BaselineCard: React.FC<BaselineCardProps> = ({ baseline, darkMode = true }) => {
    const isMeasured = baseline.confidence === 'measured';
    const isApprox = baseline.confidence === 'approximate';

    const formatDuration = (seconds: number | null) => {
        if (!seconds) return 'N/A';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.round(seconds % 60);

        if (h > 0) return `${h}h ${m}m ${s}s`;
        return `${m}m ${s}s`;
    };

    return (
        <div className={`rounded-2xl p-6 border transition-all ${darkMode
            ? 'bg-slate-900/50 border-slate-800'
            : 'bg-white border-slate-200'
            }`}>
            <div className="flex items-center justify-between mb-4">
                <h4 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    <Clock className="w-4 h-4" />
                    Baseline Runtime
                </h4>
                <div className={`px-2 py-1 rounded-full text-xs font-bold border flex items-center gap-1 ${isMeasured
                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                    : isApprox
                        ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                        : 'bg-slate-500/10 text-slate-500 border-slate-500/20'
                    }`}>
                    {isMeasured && <CheckCircle2 className="w-3 h-3" />}
                    {isApprox && <AlertTriangle className="w-3 h-3" />}
                    {baseline.confidence.toUpperCase()}
                </div>
            </div>

            <div className="flex items-end gap-3 mb-6">
                <div className={`text-4xl font-black tracking-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                    {formatDuration(baseline.totalRuntimeSeconds)}
                </div>
                {baseline.totalRuntimeSeconds && (
                    <div className="text-sm text-slate-500 font-medium mb-1">
                        total duration
                    </div>
                )}
            </div>

            {baseline.topBottlenecks.length > 0 && (
                <div>
                    <h5 className={`text-xs font-bold uppercase mb-3 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        Top Bottlenecks
                    </h5>
                    <div className="space-y-2">
                        {baseline.topBottlenecks.map((stage, idx) => (
                            <div key={idx} className={`flex items-center justify-between p-2 rounded-lg text-sm ${darkMode ? 'bg-slate-800/50' : 'bg-slate-50'
                                }`}>
                                <div className="flex items-center gap-2">
                                    <TrendingUp className="w-3 h-3 text-red-500" />
                                    <span className={`font-mono ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                        {stage}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
