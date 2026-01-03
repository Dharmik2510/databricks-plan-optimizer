import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, Sparkles } from 'lucide-react';

export interface AnalysisStep {
  label: string;
  status: 'completed' | 'current' | 'pending';
  duration?: string;
}

interface AnalysisLoadingStateProps {
  steps?: AnalysisStep[];
  currentStep?: number;
  estimatedTime?: number;
}

const DEFAULT_STEPS = [
  { label: 'Parsing query plan', status: 'pending' as const },
  { label: 'Building DAG structure', status: 'pending' as const },
  { label: 'Analyzing execution patterns', status: 'pending' as const },
  { label: 'Generating AI optimizations', status: 'pending' as const },
  { label: 'Calculating impact metrics', status: 'pending' as const },
];

const AnalysisLoadingState: React.FC<AnalysisLoadingStateProps> = ({
  steps = DEFAULT_STEPS,
  currentStep = 0,
  estimatedTime = 10000,
}) => {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [progressSteps, setProgressSteps] = useState<AnalysisStep[]>(steps);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime(prev => prev + 100);
    }, 100);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setProgressSteps(prevSteps =>
      prevSteps.map((step, index) => {
        if (index < currentStep) {
          return { ...step, status: 'completed' as const, duration: '~1s' };
        } else if (index === currentStep) {
          return { ...step, status: 'current' as const };
        }
        return { ...step, status: 'pending' as const };
      })
    );
  }, [currentStep]);

  const progressPercentage = Math.min((elapsedTime / estimatedTime) * 100, 95);

  return (
    <div className="flex items-center justify-center min-h-[400px] md:min-h-[600px] p-4 md:p-8 relative overflow-hidden bg-slate-50 dark:bg-transparent">
      {/* Background Ambient Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/10 dark:bg-indigo-600/5 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="relative max-w-2xl w-full bg-white dark:bg-[#0B1120] rounded-2xl md:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500">

        {/* Glowing Top Border */}
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-orange-500 via-purple-500 to-blue-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]"></div>

        <div className="p-5 md:p-10 space-y-6 md:space-y-10 relative z-10">

          <div className="flex flex-col items-center text-center">
            <div className="relative mb-4 md:mb-8">
              {/* Ripple Effect */}
              <div className="absolute inset-0 rounded-full border border-indigo-500/30 dark:border-indigo-500/30 animate-[ping_2s_ease-out_infinite]"></div>
              <div className="absolute inset-0 rounded-full border border-violet-500/20 dark:border-violet-500/20 animate-[ping_3s_ease-out_infinite_delay-700ms]"></div>

              <div className="w-14 h-14 md:w-20 md:h-20 rounded-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-xl relative z-10">
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-indigo-500/10 dark:from-indigo-500/20 to-violet-500/10 dark:to-violet-500/20 animate-spin-slow"></div>
                <Loader2 className="w-6 h-6 md:w-8 md:h-8 text-indigo-500 dark:text-indigo-400 animate-spin" />
              </div>
            </div>

            <h3 className="text-xl md:text-3xl font-bold text-slate-900 dark:text-white dark:bg-clip-text dark:text-transparent dark:bg-gradient-to-r dark:from-white dark:via-slate-200 dark:to-slate-400 mb-2 md:mb-3 tracking-tight">
              Analyzing Your Query
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm md:text-lg max-w-lg leading-relaxed">
              Our AI is reviewing your query plan and generating optimization recommendations...
            </p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-3">
            <div className="h-3 bg-slate-100 dark:bg-slate-800/50 rounded-full overflow-hidden border border-slate-200 dark:border-white/5 backdrop-blur-sm shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-500 bg-[length:200%_100%] animate-gradient-x transition-all duration-300 ease-out relative"
                style={{ width: `${progressPercentage}%` }}
              >
                {/* Striped overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem] animate-move-stripes"></div>

                {/* Glowing tip */}
                <div className="absolute right-0 top-0 bottom-0 w-1 bg-white/50 blur-[2px]"></div>
              </div>
            </div>
            <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest text-slate-500">
              <span className="text-indigo-600 dark:text-indigo-400">{progressPercentage.toFixed(0)}% complete</span>
              <span className="font-mono">{(elapsedTime / 1000).toFixed(1)}s elapsed</span>
            </div>
          </div>

          {/* Step-by-step Progress */}
          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl md:rounded-2xl p-4 md:p-6 border border-slate-200 dark:border-slate-800/80 backdrop-blur-md">
            <div className="space-y-4">
              {progressSteps.map((step, idx) => (
                <StepItem key={idx} step={step} />
              ))}
            </div>
          </div>

          {/* Tips */}
          <div className="pt-4 md:pt-6 border-t border-slate-200 dark:border-white/5 text-center">
            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-500 flex items-center justify-center gap-2 animate-pulse">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Tip: Larger query plans may take up to 30 seconds to analyze thoroughly
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const StepItem = ({ step }: { step: AnalysisStep }) => {
  return (
    <div className="flex items-center gap-4">
      <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
        {step.status === 'completed' && (
          <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5 text-white" />
          </div>
        )}
        {step.status === 'current' && (
          <div className="relative">
            <div className="absolute inset-0 rounded-full border-2 border-indigo-200 dark:border-white/20"></div>
            <div className="absolute inset-0 rounded-full border-t-2 border-indigo-500 dark:border-indigo-400 animate-spin"></div>
            <div className="w-6 h-6 rounded-full"></div>
          </div>
        )}
        {step.status === 'pending' && (
          <div className="w-6 h-6 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50"></div>
        )}
      </div>
      <div className="flex-1 flex justify-between items-center">
        <span className={`text-sm font-medium ${step.status === 'completed' ? 'text-emerald-600 dark:text-emerald-400' :
          step.status === 'current' ? 'text-slate-900 dark:text-white' :
            'text-slate-400 dark:text-slate-500'
          }`}>
          {step.label}
        </span>
        {step.status === 'completed' && step.duration && (
          <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">{step.duration}</span>
        )}
        {step.status === 'current' && (
          <Loader2 className="w-3 h-3 text-indigo-500 dark:text-indigo-400 animate-spin" />
        )}
      </div>
    </div>
  );
};

export default AnalysisLoadingState;
