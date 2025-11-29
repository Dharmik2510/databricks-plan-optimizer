
import { DatabricksConfig, StreamMetric, StreamStatus } from "../../shared/types";

export const validateConnection = async (config: DatabricksConfig): Promise<boolean> => {
  if (!config.host || !config.clusterId || !config.token) return false;
  try {
    const response = await fetch(`${config.host}/api/2.0/clusters/get?cluster_id=${config.clusterId}`, {
      headers: { 'Authorization': `Bearer ${config.token}` }
    });
    if (response.ok) return true;
    throw new Error("Cluster not found or unauthorized");
  } catch (error) {
    console.warn("CORS or Network Error connecting to Databricks directly from browser.", error);
    return false; 
  }
};

export const fetchRealtimeMetrics = async (config: DatabricksConfig): Promise<Partial<StreamMetric> | null> => {
  return null;
};

export const fetchLatestExecutionPlan = async (config: DatabricksConfig): Promise<string | null> => {
  return null;
};
