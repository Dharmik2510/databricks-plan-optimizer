import React, { useEffect, useState } from 'react';
import { FileClock, Activity, ChevronRight, Clock, AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react';
import { client } from '../api';
import { ActiveTab } from '../../shared/types';

interface RecentAnalysesProps {
    onViewAll: () => void;
    onSelectAnalysis: (id: string) => void;
}

export const RecentAnalyses: React.FC<RecentAnalysesProps> = ({ onViewAll, onSelectAnalysis }) => {
    const [analyses, setAnalyses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRecent = async () => {
            try {
                const data = await client.getRecentAnalyses();
                setAnalyses(data);
            } catch (error) {
                console.error("Failed to fetch recent analyses", error);
            } finally {
                setLoading(false);
            }
        };
        fetchRecent();
    }, []);

    if (loading) return <div className="text-center p-4 text-slate-500">Loading recent activity...</div>;
    if (!analyses.length) return null;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <FileClock className="w-5 h-5 text-slate-500" /> Recent Analyses
                </h2>
                <button
                    onClick={onViewAll}
                    className="text-sm text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-1"
                >
                    View All <ArrowRight className="w-4 h-4" />
                </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {analyses.map((analysis) => (
                    <div
                        key={analysis.id}
                        onClick={async () => {
                            // Quick fetch and nav
                            try {
                                // We rely on parent to handle navigation, but maybe we should pass data?
                                // For simplicity, let parent handle it.
                                // Parent currently just switches to History.
                                // Let's make parent load it.
                                onSelectAnalysis(analysis.id);
                            } catch (e) {
                                console.error(e);
                            }
                        }}
                        className="flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-orange-500/30 transition-all cursor-pointer group"
                    >
                        {/* Icon Box */}
                        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700 group-hover:bg-orange-50 dark:group-hover:bg-orange-900/20 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                            <Activity className="w-6 h-6" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-slate-900 dark:text-white truncate group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                                {analysis.title || 'Untitled Analysis'}
                            </h3>
                            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                                <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> {new Date(analysis.createdAt).toLocaleString(undefined, {
                                        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                    })}
                                </span>
                                <span className={`px-1.5 py-0.5 rounded-md font-bold uppercase text-[10px] ${analysis.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                    analysis.status === 'FAILED' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                        'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                    }`}>
                                    {analysis.status}
                                </span>
                            </div>
                        </div>

                        {/* Metrics */}
                        <div className="text-right shrink-0">
                            <div className="text-xs font-mono text-slate-500 dark:text-slate-500">
                                {analysis.processingMs ? `${analysis.processingMs}ms` : '-'}
                            </div>
                            <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600 ml-auto mt-1 group-hover:text-orange-500 dark:group-hover:text-orange-400 transition-colors" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
