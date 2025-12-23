import React, { useEffect, useRef } from 'react';
import { AgentJob } from '../../../shared/agent-types';
import { Loader2, CheckCircle2, Terminal, FileCode2, GitBranch, Play, StopCircle, ArrowRight } from 'lucide-react';

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

    // Auto-scroll logs
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [job.progress.logs]);

    const phasesContent = [
        { id: 'fetching_repo', label: 'Fetch Repo', icon: GitBranch },
        { id: 'analyzing_files', label: 'Analyze Files', icon: FileCode2 },
        { id: 'mapping_stages', label: 'Map Logic', icon: Play },
        { id: 'finalizing', label: 'Finalize', icon: CheckCircle2 },
    ];

    // Determine current phase index
    const phases = ['queued', 'fetching_repo', 'analyzing_files', 'mapping_stages', 'ai_inference', 'finalizing', 'completed'];
    const currentPhaseIndex = phases.indexOf(job.status);

    // Helper to map job status to UI steps
    const getPhaseStatus = (phaseId: string) => {
        const stepIdx = phasesContent.findIndex(p => p.id === phaseId);
        const targetIdx = phases.indexOf(phaseId);

        if (job.status === 'completed') return 'completed';
        if (job.status === 'failed' || job.status === 'cancelled') return 'error';

        if (currentPhaseIndex > targetIdx) return 'completed';
        if (job.status === phaseId) return 'active';
        return 'pending';
    };

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

                {/* Stages Steps */}
                <div className="grid grid-cols-4 gap-4 mb-8">
                    {phasesContent.map((phase) => {
                        const status = getPhaseStatus(phase.id);
                        const isActive = status === 'active';
                        const isCompleted = status === 'completed';
                        const Icon = phase.icon;

                        return (
                            <div key={phase.id} className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-colors ${isActive
                                ? 'bg-violet-50 dark:bg-violet-500/20 border-violet-200 dark:border-violet-500/50 text-violet-600 dark:text-violet-300'
                                : isCompleted
                                    ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                                    : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/50 text-slate-400 dark:text-slate-500'
                                }`}>
                                <div className={`p-2 rounded-full ${isActive ? 'bg-violet-100 dark:bg-violet-500/20' : isCompleted ? 'bg-emerald-100 dark:bg-emerald-500/20' : 'bg-slate-100 dark:bg-slate-700/50'
                                    }`}>
                                    {isActive ? <Loader2 className="w-4 h-4 animate-spin" /> :
                                        isCompleted ? <CheckCircle2 className="w-4 h-4" /> :
                                            <Icon className="w-4 h-4" />}
                                </div>
                                <span className="text-xs font-semibold">{phase.label}</span>
                            </div>
                        );
                    })}
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
