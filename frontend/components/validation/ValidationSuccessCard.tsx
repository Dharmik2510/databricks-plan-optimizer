// frontend/components/validation/ValidationSuccessCard.tsx
// Success confirmation card after validation passes

import React from 'react';
import { CheckCircle2, Cpu, Sparkles, RotateCcw } from 'lucide-react';
import { ValidationResult } from '../../store/useValidationStore';

interface ValidationSuccessCardProps {
    result: ValidationResult;
    onGoBack: () => void;
}

export const ValidationSuccessCard: React.FC<ValidationSuccessCardProps> = ({
    result,
    onGoBack,
}) => {
    const confidenceColors = {
        high: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        medium: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
        low: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden animate-in zoom-in-95 duration-500">
            {/* Success Header */}
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                        <CheckCircle2 className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white">
                            Physical Plan Validated
                        </h3>
                        <p className="text-emerald-100 text-sm font-medium">
                            Your plan is ready for analysis
                        </p>
                    </div>
                </div>
            </div>

            {/* Details */}
            <div className="p-6 space-y-6">
                {/* Stats Grid - 2 columns */}
                <div className="grid grid-cols-2 gap-4">
                    {/* Engine Badge */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2 mb-2">
                            <Cpu className="w-4 h-4 text-indigo-500" />
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                                Engine
                            </span>
                        </div>
                        <p className="text-lg font-bold text-slate-900 dark:text-white capitalize">
                            {result.detected_engine}
                        </p>
                    </div>

                    {/* Confidence */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="w-4 h-4 text-purple-500" />
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                                Confidence
                            </span>
                        </div>
                        <span
                            className={`inline-flex px-3 py-1 rounded-full text-sm font-bold border ${confidenceColors[result.confidence]
                                }`}
                        >
                            {result.confidence.charAt(0).toUpperCase() + result.confidence.slice(1)}
                        </span>
                    </div>
                </div>

                {/* Detected Operators */}
                {result.detected_operators && result.detected_operators.length > 0 && (
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-3">
                            Detected Operators
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {result.detected_operators.slice(0, 8).map((op, idx) => (
                                <span
                                    key={idx}
                                    className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-mono rounded-md border border-indigo-200 dark:border-indigo-800"
                                >
                                    {op}
                                </span>
                            ))}
                            {result.detected_operators.length > 8 && (
                                <span className="px-2 py-1 text-slate-500 dark:text-slate-400 text-xs">
                                    +{result.detected_operators.length - 8} more
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {/* Reason */}
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {result.reason}
                </p>

                {/* Go Back Button */}
                <button
                    onClick={onGoBack}
                    className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-4 py-3 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700"
                >
                    <RotateCcw className="w-4 h-4" />
                    Go Back to Input
                </button>
            </div>
        </div>
    );
};

export default ValidationSuccessCard;
