
import { CloudInstance } from "../../shared/types";

// Mock database of instances. In a real application, this would fetch from an API like Vantage or AWS Pricing API.
// We are simulating the structure that such an API would return.

const BASE_INSTANCES: Omit<CloudInstance, 'region' | 'pricePerHour'>[] = [
  { id: 'm5.xlarge', name: 'm5.xlarge', displayName: 'General Purpose (m5.xlarge)', category: 'General', vCPUs: 4, memoryGB: 16 },
  { id: 'm5.2xlarge', name: 'm5.2xlarge', displayName: 'General Purpose (m5.2xlarge)', category: 'General', vCPUs: 8, memoryGB: 32 },
  { id: 'm5.4xlarge', name: 'm5.4xlarge', displayName: 'General Purpose (m5.4xlarge)', category: 'General', vCPUs: 16, memoryGB: 64 },
  { id: 'r5.xlarge', name: 'r5.xlarge', displayName: 'Memory Optimized (r5.xlarge)', category: 'Memory', vCPUs: 4, memoryGB: 32 },
  { id: 'r5.2xlarge', name: 'r5.2xlarge', displayName: 'Memory Optimized (r5.2xlarge)', category: 'Memory', vCPUs: 8, memoryGB: 64 },
  { id: 'c5.xlarge', name: 'c5.xlarge', displayName: 'Compute Optimized (c5.xlarge)', category: 'Compute', vCPUs: 4, memoryGB: 8 },
  { id: 'c5.2xlarge', name: 'c5.2xlarge', displayName: 'Compute Optimized (c5.2xlarge)', category: 'Compute', vCPUs: 8, memoryGB: 16 },
  { id: 'i3.xlarge', name: 'i3.xlarge', displayName: 'Storage Optimized (i3.xlarge)', category: 'Storage', vCPUs: 4, memoryGB: 30 },
  { id: 'g4dn.xlarge', name: 'g4dn.xlarge', displayName: 'GPU Accelerated (g4dn.xlarge)', category: 'GPU', vCPUs: 4, memoryGB: 16 },
];

const REGION_PRICE_MULTIPLIERS: Record<string, number> = {
  'us-east-1': 1.0,
  'us-west-2': 1.0,
  'eu-west-1': 1.1,
  'ap-southeast-1': 1.15,
};

const BASE_PRICES: Record<string, number> = {
  'm5.xlarge': 0.192,
  'm5.2xlarge': 0.384,
  'm5.4xlarge': 0.768,
  'r5.xlarge': 0.252,
  'r5.2xlarge': 0.504,
  'c5.xlarge': 0.17,
  'c5.2xlarge': 0.34,
  'i3.xlarge': 0.312,
  'g4dn.xlarge': 0.526,
};

export const fetchCloudInstances = async (region: string): Promise<CloudInstance[]> => {
  // Simulate API latency
  await new Promise(resolve => setTimeout(resolve, 600));

  const multiplier = REGION_PRICE_MULTIPLIERS[region] || 1.0;

  return BASE_INSTANCES.map(inst => ({
    ...inst,
    region,
    pricePerHour: Number((BASE_PRICES[inst.id] * multiplier).toFixed(3))
  }));
};
