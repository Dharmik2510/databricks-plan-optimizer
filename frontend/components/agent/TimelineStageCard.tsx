/**
 * Timeline Stage Card Component
 * 
 * Displays individual pipeline stages with status, progress, and expandable artifacts.
 * 
 * @see design_summary.md Section 2: Agent Timeline Component
 */

import React, { useState } from 'react';
import {
    CheckCircle2,
    Loader2,
    Clock,
    XCircle,
    ChevronRight,
    FolderGit2,
    GitBranch,
    Brain,
    Search,
    Target,
    Filter as FilterIcon,
    Bot,
    Shield,
    Save,
} from 'lucide-react';
import { TimelineStage } from '../../store/useAgentMappingStore';
import { cn } from '../../lib/utils';

// Helper to format elapsed time
function formatElapsedTime(startTime: Date): string {
    const elapsed = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000);
    if (elapsed < 60) return `${elapsed}s elapsed`;
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    return `${mins}m ${secs}s elapsed`;
}

interface TimelineStageCardProps {
    stage: TimelineStage;
    isLast?: boolean;
}

const STAGE_ICONS: Record<string, React.ElementType> = {
    'Load Repository': FolderGit2,
    'Extract Semantics': Search,
    'Retrieve Candidates': Target,
    'Filter by AST': FilterIcon,
    'LLM Reasoning': Bot,
    'Confidence Check': Shield,
    'Persist Mapping': Save,
};

const STATUS_CONFIG = {
    queued: {
        icon: Clock,
        color: 'slate',
        borderStyle: 'border-dotted',
        bgColor: 'bg-slate-50 dark:bg-slate-800/30',
        textColor: 'text-slate-500 dark:text-slate-400',
        iconColor: 'text-slate-400',
    },
    running: {
        icon: Loader2,
        color: 'indigo',
        borderStyle: 'border-solid',
        bgColor: 'bg-indigo-50 dark:bg-indigo-500/10',
        textColor: 'text-slate-900 dark:text-white',
        iconColor: 'text-indigo-500',
        animate: true,
    },
    completed: {
        icon: CheckCircle2,
        color: 'emerald',
        borderStyle: 'border-solid',
        bgColor: 'bg-emerald-50 dark:bg-emerald-500/10',
        textColor: 'text-emerald-700 dark:text-emerald-400',
        iconColor: 'text-emerald-500',
    },
    failed: {
        icon: XCircle,
        color: 'red',
        borderStyle: 'border-solid',
        bgColor: 'bg-red-50 dark:bg-red-500/10',
        textColor: 'text-red-700 dark:text-red-400',
        iconColor: 'text-red-500',
    },
};

