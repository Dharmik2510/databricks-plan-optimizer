
import React from 'react';
import { PerformancePrediction } from '../../shared/types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Clock, AlertTriangle, FastForward, CheckSquare } from 'lucide-react';

interface Props {
  prediction: PerformancePrediction;
}

export const PredictivePanel: React.FC<Props> = ({ prediction }) => {
  return (
    <div className="space-y-8 animate-fade-in mt-12">
      <div className="flex items-center gap-4 mb-4">
        <div className="p-3 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-xl border border-purple-200 dark:border-purple-800 shadow-sm">
           <TrendingUp className="w-6 h-6" />
        </div>
        <div>
           <h3 className="text-2xl font-bold text-slate-900 dark:text-white drop-shadow-sm">Predictive Analytics & Scalability</h3>
           <p className="text-slate-600 dark:text-slate-400 font-medium">AI-driven projection of workload performance at scale.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Baseline vs Prediction */}
        <div className="grid grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col justify-center">
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Current Runtime
                </div>
                <div className="text-3xl font-bold text-slate-900 dark:text-white">
                    {(prediction.baselineExecutionTime / 60).toFixed(1)} <span className="text-base text-slate-500 dark:text-slate-400 font-medium">min</span>
                </div>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-3xl border border-emerald-100 dark:border-emerald-800 p-6 shadow-sm flex flex-col justify-center">
                <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide mb-2 flex items-center gap-2">
                    <FastForward className="w-4 h-4" /> Predicted
                </div>
                <div className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">
                    {(prediction.predictedExecutionTime / 60).toFixed(1)} <span className="text-base text-emerald-600 dark:text-emerald-500 font-medium">min</span>
                </div>
                 <div className="text-xs text-emerald-600 dark:text-emerald-500 font-bold mt-1">
                    -{((1 - prediction.predictedExecutionTime / prediction.baselineExecutionTime) * 100).toFixed(0)}% reduction
                 </div>
            </div>
        </div>

        {/* Scalability Chart */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
            <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-4">Scalability Forecast (Log Scale)</h4>
            <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={prediction.dataScaleImpact}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(203, 213, 225, 0.5)" vertical={false} />
                        <XAxis dataKey="dataSize" tick={{fontSize: 10, fontWeight: 600, fill: '#64748b'}} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={(val) => `${(val/60).toFixed(0)}m`} tick={{fontSize: 10, fontWeight: 600, fill: '#64748b'}} axisLine={false} tickLine={false} />
                        <Tooltip 
                            formatter={(val: number) => [`${(val/60).toFixed(1)} min`, 'Runtime']}
                            contentStyle={{backgroundColor: 'var(--tw-bg-opacity, 1) #ffffff', borderColor: '#e2e8f0', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', color: '#0f172a'}}
                            itemStyle={{color: '#0f172a'}}
                        />
                        <Line type="monotone" dataKey="currentTime" name="Current" stroke="#ef4444" strokeWidth={3} dot={{r: 4}} />
                        <Line type="monotone" dataKey="optimizedTime" name="Optimized" stroke="#10b981" strokeWidth={3} dot={{r: 4}} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
         {/* Bottleneck Progression */}
         <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
            <h4 className="font-bold text-slate-900 dark:text-white text-lg mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-500" /> Bottleneck Evolution
            </h4>
            <div className="space-y-4">
                {prediction.bottleneckProgression.length === 0 ? (
                    <div className="text-sm text-slate-500 dark:text-slate-400 italic py-4 text-center bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                        No critical scaling bottlenecks detected.
                    </div>
                ) : (
                    prediction.bottleneckProgression.map((b, i) => (
                        <div key={i} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                            <div className="flex justify-between items-start mb-2">
                                <span className="font-mono text-sm font-bold text-slate-800 dark:text-slate-200">{b.stage}</span>
                                <span className="text-xs font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded">Risk at Scale</span>
                            </div>
                            <div className="flex items-center gap-4 text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                                <div className="flex-1">Current Impact: <span className="text-slate-900 dark:text-white">{b.currentImpact}%</span></div>
                                <div className="flex-1">At 10x: <span className="text-amber-700 dark:text-amber-400 font-bold">{b.at10xScale}%</span></div>
                                <div className="flex-1">At 100x: <span className="text-red-700 dark:text-red-400 font-bold">{b.at100xScale}%</span></div>
                            </div>
                            <div className="text-xs text-slate-700 dark:text-slate-300 italic border-t border-slate-200 dark:border-slate-700 pt-2 mt-2">
                                "{b.recommendation}"
                            </div>
                        </div>
                    ))
                )}
            </div>
         </div>

         {/* What-If Scenarios */}
         <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
             <h4 className="font-bold text-slate-900 dark:text-white text-lg mb-4">What-If Scenarios</h4>
             <div className="space-y-3">
                 {prediction.whatIfScenarios.map((s, i) => (
                     <div key={i} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm transition-transform hover:scale-[1.02]">
                         <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200 text-sm mb-2">
                             <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" /> {s.scenario}
                         </div>
                         <div className="grid grid-cols-2 gap-2 text-xs">
                             <div className="text-slate-500 dark:text-slate-400">Reduction: <span className="text-emerald-600 dark:text-emerald-400 font-bold">{s.timeReduction}</span></div>
                             <div className="text-slate-500 dark:text-slate-400">Savings: <span className="text-emerald-600 dark:text-emerald-400 font-bold">{s.costSavings}</span></div>
                             <div className="text-slate-500 dark:text-slate-400">Effort: <span className="text-slate-700 dark:text-slate-300 font-bold">{s.complexity}</span></div>
                             <div className="text-slate-500 dark:text-slate-400">Time: <span className="text-slate-700 dark:text-slate-300 font-bold">{s.implementation}</span></div>
                         </div>
                     </div>
                 ))}
             </div>
         </div>
      </div>
    </div>
  );
};
