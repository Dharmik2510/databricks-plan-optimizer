import React, { useState, useEffect, useMemo } from 'react';
import {
  DollarSign, Server, Clock, TrendingDown, Calculator,
  Zap, Calendar, BarChart3, PieChart, ArrowRight,
  Sparkles, Info, ChevronDown, Globe
} from 'lucide-react';
import { CloudInstance } from '../../shared/types';
import { ClusterFinder } from './inputs/ClusterFinder';

interface Props {
  estimatedDurationMin?: number;
  instances?: CloudInstance[];
  region?: string;
  availableRegions?: Array<{ id: string; name: string }>;
  cloudProvider?: 'aws' | 'azure' | 'gcp';
  onCloudProviderChange?: (provider: 'aws' | 'azure' | 'gcp') => void;
  onRegionChange?: (region: string) => void;
  analysisResult?: any; // Using any to avoid circular deps or complex imports for now, will cast inside
}

const FREQUENCIES = [
  { value: 'hourly', label: 'Hourly', multiplier: 365 * 24 },
  { value: 'daily', label: 'Daily', multiplier: 365 },
  { value: 'weekly', label: 'Weekly', multiplier: 52 },
  { value: 'monthly', label: 'Monthly', multiplier: 12 },
];

export const CostEstimator: React.FC<Props> = ({
  estimatedDurationMin = 15,
  instances = [],
  region = 'us-east-1',
  availableRegions = [],
  cloudProvider = 'aws',
  onCloudProviderChange,
  onRegionChange,
  analysisResult
}) => {
  const [numNodes, setNumNodes] = useState(8);
  const [instanceType, setInstanceType] = useState<CloudInstance | null>(null);
  const [duration, setDuration] = useState(estimatedDurationMin);
  const [frequency, setFrequency] = useState('daily');

  const [isFinderOpen, setIsFinderOpen] = useState(false);

  // Set initial instance type when instances load
  useEffect(() => {
    if (instances.length > 0 && !instanceType) {
      // If analysis has a recommended instance type, try to find it
      const recommendedType = analysisResult?.clusterRecommendation?.recommended?.type;
      if (recommendedType) {
        const found = instances.find(i => i.name === recommendedType);
        if (found) {
          setInstanceType(found);
          if (analysisResult?.clusterRecommendation?.recommended?.nodes) {
            setNumNodes(analysisResult.clusterRecommendation.recommended.nodes);
          }
          return;
        }
      }

      setInstanceType(instances[0]);
    } else if (instances.length > 0 && instanceType) {
      // If reloaded with different region, try to find same type or default
      const match = instances.find(i => i.name === instanceType.name);
      setInstanceType(match || instances[0]);
    }
  }, [instances, instanceType, analysisResult]);

  // Calculate costs with DBU pricing
  const costs = useMemo(() => {
    if (!instanceType) return {
      currentCostPerRun: 0,
      currentAnnualCost: 0,
    };

    const durationHours = duration / 60;

    // Use totalPricePerHour if available (includes DBU), otherwise just compute
    const pricePerHour = instanceType.totalPricePerHour || instanceType.pricePerHour;
    const currentCostPerRun = numNodes * pricePerHour * durationHours;

    const frequencyData = FREQUENCIES.find(f => f.value === frequency);
    const multiplier = frequencyData?.multiplier || 365;

    const currentAnnualCost = currentCostPerRun * multiplier;

    return {
      currentCostPerRun,
      currentAnnualCost,
    };
  }, [numNodes, instanceType, duration, frequency]);

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
    <div className="relative w-full max-w-6xl mx-auto pb-20">
      {/* Background Decorators */}
      <div className="absolute -top-20 -left-20 w-96 h-96 bg-indigo-500/20 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute top-40 right-0 w-64 h-64 bg-purple-500/20 rounded-full blur-[96px] pointer-events-none" />

      <div className="relative z-10 space-y-8 animate-fade-in-up">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-2xl blur opacity-40 group-hover:opacity-60 transition-opacity duration-500" />
              <div className="relative p-3.5 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-500/20 rounded-2xl shadow-xl transition-colors">
                <Calculator className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
              </div>
            </div>
            <div>
              <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-indigo-800 to-indigo-900 dark:from-white dark:via-indigo-200 dark:to-indigo-100 tracking-tight">
                Cloud Cost Calculator
              </h2>
              <p className="text-slate-500 dark:text-slate-400 font-medium mt-1 transition-colors">
                Estimate raw runtime costs for your Databricks workloads
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">

          {/* Configuration Panel - Glassmorphism */}
          <div className="xl:col-span-8 relative group">
            <div className="absolute inset-0 bg-gradient-to-b from-slate-200/50 to-white/20 dark:from-white/5 dark:to-transparent rounded-[2.5rem] pointer-events-none" />
            <div className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-8 lg:p-10 shadow-xl dark:shadow-2xl relative overflow-hidden transition-colors">

              {/* Subtle Grid Pattern */}
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 pointer-events-none mix-blend-overlay"></div>

              <div className="relative z-10 hidden md:block">
                <div className="flex items-center gap-3 mb-8">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 dark:via-white/10 to-transparent" />
                  <span className="text-xs font-bold text-indigo-500 dark:text-indigo-400/80 uppercase tracking-[0.2em] transition-colors">Configuration</span>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 dark:via-white/10 to-transparent" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-10">
                {/* Cloud Provider */}
                <div className="space-y-4">
                  <label className="text-sm font-bold text-slate-600 dark:text-slate-300 ml-1 flex items-center gap-2 transition-colors">
                    Cloud Provider
                  </label>
                  <div className="grid grid-cols-3 gap-3 p-1.5 bg-slate-100 dark:bg-black/20 rounded-2xl border border-slate-200 dark:border-white/5 transition-colors">
                    {['aws', 'azure', 'gcp'].map((provider) => (
                      <button
                        key={provider}
                        disabled={provider !== 'aws'}
                        title={provider !== 'aws' ? 'Coming Soon' : undefined}
                        onClick={() => onCloudProviderChange?.(provider as any)}
                        className={`relative py-3 rounded-xl text-sm font-bold transition-all duration-300 overflow-hidden group/btn ${cloudProvider === provider
                          ? 'text-white shadow-lg'
                          : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                          }`}
                      >
                        {cloudProvider === provider && (
                          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-500 dark:from-indigo-600 dark:to-purple-600 rounded-xl animate-pulse-slow" />
                        )}
                        <span className="relative z-10 flex items-center justify-center gap-2">
                          {{ aws: 'AWS', azure: 'Azure', gcp: 'GCP' }[provider]}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cloud Region */}
                <div className="space-y-4">
                  <label className="text-sm font-bold text-slate-600 dark:text-slate-300 ml-1 transition-colors">Region</label>
                  <div className="relative group/input">
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-2xl blur-sm opacity-0 group-hover/input:opacity-100 transition-opacity duration-300" />
                    <select
                      className="relative w-full px-5 py-4 bg-white dark:bg-slate-950/50 hover:bg-slate-50 dark:hover:bg-slate-900/80 border border-slate-200 dark:border-white/10 hover:border-indigo-500/50 dark:hover:border-indigo-500/50 rounded-2xl text-slate-900 dark:text-slate-200 font-medium appearance-none cursor-pointer focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all duration-300 shadow-sm dark:shadow-inner"
                      value={region}
                      onChange={(e) => onRegionChange?.(e.target.value)}
                    >
                      {availableRegions.length > 0 ? availableRegions.map(r => (
                        <option key={r.id} value={r.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200">
                          {r.name}
                        </option>
                      )) : <option value={region} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200">{region}</option>}
                    </select>
                    <Globe className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-400 dark:text-indigo-400/50 pointer-events-none" />
                  </div>
                </div>

                {/* Instance Type */}
                <div className="space-y-4 md:col-span-2">
                  <label className="text-sm font-bold text-slate-600 dark:text-slate-300 ml-1 transition-colors">Instance Type</label>
                  <button
                    onClick={() => setIsFinderOpen(true)}
                    className="relative w-full group/card text-left"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/10 to-purple-600/10 rounded-2xl blur-md opacity-0 group-hover/card:opacity-100 transition-opacity duration-500" />
                    <div className="relative px-5 py-4 bg-white dark:bg-slate-950/50 hover:bg-slate-50 dark:hover:bg-slate-900/80 border border-slate-200 dark:border-white/10 hover:border-indigo-500/50 dark:hover:border-indigo-500/50 rounded-2xl flex items-center justify-between transition-all duration-300 shadow-sm hover:shadow dark:shadow-lg group-hover/card:shadow-indigo-500/10">
                      <div className="flex items-center gap-4">
                        <div className="p-2.5 bg-indigo-50 dark:bg-gradient-to-br dark:from-indigo-500/20 dark:to-purple-500/20 rounded-xl border border-indigo-100 dark:border-indigo-500/20 group-hover/card:scale-110 transition-transform duration-300">
                          <Server className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-mono text-base text-slate-900 dark:text-indigo-100 font-bold tracking-wide transition-colors">
                            {instanceType?.name || 'Select Instance'}
                          </span>
                          {instanceType && (
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5 transition-colors">
                              {instanceType.vCPUs} vCPUs • {instanceType.memoryGB} GiB Memory
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronDown className="w-5 h-5 text-slate-400 dark:text-slate-500 group-hover/card:text-indigo-500 dark:group-hover/card:text-indigo-400 transition-colors" />
                    </div>
                  </button>
                  <ClusterFinder
                    isOpen={isFinderOpen}
                    onClose={() => setIsFinderOpen(false)}
                    onSelect={setInstanceType}
                    instances={instances}
                    loading={instances.length === 0}
                    currentInstance={instanceType || undefined}
                  />
                </div>

                {/* Cluster Size */}
                <div className="space-y-4">
                  <label className="text-sm font-bold text-slate-600 dark:text-slate-300 ml-1 transition-colors">Cluster Workers</label>
                  <div className="relative group/input">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 p-1.5 bg-slate-100 dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/5 transition-colors">
                      <Server className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    </div>
                    <input
                      type="number"
                      value={numNodes}
                      onChange={(e) => setNumNodes(Math.max(1, Number(e.target.value)))}
                      className="w-full pl-14 pr-4 py-4 bg-white dark:bg-slate-950/50 hover:bg-slate-50 dark:hover:bg-slate-900/80 border border-slate-200 dark:border-white/10 focus:border-indigo-500/50 rounded-2xl text-slate-900 dark:text-white font-bold text-lg focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all duration-300 tabular-nums shadow-sm dark:shadow-none"
                      min={1}
                      max={100}
                    />
                  </div>
                </div>

                {/* Job Duration */}
                <div className="space-y-4">
                  <label className="text-sm font-bold text-slate-600 dark:text-slate-300 ml-1 transition-colors">Avg. Duration (min)</label>
                  <div className="relative group/input">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 p-1.5 bg-slate-100 dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/5 transition-colors">
                      <Clock className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    </div>
                    <input
                      type="number"
                      value={duration}
                      onChange={(e) => setDuration(Math.max(1, Number(e.target.value)))}
                      className="w-full pl-14 pr-4 py-4 bg-white dark:bg-slate-950/50 hover:bg-slate-50 dark:hover:bg-slate-900/80 border border-slate-200 dark:border-white/10 focus:border-indigo-500/50 rounded-2xl text-slate-900 dark:text-white font-bold text-lg focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all duration-300 tabular-nums shadow-sm dark:shadow-none"
                      min={1}
                    />
                  </div>
                </div>

                {/* Frequency - Custom Selector */}
                <div className="space-y-4 md:col-span-2">
                  <label className="text-sm font-bold text-slate-600 dark:text-slate-300 ml-1 transition-colors">Execution Schedule</label>
                  <div className="grid grid-cols-4 gap-3 bg-slate-100 dark:bg-black/20 p-1.5 rounded-2xl border border-slate-200 dark:border-white/5 transition-colors">
                    {FREQUENCIES.map((f) => {
                      const isSelected = frequency === f.value;
                      return (
                        <button
                          key={f.value}
                          onClick={() => setFrequency(f.value)}
                          className={`py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all duration-300 ${isSelected
                            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-md dark:shadow-lg ring-1 ring-black/5 dark:ring-white/10'
                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-white/5'
                            }`}
                        >
                          {f.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Results Panel - Floating Card Style */}
          <div className="xl:col-span-4 space-y-6">
            <div className="relative bg-gradient-to-b from-indigo-900 via-slate-900 to-black rounded-[2.5rem] p-8 border border-white/10 shadow-[0_20px_60px_-15px_rgba(79,70,229,0.3)] overflow-hidden h-full flex flex-col justify-between group">

              {/* Animated Glow Effects */}
              <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-indigo-600/30 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 group-hover:bg-indigo-500/40 transition-colors duration-1000" />
              <div className="absolute bottom-0 left-0 w-[250px] h-[250px] bg-purple-600/20 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2" />

              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-8 opacity-70">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                  <span className="text-xs font-bold tracking-widest uppercase text-indigo-300">Live Estimates</span>
                </div>

                <div className="space-y-10">
                  {/* Cost Per Run */}
                  <div className="space-y-1">
                    <span className="text-sm font-bold text-slate-400 uppercase tracking-wide">Cost Per Run</span>
                    <div className="flex items-baseline gap-1 break-words">
                      <span className="text-5xl md:text-6xl font-extrabold text-white tracking-tighter tabular-nums drop-shadow-2xl">
                        {formatCurrency(costs.currentCostPerRun)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-indigo-200/60 text-sm font-mono bg-white/5 w-fit px-3 py-1 rounded-lg border border-white/5">
                      <span>{numNodes} Nodes</span>
                      <span>•</span>
                      <span>{duration}m Duration</span>
                    </div>
                  </div>

                  {/* Annual Cost */}
                  <div className="space-y-2 pt-8 border-t border-white/10">
                    <span className="text-sm font-bold text-slate-400 uppercase tracking-wide">Projected Annual</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-indigo-100/90 tracking-tight tabular-nums">
                        {formatCurrency(costs.currentAnnualCost)}
                      </span>
                    </div>
                    <p className="text-indigo-300/50 text-xs">
                      {FREQUENCIES.find(f => f.value === frequency)?.label.toLowerCase()} schedule ({FREQUENCIES.find(f => f.value === frequency)?.multiplier} runs/yr)
                    </p>
                  </div>
                </div>
              </div>

              {/* Bottom Footer */}
              <div className="relative z-10 mt-12 pt-6 border-t border-white/5">
                <div className="flex justify-between items-center text-xs font-mono text-indigo-300/40 uppercase tracking-wider">
                  <span>Unit: ${instanceType?.pricePerHour.toFixed(3)}/hr</span>
                  <span>(DBU Inc.)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