export const TimelineStageCard: React.FC<TimelineStageCardProps> = ({ stage }) => {
    const [expanded, setExpanded] = useState(false);

    const config = STATUS_CONFIG[stage.status];
    const StatusIcon = config.icon;
    const StageIcon = STAGE_ICONS[stage.name] || Brain;

    const hasArtifacts = stage.artifacts && stage.artifacts.length > 0;
    const hasError = stage.error;

    return (
        <div
            id={`stage-${stage.id}`}
            className={cn(
                'rounded-xl border-2 p-4 transition-all duration-300',
                config.borderStyle,
                config.bgColor,
                `border-${config.color}-500/${config.borderStyle === 'border-dotted' ? '30' : '50'}`,
                config.animate && 'animate-pulse-border shadow-lg'
            )}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Status Icon */}
                    <div className="flex-shrink-0">
                        <StatusIcon
                            className={cn(
                                'w-5 h-5',
                                config.iconColor,
                                config.animate && 'animate-spin'
                            )}
                        />
                    </div>

                    {/* Stage Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <StageIcon className="w-4 h-4 text-slate-500 dark:text-slate-400 flex-shrink-0" />
                            <h4 className={cn('font-semibold truncate', config.textColor)}>
                                {stage.name}
                                {stage.nodeIndex !== undefined && ` (Node ${stage.nodeIndex + 1})`}
                            </h4>
                        </div>
                        {stage.message && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                                {stage.message}
                            </p>
                        )}
                    </div>
                </div>

                {/* Status Badge */}
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    {stage.durationMs !== undefined && (
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                            {(stage.durationMs / 1000).toFixed(1)}s
                        </span>
                    )}
                    <span
                        className={cn(
                            'px-2 py-0.5 rounded-full text-xs font-medium',
                            config.color === 'indigo' || config.color === 'emerald' || config.color === 'red'
                                ? `bg-${config.color}-100 dark:bg-${config.color}-500/20 text-${config.color}-700 dark:text-${config.color}-400`
                                : 'bg-slate-100 dark:bg-slate-500/20 text-slate-700 dark:text-slate-400'
                        )}
                    >
                        {stage.status}
                    </span>
                </div>
            </div>

            {/* Progress Bar */}
            {stage.status === 'running' && (
                <div className="mb-3">
                    <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500 relative"
                            style={{ width: `${Math.min(stage.progress || 0, 100)}%` }}
                        >
                            <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem] animate-move-stripes" />
                        </div>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                            {Math.min(Math.round(stage.progress || 0), 100)}%
                        </span>
                        {stage.startTime && (
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                {formatElapsedTime(stage.startTime)}
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Error Display */}
            {hasError && (
                <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <div className="flex items-start gap-2">
                        <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-red-700 dark:text-red-400">
                                {stage.error!.code}
                            </div>
                            <div className="text-xs text-red-600 dark:text-red-300 mt-1">
                                {stage.error!.message}
                            </div>
                            {stage.error!.retryable && (
                                <div className="text-xs text-red-500 dark:text-red-400 mt-1 italic">
                                    This error is retryable
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Artifacts Toggle */}
            {hasArtifacts && (
                <div className="mt-3">
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                    >
                        <ChevronRight
                            className={cn(
                                'w-3 h-3 transition-transform',
                                expanded && 'rotate-90'
                            )}
                        />
                        {expanded ? 'Hide' : 'Show'} Artifacts ({stage.artifacts.length})
                    </button>

                    {expanded && (
                        <div className="mt-3 space-y-2 pl-4 border-l-2 border-slate-200 dark:border-slate-700 animate-in fade-in slide-in-from-top-2 duration-200">
                            {stage.artifacts.map((artifact, idx) => (
                                <ArtifactDisplay key={idx} artifact={artifact} />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

/**
 * Artifact Display Component
 */
interface ArtifactDisplayProps {
    artifact: any;
}

const ArtifactDisplay: React.FC<ArtifactDisplayProps> = ({ artifact }) => {
    const { type, data } = artifact;

    return (
        <div className="p-2 bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {formatArtifactType(type)}
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                {renderArtifactContent(type, data)}
            </div>
        </div>
    );
};

function formatArtifactType(type: string): string {
    const names: Record<string, string> = {
        'semantic_description': '📋 Semantic Description',
        'candidates': '🎯 Candidates Retrieved',
        'filtered_candidates': '🎭 Filtered Candidates',
        'llm_reasoning': '🤖 LLM Reasoning',
        'confidence_result': '✅ Confidence Result',
    };
    return names[type] || type;
}

function renderArtifactContent(type: string, data: any): React.ReactNode {
    if (!data) return <div className="italic">No data</div>;

    switch (type) {
        case 'semantic_description':
            return (
                <>
                    {data.operatorType && <div>• Type: {data.operatorType}</div>}
                    {data.keyColumns && data.keyColumns.length > 0 && (
                        <div>• Keys: {data.keyColumns.join(', ')}</div>
                    )}
                    {data.aggregateFunctions && data.aggregateFunctions.length > 0 && (
                        <div>• Aggs: {data.aggregateFunctions.join(', ')}</div>
                    )}
                </>
            );

        case 'candidates':
            if (data.topCandidates && data.topCandidates.length > 0) {
                return (
                    <>
                        <div>• Retrieved: {data.retrievedCount} candidates</div>
                        {data.topCandidates.slice(0, 3).map((c: any, i: number) => (
                            <div key={i} className="pl-2">
                                {i + 1}. {c.symbol} ({(c.score * 100).toFixed(0)}%) - {c.file}
                            </div>
                        ))}
                    </>
                );
            }
            break;

        case 'filtered_candidates':
            return (
                <>
                    <div>• Kept: {data.filteredCount} candidates</div>
                    <div>• Rejected: {data.rejectedCount}</div>
                    {data.filterReasoning && <div className="italic">"{data.filterReasoning}"</div>}
                </>
            );

        case 'llm_reasoning':
            return (
                <>
                    {data.selectedCandidate && (
                        <div>• Selected: {data.selectedCandidate.symbol} ({data.selectedCandidate.file})</div>
                    )}
                    {data.reasoning && (
                        <div className="italic mt-1">"{data.reasoning.substring(0, 100)}..."</div>
                    )}
                    {data.llmConfidence && (
                        <div>• LLM Confidence: {(data.llmConfidence * 100).toFixed(0)}%</div>
                    )}
                </>
            );

        case 'confidence_result':
            return (
                <>
                    {data.confidence && (
                        <div className="font-semibold">Overall: {(data.confidence * 100).toFixed(0)}%</div>
                    )}
                    {data.confidenceFactors && (
                        <div className="space-y-0.5 mt-1">
                            <div>• Embedding: {(data.confidenceFactors.embeddingScore * 100).toFixed(0)}%</div>
                            <div>• AST: {(data.confidenceFactors.astScore * 100).toFixed(0)}%</div>
                            <div>• LLM: {(data.confidenceFactors.llmConfidence * 100).toFixed(0)}%</div>
                            <div>• Keywords: {(data.confidenceFactors.keywordMatch * 100).toFixed(0)}%</div>
                        </div>
                    )}
                </>
            );
    }

    return <pre className="text-xs overflow-auto">{JSON.stringify(data, null, 2)}</pre>;
}
