
import { analyzeDagContentEnhanced, sendChatMessage } from './services/llm';
import { predictiveEngine } from './services/analytics';
import { fetchRepoContentsEnhanced } from './services/github';
import { fetchCloudInstances } from './services/cloudPricing';

// This API object serves as the interface between Frontend and Backend.
// Currently it imports services directly, but this file is the perfect place
// to switch to HTTP fetch calls if we move the backend to a separate server.

export const API = {
  // LLM Services
  analyzeDag: analyzeDagContentEnhanced,
  chat: sendChatMessage,
  
  // Analytics Services
  predictAtScale: predictiveEngine.predictAtScale.bind(predictiveEngine),
  generateClusterRec: predictiveEngine.generateClusterRecommendation.bind(predictiveEngine),
  generateSparkConfigs: predictiveEngine.generateSparkConfigs.bind(predictiveEngine),
  
  // Git Services
  fetchRepo: fetchRepoContentsEnhanced,
  
  // Cloud Pricing Services
  getCloudInstances: fetchCloudInstances,
  
  // Future: Add auth, logging, etc. here
};
