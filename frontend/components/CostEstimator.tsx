
import React, { useState, useEffect } from 'react';
import { DollarSign, Server, Clock, TrendingDown } from 'lucide-react';

interface Props {
  estimatedDurationMin?: number;
}

const INSTANCE_TYPES = [
  { name: 'General Purpose (m5.xlarge)', dbus: 1.5, pricePerHour: 0.40 },
  { name: 'Memory Optimized (r5.xlarge)', dbus: 2.0, pricePerHour: 0.60 },
  { name: 'Compute Optimized (c5.xlarge)', dbus: 1.2, pricePerHour: 0.35 },
  { name: 'Storage Optimized (i3.xlarge)', dbus: 3.0, pricePerHour: 0.90 },
];

export const CostEstimator: React.FC<Props> = ({ estimatedDurationMin = 15 }) => {
  const [numNodes, setNumNodes] = useState(8);
  const [instanceType, setInstanceType] = useState(INSTANCE_TYPES[1]);
  const [duration, setDuration] = useState(estimatedDurationMin);
  const [frequency, setFrequency] = useState('daily');
  const [currentCost, setCurrentCost] = useState(0);
  const [optimizedCost, setOptimizedCost] = useState(0);

  useEffect(() => {
    const costPerRun = numNodes * instanceType.pricePerHour * (duration / 60);
    setCurrentCost(costPerRun);
    setOptimizedCost(costPerRun * 0.6);
  }, [numNodes, instanceType, duration]);

  const getFrequencyMultiplier = () => {
    if (frequency === 'daily') return 365;
    if (frequency === 'weekly') return 52;
    if (frequency === 'hourly') return 365 * 24;
    return 1;
  };
  const annualSavings = (currentCost - optimizedCost) * getFrequencyMultiplier();

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-8 relative overflow-hidden transition-colors">
        <div className="flex items-center gap-4 mb-8 relative z-10"><div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-xl border border-emerald-200 dark:border-emerald-800 shadow-sm"><DollarSign className="w-6 h-6" /></div><div><h3 className="text-xl font-bold text-slate-900 dark:text-white">Cloud Cost Impact</h3><p className="text-sm text-slate-700 dark:text-slate-400 mt-1 font-medium">Estimate potential savings based on optimization.</p></div></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 relative z-10">
          <div className="group"><label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-3 ml-1">Cluster Size</label><div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 bg-slate-50 dark:bg-slate-800 focus-within:ring-2 focus-within:ring-orange-500/20 focus-within:border-orange-500 transition-all shadow-sm"><Server className="w-5 h-5 text-slate-600 dark:text-slate-400 mr-3" /><input type="number" value={numNodes} onChange={(e) => setNumNodes(Number(e.target.value))} className="bg-transparent w-full outline-none font-bold text-slate-900 dark:text-white placeholder-slate-500" min={1}/><span className="text-xs text-slate-600 dark:text-slate-400 font-bold ml-2">Nodes</span></div></div>
          <div className="group"><label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-3 ml-1">Job Duration (Min)</label><div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 bg-slate-50 dark:bg-slate-800 focus-within:ring-2 focus-within:ring-orange-500/20 focus-within:border-orange-500 transition-all shadow-sm"><Clock className="w-5 h-5 text-slate-600 dark:text-slate-400 mr-3" /><input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="bg-transparent w-full outline-none font-bold text-slate-900 dark:text-white placeholder-slate-500"/></div></div>
          <div className="group"><label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-3 ml-1">Node Type</label><div className="relative"><select className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 pr-10 py-3 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-bold outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 appearance-none cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm" onChange={(e) => { const selected = INSTANCE_TYPES.find(t => t.name === e.target.value); if(selected) setInstanceType(selected); }} value={instanceType.name}>{INSTANCE_TYPES.map(t => <option key={t.name} value={t.name} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">{t.name}</option>)}</select><div className="absolute right-4 top-3.5 pointer-events-none text-slate-600 dark:text-slate-400"><TrendingDown className="w-4 h-4" /></div></div></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
           <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors shadow-sm group"><p className="text-xs text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider mb-2">Current Cost (Per Run)</p><p className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">${currentCost.toFixed(2)}</p></div>
           <div className="bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-2xl border border-emerald-100 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors shadow-sm group"><p className="text-xs text-emerald-700 dark:text-emerald-400 font-bold uppercase tracking-wider mb-2">Projected (Optimized)</p><p className="text-3xl font-bold text-emerald-800 dark:text-emerald-300 tracking-tight">${optimizedCost.toFixed(2)}</p></div>
           <div className="bg-orange-600 dark:bg-orange-700 p-6 rounded-2xl border border-orange-500 dark:border-orange-600 relative overflow-hidden group shadow-lg text-white"><div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity"><TrendingDown className="w-20 h-20" /></div><p className="text-xs text-orange-100 font-bold uppercase tracking-wider mb-2">Annual Savings (Daily)</p><p className="text-3xl font-bold text-white tracking-tight">${annualSavings.toFixed(0)}</p></div>
        </div>
      </div>
    </div>
  );
};
