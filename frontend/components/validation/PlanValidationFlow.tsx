// frontend/components/validation/PlanValidationFlow.tsx
// Main validation workflow component that orchestrates validation stages

import React, { useEffect, useCallback } from 'react';
import { Upload, FileText, Sparkles, BrainCircuit } from 'lucide-react';
import { useValidationStore } from '../../store/useValidationStore';
import { analysisApi } from '../../api/analysis';
import { ValidationStepList } from './ValidationStepList';
import { ValidationSuccessCard } from './ValidationSuccessCard';
import { ValidationFailureCard } from './ValidationFailureCard';

interface PlanValidationFlowProps {
    textContent: string;
    setTextContent: (content: string) => void;
    inputMode: 'text' | 'file';
    setInputMode: (mode: 'text' | 'file') => void;
    onValidationComplete: () => void;
    onInsertDemo: () => void;
    onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const STEP_DELAYS = [400, 600, 800, 600, 500]; // Simulated timing for each step

export const PlanValidationFlow: React.FC<PlanValidationFlowProps> = ({
    textContent,
    setTextContent,
    inputMode,
    setInputMode,
    onValidationComplete,
    onInsertDemo,
    onFileUpload,
}) => {
    const {
        stage,
        steps,
        currentStepIndex,
        result,
        startValidation,
        advanceStep,
        completeStep,
        setResult,
        setError,
        reset,
    } = useValidationStore();

    // Run validation with animated steps
    const runValidation = useCallback(async () => {
        if (!textContent.trim()) return;

        startValidation();

        try {
            // Simulate step progression while waiting for API
            const stepIds = ['normalize', 'engine', 'operators', 'structure', 'semantic'];
            let stepIndex = 0;

            // Start the API call
            const apiPromise = analysisApi.validatePlan(textContent);

            // Animate through steps while API processes
            for (let i = 0; i < stepIds.length - 1; i++) {
                await new Promise(resolve => setTimeout(resolve, STEP_DELAYS[i]));
                completeStep(stepIds[i], STEP_DELAYS[i]);
                advanceStep();
                stepIndex++;
            }

            // Wait for API result
            const validationResult = await apiPromise;

            // Complete final step
            completeStep(stepIds[stepIds.length - 1], STEP_DELAYS[stepIds.length - 1]);

            // Small delay before showing result
            await new Promise(resolve => setTimeout(resolve, 300));

            // Set the result
            setResult(validationResult);
        } catch (error) {
            console.error('Validation error:', error);
            setError('Validation failed. Please try again.');
        }
    }, [textContent, startValidation, advanceStep, completeStep, setResult, setError]);

    const handleValidateClick = () => {
        runValidation();
    };

    const handleEditInput = () => {
        reset();
    };

    const handleShowExample = () => {
        // This is handled in the failure card itself
    };

    // Render based on validation stage
    if (stage === 'validating') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[600px] p-8 animate-fade-in">
                <div className="max-w-lg w-full space-y-8">
                    {/* Header */}
                    <div className="text-center">
                        <div className="inline-flex p-4 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl mb-4">
                            <BrainCircuit className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                            Validating Your Plan
                        </h2>
                        <p className="text-slate-600 dark:text-slate-400">
                            Our AI is analyzing the input to ensure it's a valid physical plan
                        </p>
                    </div>

                    {/* Step List */}
                    <ValidationStepList steps={steps} currentStepIndex={currentStepIndex} />
                </div>
            </div>
        );
    }

    if (stage === 'success' && result) {
        return (
            <div className="flex items-center justify-center min-h-[600px] p-8 animate-fade-in">
                <div className="max-w-lg w-full">
                    <ValidationSuccessCard result={result} onGoBack={handleEditInput} />
                </div>
            </div>
        );
    }

    if (stage === 'failed' && result) {
        return (
            <div className="flex items-center justify-center min-h-[600px] p-8 animate-fade-in">
                <div className="max-w-lg w-full">
                    <ValidationFailureCard
                        result={result}
                        onEditInput={handleEditInput}
                    />
                </div>
            </div>
        );
    }

    // Input Stage - Two column layout
    return (
        <div className="w-full bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden relative z-10 flex flex-col transition-colors">
            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                {['text', 'file'].map((mode) => (
                    <button
                        key={mode}
                        onClick={() => setInputMode(mode as any)}
                        className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-all ${inputMode === mode
                            ? 'text-orange-700 dark:text-orange-400 bg-white dark:bg-slate-900 border-b-2 border-orange-500 shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                    >
                        {mode === 'text' ? (
                            <FileText className="w-4 h-4" />
                        ) : (
                            <Upload className="w-4 h-4" />
                        )}
                        {mode === 'text' ? 'Paste Physical Plan' : 'Upload Plan File'}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="p-8 relative flex-1 flex flex-col">
                {inputMode === 'text' ? (
                    <div className="relative group flex-1">
                        <textarea
                            value={textContent}
                            onChange={(e) => setTextContent(e.target.value)}
                            className="w-full h-full min-h-[400px] p-6 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono text-sm rounded-2xl border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none resize-none shadow-inner leading-relaxed transition-all placeholder-slate-400 dark:placeholder-slate-600"
                            placeholder="Paste output from df.explain(true) → Physical Plan section

Example:
== Physical Plan ==
AdaptiveSparkPlan isFinalPlan=true
+- Project [user_id#12, sum(amount)#45]
   +- HashAggregate(keys=[user_id#12], functions=[sum(amount#45)])
      +- Exchange hashpartitioning(user_id#12, 200)
         +- FileScan parquet db.transactions[user_id#12, amount#45]
            Batched: true, Format: Parquet"
                        />
                        <div className="absolute top-4 right-4">
                            <button
                                onClick={onInsertDemo}
                                className="group flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 hover:border-orange-200 dark:hover:border-orange-800 transition-all cursor-pointer"
                            >
                                <Sparkles className="w-3.5 h-3.5 text-orange-500 group-hover:rotate-12 transition-transform" />
                                <span className="text-xs font-semibold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent group-hover:from-orange-500 group-hover:to-red-500">
                                    Load Demo Plan
                                </span>
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="h-full min-h-[400px] border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all relative group cursor-pointer">
                        <div className="p-5 bg-white dark:bg-slate-800 rounded-full shadow-md mb-4 group-hover:scale-110 transition-transform text-orange-600 dark:text-orange-400 border border-slate-200 dark:border-slate-700">
                            <Upload className="w-8 h-8" />
                        </div>
                        <p className="text-slate-800 dark:text-slate-200 font-bold text-lg mb-1">
                            Drop or Click to Upload
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Accepts .txt, .log files
                        </p>
                        <input
                            type="file"
                            accept=".txt,.log"
                            onChange={onFileUpload}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                    </div>
                )}
            </div>

            {/* Validate Button */}
            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800">
                <button
                    onClick={handleValidateClick}
                    disabled={!textContent.trim()}
                    className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:from-slate-300 disabled:to-slate-400 dark:disabled:from-slate-600 dark:disabled:to-slate-700 text-white px-6 py-4 rounded-xl font-bold text-lg shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 disabled:shadow-none transition-all transform active:scale-[0.98] disabled:cursor-not-allowed flex items-center justify-center gap-3"
                >
                    <BrainCircuit className="w-6 h-6" />
                    Validate Plan
                </button>
            </div>
        </div>
    );
};

export default PlanValidationFlow;
