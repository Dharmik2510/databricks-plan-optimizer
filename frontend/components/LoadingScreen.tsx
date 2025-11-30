
import React, { useState, useEffect } from 'react';
import { Zap, Database, GitBranch, Brain, CheckCircle2, ArrowRight, Sparkles, Lightbulb } from 'lucide-react';

const TIPS = [
  "Did you know? Z-Ordering columns with high cardinality can speed up queries by 100x.",
  "Adaptive Query Execution (AQE) dynamically handles data skew and coalesces partitions.",
  "Converting CSV to Parquet significantly reduces storage costs and improves read throughput.",
  "Broadcast joins avoid costly network shuffles when one table is smaller than 10MB.",
  "Cache frequently used dataframes to prevent re-computation in iterative algorithms."
];

export const LoadingScreen: React.FC = () => {
  const [stage, setStage] = useState(0);
  const [progress, setProgress] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);

  const stages = [
    { icon: Database, label: "Parsing Execution Plan", desc: "Extracting DAG nodes & metrics", color: "from-blue-500 to-cyan-500", duration: 1500 },
    { icon: Brain, label: "AI Reasoning Engine", desc: "Identifying bottlenecks & patterns", color: "from-purple-500 to-pink-500", duration: 2500 },
    { icon: GitBranch, label: "Code Traceability", desc: "Mapping nodes to source code", color: "from-emerald-500 to-teal-500", duration: 1800 },
    { icon: Zap, label: "Generating Insights", desc: "Calculating cost & time savings", color: "from-orange-500 to-amber-500", duration: 1500 },
  ];

  useEffect(() => {
    const tipInterval = setInterval(() => {
      setTipIndex(prev => (prev + 1) % TIPS.length);
    }, 3000);
    return () => clearInterval(tipInterval);
  }, []);

  useEffect(() => {
    let progressInterval: ReturnType<typeof setInterval>;
    let stageTimer: ReturnType<typeof setTimeout>;
    const runAnalysis = async () => {
      for (let i = 0; i < stages.length; i++) {
        setStage(i);
        setProgress(0);
        const startTime = Date.now();
        const stageDuration = stages[i].duration;
        progressInterval = setInterval(() => {
          const elapsed = Date.now() - startTime;
          const newProgress = Math.min((elapsed / stageDuration) * 100, 100);
          setProgress(newProgress);
          if (newProgress >= 100) { clearInterval(progressInterval); }
        }, 30);
        await new Promise(resolve => { stageTimer = setTimeout(resolve, stageDuration); });
      }
      setStage(stages.length);
    };
    runAnalysis();
    return () => { clearInterval(progressInterval); clearTimeout(stageTimer); };
  }, []);

  const StageItem = ({ index, stageName, description, icon: Icon, isActive, isCompleted, color }: any) => {
    return (
      <div className="flex items-start gap-4 mb-6 last:mb-0 relative">
        {index < stages.length - 1 && (<div className={`absolute left-7 top-14 bottom-0 w-0.5 h-8 -mb-4 transition-colors duration-500 ${isCompleted ? 'bg-slate-300 dark:bg-slate-600' : 'bg-slate-100 dark:bg-slate-800'}`}></div>)}
        <div className="flex-shrink-0 relative z-10">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 ${isCompleted ? 'bg-white dark:bg-slate-800 border-2 border-emerald-500 text-emerald-600 dark:text-emerald-400 shadow-sm' : isActive ? `bg-gradient-to-br ${color} text-white shadow-lg shadow-orange-500/20 scale-110 ring-4 ring-white dark:ring-slate-800` : 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600'}`}>
            {isCompleted ? <CheckCircle2 className="w-6 h-6" /> : <Icon className="w-6 h-6" />}
          </div>
        </div>
        <div className="flex-1 pt-1.5">
          <div className="flex justify-between items-center mb-1"><h4 className={`text-sm font-bold transition-colors duration-300 ${isActive ? 'text-slate-900 dark:text-white' : isCompleted ? 'text-slate-500 dark:text-slate-400' : 'text-slate-400 dark:text-slate-600'}`}>{stageName}</h4>{isActive && <span className="text-xs font-bold text-slate-400 dark:text-slate-500">{Math.round(progress)}%</span>}</div>
          <p className={`text-xs transition-colors duration-300 mb-2 ${isActive ? 'text-slate-600 dark:text-slate-400' : 'text-slate-300 dark:text-slate-600'}`}>{description}</p>
          <div className={`h-1.5 w-full rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 transition-all duration-500 ${isActive ? 'opacity-100' : 'opacity-0'}`}><div className={`h-full rounded-full transition-all duration-100 ease-linear bg-gradient-to-r ${color}`} style={{ width: `${progress}%` }} /></div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] w-full animate-fade-in py-10">
      <div className="w-full max-w-2xl">
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 md:p-10 relative overflow-hidden transition-colors">
          <div className="absolute top-0 right-0 w-64 h-64 bg-orange-50 dark:bg-orange-900/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-50"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-50 dark:bg-blue-900/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 opacity-50"></div>
          <div className="text-center mb-10 relative z-10"><div className="inline-flex items-center gap-2 mb-2 px-3 py-1 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider"><Sparkles className="w-3 h-3 text-orange-500" /> AI Optimization in Progress</div><h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Analyzing Execution Plan</h2><p className="text-slate-500 dark:text-slate-400 font-medium">Please wait while we deconstruct your Spark DAG.</p></div>
          <div className="max-w-md mx-auto relative z-10">{stages.map((s, i) => (<StageItem key={i} index={i} stageName={s.label} description={s.desc} icon={s.icon} color={s.color} isActive={stage === i} isCompleted={stage > i} />))}</div>
          <div className="mt-10 pt-6 border-t border-slate-100 dark:border-slate-800 relative z-10"><div className="flex items-start gap-3"><div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 rounded-lg shrink-0"><Lightbulb className="w-5 h-5" /></div><div className="flex-1"><span className="text-xs font-bold text-yellow-600 dark:text-yellow-400 uppercase tracking-wide block mb-1">Optimization Tip</span><p className="text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed animate-fade-in" key={tipIndex}>{TIPS[tipIndex]}</p></div></div></div>
        </div>
        <div className="text-center mt-6 text-slate-400 dark:text-slate-500 text-xs font-medium">Powered by Gemini 2.5 Flash • Secure Analysis Environment</div>
      </div>
    </div>
  );
};
