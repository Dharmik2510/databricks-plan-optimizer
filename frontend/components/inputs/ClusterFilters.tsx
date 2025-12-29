import React from 'react';
import { Cpu, Server, Calculator, RotateCcw } from 'lucide-react';

interface Props {
    filters: {
        gpu: boolean; // Add GPU filter
        architecture: string[];
        minVcpu: number;
        maxVcpu: number | null;
        minMemory: number;
        maxMemory: number | null;
    };
    onFilterChange: (filters: any) => void;
    totalInstances: number;
}

const ARCHITECTURES = [
    { id: 'x86_64', label: 'x86_64 (Intel/AMD)' },
    { id: 'arm64', label: 'arm64 (Graviton)' },
    { id: 'i386', label: 'i386' },
];

const VCPU_OPTIONS = [1, 2, 4, 8, 16, 32, 48, 64, 96, 128];
const MEMORY_OPTIONS = [2, 4, 8, 16, 32, 64, 128, 256, 512];

export const ClusterFilters: React.FC<Props> = ({ filters, onFilterChange, totalInstances }) => {
    const toggleArchitecture = (arch: string) => {
        const newArchs = filters.architecture.includes(arch)
            ? filters.architecture.filter(a => a !== arch)
            : [...filters.architecture, arch];
        onFilterChange({ ...filters, architecture: newArchs });
    };

    const resetAll = () => {
        onFilterChange({
            gpu: false,
            architecture: [],
            minVcpu: 0,
            maxVcpu: null,
            minMemory: 0,
            maxMemory: null,
        });
    };

    return (
        <div className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-white/5 p-5 space-y-8 overflow-y-auto bg-slate-50 dark:bg-slate-950/30 h-full backdrop-blur-sm transition-colors">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest transition-colors">
                    Filters
                </h3>
                {/* Reset Button */}
                <button
                    onClick={resetAll}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline flex items-center gap-1 transition-colors"
                >
                    <RotateCcw className="w-3 h-3" />
                    Reset
                </button>
            </div>

            {/* Architecture */}
            <div className="space-y-3">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-bold text-sm transition-colors">
                    <Cpu className="w-4 h-4 text-indigo-500" />
                    Architecture
                </div>
                <div className="flex flex-wrap gap-2">
                    {ARCHITECTURES.map((arch) => (
                        <button
                            key={arch.id}
                            onClick={() => toggleArchitecture(arch.id)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${filters.architecture.includes(arch.id)
                                ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-500/20'
                                : 'bg-white dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:border-indigo-500/50 hover:text-indigo-600 dark:hover:text-slate-200 shadow-sm dark:shadow-none'
                                }`}
                        >
                            {arch.id}
                        </button>
                    ))}
                </div>
            </div>

            {/* GPU Filter */}
            <div className="space-y-3">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-bold text-sm transition-colors">
                    <Server className="w-4 h-4 text-purple-500" />
                    Capabilities
                </div>
                <label className="flex items-center gap-3 cursor-pointer group p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${filters.gpu ? 'bg-indigo-500 border-indigo-500 shadow-lg shadow-indigo-500/20' : 'border-slate-300 dark:border-slate-600 group-hover:border-indigo-400 bg-white dark:bg-slate-900'
                        }`}>
                        {filters.gpu && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <span className="text-sm text-slate-600 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200 font-medium transition-colors">GPU Instances Only</span>
                    {/* Hidden checkbox for accessibility */}
                    <input
                        type="checkbox"
                        className="hidden"
                        checked={filters.gpu}
                        onChange={(e) => onFilterChange({ ...filters, gpu: e.target.checked })}
                    />
                </label>
            </div>

            {/* vCPUs */}
            <div className="space-y-3">
                <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 font-bold text-sm transition-colors">
                    <div className="flex items-center gap-2">
                        <Calculator className="w-4 h-4 text-blue-500" />
                        vCPUs
                    </div>
                    <button
                        onClick={() => onFilterChange({ ...filters, minVcpu: 0, maxVcpu: null })}
                        className="text-xs text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    >
                        reset
                    </button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                    {VCPU_OPTIONS.map((vcpu) => (
                        <button
                            key={vcpu}
                            onClick={() => {
                                onFilterChange({ ...filters, minVcpu: vcpu, maxVcpu: vcpu });
                            }}
                            className={`px-1 py-1.5 text-xs font-bold rounded border transition-all ${filters.minVcpu === vcpu && filters.maxVcpu === vcpu
                                ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                                : 'bg-white dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:border-indigo-500/50 hover:text-indigo-600 dark:hover:text-slate-200 shadow-sm dark:shadow-none'
                                }`}
                        >
                            {vcpu}
                        </button>
                    ))}
                    <button
                        onClick={() => onFilterChange({ ...filters, minVcpu: 128, maxVcpu: null })}
                        className={`col-span-2 px-1 py-1.5 text-xs font-bold rounded border transition-all ${filters.minVcpu === 128 && filters.maxVcpu === null
                            ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                            : 'bg-white dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:border-indigo-500/50 hover:text-indigo-600 dark:hover:text-slate-200 shadow-sm dark:shadow-none'
                            }`}
                    >
                        128+
                    </button>
                </div>
            </div>

            {/* Memory */}
            <div className="space-y-3">
                <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 font-bold text-sm transition-colors">
                    <div className="flex items-center gap-2">
                        <Server className="w-4 h-4 text-pink-500" />
                        Memory (GiB)
                    </div>
                    <button
                        onClick={() => onFilterChange({ ...filters, minMemory: 0, maxMemory: null })}
                        className="text-xs text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    >
                        reset
                    </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                    {MEMORY_OPTIONS.map((mem) => (
                        <button
                            key={mem}
                            onClick={() => onFilterChange({ ...filters, minMemory: mem, maxMemory: mem })}
                            className={`px-1 py-1.5 text-xs font-bold rounded border transition-all ${filters.minMemory === mem && filters.maxMemory === mem
                                ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                                : 'bg-white dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:border-indigo-500/50 hover:text-indigo-600 dark:hover:text-slate-200 shadow-sm dark:shadow-none'
                                }`}
                        >
                            {mem}
                        </button>
                    ))}
                </div>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-white/5 transition-colors">
                <div className="text-xs text-slate-500 font-mono">
                    Showing <span className="font-bold text-slate-700 dark:text-slate-300">{totalInstances}</span> instances
                </div>
            </div>
        </div>
    );
};
