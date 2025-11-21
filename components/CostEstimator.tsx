import React, { useState, useEffect } from 'react';
import { DollarSign, Server, Clock, TrendingDown } from 'lucide-react';

interface Props {
  estimatedDurationMin?: number;
}

// Simplified Databricks Pricing (Approximate Pay-as-you-go)
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
    // Formula: Nodes * Price/Hr * (Duration / 60)
    const costPerRun = numNodes * instanceType.pricePerHour * (duration / 60);
    setCurrentCost(costPerRun);

    // Assume 40% optimization from tool suggestions
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
      <div className="bg-slate-900/40 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/10 p-8 relative overflow-hidden">
        {/* Gloss Shine */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>

        <div className="flex items-center gap-4 mb-8 relative z-10">
          <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white drop-shadow-sm">Cloud Cost Impact</h3>
            <p className="text-sm text-slate-300 mt-1 font-light">Estimate potential savings based on optimization.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 relative z-10">
          <div className="group">
            <label className="block text-xs font-bold text-indigo-300 uppercase tracking-wide mb-3 ml-1">Cluster Size</label>
            <div className="flex items-center border border-white/10 rounded-xl px-4 py-3 bg-black/40 focus-within:ring-2 focus-within:ring-indigo-500/50 transition-all backdrop-blur-md shadow-inner">
              <Server className="w-5 h-5 text-slate-400 mr-3 group-hover:text-indigo-400 transition-colors" />
              <input 
                type="number" 
                value={numNodes} 
                onChange={(e) => setNumNodes(Number(e.target.value))}
                className="bg-transparent w-full outline-none font-semibold text-white placeholder-slate-500"
                min={1}
              />
              <span className="text-xs text-slate-500 ml-2 font-medium">Nodes</span>
            </div>
          </div>

          <div className="group">
            <label className="block text-xs font-bold text-indigo-300 uppercase tracking-wide mb-3 ml-1">Job Duration (Min)</label>
            <div className="flex items-center border border-white/10 rounded-xl px-4 py-3 bg-black/40 focus-within:ring-2 focus-within:ring-indigo-500/50 transition-all backdrop-blur-md shadow-inner">
              <Clock className="w-5 h-5 text-slate-400 mr-3 group-hover:text-indigo-400 transition-colors" />
              <input 
                type="number" 
                value={duration} 
                onChange={(e) => setDuration(Number(e.target.value))}
                className="bg-transparent w-full outline-none font-semibold text-white placeholder-slate-500"
              />
            </div>
          </div>

          <div className="group">
            <label className="block text-xs font-bold text-indigo-300 uppercase tracking-wide mb-3 ml-1">Node Type</label>
            <div className="relative">
                <select 
                className="w-full border border-white/10 rounded-xl px-4 py-3 bg-black/40 text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none cursor-pointer hover:bg-black/50 transition-colors backdrop-blur-md shadow-inner"
                onChange={(e) => {
                    const selected = INSTANCE_TYPES.find(t => t.name === e.target.value);
                    if(selected) setInstanceType(selected);
                }}
                value={instanceType.name}
                >
                {INSTANCE_TYPES.map(t => <option key={t.name} value={t.name} className="bg-slate-900 text-white">{t.name}</option>)}
                </select>
                <div className="absolute right-4 top-3.5 pointer-events-none text-slate-400">
                    <TrendingDown className="w-4 h-4" />
                </div>
            </div>
          </div>
        </div>

        {/* Result Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
           <div className="bg-black/40 p-6 rounded-2xl border border-white/10 hover:bg-black/50 transition-colors backdrop-blur-md shadow-lg">
             <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">Current Cost (Per Run)</p>
             <p className="text-3xl font-bold text-white tracking-tight drop-shadow-md">${currentCost.toFixed(2)}</p>
           </div>
           <div className="bg-emerald-500/10 p-6 rounded-2xl border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors backdrop-blur-md shadow-lg">
             <p className="text-xs text-emerald-300 font-bold uppercase tracking-wider mb-2">Projected (Optimized)</p>
             <p className="text-3xl font-bold text-emerald-200 tracking-tight drop-shadow-md">${optimizedCost.toFixed(2)}</p>
           </div>
           <div className="bg-gradient-to-br from-indigo-600/20 to-purple-600/20 p-6 rounded-2xl border border-indigo-500/30 relative overflow-hidden group backdrop-blur-md shadow-lg hover:shadow-[0_0_30px_rgba(99,102,241,0.2)] transition-shadow">
             <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
               <TrendingDown className="w-20 h-20 text-white" />
             </div>
             <div className="relative z-10">
                <p className="text-xs text-indigo-200 font-bold uppercase tracking-wider mb-2">Potential Annual Savings</p>
                <div className="flex items-end gap-2 mb-1">
                    <p className="text-3xl font-bold text-white tracking-tight drop-shadow-md">${annualSavings.toFixed(0)}</p>
                </div>
                <select 
                    value={frequency} 
                    onChange={(e) => setFrequency(e.target.value)}
                    className="text-[10px] bg-white/10 border border-white/10 rounded px-2 py-1 text-indigo-100 font-medium cursor-pointer hover:bg-white/20 transition-colors outline-none backdrop-blur-sm"
                >
                    <option value="daily" className="bg-slate-900">Running Daily</option>
                    <option value="weekly" className="bg-slate-900">Running Weekly</option>
                    <option value="hourly" className="bg-slate-900">Running Hourly</option>
                </select>
             </div>
           </div>
        </div>
        
        <p className="text-xs text-slate-400 mt-6 text-center font-light">
          *Estimates based on standard on-demand pricing. Does not account for Spot instances or specific enterprise discounts.
        </p>
      </div>
    </div>
  );
};