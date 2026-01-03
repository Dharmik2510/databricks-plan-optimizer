// frontend/store/useValidationStore.ts
// Validation state management with Zustand

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export type ValidationStepStatus = 'pending' | 'active' | 'completed' | 'error';

export interface ValidationStep {
    id: string;
    label: string;
    status: ValidationStepStatus;
    duration?: number; // milliseconds
}

export interface ValidationResult {
    is_valid: boolean;
    confidence: 'high' | 'medium' | 'low';
    reason: string;
    detected_engine: 'spark' | 'unknown';
    detected_plan_type: 'physical' | 'logical' | 'unknown';
    detected_issues: string[];
    suggested_user_action: string;
    stage_count?: number;
    detected_operators?: string[];
}

export type ValidationStage = 'idle' | 'validating' | 'success' | 'failed';

interface ValidationState {
    // State
    stage: ValidationStage;
    steps: ValidationStep[];
    currentStepIndex: number;
    result: ValidationResult | null;
    error: string | null;

    // Actions
    startValidation: () => void;
    advanceStep: () => void;
    completeStep: (stepId: string, duration?: number) => void;
    setStepError: (stepId: string) => void;
    setResult: (result: ValidationResult) => void;
    setError: (error: string) => void;
    setStage: (stage: ValidationStage) => void;
    reset: () => void;
}

const DEFAULT_STEPS: ValidationStep[] = [
    { id: 'normalize', label: 'Normalizing input', status: 'pending' },
    { id: 'engine', label: 'Detecting Spark engine', status: 'pending' },
    { id: 'operators', label: 'Identifying physical operators', status: 'pending' },
    { id: 'structure', label: 'Verifying plan structure', status: 'pending' },
    { id: 'semantic', label: 'Semantic consistency check', status: 'pending' },
];

const initialState = {
    stage: 'idle' as ValidationStage,
    steps: DEFAULT_STEPS.map(step => ({ ...step })),
    currentStepIndex: -1,
    result: null,
    error: null,
};

export const useValidationStore = create<ValidationState>()(
    devtools(
        (set, get) => ({
            ...initialState,

            startValidation: () => {
                set({
                    stage: 'validating',
                    steps: DEFAULT_STEPS.map(step => ({ ...step, status: 'pending' })),
                    currentStepIndex: 0,
                    result: null,
                    error: null,
                });
                // Set first step as active
                set(state => ({
                    steps: state.steps.map((step, idx) =>
                        idx === 0 ? { ...step, status: 'active' } : step
                    ),
                }));
            },

            advanceStep: () => {
                const { currentStepIndex, steps } = get();
                const nextIndex = currentStepIndex + 1;

                if (nextIndex < steps.length) {
                    set({
                        currentStepIndex: nextIndex,
                        steps: steps.map((step, idx) =>
                            idx === nextIndex
                                ? { ...step, status: 'active' }
                                : idx < nextIndex
                                    ? { ...step, status: 'completed' }
                                    : step
                        ),
                    });
                }
            },

            completeStep: (stepId: string, duration?: number) => {
                set(state => ({
                    steps: state.steps.map(step =>
                        step.id === stepId
                            ? { ...step, status: 'completed', duration }
                            : step
                    ),
                }));
            },

            setStepError: (stepId: string) => {
                set(state => ({
                    steps: state.steps.map(step =>
                        step.id === stepId ? { ...step, status: 'error' } : step
                    ),
                }));
            },

            setResult: (result: ValidationResult) => {
                set({
                    result,
                    stage: result.is_valid ? 'success' : 'failed',
                    steps: get().steps.map(step => ({ ...step, status: 'completed' })),
                });
            },

            setError: (error: string) => {
                set({ error, stage: 'failed' });
            },

            setStage: (stage: ValidationStage) => {
                set({ stage });
            },

            reset: () => {
                set({
                    ...initialState,
                    steps: DEFAULT_STEPS.map(step => ({ ...step })),
                });
            },
        }),
        { name: 'ValidationStore' }
    )
);
