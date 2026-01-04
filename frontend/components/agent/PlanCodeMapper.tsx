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
    LayoutDashboard,
    AlertCircle,
    ChevronDown,
    Activity,
    GitCommit
} from 'lucide-react';
import { AgentProgressTracker } from './AgentProgressTracker';
import { MappingResultsView } from './MappingResultsView';
import { AgentMappingWorkspace } from './AgentMappingWorkspace';
import { useAgentMappingStore } from '../../store/useAgentMappingStore';
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

type ViewMode = 'input' | 'processing' | 'agentic_workspace' | 'results';

export const PlanCodeMapper: React.FC<PlanCodeMapperProps> = ({ onBack, initialPlanContent, initialRepoConfig, initialDagStages }) => {
    const [viewMode, setViewMode] = useState<ViewMode>('input');
    // Initialize with prop, but allow internal updates if we supported manual entry (though we are blocking it now per request)
    const [planContent, setPlanContent] = useState(initialPlanContent || '');
    const [planName, setPlanName] = useState('');
    const [repoUrl, setRepoUrl] = useState(initialRepoConfig?.url || '');
    const [branch, setBranch] = useState(initialRepoConfig?.branch || 'main');
    const [commitHash, setCommitHash] = useState('');
    const [token, setToken] = useState(initialRepoConfig?.token || '');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [job, setJob] = useState<AgentJob | null>(null);
    const [urlError, setUrlError] = useState<string>('');

    // Mobile Tab State for Workspace
    const [activeMobileTab, setActiveMobileTab] = useState<'plan' | 'code'>('plan');

    // Branch selection state
    const [availableBranches, setAvailableBranches] = useState<string[]>([]);
    const [isLoadingBranches, setIsLoadingBranches] = useState(false);
    const [showBranchDropdown, setShowBranchDropdown] = useState(false);

    // Agent store for SSE connection
    const { connectSSE, disconnectSSE, reset: resetAgentStore } = useAgentMappingStore(state => state.actions);
    const storeJobId = useAgentMappingStore(state => state.jobId);
    const storeStatus = useAgentMappingStore(state => state.status);

    const isValidGitHubUrl = (url: string): boolean => {
        if (!url) return true; // Empty is valid (no error shown)
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.toLowerCase();
            return hostname === 'github.com' || hostname.endsWith('.github.com');
        } catch {
            return false;
        }
    };

    useEffect(() => {
        if (repoUrl && !isValidGitHubUrl(repoUrl)) {
            setUrlError('Please enter a valid GitHub repository URL');
        } else {
            setUrlError('');
        }
    }, [repoUrl]);

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

    // Restore view if active job exists in store
    useEffect(() => {
        if (storeJobId && ['initializing', 'running', 'paused', 'completed'].includes(storeStatus)) {
            // If we have an active or completed job, restore the workspace view immediately
            // Reconnect SSE if not connected (though workspace handles it generally, good to be safe)
            const authToken = localStorage.getItem('accessToken') || '';
            // Only connect if it's not completed (completed jobs don't need live updates, but workspace might need data?)
            // Actually workspace usually fetches data on mount or via SSE. 
            // Let's just switch view. The workspace component will handle its own data fetching/SSE if needed.
            // BUT we need to ensure SSE is connected for live updates if it's running.
            if (['initializing', 'running', 'paused'].includes(storeStatus)) {
                connectSSE(storeJobId, authToken);
            }
            setViewMode('agentic_workspace');
        }
    }, []); // Run ONCE on mount

    // Poll for branches when repo URL changes
    useEffect(() => {
        const fetchRemoteBranches = async () => {
            if (repoUrl && isValidGitHubUrl(repoUrl)) {
                setIsLoadingBranches(true);
                try {
                    const branches = await client.fetchBranches(repoUrl, token);
                    if (branches && branches.length > 0) {
                        setAvailableBranches(branches);
                    }
                } catch (e) {
                    console.error("Failed to fetch branches", e);
                } finally {
                    setIsLoadingBranches(false);
                }
            } else {
                setAvailableBranches([]);
            }
        };
        const timer = setTimeout(fetchRemoteBranches, 1000); // 1s Debounce
        return () => clearTimeout(timer);
    }, [repoUrl, token]);

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

        if (!isValidGitHubUrl(repoUrl)) {
            setUrlError('Please enter a valid GitHub repository URL (e.g., https://github.com/username/repo)');
            return;
        }

        setIsLoading(true);
        setError(null);
        setUrlError('');

        try {
            // Use API client - backend is at /api/v1/agent/jobs
            const response = await client.post<any>('/agent/jobs', {
                // Match CreateAgentJobRequest interface
                planContent: planContent || '', // Required by backend
                planName: planName || 'Spark Execution Plan',
                repositoryUrl: repoUrl, // Backend expects repositoryUrl, not repoUrl
                branch: branch || 'main',
                commitHash: commitHash || undefined,
                token: token || undefined,
                dagStages: (initialDagStages || []).map((stage, idx) => ({
                    id: stage.id || `dag_stage_${idx}`,
                    name: stage.name,
                    type: stage.type || 'Unknown',
                    description: stage.description || stage.name,
                })),
            });

            // Extract jobId from response (handle multiple formats)
            const jobId = response?.jobId || response?.id || response?.data?.jobId || response?.data?.id;

            if (!jobId) {
                console.error('No jobId in response:', response);
                throw new Error('No job ID returned from server');
            }

            console.log('[PlanCodeMapper] Job created:', jobId);

            // Reset and connect to SSE stream
            resetAgentStore();

            // Get auth token from localStorage
            const authToken = localStorage.getItem('accessToken') || '';

            // Connect to SSE stream
            connectSSE(jobId, authToken);

            setViewMode('agentic_workspace');
        } catch (err: any) {
            setError(err.message || 'Failed to start mapping job');
        } finally {
            setIsLoading(false);
        }
    }, [planContent, planName, repoUrl, branch, commitHash, token, initialDagStages, connectSSE, resetAgentStore]);

    const handleCancelJob = () => {
        disconnectSSE();
        resetAgentStore();
        setJob(null);
        setViewMode('input');
    };

    const handleBackFromWorkspace = () => {
        disconnectSSE();
        // Do NOT reset store or setJob(null) here to allow resuming
        setViewMode('input');
    };

    const isConnected = useAgentMappingStore(state => state.isConnected);

    const handleResumeJob = () => {
        if (storeJobId) {
            // Only connect if not completed/failed AND not already connected
            if (['initializing', 'running', 'paused'].includes(storeStatus) && !isConnected) {
                const authToken = localStorage.getItem('accessToken') || '';
                connectSSE(storeJobId, authToken);
            }
            setViewMode('agentic_workspace');
        }
    };

    const handleDismissJob = () => {
        disconnectSSE();
        resetAgentStore();
        setJob(null);
    };

    // Case 1: Agentic Workspace (new design)
    if (viewMode === 'agentic_workspace') {
        return <AgentMappingWorkspace onBack={handleBackFromWorkspace} />;
    }

    // Case 2: Processing (legacy)
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
        <div className="h-full p-4 md:p-8 bg-slate-50 dark:bg-slate-900 overflow-y-auto">
            <div className="max-w-3xl mx-auto">
                {/* Helper Banner for Active/Completed Job */}
                {storeJobId && ['initializing', 'running', 'paused', 'completed', 'failed'].includes(storeStatus) && (
                    <div className="mb-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-xl flex items-center justify-between shadow-sm animate-fade-in-down">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${storeStatus === 'completed' ? 'bg-emerald-100 dark:bg-emerald-900/40' : storeStatus === 'failed' ? 'bg-red-100 dark:bg-red-900/40' : 'bg-indigo-100 dark:bg-indigo-900/40 animate-pulse'}`}>
                                {storeStatus === 'completed' ? (
                                    <Target className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                ) : storeStatus === 'failed' ? (
                                    <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                                ) : (
                                    <Activity className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                )}
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                                    {storeStatus === 'completed' ? 'Mapping Completed' : storeStatus === 'failed' ? 'Mapping Failed' : 'Mapping in Progress'}
                                </h4>
                                <p className="text-xs text-slate-600 dark:text-slate-400">
                                    {storeStatus === 'completed' ? 'Your code mapping is ready to view.' : storeStatus === 'failed' ? 'The last mapping job failed.' : 'A mapping job is currently running in the background.'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleDismissJob}
                                className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                            >
                                Dismiss
                            </button>
                            <button
                                onClick={handleResumeJob}
                                className={`px-4 py-2 text-white text-xs font-bold rounded-lg transition-all shadow-sm flex items-center gap-2 ${storeStatus === 'completed' ? 'bg-emerald-600 hover:bg-emerald-700' : storeStatus === 'failed' ? 'bg-slate-600 hover:bg-slate-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                            >
                                {storeStatus === 'completed' ? 'View Results' : storeStatus === 'failed' ? 'View Error' : 'Resume Mapping'}
                                <ChevronRight className="w-3 h-3" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Header */}
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                        Connect Repository
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400">
                        Map the analyzed execution plan to your source code
                    </p>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 md:gap-8">
                    {/* Main Content (2/3) */}
                    <div className="xl:col-span-2 space-y-6">
                        {/* Plan Context Banner */}
                        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30 rounded-xl flex items-center gap-3">
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
                        <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 bg-slate-50/50 dark:bg-slate-900/50 rounded-t-2xl">
                                <div className="p-2 bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg shadow-sm">
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
                                        className={`w-full bg-slate-50 dark:bg-slate-800/50 border ${urlError
                                            ? 'border-red-500 dark:border-red-500 focus:ring-red-500/20 focus:border-red-500'
                                            : 'border-slate-200 dark:border-slate-700 focus:ring-indigo-500/20 focus:border-indigo-500'
                                            } rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all font-medium`}
                                    />
                                    {urlError && (
                                        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-xs mt-2">
                                            <AlertCircle className="w-3 h-3" />
                                            <span>{urlError}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 block">Branch</label>
                                        <div className="relative">
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    placeholder="main"
                                                    value={branch}
                                                    onChange={(e) => {
                                                        setBranch(e.target.value);
                                                        setShowBranchDropdown(true);
                                                    }}
                                                    onFocus={(e) => {
                                                        setShowBranchDropdown(true);
                                                        e.target.select();
                                                    }}
                                                    onBlur={() => setTimeout(() => setShowBranchDropdown(false), 200)}
                                                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 pr-10 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                                                />
                                                <div
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer p-1"
                                                    onClick={() => setShowBranchDropdown(!showBranchDropdown)}
                                                >
                                                    {isLoadingBranches ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <ChevronDown className={`w-4 h-4 transition-transform ${showBranchDropdown ? 'rotate-180' : ''}`} />
                                                    )}
                                                </div>
                                            </div>

                                            {showBranchDropdown && availableBranches.length > 0 && (
                                                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                                    {(availableBranches.some(b => b.toLowerCase() === branch.toLowerCase())
                                                        ? availableBranches
                                                        : availableBranches.filter(b => b.toLowerCase().includes(branch.toLowerCase()))
                                                    ).map((b) => (
                                                        <button
                                                            key={b}
                                                            type="button"
                                                            className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700 ${b === branch ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-medium' : 'text-slate-700 dark:text-slate-200'
                                                                }`}
                                                            onClick={() => {
                                                                setBranch(b);
                                                                setShowBranchDropdown(false);
                                                            }}
                                                        >
                                                            <GitBranch className="w-3 h-3 opacity-50" />
                                                            {b}
                                                        </button>
                                                    ))}
                                                    {!availableBranches.some(b => b.toLowerCase() === branch.toLowerCase()) &&
                                                        availableBranches.filter(b => b.toLowerCase().includes(branch.toLowerCase())).length === 0 && (
                                                            <div className="px-4 py-2 text-xs text-slate-400 italic">
                                                                No matching branches found
                                                            </div>
                                                        )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 block">
                                            Commit Hash <span className="font-normal text-slate-400 lowercase">(optional)</span>
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. 7b3f1..."
                                            value={commitHash}
                                            onChange={(e) => setCommitHash(e.target.value)}
                                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium font-mono text-sm"
                                        />
                                    </div>
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

                            <div className="p-6 bg-slate-50 dark:bg-slate-900/30 border-t border-slate-200 dark:border-slate-800 rounded-b-2xl">
                                <button
                                    onClick={handleStartMapping}
                                    disabled={!planContent.trim() || !repoUrl.trim() || isLoading || !!urlError}
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
                    </div>

                    {/* Sidebar / Feature Cards (1/3) */}
                    <div className="space-y-4">
                        <div className="p-4 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl text-white shadow-xl shadow-indigo-500/20">
                            <Brain className="w-8 h-8 mb-4 opacity-90" />
                            <h3 className="text-lg font-bold mb-1">AI-Powered Mapping</h3>
                            <p className="text-indigo-100 text-sm leading-relaxed mb-4">
                                Our agent analyzes your execution plan and semantically matches it to your codebase using advanced AST parsing.
                            </p>
                            <div className="h-1 lg:w-16 bg-white/30 rounded-full" />
                        </div>

                        {[
                            { icon: Target, label: 'Precise Location', desc: 'Identifies exact file and lines' },
                            { icon: Workflow, label: 'Seamless Flow', desc: 'Integrated with plan analysis' }
                        ].map((feature, idx) => (
                            <div key={idx} className="p-5 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-start gap-4 hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors group">
                                <div className="p-2.5 bg-slate-100 dark:bg-slate-900 rounded-lg text-slate-500 dark:text-slate-400 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/20 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                    <feature.icon className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-1">{feature.label}</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{feature.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
