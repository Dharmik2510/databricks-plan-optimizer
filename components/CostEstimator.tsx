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
      <div className="bg-white/50 backdrop-blur-3xl rounded-3xl shadow-2xl border border-white/60 p-8 relative overflow-hidden ring-1 ring-white/40">

        <div className="flex items-center gap-4 mb-8 relative z-10">
          <div className="p-3 bg-emerald-100/80 backdrop-blur text-emerald-700 rounded-xl border border-emerald-200 shadow-sm">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 drop-shadow-sm">Cloud Cost Impact</h3>
            <p className="text-sm text-slate-700 mt-1 font-medium">Estimate potential savings based on optimization.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 relative z-10">
          <div className="group">
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-3 ml-1">Cluster Size</label>
            <div className="flex items-center border border-white/60 rounded-xl px-4 py-3 bg-white/40 backdrop-blur-md focus-within:ring-2 focus-within:ring-orange-500/30 focus-within:border-orange-500 transition-all shadow-sm">
              <Server className="w-5 h-5 text-slate-600 mr-3" />
              <input 
                type="number" 
                value={numNodes} 
                onChange={(e) => setNumNodes(Number(e.target.value))}
                className="bg-transparent w-full outline-none font-bold text-slate-900 placeholder-slate-500"
                min={1}
              />
              <span className="text-xs text-slate-600 font-bold ml-2">Nodes</span>
            </div>
          </div>

          <div className="group">
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-3 ml-1">Job Duration (Min)</label>
            <div className="flex items-center border border-white/60 rounded-xl px-4 py-3 bg-white/40 backdrop-blur-md focus-within:ring-2 focus-within:ring-orange-500/30 focus-within:border-orange-500 transition-all shadow-sm">
              <Clock className="w-5 h-5 text-slate-600 mr-3" />
              <input 
                type="number" 
                value={duration} 
                onChange={(e) => setDuration(Number(e.target.value))}
                className="bg-transparent w-full outline-none font-bold text-slate-900 placeholder-slate-500"
              />
            </div>
          </div>

          <div className="group">
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-3 ml-1">Node Type</label>
            <div className="relative">
                <select 
                className="w-full border border-white/60 rounded-xl px-4 py-3 bg-white/40 backdrop-blur-md text-slate-900 text-sm font-bold outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 appearance-none cursor-pointer hover:bg-white/60 transition-colors shadow-sm"
                onChange={(e) => {
                    const selected = INSTANCE_TYPES.find(t => t.name === e.target.value);
                    if(selected) setInstanceType(selected);
                }}
                value={instanceType.name}
                >
                {INSTANCE_TYPES.map(t => <option key={t.name} value={t.name} className="bg-white text-slate-900">{t.name}</option>)}
                </select>
                <div className="absolute right-4 top-3.5 pointer-events-none text-slate-600">
                    <TrendingDown className="w-4 h-4" />
                </div>
            </div>
          </div>
        </div>

        {/* Result Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
           <div className="bg-white/60 backdrop-blur-md p-6 rounded-2xl border border-white/60 hover:bg-white/80 transition-colors shadow-md group">
             <p className="text-xs text-slate-600 font-bold uppercase tracking-wider mb-2">Current Cost (Per Run)</p>
             <p className="text-3xl font-bold text-slate-900 tracking-tight group-hover:text-orange-600 transition-colors">${currentCost.toFixed(2)}</p>
           </div>
           <div className="bg-emerald-100/40 backdrop-blur-md p-6 rounded-2xl border border-emerald-200/50 hover:bg-emerald-100/60 transition-colors shadow-md group">
             <p className="text-xs text-emerald-700 font-bold uppercase tracking-wider mb-2">Projected (Optimized)</p>
             <p className="text-3xl font-bold text-emerald-800 tracking-tight">${optimizedCost.toFixed(2)}</p>
           </div>
           <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-6 rounded-2xl border border-orange-400/50 relative overflow-hidden group shadow-xl text-white">
             <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
               <TrendingDown className="w-20 h-20 text-white" />
             </div>
             <div className="relative z-10">
                <p className="text-xs text-orange-100 font-bold uppercase tracking-wider mb-2">Potential Annual Savings</p>
                <div className="flex items-end gap-2 mb-1">
                    <p className="text-3xl font-bold text-white tracking-tight drop-shadow-sm">${annualSavings.toFixed(0)}</p>
                </div>
                <select 
                    value={frequency} 
                    onChange={(e) => setFrequency(e.target.value)}
                    className="text-[10px] bg-white/20 border border-white/30 rounded px-2 py-1 text-white font-bold cursor-pointer hover:bg-white/30 transition-colors outline-none backdrop-blur-sm"
                >
                    <option value="daily" className="bg-slate-800 text-white">Running Daily</option>
                    <option value="weekly" className="bg-slate-800 text-white">Running Weekly</option>
                    <option value="hourly" className="bg-slate-800 text-white">Running Hourly</option>
                </select>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
};