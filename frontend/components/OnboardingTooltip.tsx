import React from 'react';
import { TooltipRenderProps } from 'react-joyride';
import { ChevronRight, X, ArrowLeft, Check } from 'lucide-react';
import Button from '../design-system/components/Button';

const OnboardingTooltip: React.FC<TooltipRenderProps> = ({
    continuous,
    index,
    step,
    backProps,
    closeProps,
    primaryProps,
    tooltipProps,
    isLastStep,
    size,
}) => {
    return (
        <div
            {...tooltipProps}
            className="max-w-[400px] w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up"
        >
            {/* Header Gradient Line */}
            <div className="h-1.5 w-full bg-gradient-to-r from-orange-500 via-pink-500 to-indigo-500"></div>

            <div className="p-6 relative">
                {/* Close Button (top-right) */}
                {!isLastStep && (
                    <button
                        {...closeProps}
                        className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}

                {/* Step Indicator */}
                <div className="flex items-center gap-2 mb-4">
                    <div className="flex items-center gap-1">
                        {Array.from({ length: size }).map((_, i) => (
                            <div
                                key={i}
                                className={`h-1.5 rounded-full transition-all duration-300 ${i === index
                                    ? 'w-6 bg-gradient-to-r from-orange-500 to-pink-500'
                                    : i < index
                                        ? 'w-1.5 bg-slate-300 dark:bg-slate-700'
                                        : 'w-1.5 bg-slate-200 dark:bg-slate-800'
                                    }`}
                            ></div>
                        ))}
                    </div>
                    <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 ml-1">
                        Step {index + 1} of {size}
                    </span>
                </div>

                {/* Content */}
                <div className="mb-6">
                    {step.title && (
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 leading-tight">
                            {step.title}
                        </h3>
                    )}
                    <div className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed font-medium">
                        {step.content}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between pt-2">
                    {index > 0 ? (
                        <button
                            {...backProps}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" /> Back
                        </button>
                    ) : (
                        <button
                            {...closeProps}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                            Skip Tour
                        </button>
                    )}

                    <button
                        {...primaryProps}
                        className="group relative px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 transition-all transform active:scale-95 flex items-center gap-2 overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-orange-500 via-pink-500 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <span className="relative z-10 flex items-center gap-2 text-white dark:text-slate-900 group-hover:text-white transition-colors duration-300">
                            {isLastStep ? 'Get Started' : 'Next'}
                            {isLastStep ? <Check className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </span>
                    </button>
                </div>
            </div>

            {/* Decorative Blur */}
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
        </div>
    );
};

export default OnboardingTooltip;
