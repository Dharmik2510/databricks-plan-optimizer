import React from 'react';
import { CloudInstance } from '../../../shared/types';

interface Props {
    instances: CloudInstance[];
    onSelect: (instance: CloudInstance) => void;
    loading: boolean;
}

export const InstanceGrid: React.FC<Props> = ({ instances, onSelect, loading }) => {
    if (loading) {
        return (
            <div className="flex-1 p-8 flex items-center justify-center">
                <div className="relative">
                    <div className="w-12 h-12 rounded-full border-4 border-slate-200 dark:border-slate-700/50"></div>
                    <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
                </div>
            </div>
        );
    }

    // Group by family (first letter or first part before dot)
    const grouped = instances.reduce((acc, instance) => {
        // Extract family properly. API might give 'c6g', 'm5', etc. 
        // Fallback if family not set (though we added it)
        let family = instance.family || instance.name.split('.')[0];

        // Group families strictly by first letter first? 
        // The reference UI groups by First Letter -> Family Group.
        // e.g. "C" -> [c1, c3, c4...].
        // Let's group by Family Name first.

        // Clean family name
        family = family.toLowerCase();

        if (!acc[family]) acc[family] = [];
        acc[family].push(instance);
        return acc;
    }, {} as Record<string, CloudInstance[]>);

    // Group families by first letter for the "Section" headers (A, C, D, F...)
    const sectionedResults = Object.entries(grouped).reduce((acc, [family, familyInstances]) => {
        const letter = family.charAt(0).toUpperCase();
        if (!acc[letter]) acc[letter] = {};
        acc[letter][family] = familyInstances;
        return acc;
    }, {} as Record<string, Record<string, CloudInstance[]>>);

    const sortedLetters = Object.keys(sectionedResults).sort();

    return (
        <div className="flex-1 p-8 overflow-y-auto bg-slate-50 dark:bg-slate-950/30 backdrop-blur-sm transition-colors">
            {instances.length === 0 ? (
                <div className="text-center text-slate-500 mt-20 flex flex-col items-center">
                    <div className="w-16 h-16 bg-slate-200 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4 text-slate-400 dark:text-slate-600 transition-colors">
                        <span className="text-2xl font-bold">?</span>
                    </div>
                    <p className="text-lg font-medium text-slate-600 dark:text-slate-400 transition-colors">No instances match your filters</p>
                    <p className="text-sm text-slate-500 dark:text-slate-600 mt-1 transition-colors">Try adjusting your search or filters</p>
                </div>
            ) : (
                <div className="space-y-10">
                    {sortedLetters.map(letter => (
                        <div key={letter} className="flex gap-6">
                            {/* Big Letter Label */}
                            <div className="w-8 pt-2 flex-shrink-0 text-2xl font-bold text-slate-300 dark:text-slate-700 uppercase font-mono transition-colors">
                                {letter}
                            </div>

                            {/* Families Grid for this letter */}
                            <div className="flex-1 flex flex-wrap gap-4">
                                {Object.entries(sectionedResults[letter]).sort().map(([family, famInstances]) => {
                                    // Sort instances within family by size (vCPUs)
                                    const sortedInstances = famInstances.sort((a, b) => a.vCPUs - b.vCPUs);

                                    return (
                                        <div key={family} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-2xl p-4 min-w-[220px] shadow-sm hover:border-indigo-500/30 transition-all duration-300">
                                            <div className="flex items-center gap-3 mb-3 pb-3 border-b border-slate-100 dark:border-white/5 transition-colors">
                                                <div className="p-1.5 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg transition-colors">
                                                    <span className="text-indigo-600 dark:text-indigo-400 font-bold font-mono text-lg block leading-none transition-colors">{family}</span>
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md transition-colors">
                                                    {famInstances.length} types
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                                {sortedInstances.map(inst => (
                                                    <button
                                                        key={inst.id}
                                                        onClick={() => onSelect(inst)}
                                                        className="col-span-1 text-left px-2.5 py-2 rounded-lg hover:bg-indigo-600 hover:shadow-lg hover:shadow-indigo-500/20 border border-transparent transition-all group relative overflow-hidden"
                                                        title={`${inst.displayName} - $${inst.pricePerHour}/hr`}
                                                    >
                                                        <div className="relative z-10">
                                                            <div className="text-sm font-bold text-slate-600 dark:text-slate-300 group-hover:text-white truncate font-mono transition-colors">
                                                                {inst.name.split('.')[1] || inst.name}
                                                            </div>
                                                            <div className="text-[10px] text-slate-500 group-hover:text-indigo-200 transition-colors font-medium mt-0.5">
                                                                {inst.vCPUs}v • {inst.memoryGB}G
                                                            </div>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
