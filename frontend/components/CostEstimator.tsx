
import React, { useState, useEffect, useMemo } from 'react';
import { 
  DollarSign, Server, Clock, TrendingDown, Calculator, 
  Zap, Calendar, BarChart3, PieChart, ArrowRight, 
  Sparkles, Info, ChevronDown
} from 'lucide-react';
import { CloudInstance } from '../../shared/types';

interface Props {
  estimatedDurationMin?: number;
  instances?: CloudInstance[];
  region?: string;
}

const FREQUENCIES = [
  { value: 'hourly', label: 'Hourly', multiplier: 365 * 24 },
  { value: 'daily', label: 'Daily', multiplier: 365 },
  { value: 'weekly', label: 'Weekly', multiplier: 52 },
  { value: 'monthly', label: 'Monthly', multiplier: 12 },
];

export const CostEstimator: React.FC<Props> = ({ estimatedDurationMin = 15, instances = [], region = 'us-east-1' }) => {
  const [numNodes, setNumNodes] = useState(8);
  const [instanceType, setInstanceType] = useState<CloudInstance | null>(null);
  const [duration, setDuration] = useState(estimatedDurationMin);
  const [frequency, setFrequency] = useState('daily');
  const [optimizationFactor, setOptimizationFactor] = useState(0.4); // 40% savings

  // Set initial instance type when instances load
  useEffect(() => {
    if (instances.length > 0 && !instanceType) {
      setInstanceType(instances[0]);
    } else if (instances.length > 0 && instanceType) {
        // If reloaded with different region, try to find same type or default
        const match = instances.find(i => i.name === instanceType.name);
        setInstanceType(match || instances[0]);
    }
  }, [instances, instanceType]);

  // Calculate costs
  const costs = useMemo(() => {
    if (!instanceType) return {
        currentCostPerRun: 0, optimizedCostPerRun: 0, savingsPerRun: 0,
        currentAnnualCost: 0, optimizedAnnualCost: 0, annualSavings: 0, savingsPercent: 0
    };

    const durationHours = duration / 60;
    const currentCostPerRun = numNodes * instanceType.pricePerHour * durationHours;
    const optimizedCostPerRun = currentCostPerRun * (1 - optimizationFactor);
    const savingsPerRun = currentCostPerRun - optimizedCostPerRun;
    
    const frequencyData = FREQUENCIES.find(f => f.value === frequency);
    const multiplier = frequencyData?.multiplier || 365;
    
    const currentAnnualCost = currentCostPerRun * multiplier;
    const optimizedAnnualCost = optimizedCostPerRun * multiplier;
    const annualSavings = savingsPerRun * multiplier;

    return {
      currentCostPerRun,
      optimizedCostPerRun,
      savingsPerRun,
      currentAnnualCost,
      optimizedAnnualCost,
      annualSavings,
      savingsPercent: optimizationFactor * 100,
    };
  }, [numNodes, instanceType, duration, frequency, optimizationFactor]);

  useEffect(() => {
    if (estimatedDurationMin) {
      setDuration(estimatedDurationMin);
    }
  }, [estimatedDurationMin]);

  const formatCurrency = (value: number): string => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toFixed(2)}`;
  };

  if (instances.length === 0) {
      return (
          <div className="p-8 text-center text-slate-500 animate-pulse">
              Loading instance data for region {region}...
          </div>
      );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Card */}
      <div className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 rounded-2xl p-6 text-white relative overflow-hidden shadow-xl shadow-emerald-500/20">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Cloud Cost Calculator</h2>
              <p className="text-emerald-100 text-sm font-medium">Estimate your Databricks compute costs in {region}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="text-xs font-semibold text-emerald-200 uppercase tracking-wider mb-1">Current / Run</div>
              <div className="text-2xl font-bold">{formatCurrency(costs.currentCostPerRun)}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="text-xs font-semibold text-emerald-200 uppercase tracking-wider mb-1">Optimized / Run</div>
              <div className="text-2xl font-bold text-emerald-200">{formatCurrency(costs.optimizedCostPerRun)}</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="text-xs font-semibold text-emerald-200 uppercase tracking-wider mb-1">Savings / Run</div>
              <div className="text-2xl font-bold flex items-center gap-2">
                <TrendingDown className="w-5 h-5" />
                {formatCurrency(costs.savingsPerRun)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Configuration Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden transition-colors">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Calculator className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            Configuration
          </h3>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Cluster Size */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Cluster Size
              </label>
              <div className="relative">
                <Server className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                <input 
                  type="number" 
                  value={numNodes} 
                  onChange={(e) => setNumNodes(Math.max(1, Number(e.target.value)))}
                  className="w-full pl-11 pr-16 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-semibold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                  min={1}
                  max={100}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Workers
                </span>
              </div>
            </div>

            {/* Job Duration */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Job Duration
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                <input 
                  type="number" 
                  value={duration} 
                  onChange={(e) => setDuration(Math.max(1, Number(e.target.value)))}
                  className="w-full pl-11 pr-12 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-semibold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                  min={1}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  min
                </span>
              </div>
            </div>

            {/* Instance Type */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Instance Type
              </label>
              <div className="relative">
                <select 
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-semibold appearance-none cursor-pointer focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all pr-10"
                  onChange={(e) => {
                    const selected = instances.find(t => t.id === e.target.value);
                    if (selected) setInstanceType(selected);
                  }}
                  value={instanceType?.id || ''}
                >
                  {instances.map(t => (
                    <option key={t.id} value={t.id} className="bg-white dark:bg-slate-800">
                      {t.displayName} (${t.pricePerHour}/hr)
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Frequency */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Run Frequency
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                <select 
                  className="w-full pl-11 pr-10 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-semibold appearance-none cursor-pointer focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                >
                  {FREQUENCIES.map(f => (
                    <option key={f.value} value={f.value} className="bg-white dark:bg-slate-800">
                      {f.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Instance Details */}
          {instanceType && (
            <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2 mb-3">
                <Info className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Instance Details ({region})</span>
                </div>
                <div className="grid grid-cols-4 gap-4">
                <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Category</div>
                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">{instanceType.category}</div>
                </div>
                <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">vCPUs</div>
                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">{instanceType.vCPUs} cores</div>
                </div>
                <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Memory</div>
                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">{instanceType.memoryGB} GB</div>
                </div>
                <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Price</div>
                    <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">${instanceType.pricePerHour}/hr</div>
                </div>
                </div>
            </div>
          )}

          {/* Optimization Slider */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Expected Optimization Savings
              </label>
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                {Math.round(optimizationFactor * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="80"
              value={optimizationFactor * 100}
              onChange={(e) => setOptimizationFactor(Number(e.target.value) / 100)}
              className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full appearance-none cursor-pointer accent-emerald-500"
            />
            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
              <span>0%</span>
              <span>Conservative (20%)</span>
              <span>Aggressive (60%)</span>
              <span>80%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Results Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Current Annual Cost */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-lg transition-colors">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <BarChart3 className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Current Annual Cost
            </span>
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white mb-1">
            {formatCurrency(costs.currentAnnualCost)}
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {FREQUENCIES.find(f => f.value === frequency)?.label} execution
          </div>
        </div>

        {/* Optimized Annual Cost */}
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800 p-6 shadow-lg transition-colors">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg">
              <Zap className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
              Optimized Annual Cost
            </span>
          </div>
          <div className="text-3xl font-bold text-emerald-700 dark:text-emerald-400 mb-1">
            {formatCurrency(costs.optimizedAnnualCost)}
          </div>
          <div className="text-sm text-emerald-600 dark:text-emerald-500 font-medium">
            After applying optimizations
          </div>
        </div>

        {/* Annual Savings */}
        <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 rounded-2xl p-6 shadow-xl shadow-orange-500/20 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg">
                <TrendingDown className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-amber-100 uppercase tracking-wider">
                Annual Savings
              </span>
            </div>
            <div className="text-4xl font-bold mb-1">
              {formatCurrency(costs.annualSavings)}
            </div>
            <div className="flex items-center gap-2 text-sm text-amber-100">
              <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs font-bold">
                {Math.round(costs.savingsPercent)}% reduction
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Cost Comparison Visual */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-lg transition-colors">
        <h3 className="font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
          <PieChart className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          Cost Comparison
        </h3>

        <div className="space-y-4">
          {/* Current Cost Bar */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-600 dark:text-slate-400 font-medium">Current Cost</span>
              <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(costs.currentAnnualCost)}</span>
            </div>
            <div className="h-8 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-slate-500 to-slate-600 rounded-lg flex items-center justify-end pr-3"
                style={{ width: '100%' }}
              >
                <span className="text-xs font-bold text-white">100%</span>
              </div>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <ArrowRight className="w-6 h-6 text-slate-400 dark:text-slate-500 rotate-90" />
          </div>

          {/* Optimized Cost Bar */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">Optimized Cost</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(costs.optimizedAnnualCost)}</span>
            </div>
            <div className="h-8 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden relative">
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg flex items-center justify-end pr-3 transition-all duration-500"
                style={{ width: `${100 - costs.savingsPercent}%` }}
              >
                <span className="text-xs font-bold text-white">{Math.round(100 - costs.savingsPercent)}%</span>
              </div>
              {/* Savings portion */}
              <div 
                className="absolute top-0 right-0 h-full bg-gradient-to-r from-amber-100 to-amber-200 dark:from-amber-900/30 dark:to-amber-800/30 rounded-r-lg flex items-center justify-center border-l-2 border-dashed border-amber-400 dark:border-amber-600 transition-all duration-500"
                style={{ width: `${costs.savingsPercent}%` }}
              >
                <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                  -{Math.round(costs.savingsPercent)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="mt-6 p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 mb-1">
                Projected Impact
              </div>
              <p className="text-sm text-emerald-700 dark:text-emerald-400">
                By applying the recommended optimizations, you could save approximately{' '}
                <span className="font-bold">{formatCurrency(costs.annualSavings)}</span> annually 
                ({Math.round(costs.savingsPercent)}% reduction). This translates to{' '}
                <span className="font-bold">{formatCurrency(costs.savingsPerRun)}</span> per execution.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
