import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CloudInstance } from '../../../shared/types';
import { Search, X, Layers } from 'lucide-react';
import { ClusterFilters } from './ClusterFilters';
import { InstanceGrid } from './InstanceGrid';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (instance: CloudInstance) => void;
    instances: CloudInstance[];
    loading: boolean;
    currentInstance?: CloudInstance;
}

export const ClusterFinder: React.FC<Props> = ({
    isOpen,
    onClose,
    onSelect,
    instances,
    loading,
    currentInstance
}) => {
    const [search, setSearch] = useState('');
    const [filters, setFilters] = useState({
        gpu: false,
        architecture: [] as string[],
        minVcpu: 0,
        maxVcpu: null as number | null,
        minMemory: 0,
        maxMemory: null as number | null,
    });
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    // Filter logic
    const filteredInstances = useMemo(() => {
        return instances.filter(inst => {
            // Search
            if (search) {
                const query = search.toLowerCase();
                if (!inst.name.toLowerCase().includes(query) && !inst.displayName.toLowerCase().includes(query)) {
                    return false;
                }
            }

            // GPU Filter
            if (filters.gpu) {
                // Check if category is GPU or family starts with g/p
                const isGpu = inst.category === 'GPU' || inst.family?.startsWith('g') || inst.family?.startsWith('p');
                if (!isGpu) return false;
            }

            // Architecture
            if (filters.architecture.length > 0) {
                const arch = inst.architecture || 'x86_64';
                if (!filters.architecture.includes(arch)) return false;
            }

            // vCPU
            if (inst.vCPUs < filters.minVcpu) return false;
            if (filters.maxVcpu !== null && inst.vCPUs > filters.maxVcpu) return false;

            // Memory
            if (inst.memoryGB < filters.minMemory) return false;
            if (filters.maxMemory !== null && inst.memoryGB > filters.maxMemory) return false;

            return true;
        });
    }, [instances, search, filters]);

    if (!isOpen || !mounted) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-500/30 dark:bg-slate-950/80 backdrop-blur-md transition-colors" onClick={onClose} />

            <div className="relative bg-white dark:bg-slate-900 w-full max-w-7xl h-[85vh] rounded-[2rem] shadow-2xl dark:shadow-[0_0_50px_-12px_rgba(79,70,229,0.3)] border border-slate-200 dark:border-white/10 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 ring-1 ring-black/5 dark:ring-white/5 transition-colors">

                {/* Background decorators (Dark mode only) */}
                <div className="hidden dark:block absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none" />
                <div className="hidden dark:block absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[100px] pointer-events-none" />

                {/* Header */}
                <div className="relative z-10 flex items-center justify-between px-8 py-6 border-b border-slate-200 dark:border-white/5 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl transition-colors">
                    <div className="flex items-center gap-5 flex-1 min-w-0">
                        <div className="p-3 bg-indigo-50 dark:bg-gradient-to-br dark:from-indigo-500/20 dark:to-purple-500/20 rounded-xl border border-indigo-100 dark:border-white/5 shadow-sm dark:shadow-inner flex-shrink-0 transition-colors">
                            <Layers className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight whitespace-nowrap overflow-hidden text-overflow-ellipsis transition-colors">Instance Explorer</h2>
                            <div className="text-sm text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap overflow-hidden text-overflow-ellipsis transition-colors">
                                Select optimal cluster configuration
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Search Bar */}
                        <div className="relative w-72 group">
                            <div className="hidden dark:block absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-xl blur opacity-0 group-hover:opacity-100 transition-opacity" />
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors" />
                            <input
                                type="text"
                                placeholder="Search families (e.g. m5, c6)..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="relative w-full pl-12 pr-4 py-3 bg-slate-100 dark:bg-slate-950/50 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all shadow-sm dark:shadow-inner"
                                autoFocus
                            />
                        </div>

                        <button
                            onClick={onClose}
                            className="p-2.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-white border border-transparent dark:hover:border-white/5"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="relative z-10 flex flex-1 overflow-hidden bg-slate-50 dark:bg-slate-950/30 transition-colors">
                    {/* Sidebar Filters */}
                    <ClusterFilters
                        filters={filters}
                        onFilterChange={setFilters}
                        totalInstances={filteredInstances.length}
                    />

                    {/* Main Grid */}
                    <InstanceGrid
                        instances={filteredInstances}
                        onSelect={(inst) => {
                            onSelect(inst);
                            onClose();
                        }}
                        loading={loading}
                    />
                </div>

                {/* Footer */}
                <div className="relative z-10 px-8 py-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-white/5 text-xs text-slate-500 font-mono flex justify-between items-center transition-colors">
                    <span className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                        {filteredInstances.length} Available Instances
                    </span>
                    <span>Region: {instances[0]?.region || 'us-east-1'}</span>
                </div>
            </div>
        </div>,
        document.body
    );
};
