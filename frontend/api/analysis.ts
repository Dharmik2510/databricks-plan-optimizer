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

export interface QuickValidationResult {
  likely_valid: boolean;
  hints: string[];
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

  uploadEventLog: async (id: string, file: File): Promise<{ success: boolean; message: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    // apiClient likely handles Content-Type for FormData automatically or we set it
    // If apiClient is axios/fetch wrapper, FormData usually triggers multipart
    return apiClient.post(`/analyses/${id}/event-log`, formData, {
      headers: {
        // 'Content-Type': 'multipart/form-data' // Often better to let browser set boundary
      }
    });
  },

  useDemoEventLog: async (id: string): Promise<{ success: boolean; message: string }> => {
    return apiClient.post(`/analyses/${id}/event-log/demo`);
  },

  /**
   * Validate a physical plan using AI
   */
  validatePlan: async (planText: string): Promise<ValidationResult> => {
    return apiClient.post<ValidationResult>('/analyses/validate', { planText });
  },

  /**
   * Quick heuristic validation (no AI, instant response)
   */
  quickValidate: async (planText: string): Promise<QuickValidationResult> => {
    return apiClient.post<QuickValidationResult>('/analyses/validate/quick', { planText });
  },
};

export default analysisApi;

