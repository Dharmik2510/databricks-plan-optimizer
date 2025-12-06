// src/hooks/useAnalysis.ts
// Hook for managing analysis operations

import { useState, useCallback } from 'react';
import { analysisApi, Analysis, AnalysisListResponse, CreateAnalysisData } from '../api';

interface UseAnalysisReturn {
  // State
  analyses: Analysis[];
  currentAnalysis: Analysis | null;
  isLoading: boolean;
  isCreating: boolean;
  error: string | null;
  pagination: AnalysisListResponse['pagination'] | null;

  // Actions
  createAnalysis: (data: CreateAnalysisData) => Promise<Analysis>;
  fetchAnalyses: (params?: { page?: number; limit?: number }) => Promise<void>;
  fetchAnalysis: (id: string) => Promise<Analysis>;
  pollStatus: (id: string, interval?: number) => () => void;
  deleteAnalysis: (id: string) => Promise<void>;
  retryAnalysis: (id: string) => Promise<void>;
  clearError: () => void;
  clearCurrentAnalysis: () => void;
}

export function useAnalysis(): UseAnalysisReturn {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [currentAnalysis, setCurrentAnalysis] = useState<Analysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<AnalysisListResponse['pagination'] | null>(null);

  const createAnalysis = useCallback(async (data: CreateAnalysisData): Promise<Analysis> => {
    setIsCreating(true);
    setError(null);

    try {
      const analysis = await analysisApi.create(data);
      setCurrentAnalysis(analysis);
      return analysis;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create analysis';
      setError(message);
      throw err;
    } finally {
      setIsCreating(false);
    }
  }, []);

  const fetchAnalyses = useCallback(async (params?: { page?: number; limit?: number }) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await analysisApi.list(params);
      setAnalyses(response.data);
      setPagination(response.pagination);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch analyses';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchAnalysis = useCallback(async (id: string): Promise<Analysis> => {
    setIsLoading(true);
    setError(null);

    try {
      const analysis = await analysisApi.get(id);
      setCurrentAnalysis(analysis);
      return analysis;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch analysis';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const pollStatus = useCallback((id: string, interval = 2000) => {
    const poll = async () => {
      try {
        const status = await analysisApi.getStatus(id);
        
        setCurrentAnalysis(prev => {
          if (!prev || prev.id !== id) return prev;
          return { ...prev, ...status };
        });

        // If still processing, continue polling
        if (status.status === 'PENDING' || status.status === 'PROCESSING') {
          timeoutId = setTimeout(poll, interval);
        } else {
          // Fetch full analysis when complete
          fetchAnalysis(id);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    };

    let timeoutId = setTimeout(poll, interval);

    // Return cleanup function
    return () => clearTimeout(timeoutId);
  }, [fetchAnalysis]);

  const deleteAnalysis = useCallback(async (id: string) => {
    try {
      await analysisApi.delete(id);
      setAnalyses(prev => prev.filter(a => a.id !== id));
      if (currentAnalysis?.id === id) {
        setCurrentAnalysis(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete analysis';
      setError(message);
      throw err;
    }
  }, [currentAnalysis]);

  const retryAnalysis = useCallback(async (id: string) => {
    try {
      await analysisApi.retry(id);
      // Fetch updated analysis
      await fetchAnalysis(id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to retry analysis';
      setError(message);
      throw err;
    }
  }, [fetchAnalysis]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearCurrentAnalysis = useCallback(() => {
    setCurrentAnalysis(null);
  }, []);

  return {
    analyses,
    currentAnalysis,
    isLoading,
    isCreating,
    error,
    pagination,
    createAnalysis,
    fetchAnalyses,
    fetchAnalysis,
    pollStatus,
    deleteAnalysis,
    retryAnalysis,
    clearError,
    clearCurrentAnalysis,
  };
}

export default useAnalysis;
