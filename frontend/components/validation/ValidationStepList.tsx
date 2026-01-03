// frontend/components/validation/ValidationStepList.tsx
// Animated checklist component showing validation progress

import React, { useEffect, useState } from 'react';
import { Check, Loader2, AlertCircle, Circle } from 'lucide-react';
import { ValidationStep, ValidationStepStatus } from '../../store/useValidationStore';

interface ValidationStepListProps {
    steps: ValidationStep[];
    currentStepIndex: number;
}

const stepAnimationDelay = 600; // ms between each step appearing

export const ValidationStepList: React.FC<ValidationStepListProps> = ({
    steps,
    currentStepIndex,
}) => {
    const [visibleCount, setVisibleCount] = useState(0);

    useEffect(() => {
        // Animate steps appearing one by one
        if (currentStepIndex >= 0 && visibleCount < steps.length) {
            const timer = setTimeout(() => {
                setVisibleCount(prev => Math.min(prev + 1, currentStepIndex + 1));
            }, stepAnimationDelay);
            return () => clearTimeout(timer);
        }
    }, [currentStepIndex, visibleCount, steps.length]);

    // When validation starts, reset visible count
    useEffect(() => {
        if (currentStepIndex === 0) {
            setVisibleCount(1);
        }
    }, [currentStepIndex]);

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-lg">
            <div className="space-y-4">
                {steps.map((step, idx) => (
                    <StepItem
                        key={step.id}
                        step={step}
                        isVisible={idx < visibleCount}
                        index={idx}
                    />
                ))}
            </div>
        </div>
    );
};

interface StepItemProps {
    step: ValidationStep;
    isVisible: boolean;
    index: number;
}

const StepItem: React.FC<StepItemProps> = ({ step, isVisible, index }) => {
    if (!isVisible) {
        return null;
    }

    return (
        <div
            className="flex items-center gap-4 animate-in fade-in slide-in-from-left-4 duration-500"
            style={{ animationDelay: `${index * 100}ms` }}
        >
            <StatusIcon status={step.status} />
            <div className="flex-1 flex justify-between items-center">
                <span
                    className={`text-sm font-medium transition-colors duration-300 ${step.status === 'completed'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : step.status === 'active'
                                ? 'text-slate-900 dark:text-white'
                                : step.status === 'error'
                                    ? 'text-red-600 dark:text-red-400'
                                    : 'text-slate-400 dark:text-slate-500'
                        }`}
                >
                    {step.label}
                </span>
                {step.status === 'completed' && step.duration && (
                    <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                        {step.duration < 1000
                            ? `${step.duration}ms`
                            : `${(step.duration / 1000).toFixed(1)}s`}
                    </span>
                )}
                {step.status === 'active' && (
                    <Loader2 className="w-3 h-3 text-indigo-500 dark:text-indigo-400 animate-spin" />
                )}
            </div>
        </div>
    );
};

const StatusIcon: React.FC<{ status: ValidationStepStatus }> = ({ status }) => {
    const baseClasses = 'w-6 h-6 flex items-center justify-center flex-shrink-0';

    switch (status) {
        case 'completed':
            return (
                <div
                    className={`${baseClasses} rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/30`}
                >
                    <Check className="w-3.5 h-3.5 text-white" />
                </div>
            );
        case 'active':
            return (
                <div className={`${baseClasses} relative`}>
                    <div className="absolute inset-0 rounded-full border-2 border-slate-200 dark:border-slate-700" />
                    <div className="absolute inset-0 rounded-full border-t-2 border-indigo-500 dark:border-indigo-400 animate-spin" />
                </div>
            );
        case 'error':
            return (
                <div
                    className={`${baseClasses} rounded-full bg-red-500 shadow-lg shadow-red-500/30`}
                >
                    <AlertCircle className="w-3.5 h-3.5 text-white" />
                </div>
            );
        default:
            return (
                <div
                    className={`${baseClasses} rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50`}
                >
                    <Circle className="w-3 h-3 text-slate-300 dark:text-slate-600" />
                </div>
            );
    }
};

export default ValidationStepList;
