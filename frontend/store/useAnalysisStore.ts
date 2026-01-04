// frontend/store/useAnalysisStore.ts
// Analysis state management with Zustand

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { AnalysisResult, AppState } from '../../shared/types';

interface AnalysisState {
  // State
  analysisId: string | null;
  result: AnalysisResult | null;
  appState: AppState;
  error: string | null;
  analysisTitle: string;
  textContent: string;
  inputMode: 'file' | 'text';

  // Actions
  setAnalysisId: (id: string | null) => void;
  setResult: (result: AnalysisResult | null) => void;
  setAppState: (state: AppState) => void;
  setError: (error: string | null) => void;
  setAnalysisTitle: (title: string) => void;
  setTextContent: (content: string) => void;
  setInputMode: (mode: 'file' | 'text') => void;
  reset: () => void;
}

const initialState = {
  analysisId: null,
  result: null,
  appState: AppState.IDLE,
  error: null,
  analysisTitle: '',
  textContent: '',
  inputMode: 'text' as const,
};

export const useAnalysisStore = create<AnalysisState>()(
  devtools(
    (set) => ({
      ...initialState,

      setAnalysisId: (analysisId) => set({ analysisId }),
      setResult: (result) => set({ result }),
      setAppState: (appState) => set({ appState }),
      setError: (error) => set({ error }),
      setAnalysisTitle: (analysisTitle) => set({ analysisTitle }),
      setTextContent: (textContent) => set({ textContent }),
      setInputMode: (inputMode) => set({ inputMode }),
      reset: () => set(initialState),
    }),
    { name: 'AnalysisStore' }
  )
);
