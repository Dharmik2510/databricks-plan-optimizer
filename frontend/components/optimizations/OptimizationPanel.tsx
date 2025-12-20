
import React, { useState, useMemo } from 'react';
import { Filter, SortAsc, Sparkles, SlidersHorizontal } from 'lucide-react';
import { OptimizationTip, Severity } from '../../../shared/types';
import { OptimizationCard } from './OptimizationCard';
import { useToast } from '../../hooks/useToast';

interface OptimizationPanelProps {
    optimizations: OptimizationTip[];
    className?: string;
}

type SortOption = 'severity' | 'impact' | 'confidence';
type FilterOption = 'ALL' | Severity;

export const OptimizationPanel: React.FC<OptimizationPanelProps> = ({ optimizations, className }) => {
    const [filter, setFilter] = useState<FilterOption>('ALL');
    const [sortBy, setSortBy] = useState<SortOption>('severity');
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null); // Use index instead of ID
    const { success } = useToast();

    // Normalize Severities (Handle Backend 'HIGH' vs Frontend 'High')
    const normalizedOptimizations = useMemo(() => {
        return optimizations.map((opt, index) => {
            let normalizedSeverity = opt.severity;
            if (typeof opt.severity === 'string') {
                const s = opt.severity.toUpperCase();
                if (s === 'HIGH' || s === 'CRITICAL') normalizedSeverity = Severity.HIGH;
                else if (s === 'MEDIUM') normalizedSeverity = Severity.MEDIUM;
                else if (s === 'LOW') normalizedSeverity = Severity.LOW;
            }
            return { ...opt, severity: normalizedSeverity, originalIndex: index };
        });
    }, [optimizations]);

    const filteredAndSorted = useMemo(() => {
        let result = [...normalizedOptimizations];

        // Filter
        if (filter !== 'ALL') {
            result = result.filter(opt => opt.severity === filter);
        }

        // Sort
        result.sort((a, b) => {
            if (sortBy === 'severity') {
                const severityWeight = { [Severity.HIGH]: 3, [Severity.MEDIUM]: 2, [Severity.LOW]: 1 };
                return (severityWeight[b.severity] || 0) - (severityWeight[a.severity] || 0);
            }
            if (sortBy === 'impact') {
                return (b.estimated_cost_saved_usd || 0) - (a.estimated_cost_saved_usd || 0);
            }
            if (sortBy === 'confidence') {
                return (b.confidence_score || 0) - (a.confidence_score || 0);
            }
            return 0;
        });

        return result;
    }, [normalizedOptimizations, filter, sortBy]);

    const stats = useMemo(() => {
        return {
            total: normalizedOptimizations.length,
            critical: normalizedOptimizations.filter(o => o.severity === Severity.HIGH).length,
            savings: normalizedOptimizations.reduce((acc, curr) => acc + (curr.estimated_cost_saved_usd || 0), 0)
        };
    }, [normalizedOptimizations]);

    if (optimizations.length === 0) {
        return (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-8 text-center border border-slate-200 dark:border-slate-800">
                <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Excellent Work!</h3>
                <p className="text-slate-600 dark:text-slate-400">No optimizations found. Your execution plan looks highly efficient.</p>
            </div>
        );
    }

    return (
        <div className={`flex flex-col gap-6 ${className}`}>

            {/* Header & Stats */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        Optimization Opportunities
                        <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-xs rounded-full">
                            {stats.total} found
                        </span>
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Potential savings: <span className="font-bold text-emerald-600 dark:text-emerald-400">${stats.savings.toFixed(2)}</span> per run
                    </p>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    <button
                        onClick={() => setFilter('ALL')}
                        className={`
                px-3 py-1.5 rounded-md text-xs font-bold transition-all
                ${filter === 'ALL'
                                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}
              `}
                    >
                        All Items
                    </button>
                    {[Severity.HIGH, Severity.MEDIUM, Severity.LOW].map((sev) => (
                        <button
                            key={sev}
                            onClick={() => setFilter(sev)}
                            className={`
                px-3 py-1.5 rounded-md text-xs font-bold transition-all
                ${filter === sev
                                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}
              `}
                        >
                            {sev}
                        </button>
                    ))}
                </div>

                <div className="ml-auto flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-400">Sort by:</span>
                    <select
                        className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as SortOption)}
                    >
                        <option value="severity">Severity</option>
                        <option value="impact">Impact</option>
                        <option value="confidence">Confidence</option>
                    </select>
                </div>
            </div>

            {/* List */}
            <div className="space-y-4">
                {filteredAndSorted.map((opt) => (
                    <OptimizationCard
                        key={opt.originalIndex}
                        optimization={opt}
                        expanded={expandedIndex === opt.originalIndex}
                        onToggle={() => setExpandedIndex(expandedIndex === opt.originalIndex ? null : opt.originalIndex)}
                        onApply={() => { }}
                        onViewInDag={() => { }}
                    />
                ))}
            </div>
        </div>
    );
};
