
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, CheckCircle, ExternalLink, X, FileCode, Lightbulb } from 'lucide-react';
import { OptimizationTip, Severity } from '../../../shared/types';
import { SeverityBadge } from './SeverityBadge';
import { ImpactBadge } from './ImpactBadge';
import { CodeDiff } from './CodeDiff';
import { ConfidenceMeter } from './ConfidenceMeter';
import { useToast } from '../../hooks/useToast';

interface OptimizationCardProps {
    optimization: OptimizationTip;
    expanded?: boolean;
    onToggle?: () => void;
    onApply?: () => void;
    onDismiss?: () => void;
    onViewInDag?: () => void;
}

export const OptimizationCard: React.FC<OptimizationCardProps> = ({
    optimization,
    expanded = false,
    onToggle,
    onApply,
    onDismiss,
    onViewInDag
}) => {
    const { title, description, severity, impactLevel, impactReasoning, evidenceBasis, codeSuggestion, confidence_score } = optimization;
    const { success } = useToast();
    const [isHovered, setIsHovered] = useState(false);

    const borderColors = {
        [Severity.HIGH]: 'border-l-red-500',
        [Severity.MEDIUM]: 'border-l-yellow-500',
        [Severity.LOW]: 'border-l-blue-500' // Changed from green to blue to match badge
    };

    const handleApply = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onApply) {
            onApply();
            success("Optimization applied successfully");
        }
    };

    return (
        <div
            className={`
        bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 
        border-l-4 ${borderColors[severity]} 
        transition-all duration-200 hover:shadow-md cursor-pointer
        ${expanded ? 'ring-2 ring-orange-100 dark:ring-slate-700' : ''}
      `}
            onClick={onToggle}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Header Summary */}
            <div className="p-4 flex items-start gap-4">
                <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                        <SeverityBadge severity={severity} size="sm" />
                        <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {title}
                        </span>
                        <div className="ml-auto flex items-center gap-4">
                            <ImpactBadge level={impactLevel} compact />
                            {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        </div>
                    </div>

                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2">
                        {description}
                    </p>
                </div>
            </div>

            {/* Expanded Details */}
            {expanded && (
                <div className="px-4 pb-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200 cursor-default" onClick={e => e.stopPropagation()}>

                    {/* Metadata Row */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                        <ConfidenceMeter score={confidence_score || 0} />
                        {evidenceBasis && evidenceBasis.length > 0 && (
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-400 uppercase">Evidence:</span>
                                <div className="flex gap-1 flex-wrap">
                                    {evidenceBasis.slice(0, 2).map((e, i) => (
                                        <span key={i} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-xs text-slate-500 rounded">{e}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Impact Reasoning */}
                    {impactReasoning && (
                        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                            <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-800 dark:text-amber-300 font-medium">{impactReasoning}</p>
                        </div>
                    )}

                    {/* Code Suggestion */}
                    {codeSuggestion && (
                        <div className="mt-4">
                            <CodeDiff
                                suggestedCode={codeSuggestion}
                            />
                        </div>
                    )}

                    {/* Repo Links */}
                    {optimization.relatedCodeSnippets && optimization.relatedCodeSnippets.length > 0 && (
                        <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                            <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2"><FileCode className="w-3 h-3" /> Linked Source Code</h4>
                            <div className="space-y-2">
                                {optimization.relatedCodeSnippets.map((snippet, idx) => (
                                    <div key={idx} className="flex items-center justify-between text-sm">
                                        <span className="font-mono text-slate-700 dark:text-slate-300 truncate" title={snippet.filePath}>
                                            {snippet.filePath.split('/').pop()}:{snippet.lineNumber}
                                        </span>
                                        <span className="text-xs text-slate-500">
                                            Line {snippet.lineNumber}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Actions Footer */}
                    <div className="flex items-center justify-end gap-3 pt-4 mt-2">
                        {onDismiss && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onDismiss(); }}
                                className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                            >
                                Dismiss
                            </button>
                        )}

                        {onViewInDag && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onViewInDag(); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors bg-white dark:bg-slate-900"
                            >
                                <ExternalLink className="w-3.5 h-3.5" />
                                View in DAG
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
