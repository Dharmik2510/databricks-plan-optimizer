import React, { useState } from 'react';
import { X, ChevronRight, ChevronLeft, BookOpen, LayoutDashboard, GitBranch, Zap, Activity } from 'lucide-react';

interface UserGuideModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const steps = [
    {
        title: "Welcome to BrickOptima",
        description: "Your intelligent companion for Databricks optimization. This guide will help you navigate the platform and get the most out of your Spark jobs.",
        icon: Activity,
        color: "text-blue-500",
        bg: "bg-blue-50 dark:bg-blue-900/20"
    },
    {
        title: "Plan Analyzer",
        description: "Paste your Spark query execution plans (EXPLAIN output) or upload logs to get instant optimization recommendations, cost estimates, and bottleneck analysis.",
        icon: LayoutDashboard,
        color: "text-orange-500",
        bg: "bg-orange-50 dark:bg-orange-900/20"
    },
    {
        title: "Repository Mapping",
        description: "Connect your Git repository to automatically map expensive query stages back to the exact lines of code in your source files.",
        icon: GitBranch,
        color: "text-purple-500",
        bg: "bg-purple-50 dark:bg-purple-900/20"
    },
    {
        title: "Optimization Playground",
        description: "Simulate the impact of applying different optimizations before you change a single line of code. See potential time and cost savings in real-time.",
        icon: Zap,
        color: "text-emerald-500",
        bg: "bg-emerald-50 dark:bg-emerald-900/20"
    }
];

export const UserGuideModal: React.FC<UserGuideModalProps> = ({ isOpen, onClose }) => {
    const [currentStep, setCurrentStep] = useState(0);

    if (!isOpen) return null;

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            onClose();
        }
    };

    const handlePrev = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const StepIcon = steps[currentStep].icon;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                            <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Platform Guide</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8">
                    <div className="min-h-[240px] flex flex-col items-center text-center">
                        <div className={`w-20 h-20 rounded-2xl ${steps[currentStep].bg} flex items-center justify-center mb-6 shadow-sm`}>
                            <StepIcon className={`w-10 h-10 ${steps[currentStep].color}`} />
                        </div>

                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                            {steps[currentStep].title}
                        </h3>

                        <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-lg">
                            {steps[currentStep].description}
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex gap-1.5">
                        {steps.map((_, idx) => (
                            <div
                                key={idx}
                                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${idx === currentStep ? 'bg-indigo-600 w-6' : 'bg-slate-300 dark:bg-slate-600'}`}
                            />
                        ))}
                    </div>

                    <div className="flex gap-3">
                        {currentStep > 0 && (
                            <button
                                onClick={handlePrev}
                                className="px-4 py-2 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
                            >
                                Back
                            </button>
                        )}
                        <button
                            onClick={handleNext}
                            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 flex items-center gap-2 transition-all transform active:scale-95"
                        >
                            {currentStep === steps.length - 1 ? "Get Started" : "Next"}
                            {currentStep < steps.length - 1 && <ChevronRight className="w-4 h-4" />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
