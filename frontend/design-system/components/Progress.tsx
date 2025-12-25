import React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import { cn } from '../utils';

export interface ProgressProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'success' | 'warning' | 'error';
  showLabel?: boolean;
  label?: string;
  className?: string;
}

const Progress: React.FC<ProgressProps> = ({
  value,
  max = 100,
  size = 'md',
  variant = 'default',
  showLabel = false,
  label,
  className,
}) => {
  const percentage = Math.min((value / max) * 100, 100);

  const sizes = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  const variants = {
    default: 'bg-primary-500 dark:bg-primary-400',
    success: 'bg-green-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500',
  };

  return (
    <div className={cn('w-full', className)}>
      {(showLabel || label) && (
        <div className="flex justify-between mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          <span>{label || 'Progress'}</span>
          <span>{percentage.toFixed(0)}%</span>
        </div>
      )}

      <ProgressPrimitive.Root
        value={value}
        max={max}
        className={cn(
          'relative overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700',
          sizes[size]
        )}
      >
        <ProgressPrimitive.Indicator
          className={cn(
            'h-full transition-all duration-500 ease-out',
            variants[variant]
          )}
          style={{ transform: `translateX(-${100 - percentage}%)` }}
        />
      </ProgressPrimitive.Root>
    </div>
  );
};

export default Progress;

// Step-based progress component
export interface ProgressStepsProps {
  steps: Array<{
    label: string;
    status: 'completed' | 'current' | 'pending';
    duration?: string;
  }>;
  className?: string;
}

export const ProgressSteps: React.FC<ProgressStepsProps> = ({ steps, className }) => {
  return (
    <div className={cn('space-y-3', className)}>
      {steps.map((step, index) => (
        <div key={index} className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            {step.status === 'completed' ? (
              <div className="h-6 w-6 rounded-full bg-green-500 flex items-center justify-center">
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            ) : step.status === 'current' ? (
              <div className="h-6 w-6 rounded-full border-2 border-primary-500 flex items-center justify-center">
                <div className="h-2 w-2 rounded-full bg-primary-500 animate-pulse" />
              </div>
            ) : (
              <div className="h-6 w-6 rounded-full border-2 border-gray-300 dark:border-gray-600" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p
              className={cn(
                'text-sm font-medium',
                step.status === 'completed' && 'text-green-700 dark:text-green-400',
                step.status === 'current' && 'text-primary-700 dark:text-primary-400',
                step.status === 'pending' && 'text-gray-500 dark:text-gray-400'
              )}
            >
              {step.label}
            </p>
            {step.duration && step.status === 'completed' && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {step.duration}
              </p>
            )}
          </div>

          {step.status === 'current' && (
            <div className="flex-shrink-0">
              <svg className="animate-spin h-4 w-4 text-primary-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
