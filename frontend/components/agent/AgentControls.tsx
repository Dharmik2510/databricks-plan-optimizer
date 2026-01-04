/**
 * Agent Controls Component
 * 
 * Sticky control bar with Pause/Resume, Retry, and Settings buttons.
 * 
 * @see design_summary.md Section 4: Interactive Controls
 */

import React from 'react';
import {
    Pause,
    Play,
    Check,
    X,
} from 'lucide-react';
import { useAgentMappingStore } from '../../store/useAgentMappingStore';
import { cn } from '../../lib/utils';

interface AgentControlsProps {
    className?: string;
}

export const AgentControls: React.FC<AgentControlsProps> = ({ className }) => {
    // Store state
    const status = useAgentMappingStore(state => state.status);
    const isPaused = useAgentMappingStore(state => state.isPaused);
    const pauseAgent = useAgentMappingStore(state => state.actions.pauseAgent);
    const resumeAgent = useAgentMappingStore(state => state.actions.resumeAgent);

    const isRunning = status === 'running' || status === 'initializing';
    const canPause = isRunning && !isPaused;
    const canResume = isPaused;

    return (
        <div className={cn(
            'flex items-center gap-3 px-4 py-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700',
            className
        )}>
            {/* Pause/Resume Button */}
            <button
                onClick={() => isPaused ? resumeAgent() : pauseAgent()}
                disabled={!isRunning}
                className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all',
                    canPause && 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700',
                    canResume && 'bg-indigo-600 text-white hover:bg-indigo-700',
                    !isRunning && 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400'
                )}
            >
                {isPaused ? (
                    <>
                        <Play className="w-4 h-4" />
                        Resume
                    </>
                ) : (
                    <>
                        <Pause className="w-4 h-4" />
                        Pause
                    </>
                )}
            </button>

            {/* Status Indicator */}
            <div className="ml-auto flex items-center gap-2 text-sm">
                {status === 'running' && !isPaused && (
                    <span className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Processing...
                    </span>
                )}
                {isPaused && (
                    <span className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        Paused
                    </span>
                )}
                {status === 'completed' && (
                    <span className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                        <Check className="w-4 h-4" />
                        Completed
                    </span>
                )}
                {status === 'failed' && (
                    <span className="flex items-center gap-2 text-red-600 dark:text-red-400">
                        <X className="w-4 h-4" />
                        Failed
                    </span>
                )}
            </div>
        </div>
    );
};
