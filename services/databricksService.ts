
import { DatabricksConfig, StreamMetric, StreamStatus } from "../types";

// NOTE: Browser-based requests to Databricks API often fail due to CORS.
// In a real production app, these requests should go through a backend proxy.
export const validateConnection = async (config: DatabricksConfig): Promise<boolean> => {
  if (!config.host || !config.clusterId || !config.token) return false;
  
  try {
    const response = await fetch(`${config.host}/api/2.0/clusters/get?cluster_id=${config.clusterId}`, {
      headers: {
        'Authorization': `Bearer ${config.token}`
      }
    });
    
    if (response.ok) {
      return true;
    }
    throw new Error("Cluster not found or unauthorized");
  } catch (error) {
    console.warn("CORS or Network Error connecting to Databricks directly from browser.", error);
    // For the sake of the demo, if we get a network error (likely CORS), we might pretend it worked
    // if the format looks correct, or throw to force simulation.
    // Returning false here to force fallback to simulation for smooth UX in this demo environment.
    return false; 
  }
};

export const fetchRealtimeMetrics = async (config: DatabricksConfig): Promise<Partial<StreamMetric> | null> => {
  // Logic to fetch /api/v1/applications/{appId}/executors
  // This would return detailed memory, GC time, and swap usage.
  // Stubbed for demo purposes since we don't have a real proxy.
  return null;
};

export const fetchLatestExecutionPlan = async (config: DatabricksConfig): Promise<string | null> => {
  // Logic to fetch /api/v1/applications/{appId}/sql
  // And get the description of the latest query.
  return null;
};
