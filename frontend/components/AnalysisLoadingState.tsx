import React, { useState, useEffect } from 'react';
import { ProgressSteps } from '../design-system/components/Progress';

import { Loader2 } from 'lucide-react';

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
    <div className="flex items-center justify-center min-h-[400px] p-8 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-96 h-96 bg-primary-500/10 rounded-full blur-3xl animate-pulse-slow"></div>
        <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl mix-blend-multiply animate-blob"></div>
        <div className="absolute top-1/3 right-1/3 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl mix-blend-multiply animate-blob animation-delay-2000"></div>
      </div>

      <div className="relative max-w-2xl w-full backdrop-blur-md bg-white/70 dark:bg-gray-900/60 rounded-3xl border border-white/20 dark:border-white/5 shadow-2xl p-8 transform transition-all duration-500 hover:shadow-primary-500/10">
        <div className="space-y-8">
          {/* Header */}
          <div className="text-center relative">
            <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-gradient-to-tr from-primary-100 to-white dark:from-primary-900/30 dark:to-gray-800 shadow-lg mb-6 ring-1 ring-white/50 dark:ring-white/10 relative">
              <div className="absolute inset-0 rounded-full bg-primary-500/20 animate-ping opacity-20"></div>
              <Loader2 className="h-10 w-10 text-primary-600 dark:text-primary-400 animate-spin" />
            </div>
            <h3 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent mb-3">
              Analyzing Your Query
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              Our AI is reviewing your query plan and generating optimization recommendations...
            </p>
          </div>

          {/* Progress Bar */}
          <div className="relative pt-2">
            <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden shadow-inner border border-gray-200 dark:border-gray-700/50">
              <div
                className="h-full bg-gradient-to-r from-primary-500 via-purple-500 to-orange-500 relative"
                style={{ width: `${progressPercentage}%`, transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)' }}
              >
                <div className="absolute inset-0 bg-white/30 w-full h-full animate-shimmer" style={{ backgroundImage: 'linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent)', backgroundSize: '1rem 1rem' }}></div>
              </div>
            </div>
            <div className="flex justify-between items-center mt-3 font-medium">
              <span className="text-primary-600 dark:text-primary-400">{progressPercentage.toFixed(0)}% complete</span>
              <span className="text-gray-500 dark:text-gray-400 font-mono text-sm">{(elapsedTime / 1000).toFixed(1)}s elapsed</span>
            </div>
          </div>

          {/* Step-by-step Progress */}
          <div className="bg-white/40 dark:bg-black/20 rounded-2xl p-6 border border-white/20 dark:border-white/5 shadow-inner">
            <ProgressSteps steps={progressSteps} />
          </div>

          {/* Tips */}
          <div className="pt-4 border-t border-gray-200/50 dark:border-gray-700/50 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400 animate-pulse">
              💡 Tip: Larger query plans may take up to 30 seconds to analyze thoroughly
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisLoadingState;

// Simpler spinner component for inline use
export const InlineLoader: React.FC<{ text?: string; size?: 'sm' | 'md' | 'lg' }> = ({
  text = 'Loading...',
  size = 'md',
}) => {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return (
    <div className="flex items-center gap-3">
      <Loader2 className={`${sizes[size]} text-primary-500 animate-spin`} />
      {text && <span className="text-sm text-gray-600 dark:text-gray-400">{text}</span>}
    </div>
  );
};
