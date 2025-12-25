import React, { useEffect, useRef, useState } from 'react';
import { AgentJob } from '../../../shared/agent-types';
import { Loader2, CheckCircle2, Terminal, StopCircle, ArrowRight, Bot, Sparkles, Cpu, Code2 } from 'lucide-react';

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
    const [elapsedTime, setElapsedTime] = useState(0);

    // Auto-scroll logs
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [job.progress.logs]);

    // Timer for elapsed time
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (job.status !== 'completed' && job.status !== 'failed' && job.status !== 'cancelled') {
            interval = setInterval(() => {
                setElapsedTime(prev => prev + 0.1);
            }, 100);
        }
        return () => clearInterval(interval);
    }, [job.status]);

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
        <div className="max-w-3xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500">
            {/* Main Card with Glassmorphism */}
            <div className="relative bg-white dark:bg-[#0B1120] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-8 overflow-hidden">

                {/* Glowing Top Border */}
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-orange-500 via-purple-500 to-blue-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]"></div>

                {/* Background Ambient Glow */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/10 dark:bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-violet-500/10 dark:bg-violet-600/10 rounded-full blur-[80px] pointer-events-none translate-y-1/2 -translate-x-1/2"></div>

                {/* Header Section */}
                <div className="relative z-10 flex flex-col items-center text-center mb-10">
                    <div className="relative mb-6">
                        {job.status === 'completed' ? (
                            <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
                                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                            </div>
                        ) : (
                            <div className="relative">
                                {/* Ripple Effect */}
                                <div className="absolute inset-0 rounded-full border border-indigo-500/30 dark:border-indigo-500/30 animate-[ping_2s_ease-out_infinite]"></div>
                                <div className="absolute inset-0 rounded-full border border-violet-500/20 dark:border-violet-500/20 animate-[ping_3s_ease-out_infinite_delay-700ms]"></div>

                                <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-xl relative z-10">
                                    <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-indigo-500/10 dark:from-indigo-500/20 to-violet-500/10 dark:to-violet-500/20 animate-spin-slow"></div>
                                    <Loader2 className="w-8 h-8 text-indigo-500 dark:text-indigo-400 animate-spin" />
                                </div>
                            </div>
                        )}
                    </div>

                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white dark:bg-clip-text dark:text-transparent dark:bg-gradient-to-r dark:from-white dark:via-slate-200 dark:to-slate-400 mb-3 tracking-tight">
                        {job.status === 'completed' ? 'Analysis Complete' : 'Analyzing Your Query'}
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md leading-relaxed">
                        {job.status === 'completed'
                            ? 'Your execution plan has been successfully mapped to the codebase.'
                            : 'Our AI is reviewing your query plan and generating optimization recommendations...'
                        }
                    </p>
                </div>

                {/* Progress Bar Section */}
                <div className="relative z-10 mb-8">
                    <div className="flex justify-between text-xs font-semibold uppercase tracking-wider mb-3">
                        <span className="text-slate-600 dark:text-white">{job.progress.percentage}% complete</span>
                        <span className="text-slate-400 dark:text-slate-400 font-mono">{elapsedTime.toFixed(1)}s elapsed</span>
                    </div>
                    <div className="h-4 bg-slate-100 dark:bg-slate-800/50 rounded-full overflow-hidden border border-slate-200 dark:border-white/5 backdrop-blur-sm shadow-inner">
                        <div
                            className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-500 bg-[length:200%_100%] animate-gradient-x transition-all duration-500 ease-out relative"
                            style={{ width: `${job.progress.percentage}%` }}
                        >
                            {/* Striped overlay */}
                            <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem] animate-move-stripes"></div>

                            {/* Glowing tip */}
                            <div className="absolute right-0 top-0 bottom-0 w-1 bg-white/50 blur-[2px]"></div>
                        </div>
                    </div>
                </div>

                {/* Steps / Activities Panel */}
                <div className="relative z-10 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800/80 p-6 mb-8 backdrop-blur-md">
                    <div className="space-y-4">
                        {/* Static Steps for clearer visual progress */}
                        <div className="space-y-4">
                            <StepItem
                                status={getStepStatus(job.status, 'parsing')}
                                label="Parsing query plan"
                                time="~1s"
                            />
                            <StepItem
                                status={getStepStatus(job.status, 'repo')}
                                label="Building DAG structure"
                                time="~1s"
                            />
                            <StepItem
                                status={getStepStatus(job.status, 'analysis')}
                                label="Analyzing execution patterns"
                                isActive={job.status === 'analyzing_files'}
                            />
                            <StepItem
                                status={getStepStatus(job.status, 'mapping')}
                                label="Generating AI optimizations"
                                isActive={job.status === 'mapping_stages'}
                            />
                            <StepItem
                                status={getStepStatus(job.status, 'report')}
                                label="Calculating impact metrics"
                            />
                        </div>
                    </div>
                </div>

                {/* Cancel / View Results Actions */}
                <div className="relative z-10 flex justify-center">
                    {job.status === 'completed' ? (
                        <button
                            onClick={onViewResults}
                            className="relative group overflow-hidden rounded-xl p-[1px] focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                        >
                            <span className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 opacity-80 group-hover:opacity-100 transition-opacity duration-300"></span>
                            <span className="relative flex items-center justify-center gap-2 w-full bg-white dark:bg-slate-900 group-hover:bg-white/50 dark:group-hover:bg-slate-800/50 text-slate-900 dark:text-white px-8 py-3 rounded-[11px] font-bold text-sm transition-colors duration-300">
                                <span className="bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-200 bg-clip-text text-transparent">View Results</span>
                                <ArrowRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400 group-hover:translate-x-1 transition-transform" />
                            </span>
                        </button>
                    ) : (
                        <button
                            onClick={onCancel}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-sm font-medium transition-colors px-4 py-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg flex items-center gap-2"
                        >
                            Cancel Analysis
                        </button>
                    )}
                </div>

                {/* Footer Tip */}
                {job.status !== 'completed' && (
                    <div className="mt-8 pt-6 border-t border-slate-200 dark:border-white/5 text-center">
                        <p className="text-slate-500 text-xs flex items-center justify-center gap-2">
                            <Sparkles className="w-3 h-3 text-amber-500" />
                            Tip: Larger query plans may take up to 30 seconds to analyze thoroughly
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

// Helper for step status
const getStepStatus = (jobStatus: string, step: string) => {
    // Logic to determine if a step is done, active or pending
    // This is a simplified mapping for visual purposes
    const stages = ['queued', 'fetching_repo', 'analyzing_files', 'mapping_stages', 'finalizing', 'completed'];
    const stepMap = {
        'parsing': 0,
        'repo': 1,
        'analysis': 2,
        'mapping': 3,
        'report': 4
    };

    // Map job status to an index
    let currentStageIndex = stages.indexOf(jobStatus);
    if (jobStatus === 'completed') currentStageIndex = 5;

    const stepIndex = stepMap[step as keyof typeof stepMap];

    if (currentStageIndex > stepIndex) return 'completed';
    if (currentStageIndex === stepIndex) return 'active';
    return 'pending';
};

const StepItem = ({ status, label, time, isActive }: { status: string, label: string, time?: string, isActive?: boolean }) => {
    return (
        <div className="flex items-center gap-4">
            <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                {status === 'completed' && (
                    <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                        <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    </div>
                )}
                {status === 'active' && (
                    <div className="relative">
                        <div className="absolute inset-0 rounded-full border-2 border-indigo-200 dark:border-white/20"></div>
                        <div className="absolute inset-0 rounded-full border-t-2 border-indigo-500 dark:border-white animate-spin"></div>
                        <div className="w-6 h-6 rounded-full"></div>
                    </div>
                )}
                {status === 'pending' && (
                    <div className="w-6 h-6 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50"></div>
                )}
            </div>
            <div className="flex-1 flex justify-between items-center">
                <span className={`text-sm font-medium ${status === 'completed' ? 'text-emerald-600 dark:text-emerald-400' :
                    status === 'active' ? 'text-slate-900 dark:text-white' :
                        'text-slate-400 dark:text-slate-500'
                    }`}>
                    {label}
                </span>
                {status === 'completed' && time && (
                    <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">{time}</span>
                )}
                {isActive && (
                    <Loader2 className="w-3 h-3 text-slate-500 animate-spin" />
                )}
            </div>
        </div>
    );
}
