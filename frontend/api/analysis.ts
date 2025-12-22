// src/api/analysis.ts
// Analysis API functions

import apiClient from './client';

import {
  AnalysisResult as SharedAnalysisResult,
  DagNode,
  DagLink,
  ResourceMetric,
  OptimizationTip,
  Severity
} from '../../shared/types';

export type { DagNode, DagLink, ResourceMetric };
export type Optimization = OptimizationTip;
export type AnalysisResult = SharedAnalysisResult;

export interface Analysis {
  id: string;
  title?: string;
  inputType: 'SPARK_PLAN' | 'SQL_EXPLAIN' | 'LOG_FILE';
  inputContent?: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  errorMessage?: string;
  result?: AnalysisResult;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  optimizationCount?: number;
  dagNodeCount?: number;
  processingMs?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AnalysisListResponse {
  data: Analysis[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface CreateAnalysisData {
  title?: string;
  inputType: 'SPARK_PLAN' | 'SQL_EXPLAIN' | 'LOG_FILE';
  content: string;
  repoFiles?: any[];
}

export const analysisApi = {
  create: async (data: CreateAnalysisData): Promise<Analysis> => {
    return apiClient.post<Analysis>('/analyses', data);
  },

  list: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    severity?: string;
  }): Promise<AnalysisListResponse> => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.status) searchParams.set('status', params.status);
    if (params?.severity) searchParams.set('severity', params.severity);

    const query = searchParams.toString();
    return apiClient.get<AnalysisListResponse>(`/analyses${query ? `?${query}` : ''}`);
  },

  get: async (id: string): Promise<Analysis> => {
    return apiClient.get<Analysis>(`/analyses/${id}`);
  },

  getStatus: async (id: string): Promise<Pick<Analysis, 'id' | 'status' | 'errorMessage' | 'processingMs' | 'updatedAt'>> => {
    return apiClient.get(`/analyses/${id}/status`);
  },

  retry: async (id: string): Promise<{ success: boolean; message: string; analysisId: string }> => {
    return apiClient.post(`/analyses/${id}/retry`);
  },

  delete: async (id: string): Promise<{ success: boolean; message: string }> => {
    return apiClient.delete(`/analyses/${id}`);
  },
};

export default analysisApi;
