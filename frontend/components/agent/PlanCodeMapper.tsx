/**
 * Plan Code Mapper Page
 * Main interface for execution plan to code mapping feature
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    GitBranch,
    Upload,
    Play,
    Loader2,
    XCircle,
    FileCode2,
    Workflow,
    Link2,
    ChevronRight,
    Settings2,
    Brain,
    Target,
    FolderGit2,
    LayoutDashboard
} from 'lucide-react';
import { AgentProgressTracker } from './AgentProgressTracker';
import { MappingResultsView } from './MappingResultsView';
import { AgentJob } from '../../../shared/agent-types';
import { client } from '../../api';

interface PlanCodeMapperProps {
    onBack?: () => void;
    initialPlanContent?: string;
    initialRepoConfig?: {
        url?: string;
        branch?: string;
        token?: string;
    };
    initialDagStages?: any[];
}

type ViewMode = 'input' | 'processing' | 'results';

export const PlanCodeMapper: React.FC<PlanCodeMapperProps> = ({ onBack, initialPlanContent, initialRepoConfig, initialDagStages }) => {
    const [viewMode, setViewMode] = useState<ViewMode>('input');
    // Initialize with prop, but allow internal updates if we supported manual entry (though we are blocking it now per request)
    const [planContent, setPlanContent] = useState(initialPlanContent || '');
    const [planName, setPlanName] = useState('');
    const [repoUrl, setRepoUrl] = useState(initialRepoConfig?.url || '');
    const [branch, setBranch] = useState(initialRepoConfig?.branch || 'main');
    const [token, setToken] = useState(initialRepoConfig?.token || '');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [job, setJob] = useState<AgentJob | null>(null);

    useEffect(() => {
        if (initialPlanContent) {
            setPlanContent(initialPlanContent);
        }
        if (initialRepoConfig) {
            if (initialRepoConfig.url) setRepoUrl(initialRepoConfig.url);
            if (initialRepoConfig.branch) setBranch(initialRepoConfig.branch);
            if (initialRepoConfig.token) setToken(initialRepoConfig.token);
        }
    }, [initialPlanContent, initialRepoConfig]);

    // Polling for job updates
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (viewMode === 'processing' && job && !['completed', 'failed', 'cancelled'].includes(job.status)) {
            interval = setInterval(async () => {
                try {
                    const updatedJob = await client.get<AgentJob>(`/agent/jobs/${job.id}`);
                    if (updatedJob) {
                        setJob(updatedJob);
                    }
                } catch (e) {
                    console.error('Polling error:', e);
                }
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [viewMode, job?.id, job?.status]);

    const handleStartMapping = useCallback(async () => {
        if (!planContent.trim() || !repoUrl.trim()) return;

        setIsLoading(true);
        setError(null);

        try {
            const data = await client.post<AgentJob>('/agent/jobs', {
                planContent,
                planName: planName || 'Untitled Plan',
                repositoryUrl: repoUrl,
                branch,
                token: token || undefined,
                dagStages: initialDagStages,
                options: {
                    maxConcurrentFiles: 50,
                }
            });

            setJob(data);
            setViewMode('processing');
        } catch (err: any) {
            setError(err.message || 'Failed to start mapping job');
        } finally {
            setIsLoading(false);
        }
    }, [planContent, planName, repoUrl, branch, token]);

    const handleCancelJob = async () => {
        if (job) {
            try {
                await client.post(`/agent/jobs/${job.id}/cancel`);
                setJob({ ...job, status: 'cancelled' });
            } catch (e) {
                console.error(e);
            }
        }
        setJob(null);
        setViewMode('input');
    };

    // Case 1: Processing
    if (viewMode === 'processing' && job) {
        return (
            <div className="h-full bg-slate-50 dark:bg-slate-900 p-8 overflow-y-auto">
                <AgentProgressTracker
                    job={job}
                    onCancel={handleCancelJob}
                    onViewResults={() => setViewMode('results')}
                />
            </div>
        );
    }

    // Case 2: Results
    if (viewMode === 'results' && job) {
        return (
            <div className="h-full bg-slate-50 dark:bg-slate-900">
                <MappingResultsView
                    job={job}
                    onBack={() => setViewMode('input')}
                    onRefresh={() => { }}
                    selectedStageId={selectedStageId}
                    onStageSelect={setSelectedStageId}
                />
            </div>
        );
    }

    // Case 3: No Plan Content (Empty State)
    if (!initialPlanContent || !planContent) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-900 animate-fade-in">
                <div className="max-w-md text-center">
                    <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-slate-200 dark:border-slate-700">
                        <LayoutDashboard className="w-10 h-10 text-slate-400 dark:text-slate-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">Analysis Required</h2>
                    <p className="text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
                        To map execution plans to your code, you first need to run an analysis on a query plan.
                    </p>
                    <button
                        onClick={onBack}
                        className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"
                    >
                        Go to Plan Analyzer <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        );
    }

    // Case 4: Input / Configuration (With Plan Context)
    return (
        <div className="h-full p-8 bg-slate-50 dark:bg-slate-900 overflow-y-auto">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                        Connect Repository
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400">
                        Map the analyzed execution plan to your source code
                    </p>
                </div>

                {/* Plan Context Banner */}
                <div className="mb-8 p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30 rounded-xl flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg text-indigo-600 dark:text-indigo-400">
                        <FileCode2 className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                        <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">Ready to map</div>
                        <div className="text-sm font-medium text-slate-900 dark:text-slate-200">Execution Plan Loaded ({Math.round(planContent.length / 1024)} KB)</div>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                        {planContent.split('\n').length} lines
                    </div>
                </div>

                {/* Repository Config Form */}
                <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 bg-slate-50/50 dark:bg-slate-900/50">
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg">
                            <GitBranch className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 dark:text-white">Repository Details</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Configure access to your source code</p>
                        </div>
                    </div>

                    <div className="p-6 space-y-6">
                        <div>
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 block">Repository URL</label>
                            <input
                                type="url"
                                placeholder="https://github.com/owner/repo"
                                value={repoUrl}
                                onChange={(e) => setRepoUrl(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 block">Branch</label>
                                <input
                                    type="text"
                                    placeholder="main"
                                    value={branch}
                                    onChange={(e) => setBranch(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 block">
                                    Access Token <span className="font-normal text-slate-400 lowercase">(optional)</span>
                                </label>
                                <input
                                    type="password"
                                    placeholder="ghp_xxxx"
                                    value={token}
                                    onChange={(e) => setToken(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                                />
                            </div>
                        </div>

                        {/* Advanced Options Toggle */}
                        <div className="pt-2">
                            <button
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                            >
                                <Settings2 className="w-4 h-4" />
                                Advanced Configuration
                                <ChevronRight className={`w-3 h-3 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} />
                            </button>

                            {showAdvanced && (
                                <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-4 animate-fade-in-down">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 block">Max Files to Scan</label>
                                        <input
                                            type="number"
                                            defaultValue={50}
                                            min={1}
                                            max={200}
                                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 block">Min Confidence %</label>
                                        <input
                                            type="number"
                                            defaultValue={40}
                                            min={0}
                                            max={100}
                                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="p-6 bg-slate-50 dark:bg-slate-900/30 border-t border-slate-200 dark:border-slate-800">
                        <button
                            onClick={handleStartMapping}
                            disabled={!planContent.trim() || !repoUrl.trim() || isLoading}
                            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:from-slate-300 disabled:to-slate-400 disabled:dark:from-slate-700 disabled:dark:to-slate-800 disabled:cursor-not-allowed rounded-xl font-bold text-white shadow-lg shadow-indigo-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-3"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Starting Agent...
                                </>
                            ) : (
                                <>
                                    <Play className="w-5 h-5" />
                                    Start Code Mapping
                                </>
                            )}
                        </button>

                        {error && (
                            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-xl border border-red-100 dark:border-red-800 text-sm flex items-start gap-3 animate-fade-in">
                                <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                <div>
                                    <span className="font-bold block mb-1">Mapping Failed</span>
                                    {error}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                        { icon: Brain, label: 'Smart Analysis', desc: 'Semantically matches operations to code' },
                        { icon: Target, label: 'Precise Location', desc: 'Identifies exact file and lines' },
                        { icon: Workflow, label: 'Seamless Flow', desc: 'Integrated with plan analysis' }
                    ].map((feature, idx) => (
                        <div key={idx} className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center text-center">
                            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full mb-3 text-slate-500 dark:text-slate-400">
                                <feature.icon className="w-5 h-5" />
                            </div>
                            <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-1">{feature.label}</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{feature.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
