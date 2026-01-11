import apiClient from './client';

export interface HistoricalAnalysisResult {
  id: string;
  mode: 'single' | 'compare';
  app_id_a: string;
  app_id_b?: string | null;
  app_name?: string | null;
  narrative_md: string;
  evidence_json: any;
  status: 'pending' | 'complete' | 'error';
  error?: string | null;
  latency_ms?: number | null;
  created_at?: string;
  title?: string | null;
  tags?: string[] | null;
}

export interface HistoricalRunItem {
  appId: string;
  appName: string;
  startTime?: string | null;
  endTime?: string | null;
  durationMs?: number | null;
  completed?: boolean;
}

const buildQuery = (params: Record<string, any>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });
  const qs = search.toString();
  return qs ? `?${qs}` : '';
};

export const historicalApi = {
  analyze: (payload: { appId?: string; appName?: string; startTime?: string; endTime?: string; question?: string }) =>
    apiClient.post<HistoricalAnalysisResult>('/historical/analyze', payload),

  compare: (payload: { appIdA: string; appIdB: string; question?: string }) =>
    apiClient.post<HistoricalAnalysisResult>('/historical/compare', payload),

  history: (params: { search?: string; mode?: string; appId?: string; appName?: string }) =>
    apiClient.get<HistoricalAnalysisResult[]>(`/historical/history${buildQuery(params)}`),

  get: (id: string) => apiClient.get<HistoricalAnalysisResult>(`/historical/${id}`),

  runs: (params: { appName: string; start?: string; end?: string; limit?: number }) =>
    apiClient.get<HistoricalRunItem[]>(`/historical/runs${buildQuery(params)}`),

  update: (id: string, payload: { title?: string; tags?: string[] }) =>
    apiClient.patch<HistoricalAnalysisResult>(`/historical/${id}`, payload),
};
