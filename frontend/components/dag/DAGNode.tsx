
import React, { memo } from 'react';
import { Database, GitCommit, Layers, Filter, ArrowRight, AlertOctagon, Activity } from 'lucide-react';

interface ComponentProps {
    node: any;
    selected: boolean;
    onClick: (e: React.MouseEvent) => void;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    theme: 'light' | 'dark';
}

const NodeIcon = ({ type }: { type: string }) => {
    const t = type.toLowerCase();
    if (t.includes('scan')) return <Database className="w-4 h-4" />;
    if (t.includes('join')) return <GitCommit className="w-4 h-4" />;
    if (t.includes('exchange') || t.includes('shuffle')) return <ArrowRight className="w-4 h-4" />;
    if (t.includes('filter')) return <Filter className="w-4 h-4" />;
    if (t.includes('aggregate')) return <Layers className="w-4 h-4" />;
    return <Activity className="w-4 h-4" />;
};

export const DAGNode: React.FC<ComponentProps> = memo(({ node, selected, onClick, onMouseEnter, onMouseLeave, theme }) => {
    const isDark = theme === 'dark';

    // Dynamic Styles based on state
    const isBottleneck = node.isBottleneck;
    const isHighCost = (node.estimatedCost || 0) > 50;

    const baseClasses = `
    group/node relative flex flex-col items-center justify-center
    w-[240px] p-3 rounded-xl border-2 transition-all duration-300 cursor-pointer
    ${selected ? 'ring-4 ring-indigo-500/30 scale-105' : 'hover:scale-[1.02]'}
  `;

    const colorClasses = isBottleneck
        ? 'bg-red-50 dark:bg-red-950/30 border-red-400 dark:border-red-600 shadow-lg shadow-red-500/10'
        : isHighCost
            ? 'bg-orange-50 dark:bg-orange-950/30 border-orange-400 dark:border-orange-600 shadow-lg shadow-orange-500/10'
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-sm hover:border-indigo-400 dark:hover:border-indigo-600 hover:shadow-md';

    return (
        <div
            className={`${baseClasses} ${colorClasses}`}
            style={{
                position: 'absolute',
                transform: `translate(${node.x - 120}px, ${node.y - 40}px)`, // Centered based on x,y
                zIndex: selected ? 50 : 10
            }}
            onClick={onClick}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            {/* Header with Type Icon */}
            <div className="flex items-center gap-2 w-full mb-2">
                <div className={`
          p-1.5 rounded-lg
          ${isBottleneck ? 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}
        `}>
                    <NodeIcon type={node.type} />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">
                        {node.type}
                    </div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white truncate" title={node.name}>
                        {node.name}
                    </div>
                </div>
                {isBottleneck && (
                    <AlertOctagon className="w-5 h-5 text-red-500 animate-pulse" />
                )}
            </div>

            {/* Metrics Row */}
            <div className="flex items-center justify-between w-full pt-2 border-t border-slate-100 dark:border-slate-800/50">
                <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 font-medium">Rows</span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {node.rowsProcessed ? (node.rowsProcessed >= 1e6 ? `${(node.rowsProcessed / 1e6).toFixed(1)}M` : `${(node.rowsProcessed / 1e3).toFixed(1)}K`) : '-'}
                    </span>
                </div>

                {/* Mini Bar Chart / Sparkline representation of cost */}
                <div className="flex flex-col items-end w-16">
                    <span className="text-[10px] text-slate-400 font-medium">Est. Cost</span>
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-1">
                        <div
                            className={`h-full rounded-full ${isBottleneck ? 'bg-red-500' : 'bg-emerald-500'}`}
                            style={{ width: `${Math.min(100, node.estimatedCost || 0)}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Connector Dots for visual anchor */}
            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-400 dark:bg-slate-600 rounded-full border-2 border-white dark:border-slate-900" />
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-400 dark:bg-slate-600 rounded-full border-2 border-white dark:border-slate-900" />
        </div>
    );
});
