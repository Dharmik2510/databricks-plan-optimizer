
import React, { useState, useEffect } from 'react';
import { OptimizationTip, DagNode } from '../types';
import { FlaskConical, Play, RotateCcw, Zap, Check, X } from 'lucide-react';

interface Props {
  optimizations: OptimizationTip[];
  baselineDuration: number; // minutes
}

export const OptimizationPlayground: React.FC<Props> = ({ optimizations, baselineDuration }) => {
  const [activeOptimizations, setActiveOptimizations] = useState<Set<number>>(new Set());
  const [simulatedDuration, setSimulatedDuration] = useState(baselineDuration);
  const [isSimulating, setIsSimulating] = useState(false);

  useEffect(() => {
    // Recalculate whenever active set changes
    if (activeOptimizations.size === 0) {
        setSimulatedDuration(baselineDuration);
        return;
    }

    setIsSimulating(true);
    setTimeout(() => {
        let savedTimeSeconds = 0;
        activeOptimizations.forEach(idx => {
            savedTimeSeconds += optimizations[idx].estimated_time_saved_seconds || 0;
        });
        
        const newDurationMin = Math.max(0.1, baselineDuration - (savedTimeSeconds / 60));
        setSimulatedDuration(newDurationMin);
        setIsSimulating(false);
    }, 600); // Fake calculation delay for effect
  }, [activeOptimizations, baselineDuration, optimizations]);

  const toggleOptimization = (idx: number) => {
    const newSet = new Set(activeOptimizations);
    if (newSet.has(idx)) {
        newSet.delete(idx);
    } else {
        newSet.add(idx);
    }
    setActiveOptimizations(newSet);
  };

  const improvement = ((baselineDuration - simulatedDuration) / baselineDuration) * 100;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4 mb-4">
        <div className="p-3 bg-fuchsia-100 text-fuchsia-700 rounded-xl border border-fuchsia-200 shadow-sm">
           <FlaskConical className="w-6 h-6" />
        </div>
        <div>
           <h3 className="text-2xl font-bold text-slate-900 drop-shadow-sm">Optimization Playground</h3>
           <p className="text-slate-600 font-medium">Sandboxed environment. Toggle fixes to simulate impact before deploying.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Controls */}
          <div className="lg:col-span-2 space-y-4">
              {optimizations.map((opt, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => toggleOptimization(idx)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between group ${
                        activeOptimizations.has(idx) 
                        ? 'bg-fuchsia-50 border-fuchsia-300 ring-1 ring-fuchsia-200' 
                        : 'bg-white border-slate-200 hover:border-fuchsia-200'
                    }`}
                  >
                      <div className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center border transition-colors ${
                              activeOptimizations.has(idx) ? 'bg-fuchsia-500 border-fuchsia-600 text-white' : 'bg-white border-slate-300'
                          }`}>
                              {activeOptimizations.has(idx) && <Check className="w-4 h-4" />}
                          </div>
                          <div>
                              <h4 className={`font-bold text-sm ${activeOptimizations.has(idx) ? 'text-fuchsia-900' : 'text-slate-700'}`}>
                                  {opt.title}
                              </h4>
                              <p className="text-xs text-slate-500">
                                  Potential Savings: <span className="font-mono font-bold text-emerald-600">{(opt.estimated_time_saved_seconds || 0).toFixed(0)}s</span>
                              </p>
                          </div>
                      </div>
                      <div className="text-xs font-bold px-2 py-1 rounded bg-white border border-slate-200 text-slate-500">
                          {opt.implementation_complexity} Effort
                      </div>
                  </div>
              ))}
          </div>

          {/* Results Panel */}
          <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-between h-[400px]">
              {/* Background Glow */}
              <div className="absolute top-[-50%] right-[-50%] w-full h-full bg-fuchsia-500/20 blur-3xl rounded-full"></div>

              <div>
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2">
                      <Play className="w-4 h-4" /> Simulation Results
                  </h4>
                  
                  <div className="space-y-6">
                      <div>
                          <p className="text-slate-400 text-xs mb-1">Projected Runtime</p>
                          <div className="text-5xl font-bold flex items-baseline gap-2">
                              {isSimulating ? (
                                  <span className="animate-pulse">---</span>
                              ) : (
                                  simulatedDuration.toFixed(1)
                              )}
                              <span className="text-lg text-slate-500 font-medium">min</span>
                          </div>
                      </div>
                      
                      <div>
                          <p className="text-slate-400 text-xs mb-1">Total Improvement</p>
                          <div className={`text-3xl font-bold ${improvement > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                             {isSimulating ? '...' : `${improvement.toFixed(1)}%`}
                          </div>
                      </div>
                  </div>
              </div>

              <div className="relative z-10">
                  <button 
                    onClick={() => setActiveOptimizations(new Set())}
                    className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-sm font-bold flex items-center justify-center gap-2 transition-all"
                  >
                      <RotateCcw className="w-4 h-4" /> Reset Playground
                  </button>
                  {improvement > 20 && (
                      <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-300 font-medium flex items-start gap-2">
                          <Zap className="w-4 h-4 shrink-0" />
                          <span>Great combo! This configuration yields significant gains with {activeOptimizations.size} changes.</span>
                      </div>
                  )}
              </div>
          </div>
      </div>
    </div>
  );
};
