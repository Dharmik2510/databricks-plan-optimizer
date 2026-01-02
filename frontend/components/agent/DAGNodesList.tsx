/**
 * DAG Nodes List Component
 * 
 * Left panel showing list of DAG nodes with confidence badges and status.
 * 
 * @see design_summary.md Section 5: Clean Layout Proposal
 */

import React, { useState } from 'react';
import { useAgentMappingStore } from '../../store/useAgentMappingStore';
import { CheckCircle2, AlertCircle, XCircle, Loader2, Clock, Search } from 'lucide-react';
import { cn } from '../../lib/utils';

export const DAGNodesList: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    // Use individual selectors to prevent creating new object references (fixes infinite loop)
    const dagNodes = useAgentMappingStore(state => state.dagNodes);
    const selectedNodeId = useAgentMappingStore(state => state.selectedNodeId);
    const selectNode = useAgentMappingStore(state => state.actions.selectNode);
    const statistics = useAgentMappingStore(state => state.statistics);

    // Filter nodes
    const filteredNodes = dagNodes.filter(node => {
        const matchesSearch = node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            node.operatorType.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' || node.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="h-full flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
            {/* Header */}
            <div className="sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm z-10 border-b border-slate-200 dark:border-slate-800 p-4">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        DAG Nodes
                    </h3>
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400">
                        {dagNodes.length} nodes
                    </span>
                </div>

                {/* Statistics */}
                {statistics && (
                    <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
                        <div className="text-center p-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10">
                            <div className="font-bold text-emerald-700 dark:text-emerald-400">
                                {statistics.confirmedMappings}
                            </div>
                            <div className="text-emerald-600 dark:text-emerald-500">Confirmed</div>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-amber-50 dark:bg-amber-500/10">
                            <div className="font-bold text-amber-700 dark:text-amber-400">
                                {statistics.probableMappings}
                            </div>
                            <div className="text-amber-600 dark:text-amber-500">Probable</div>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                            <div className="font-bold text-slate-700 dark:text-slate-400">
                                {statistics.unmappedNodes}
                            </div>
                            <div className="text-slate-600 dark:text-slate-500">Unmapped</div>
                        </div>
                    </div>
                )}

                {/* Search */}
                <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search nodes..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                </div>

                {/* Status Filter */}
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                >
                    <option value="all">All Status</option>
                    <option value="mapped">Mapped</option>
                    <option value="processing">Processing</option>
                    <option value="unmapped">Unmapped</option>
                    <option value="failed">Failed</option>
                </select>
            </div>

            {/* Nodes List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {filteredNodes.map(node => (
                    <DAGNodeCard
                        key={node.id}
                        node={node}
                        isSelected={node.id === selectedNodeId}
                        onClick={() => selectNode(node.id)}
                    />
                ))}

                {filteredNodes.length === 0 && (
                    <div className="text-center py-8 text-slate-400 dark:text-slate-600 text-sm">
                        No nodes found
                    </div>
                )}
            </div>
        </div>
    );
};

/**
 * DAG Node Card
 */
interface DAGNodeCardProps {
    node: any;
    isSelected: boolean;
    onClick: () => void;
}

const DAGNodeCard: React.FC<DAGNodeCardProps> = ({ node, isSelected, onClick }) => {
    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'processing':
                return { icon: Loader2, bgClass: 'bg-indigo-50 dark:bg-indigo-500/10', iconClass: 'text-indigo-500', animate: true };
            case 'mapped':
                return { icon: CheckCircle2, bgClass: 'bg-emerald-50 dark:bg-emerald-500/10', iconClass: 'text-emerald-500', animate: false };
            case 'unmapped':
                return { icon: XCircle, bgClass: 'bg-slate-100 dark:bg-slate-800', iconClass: 'text-slate-400', animate: false };
            case 'failed':
                return { icon: XCircle, bgClass: 'bg-red-50 dark:bg-red-500/10', iconClass: 'text-red-500', animate: false };
            default:
                return { icon: Clock, bgClass: 'bg-slate-100 dark:bg-slate-800', iconClass: 'text-slate-400', animate: false };
        }
    };

    const getConfidenceColors = (confidence: number) => {
        if (confidence >= 75) return { ring: 'stroke-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-400' };
        if (confidence >= 50) return { ring: 'stroke-amber-500', bg: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-400' };
        return { ring: 'stroke-red-500', bg: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-700 dark:text-red-400' };
    };

    const config = getStatusConfig(node.status);
    const StatusIcon = config.icon;
    const confidenceColors = node.confidence ? getConfidenceColors(node.confidence) : null;

    // Calculate circular progress
    const radius = 18;
    const circumference = 2 * Math.PI * radius;
    const progress = node.confidence || 0;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    return (
        <button
            onClick={onClick}
            className={cn(
                'w-full p-3 rounded-xl border-2 text-left transition-all duration-200 relative',
                isSelected
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/20 shadow-lg ring-2 ring-indigo-500/20'
                    : 'border-transparent hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50',
                config.bgClass
            )}
        >
            <div className="flex items-start gap-3">
                {/* Circular Progress / Status Icon */}
                <div className="relative flex-shrink-0">
                    {node.confidence !== undefined ? (
                        <div className="relative w-12 h-12">
                            <svg className="w-12 h-12 transform -rotate-90">
                                {/* Background circle */}
                                <circle
                                    cx="24"
                                    cy="24"
                                    r={radius}
                                    className="stroke-slate-200 dark:stroke-slate-700"
                                    strokeWidth="3"
                                    fill="transparent"
                                />
                                {/* Progress circle */}
                                <circle
                                    cx="24"
                                    cy="24"
                                    r={radius}
                                    className={cn('transition-all duration-500', confidenceColors?.ring || 'stroke-slate-400')}
                                    strokeWidth="3"
                                    fill="transparent"
                                    strokeDasharray={circumference}
                                    strokeDashoffset={strokeDashoffset}
                                    strokeLinecap="round"
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className={cn('text-xs font-bold', confidenceColors?.text || 'text-slate-500')}>
                                    {Math.round(node.confidence)}%
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                            <StatusIcon
                                className={cn(
                                    'w-5 h-5',
                                    config.iconClass,
                                    config.animate && 'animate-spin'
                                )}
                            />
                        </div>
                    )}
                </div>

                {/* Node Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                            Node {node.nodeIndex + 1}
                        </span>
                        {node.confidenceStatus && (
                            <span className={cn(
                                'text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize',
                                confidenceColors?.bg || 'bg-slate-100 dark:bg-slate-800',
                                confidenceColors?.text || 'text-slate-600 dark:text-slate-400'
                            )}>
                                {node.confidenceStatus}
                            </span>
                        )}
                    </div>

                    <div className="text-sm font-semibold text-slate-900 dark:text-white mb-0.5 truncate">
                        {node.name}
                    </div>

                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {node.operatorType}
                    </div>
                </div>
            </div>

            {/* Selection indicator */}
            {isSelected && (
                <div className="absolute -left-0.5 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-500 rounded-r-full" />
            )}
        </button>
    );
};
