export { default as apiClient } from './client';
import apiClient from './client';
export { authApi } from './auth';
export type { User, AuthResponse, RegisterData, LoginData } from './auth';

export { analysisApi } from './analysis';
import { analysisApi } from './analysis';
import { predictiveEngine } from '../lib/predictiveAnalytics';
import { CloudInstance } from '../../shared/types';
export { userApi } from './user';


export type {
  Analysis,
  AnalysisResult,
  AnalysisListResponse,
  CreateAnalysisData,
  DagNode,
  DagLink,
  ResourceMetric,
  Optimization
} from './analysis';

export { chatApi } from './chat';
export type {
  ChatSession,
  ChatMessage,
  CreateSessionData,
  SendMessageResponse
} from './chat';

// Facade Client for backward compatibility/ease of use in App.tsx
export const client = {
  get: <T>(url: string) => apiClient.get<T>(url),
  post: <T>(url: string, body?: any) => apiClient.post<T>(url, body),
  patch: <T>(url: string, body?: any) => apiClient.patch<T>(url, body),
  delete: <T>(url: string) => apiClient.delete<T>(url),
  updateAnalysis: apiClient.updateAnalysis.bind(apiClient),
  getRecentAnalyses: apiClient.getRecentAnalyses.bind(apiClient),
  getAnalysisHistory: apiClient.getAnalysisHistory.bind(apiClient),

  getCloudInstances: async (region: string, cloudProvider: 'aws' | 'azure' | 'gcp' = 'aws'): Promise<CloudInstance[]> => {
    try {
      const response = await apiClient.get(`/pricing/instances?region=${region}&cloud=${cloudProvider}`) as any;
      return response.instances || [];
    } catch (error) {
      console.error('Failed to fetch cloud instances:', error);
      // Fallback to basic instances if API fails
      return [
        { id: 'm5.xlarge', name: 'm5.xlarge', displayName: 'General Purpose (4 vCPU, 16 GB)', category: 'General', vCPUs: 4, memoryGB: 16, pricePerHour: 0.192, region, cloudProvider },
        { id: 'm5.2xlarge', name: 'm5.2xlarge', displayName: 'General Purpose (8 vCPU, 32 GB)', category: 'General', vCPUs: 8, memoryGB: 32, pricePerHour: 0.384, region, cloudProvider },
        { id: 'c5.4xlarge', name: 'c5.4xlarge', displayName: 'Compute Optimized (16 vCPU, 32 GB)', category: 'Compute', vCPUs: 16, memoryGB: 32, pricePerHour: 0.68, region, cloudProvider },
        { id: 'r5.2xlarge', name: 'r5.2xlarge', displayName: 'Memory Optimized (8 vCPU, 64 GB)', category: 'Memory', vCPUs: 8, memoryGB: 64, pricePerHour: 0.504, region, cloudProvider }
      ];
    }
  },

  getRegions: async (cloudProvider: 'aws' | 'azure' | 'gcp' = 'aws'): Promise<Array<{ id: string, name: string }>> => {
    try {
      const response = await apiClient.get(`/pricing/regions?cloud=${cloudProvider}`) as any;
      return response.regions || [];
    } catch (error) {
      console.error("Failed to fetch regions:", error);
      return [];
    }
  },

  fetchRepo: async (config: any, options: any) => {
    try {
      const response = await apiClient.post('/repository/scan', {
        url: config.url,
        branch: config.branch,
        token: config.token,
        fileExtensions: options.fileExtensions
      }) as any;
      return response || [];
    } catch (error) {
      console.error("Repo fetch failed:", error);
      throw error;
    }
  },

  fetchBranches: async (url: string, token?: string): Promise<string[]> => {
    try {
      // client.post already returns data.data if it exists (see client.ts:128)
      // So we should expect the array directly here.
      const response = await apiClient.post('/repository/branches', { url, token }) as any;
      return response || [];
    } catch (error) {
      console.error("Branch fetch failed:", error);
      // Return empty array on failure so UI doesn't crash
      return [];
    }
  },

  analyzeDag: async (content: string, repoFiles: any[], options: any, clusterContext: any) => {
    let analysis = await analysisApi.create({
      content,
      repoFiles: repoFiles,
      inputType: 'SPARK_PLAN',
      title: options?.title || `Analysis ${new Date().toLocaleString()}`
    });

    const MAX_RETRIES = 30; // 60 seconds max
    let retries = 0;

    while (['PENDING', 'PROCESSING'].includes(analysis.status) && retries < MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const status = await analysisApi.getStatus(analysis.id);
      if (status.status === 'COMPLETED') {
        // Fetch full analysis to get result
        analysis = await analysisApi.get(analysis.id);
        break;
      }
      if (status.status === 'FAILED') {
        throw new Error(`Analysis failed: ${status.errorMessage}`);
      }
      retries++;
    }

    if (analysis.status !== 'COMPLETED' || !analysis.result) {
      throw new Error("Analysis timed out or incomplete. Please check the 'Analysis List' for status.");
    }

    return analysis.result;
  },

  predictAtScale: (data: any, size: number) => predictiveEngine.predictAtScale(data, size)
};
