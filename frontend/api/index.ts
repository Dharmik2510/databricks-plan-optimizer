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
  get: apiClient.get.bind(apiClient),
  post: apiClient.post.bind(apiClient),

  getCloudInstances: async (region: string): Promise<CloudInstance[]> => {
    // Mock Data - in real app, fetch from backend or static config
    return [
      { id: 'm5.xlarge', name: 'm5.xlarge', displayName: 'General Purpose (m5.xlarge)', category: 'General', vCPUs: 4, memoryGB: 16, pricePerHour: 0.192, region },
      { id: 'm5.2xlarge', name: 'm5.2xlarge', displayName: 'General Purpose (m5.2xlarge)', category: 'General', vCPUs: 8, memoryGB: 32, pricePerHour: 0.384, region },
      { id: 'c5.4xlarge', name: 'c5.4xlarge', displayName: 'Compute Optimized (c5.4xlarge)', category: 'Compute', vCPUs: 16, memoryGB: 32, pricePerHour: 0.68, region },
      { id: 'r5.2xlarge', name: 'r5.2xlarge', displayName: 'Memory Optimized (r5.2xlarge)', category: 'Memory', vCPUs: 8, memoryGB: 64, pricePerHour: 0.504, region }
    ];
  },

  fetchRepo: async (config: any, options: any) => {
    // Not implemented in backend yet, returning empty
    console.warn("Repo fetch not implemented in backend");
    return [];
  },

  analyzeDag: async (content: string, repoFiles: any[], options: any, clusterContext: any) => {
    let analysis = await analysisApi.create({
      content,
      inputType: 'SPARK_PLAN',
      title: `Analysis ${new Date().toLocaleString()}`
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
