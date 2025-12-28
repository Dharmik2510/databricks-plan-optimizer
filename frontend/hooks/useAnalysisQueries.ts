// frontend/hooks/useAnalysisQueries.ts
// React Query hooks for analysis operations

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, analysisApi } from '../api';

// Query Keys
export const analysisKeys = {
  all: ['analyses'] as const,
  lists: () => [...analysisKeys.all, 'list'] as const,
  list: (filters: any) => [...analysisKeys.lists(), filters] as const,
  details: () => [...analysisKeys.all, 'detail'] as const,
  detail: (id: string) => [...analysisKeys.details(), id] as const,
  recent: () => [...analysisKeys.all, 'recent'] as const,
};

// Fetch recent analyses
export function useRecentAnalyses() {
  return useQuery({
    queryKey: analysisKeys.recent(),
    queryFn: () => apiClient.getRecentAnalyses(),
  });
}

// Fetch analysis history with filters
export function useAnalysisHistory(params?: any) {
  return useQuery({
    queryKey: analysisKeys.list(params),
    queryFn: () => apiClient.getAnalysisHistory(params),
  });
}

// Fetch single analysis by ID
export function useAnalysis(id: string | null) {
  return useQuery({
    queryKey: analysisKeys.detail(id || ''),
    queryFn: () => analysisApi.get(id!),
    enabled: !!id,
  });
}

// Update analysis mutation
export function useUpdateAnalysis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { title?: string } }) =>
      apiClient.updateAnalysis(id, data),
    onSuccess: (_, variables) => {
      // Invalidate and refetch relevant queries
      queryClient.invalidateQueries({ queryKey: analysisKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: analysisKeys.recent() });
      queryClient.invalidateQueries({ queryKey: analysisKeys.lists() });
    },
  });
}
