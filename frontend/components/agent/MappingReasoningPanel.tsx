/**
 * Mapping Reasoning Panel Component
 * 
 * "Why This Mapping?" panel with confidence breakdown and evidence.
 * 
 * @see design_summary.md Section 3: "Why This Mapping?" Panel
 */

import React from 'react';
import { CheckCircle2, XCircle, Code, ExternalLink } from 'lucide-react';
import { cn } from '../../lib/utils';

interface MappingReasoningPanelProps {
    node: any;
}

export const MappingReasoningPanel: React.FC<MappingReasoningPanelProps> = ({ node }) => {
    if (!node || !node.mapping) {
        return (
            <div className="p-8 text-center text-slate-400 dark:text-slate-600">
                <Code className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <div className="text-sm">Select a mapped node to view reasoning</div>
            </div>
        );
    }

    const { confidence, confidenceFactors, mapping, reasoning, alternatives } = node;

    return (
        <div className="space-y-6 p-6 overflow-y-auto h-full">
            {/* Header */}
            <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                    Why map "{node.operatorType}" to {mapping.symbol}()?
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                    Detailed confidence breakdown and evidence
                </p>
            </div>

            {/* Similarity Score Breakdown */}
            <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                    📊 Similarity Score Breakdown
                </h3>

                <div className="flex items-center gap-4 mb-6 p-4 bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-500/10 dark:to-violet-500/10 rounded-xl">
                    <div className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">
                        {Math.round(confidence)}%
                    </div>
                    <div className="flex-1">
                        <ConfidenceBadge confidence={confidence} />
                    </div>
                </div>

                {confidenceFactors && (
                    <div className="space-y-3">
                        <ScoreBar
                            label="Embedding Similarity"
                            value={confidenceFactors.embeddingScore * 100}
                            color="indigo"
                        />
                        <ScoreBar
                            label="AST Pattern Match"
                            value={confidenceFactors.astScore * 100}
                            color="violet"
                        />
                        <ScoreBar
                            label="LLM Confidence"
                            value={confidenceFactors.llmConfidence * 100}
                            color="blue"
                        />
                        <ScoreBar
                            label="Keyword Match"
                            value={confidenceFactors.keywordMatch * 100}
                            color="cyan"
                        />
                        {confidenceFactors.alternativesPenalty < 0 && (
                            <ScoreBar
                                label="Alternatives Penalty"
                                value={Math.abs(confidenceFactors.alternativesPenalty * 100)}
                                color="red"
                                isPenalty
                            />
                        )}
                    </div>
                )}
            </div>

            {/* Cited Evidence */}
            <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                    📝 Cited Evidence
                </h3>

                <div className="bg-slate-950 rounded-xl p-4 mb-3">
                    <div className="flex items-center justify-between mb-2">
                        <div className="text-xs text-slate-400 font-mono">
                            {mapping.file}:{mapping.lines}
                        </div>
                        <button className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" />
                            View Full File
                        </button>
                    </div>

                    {mapping.codeSnippet ? (
                        <pre className="text-sm text-slate-200 overflow-x-auto">
                            <code>{mapping.codeSnippet}</code>
                        </pre>
                    ) : (
                        <div className="text-sm text-slate-500 italic">Code snippet not available</div>
                    )}
                </div>

                {reasoning && (
                    <div className="space-y-2">
                        {extractMatches(reasoning).map((match, idx) => (
                            <div
                                key={idx}
                                className="flex items-start gap-2 text-sm text-emerald-600 dark:text-emerald-400"
                            >
                                <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                <span>{match}</span>
                            </div>
                        ))}
                    </div>
                )}

                {reasoning && (
                    <div className="mt-4 p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
                        <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                            Full Explanation
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                            {reasoning}
                        </div>
                    </div>
                )}
            </div>

            {/* Alternatives */}
            {alternatives && alternatives.length > 0 && (
                <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                        🔄 Alternatives Considered
                    </h3>

                    <div className="space-y-3">
                        {alternatives.map((alt, idx) => (
                            <AlternativeCard key={idx} alternative={alt} rank={idx + 2} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

/**
 * Confidence Badge
 */
const ConfidenceBadge: React.FC<{ confidence: number }> = ({ confidence }) => {
    const status = confidence >= 75 ? 'confirmed' : confidence >= 50 ? 'probable' : 'uncertain';
    const colors = {
        confirmed: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400',
        probable: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400',
        uncertain: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400',
    };

    return (
        <span className={cn('px-3 py-1 rounded-full text-sm font-semibold capitalize', colors[status])}>
            {status}
        </span>
    );
};

/**
 * Score Bar
 */
interface ScoreBarProps {
    label: string;
    value: number;
    color?: string;
    isPenalty?: boolean;
}

const ScoreBar: React.FC<ScoreBarProps> = ({ label, value, color = 'indigo', isPenalty = false }) => {
    const displayValue = Math.min(Math.max(value, 0), 100);

    // Use static classes since Tailwind doesn't support dynamic class interpolation
    const colorClasses: Record<string, string> = {
        indigo: 'bg-indigo-500',
        violet: 'bg-violet-500',
        blue: 'bg-blue-500',
        cyan: 'bg-cyan-500',
        emerald: 'bg-emerald-500',
        amber: 'bg-amber-500',
        red: 'bg-red-500',
    };

    return (
        <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400 w-40 flex-shrink-0">
                {isPenalty ? '⚠️' : ''} {label}
            </span>
            <div className="flex-1 h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                    className={cn(
                        'h-full transition-all duration-500 rounded-full',
                        isPenalty ? colorClasses.red : (colorClasses[color] || colorClasses.indigo)
                    )}
                    style={{ width: `${displayValue}%` }}
                />
            </div>
            <span className={cn(
                'text-sm font-bold w-12 text-right',
                isPenalty ? 'text-red-500' : 'text-slate-900 dark:text-white'
            )}>
                {isPenalty && '-'}{Math.round(value)}%
            </span>
        </div>
    );
};

/**
 * Alternative Card
 */
interface AlternativeCardProps {
    alternative: any;
    rank: number;
}

const AlternativeCard: React.FC<AlternativeCardProps> = ({ alternative, rank }) => {
    return (
        <div className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
            <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-600 dark:text-slate-400">
                    {rank}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                        {alternative.symbol}
                        {alternative.confidence && (
                            <span className="ml-2 text-xs text-slate-500">
                                ({Math.round(alternative.confidence * 100)}% confidence)
                            </span>
                        )}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                        {alternative.file}
                    </div>
                    <div className="flex items-start gap-2">
                        <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                            <span className="font-medium">Why rejected:</span> {alternative.reasoning}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

/**
 * Helper: Extract matches from reasoning text
 */
function extractMatches(reasoning: string): string[] {
    const matches: string[] = [];

    // Look for common patterns
    if (reasoning.includes('groupBy')) {
        matches.push('Matched: groupBy operation');
    }
    if (reasoning.includes('agg')) {
        matches.push('Matched: aggregation function');
    }
    if (reasoning.includes('filter')) {
        matches.push('Keyword: filter operation');
    }
    if (reasoning.includes('join')) {
        matches.push('Matched: join operation');
    }

    return matches;
}
