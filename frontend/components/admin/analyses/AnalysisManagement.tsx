import React, { useState, useEffect } from 'react';
import { Button } from '../../../design-system/components';
import * as adminAPI from '../../../api/admin';
import { Activity, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { AdminPageHeader } from '../shared/AdminPageHeader';
import { AnalysisTable, Analysis } from './AnalysisTable';

const AnalysisManagement: React.FC = () => {
    const [recentAnalyses, setRecentAnalyses] = useState<Analysis[]>([]);
    const [failedAnalyses, setFailedAnalyses] = useState<Analysis[]>([]);
    const [activeTab, setActiveTab] = useState<'recent' | 'failed'>('recent');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadAnalyses();
    }, []);

    const loadAnalyses = async () => {
        try {
            setLoading(true);
            const [recent, failed] = await Promise.all([
                adminAPI.getRecentAnalyses(50),
                adminAPI.getFailedAnalyses(50),
            ]);
            setRecentAnalyses(recent as unknown as Analysis[]);
            setFailedAnalyses(failed as unknown as Analysis[]);
        } catch (error) {
            console.error('Failed to load analyses:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8">
            <AdminPageHeader
                title="Analysis Management"
                subtitle="Monitor platform analyses, track performance, and troubleshoot issues"
            >
                <Button variant="outline" onClick={loadAnalyses} leftIcon={<RefreshCw className="w-4 h-4" />}>
                    Refresh Data
                </Button>
            </AdminPageHeader>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-100 dark:bg-emerald-900/20 rounded-full -mr-10 -mt-10 blur-2xl opacity-50 group-hover:opacity-100 transition-opacity"></div>
                    <div className="flex items-start justify-between relative z-10">
                        <div>
                            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Recent Analyses</p>
                            <h3 className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{recentAnalyses.length}</h3>
                            <div className="mt-4 flex items-center text-sm gap-2">
                                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                                    <CheckCircle className="w-4 h-4" />
                                    {recentAnalyses.filter((a) => a.status === 'COMPLETED').length} completed
                                </span>
                                <span className="text-slate-300 dark:text-slate-700">|</span>
                                <span className="text-slate-500 dark:text-slate-400">Last 50 records</span>
                            </div>
                        </div>
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl">
                            <Activity className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-red-100 dark:bg-red-900/20 rounded-full -mr-10 -mt-10 blur-2xl opacity-50 group-hover:opacity-100 transition-opacity"></div>
                    <div className="flex items-start justify-between relative z-10">
                        <div>
                            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Failed Analyses</p>
                            <h3 className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{failedAnalyses.length}</h3>
                            <div className="mt-4 flex items-center text-sm gap-2">
                                <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
                                    <AlertTriangle className="w-4 h-4" />
                                    Requires attention
                                </span>
                                <span className="text-slate-300 dark:text-slate-700">|</span>
                                <span className="text-slate-500 dark:text-slate-400">All failed records</span>
                            </div>
                        </div>
                        <div className="p-3 bg-red-50 dark:bg-red-900/30 rounded-xl">
                            <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="border-b border-slate-200 dark:border-slate-800 px-6 pt-2">
                    <div className="flex gap-8">
                        <button
                            onClick={() => setActiveTab('recent')}
                            className={`pb-4 pt-4 text-sm font-semibold relative transition-colors ${activeTab === 'recent'
                                ? 'text-indigo-600 dark:text-indigo-400'
                                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                }`}
                        >
                            Recent Analyses
                            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs transition-colors ${activeTab === 'recent'
                                ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                }`}>
                                {recentAnalyses.length}
                            </span>
                            {activeTab === 'recent' && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('failed')}
                            className={`pb-4 pt-4 text-sm font-semibold relative transition-colors ${activeTab === 'failed'
                                ? 'text-indigo-600 dark:text-indigo-400'
                                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                }`}
                        >
                            Failed Analyses
                            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs transition-colors ${activeTab === 'failed'
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                }`}>
                                {failedAnalyses.length}
                            </span>
                            {activeTab === 'failed' && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                            )}
                        </button>
                    </div>
                </div>

                <div className="p-0">
                    {activeTab === 'recent' && <AnalysisTable analyses={recentAnalyses} loading={loading} />}
                    {activeTab === 'failed' && <AnalysisTable analyses={failedAnalyses} showError loading={loading} />}
                </div>
            </div>
        </div>
    );
};

export default AnalysisManagement;
