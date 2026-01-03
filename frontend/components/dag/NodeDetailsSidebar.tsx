import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronDown, ChevronRight, AlertCircle, Quote, Copy, Check, Info } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getOperatorEducation } from '../../utils/sparkOperatorEducation';

// --- Types ---

export interface SelectedNode {
    id: string;
    label: string;
    operatorType: string | null;
    confidence: number | null; // 0..1
    evidence: Evidence[];
    metrics: Record<string, string | number>; // may be empty
    stageInfo: StageInfo | null;
    reasoningNotes: string | null;
}

export interface Evidence {
    text: string;
    file?: string;
    lineStart?: number;
    lineEnd?: number;
}

export interface StageInfo {
    stageId: string | number;
    attemptId?: number;
    status?: string;
    taskCount?: number;
    duration?: string;
}

interface NodeDetailsSidebarProps {
    selectedNode: SelectedNode | null;
    onClose: () => void;
    onCopyDetails: (text: string) => void;
}

// --- Components ---

const AccordionSection = ({
    title,
    children,
    defaultExpanded = false,
    icon: Icon = null
}: {
    title: string;
    children: React.ReactNode;
    defaultExpanded?: boolean;
    icon?: any;
}) => {
    const [expanded, setExpanded] = useState(defaultExpanded);

    return (
        <div className="border-b border-slate-100 dark:border-slate-800 last:border-0">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
                <div className="flex items-center gap-2 font-semibold text-sm text-slate-800 dark:text-slate-200">
                    {Icon && <Icon className="w-4 h-4 text-slate-500" />}
                    {title}
                </div>
                {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
            </button>
            {expanded && <div className="px-4 pb-4">{children}</div>}
        </div>
    );
};

export const NodeDetailsSidebar: React.FC<NodeDetailsSidebarProps> = ({
    selectedNode,
    onClose,
    onCopyDetails
}) => {
    // --- Resizable Logic ---
    const [width, setWidth] = useState(400);
    const [isResizing, setIsResizing] = useState(false);
    const sidebarRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;
            const newWidth = window.innerWidth - e.clientX;
            // Min 320px, Max 600px
            setWidth(Math.min(Math.max(newWidth, 320), 600));
        };

        const handleMouseUp = () => setIsResizing(false);

        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    // --- Content Helpers ---

    const renderContent = () => {
        if (!selectedNode) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-center p-8 text-slate-400 dark:text-slate-500">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                        <AlertCircle className="w-8 h-8 opacity-50" />
                    </div>
                    <h3 className="text-sm font-semibold mb-1">Select a Node</h3>
                    <p className="text-xs max-w-[200px]">
                        Click on any node in the DAG to view its details and analysis.
                    </p>
                </div>
            );
        }

        const hasSummary = !!(selectedNode.reasoningNotes || selectedNode.evidence.length > 0);
        const hasEvidence = selectedNode.evidence.length > 0;
        const hasMetrics = Object.keys(selectedNode.metrics).length > 0;
        const hasStageInfo = !!selectedNode.stageInfo;
        const isUnknown = !selectedNode.operatorType && !hasEvidence && !hasMetrics;

        const education = getOperatorEducation(selectedNode.operatorType);

        // Confidence Level
        const getConfidenceColor = (conf: number | null) => {
            if (conf === null) return 'text-slate-400 bg-slate-100 dark:bg-slate-800';
            if (conf >= 0.75) return 'text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400';
            if (conf >= 0.50) return 'text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400';
            return 'text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-400';
        };

        const getConfidenceLabel = (conf: number | null) => {
            if (conf === null) return '';
            if (conf >= 0.75) return 'High Confidence';
            if (conf >= 0.50) return 'Medium Confidence';
            return 'Low Confidence';
        };

        const handleCopy = () => {
            // Build a plain text representation of visible details
            const parts = [`Node: ${selectedNode.label}`];
            if (selectedNode.operatorType) parts.push(`Type: ${selectedNode.operatorType}`);

            if (selectedNode.reasoningNotes) {
                parts.push(`\nSummary:\n${selectedNode.reasoningNotes}`);
            }

            if (hasMetrics) {
                parts.push('\nMetrics:');
                Object.entries(selectedNode.metrics).forEach(([k, v]) => parts.push(`${k}: ${v}`));
            }

            onCopyDetails(parts.join('\n'));
        };

        return (
            <div className="flex flex-col h-full bg-white dark:bg-slate-900">
                {/* Header */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex-shrink-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                {selectedNode.operatorType && (
                                    <span className="px-2 py-0.5 text-xs font-bold uppercase rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 tracking-wider">
                                        {selectedNode.operatorType}
                                    </span>
                                )}
                                {selectedNode.confidence !== null && (
                                    <span className={cn("px-2 py-0.5 text-xs font-bold rounded-full", getConfidenceColor(selectedNode.confidence))}>
                                        {Math.round(selectedNode.confidence * 100)}%
                                    </span>
                                )}
                            </div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                                {selectedNode.label}
                            </h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"
                            aria-label="Close sidebar"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-900">

                    {/* Empty State: Not Enough Info */}
                    {isUnknown && (
                        <div className="p-8 text-center">
                            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                                <AlertCircle className="w-6 h-6 text-slate-400" />
                            </div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">
                                Not enough information
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                                We couldn't extract detailed analysis for this node.
                            </p>
                            <div className="text-xs text-left text-slate-500 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                                <strong>What's missing:</strong>
                                <ul className="list-disc ml-4 mt-1 space-y-0.5">
                                    <li>Operator type not identified</li>
                                    <li>No evidence from analysis</li>
                                    <li>No execution metrics available</li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* Summary Section */}
                    {hasSummary && (
                        <AccordionSection title="Analysis Summary" defaultExpanded>
                            {selectedNode.reasoningNotes ? (
                                <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                    {selectedNode.reasoningNotes.split('\n').map((line, i) => (
                                        <p key={i} className="mb-2 last:mb-0">{line}</p>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-slate-500 italic">No summary notes available.</p>
                            )}
                        </AccordionSection>
                    )}

                    {/* Evidence Section */}
                    {hasEvidence && (
                        <AccordionSection title="Evidence" icon={Quote}>
                            <div className="space-y-3">
                                {selectedNode.evidence.map((ev, i) => (
                                    <div key={i} className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                                        <blockquote className="text-xs font-mono text-slate-600 dark:text-slate-300 border-l-2 border-indigo-500 pl-2 mb-2">
                                            "{ev.text}"
                                        </blockquote>
                                        {ev.file && (
                                            <div className="text-[10px] text-slate-400 flex items-center gap-1">
                                                <span className="font-semibold">Source:</span>
                                                <span className="truncate" title={ev.file}>{ev.file.split('/').pop()}</span>
                                                {ev.lineStart && <span>:{ev.lineStart}-{ev.lineEnd}</span>}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </AccordionSection>
                    )}

                    {/* Metrics Section */}
                    {hasMetrics && (
                        <AccordionSection title="Metrics">
                            <div className="grid grid-cols-2 gap-3">
                                {Object.entries(selectedNode.metrics).map(([key, value]) => (
                                    <div key={key} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                            {key}
                                        </div>
                                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate" title={String(value)}>
                                            {value}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </AccordionSection>
                    )}

                    {/* Stage Info Section */}
                    {hasStageInfo && selectedNode.stageInfo && (
                        <AccordionSection title="Stage Execution">
                            <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                                <div>
                                    <span className="text-slate-500 block text-xs">Stage ID</span>
                                    <span className="font-mono text-slate-700 dark:text-slate-300">
                                        {selectedNode.stageInfo.stageId}
                                    </span>
                                </div>
                                {selectedNode.stageInfo.duration && (
                                    <div>
                                        <span className="text-slate-500 block text-xs">Duration</span>
                                        <span className="text-slate-700 dark:text-slate-300">
                                            {selectedNode.stageInfo.duration}
                                        </span>
                                    </div>
                                )}
                                {selectedNode.stageInfo.taskCount !== undefined && (
                                    <div>
                                        <span className="text-slate-500 block text-xs">Tasks</span>
                                        <span className="text-slate-700 dark:text-slate-300">
                                            {selectedNode.stageInfo.taskCount}
                                        </span>
                                    </div>
                                )}
                                {selectedNode.stageInfo.status && (
                                    <div>
                                        <span className="text-slate-500 block text-xs">Status</span>
                                        <span className={cn(
                                            "font-medium text-xs px-1.5 py-0.5 rounded",
                                            selectedNode.stageInfo.status.toLowerCase() === 'success' || selectedNode.stageInfo.status.toLowerCase() === 'completed'
                                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                                : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                        )}>
                                            {selectedNode.stageInfo.status}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </AccordionSection>
                    )}

                    {/* Education Section (Always Shown) */}
                    <div className="p-4 bg-indigo-50/50 dark:bg-indigo-900/10 border-t border-indigo-100 dark:border-indigo-900/30">
                        <div className="flex items-center gap-2 mb-2 text-indigo-700 dark:text-indigo-400">
                            <Info className="w-4 h-4" />
                            <h4 className="text-xs font-bold uppercase tracking-wider">
                                About this Operator
                            </h4>
                        </div>
                        <p className="text-sm text-slate-700 dark:text-slate-300 mb-3 leading-relaxed">
                            {education.explanation}
                        </p>
                        <a
                            href={education.learnMoreUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                            Learn more about {selectedNode.operatorType || 'Spark Operators'}
                            <ChevronRight className="w-3 h-3 ml-0.5" />
                        </a>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex-shrink-0">
                    <button
                        onClick={handleCopy}
                        className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-sm transition-all shadow-sm active:scale-[0.98]"
                    >
                        <Copy className="w-4 h-4" />
                        Copy Details
                    </button>
                </div>
            </div>
        );
    };

    return (
        <aside
            ref={sidebarRef}
            className="absolute top-0 right-0 bg-slate-50 dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 z-40 flex flex-col shadow-xl"
            style={{ width: `${width}px` }}
        >
            {/* Resizer Handle */}
            <div
                className="absolute top-0 left-0 w-1 h-full cursor-ew-resize hover:bg-indigo-500/50 transition-colors z-50 group"
                onMouseDown={() => setIsResizing(true)}
            >
                <div className="absolute top-1/2 left-0 w-1 h-8 -translate-y-1/2 bg-slate-300 dark:bg-slate-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            {renderContent()}
        </aside>
    );
};
