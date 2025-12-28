// frontend/store/usePredictionStore.ts
// Prediction state management with Zustand

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { PerformancePrediction } from '../../shared/types';

interface PredictionState {
  // State
  prediction: PerformancePrediction | null;

  // Actions
  setPrediction: (prediction: PerformancePrediction | null) => void;
  reset: () => void;
}

export const usePredictionStore = create<PredictionState>()(
  devtools(
    (set) => ({
      prediction: null,

      setPrediction: (prediction) => set({ prediction }),
      reset: () => set({ prediction: null }),
    }),
    { name: 'PredictionStore' }
  )
);
