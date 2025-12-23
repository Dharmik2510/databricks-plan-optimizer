import React, { useEffect, useRef, useState } from 'react';
import { AgentJob } from '../../../shared/agent-types';
import { Loader2, CheckCircle2, Terminal, FileCode2, GitBranch, Play, StopCircle, ArrowRight, Bot, Sparkles, Search, Brain, Code2, CheckCircle } from 'lucide-react';

interface AgentProgressTrackerProps {
    job: AgentJob;
    onCancel: () => void;
    onViewResults: () => void;
}

export const AgentProgressTracker: React.FC<AgentProgressTrackerProps> = ({
    job,
    onCancel,
    onViewResults
}) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [agentActions, setAgentActions] = useState<string[]>([]);

    // Auto-scroll logs
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [job.progress.logs]);

    // Generate agent action steps based on current status
    useEffect(() => {
        const actions: string[] = [];

        switch (job.status) {
            case 'queued':
                actions.push('Initializing AI agent...');
                actions.push('Loading execution plan...');
                break;
            case 'fetching_repo':
                actions.push('Connected to repository');
                actions.push(`Cloning branch: ${job.repoConfig.branch}`);
                actions.push('Scanning directory structure...');
                if (job.progress.filesProcessed > 0) {
                    actions.push(`Discovered ${job.progress.totalFiles} code files`);
                }
                break;
            case 'analyzing_files':
                actions.push('Analyzing code structure and patterns');
                actions.push('Extracting functions and classes...');
                actions.push('Identifying data operations...');
                actions.push('Building dependency graph...');
                if (job.progress.filesProcessed > 0) {
                    actions.push(`Processed ${job.progress.filesProcessed}/${job.progress.totalFiles} files`);
                }
                break;
            case 'mapping_stages':
                actions.push('Mapping execution plan to codebase');
                actions.push('Analyzing semantic relationships...');
                actions.push('Matching tables and operations...');
                actions.push('Calculating confidence scores...');
                if (job.progress.stagesMapped > 0) {
                    actions.push(`Mapped ${job.progress.stagesMapped}/${job.progress.totalStages} stages`);
                }
                break;
            case 'finalizing':
                actions.push('Generating final report...');
                actions.push('Calculating statistics...');
                actions.push('Building repository summary...');
                break;
            case 'completed':
                actions.push('Analysis complete!');
                actions.push(`Successfully mapped ${job.progress.stagesMapped} stages`);
                actions.push(`Analyzed ${job.progress.filesProcessed} files`);
                break;
            case 'failed':
                actions.push('Agent encountered an error');
                break;
            case 'cancelled':
                actions.push('Analysis cancelled by user');
                break;
        }

        setAgentActions(actions);
    }, [job.status, job.progress.filesProcessed, job.progress.totalFiles, job.progress.stagesMapped, job.progress.totalStages, job.repoConfig.branch]);



    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white dark:bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-200 dark:border-slate-700/50 p-6 shadow-xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                            {job.status === 'completed' ? 'Mapping Complete' : 'Analyzing Plan & Code'}
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">
                            Job ID: <span className="font-mono text-slate-600 dark:text-slate-500">{job.id}</span>
                        </p>
                    </div>
                    {job.status === 'completed' ? (
                        <button onClick={onViewResults} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg flex items-center gap-2 font-medium transition-colors shadow-lg shadow-emerald-500/20">
                            View Results <ArrowRight className="w-4 h-4" />
                        </button>
                    ) : (
                        <button onClick={onCancel} className="px-4 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg flex items-center gap-2 font-medium transition-colors">
                            <StopCircle className="w-4 h-4" /> Cancel
                        </button>
                    )}
                </div>

                {/* Progress Bar */}
                <div className="mb-8">
                    <div className="flex justify-between text-sm mb-2">
                        <span className="text-slate-600 dark:text-slate-300 font-medium">{job.progress.percentage}% Complete</span>
                        <span className="text-slate-500 dark:text-slate-400">{job.progress.currentPhase}</span>
                    </div>
                    <div className="h-2 bg-slate-200 dark:bg-slate-700/50 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-500 ease-out"
                            style={{ width: `${job.progress.percentage}%` }}
                        />
                    </div>
                </div>



                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700/50">
                        <div className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider mb-1">Files Processed</div>
                        <div className="text-xl font-mono text-slate-900 dark:text-white">
                            {job.progress.filesProcessed} <span className="text-slate-400 dark:text-slate-600 text-sm">/ {job.progress.totalFiles}</span>
                        </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700/50">
                        <div className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider mb-1">Stages Mapped</div>
                        <div className="text-xl font-mono text-slate-900 dark:text-white">
                            {job.progress.stagesMapped} <span className="text-slate-400 dark:text-slate-600 text-sm">/ {job.progress.totalStages}</span>
                        </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700/50">
                        <div className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider mb-1">Logs</div>
                        <div className="text-xl font-mono text-slate-900 dark:text-white">{job.progress.logs.length}</div>
                    </div>
                </div>

                {/* AI Agent Activity Feed */}
                <div className="bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-500/10 dark:to-indigo-500/10 rounded-xl border border-violet-200 dark:border-violet-500/30 p-5 mb-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="relative">
                            <div className="absolute inset-0 bg-violet-500 blur-md opacity-50 animate-pulse"></div>
                            <div className="relative bg-gradient-to-br from-violet-500 to-indigo-600 p-2 rounded-lg">
                                <Bot className="w-5 h-5 text-white" />
                            </div>
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-violet-900 dark:text-violet-100">AI Agent Activity</h3>
                            <p className="text-xs text-violet-600 dark:text-violet-300">Real-time processing updates</p>
                        </div>
                        {job.status !== 'completed' && job.status !== 'failed' && job.status !== 'cancelled' && (
                            <Sparkles className="w-4 h-4 text-violet-500 dark:text-violet-400 ml-auto animate-pulse" />
                        )}
                    </div>

                    <div className="space-y-2">
                        {agentActions.map((action, index) => {
                            const isLast = index === agentActions.length - 1;
                            const isCompleted = !isLast || job.status === 'completed';

                            return (
                                <div
                                    key={index}
                                    className={`flex items-start gap-3 p-3 rounded-lg transition-all duration-300 ${isLast && job.status !== 'completed' && job.status !== 'failed' && job.status !== 'cancelled'
                                        ? 'bg-white dark:bg-slate-800 border border-violet-300 dark:border-violet-500/50 shadow-sm'
                                        : 'bg-white/50 dark:bg-slate-800/50 border border-violet-100 dark:border-violet-500/20'
                                        }`}
                                >
                                    <div className="flex-shrink-0 mt-0.5">
                                        {isLast && job.status !== 'completed' && job.status !== 'failed' && job.status !== 'cancelled' ? (
                                            <Loader2 className="w-4 h-4 text-violet-600 dark:text-violet-400 animate-spin" />
                                        ) : isCompleted ? (
                                            <CheckCircle className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                                        ) : (
                                            <div className="w-4 h-4 rounded-full bg-violet-200 dark:bg-violet-500/30"></div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm ${isLast && job.status !== 'completed' && job.status !== 'failed' && job.status !== 'cancelled'
                                            ? 'text-violet-900 dark:text-violet-100 font-semibold'
                                            : 'text-violet-700 dark:text-violet-300'
                                            }`}>
                                            {action}
                                        </p>
                                    </div>
                                    {isLast && job.status !== 'completed' && job.status !== 'failed' && job.status !== 'cancelled' && (
                                        <div className="flex gap-1">
                                            <span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                            <span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                            <span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Logs Console */}
                <div className="bg-slate-900 dark:bg-slate-950 rounded-xl border border-slate-800 overflow-hidden font-mono text-sm">
                    <div className="p-2 border-b border-slate-800 bg-slate-800/50 flex items-center gap-2 text-slate-400">
                        <Terminal className="w-4 h-4" />
                        <span className="text-xs font-medium">Agent Logs</span>
                    </div>
                    <div ref={scrollRef} className="h-48 overflow-y-auto p-4 space-y-1.5 scrollbar-hide">
                        {job.progress.logs.length === 0 && (
                            <div className="text-slate-600 italic">Waiting for logs...</div>
                        )}
                        {job.progress.logs.map((log, i) => (
                            <div key={i} className="flex gap-2 text-xs">
                                <span className="text-slate-500 flex-shrink-0">
                                    {new Date(log.timestamp).toLocaleTimeString()}
                                </span>
                                <span className={`break-all ${log.level === 'error' ? 'text-red-400' :
                                    log.level === 'warn' ? 'text-amber-400' :
                                        log.level === 'debug' ? 'text-slate-500' :
                                            'text-slate-300'
                                    }`}>
                                    {log.message}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
