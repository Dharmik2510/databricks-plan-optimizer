// frontend/hooks/useCloudQueries.ts
// React Query hooks for cloud instances and regions

import { useQuery } from '@tanstack/react-query';
import { client } from '../api';
import { useClusterStore } from '../store/useClusterStore';
import { useEffect } from 'react';

// Query Keys
export const cloudKeys = {
  all: ['cloud'] as const,
  instances: (region: string, provider: string) =>
    [...cloudKeys.all, 'instances', region, provider] as const,
  regions: (provider: string) => [...cloudKeys.all, 'regions', provider] as const,
};

// Fetch cloud instances for a region
export function useCloudInstances(region: string, provider: 'aws' | 'azure' | 'gcp') {
  const setAvailableInstances = useClusterStore((state) => state.setAvailableInstances);
  const setLoadingInstances = useClusterStore((state) => state.setLoadingInstances);

  const query = useQuery({
    queryKey: cloudKeys.instances(region, provider),
    queryFn: () => client.getCloudInstances(region, provider),
    staleTime: 10 * 60 * 1000, // 10 minutes - instance types don't change often
  });

  // Sync with Zustand store
  useEffect(() => {
    if (query.data) {
      setAvailableInstances(query.data);
    }
    setLoadingInstances(query.isLoading);
  }, [query.data, query.isLoading, setAvailableInstances, setLoadingInstances]);

  return query;
}

// Fetch available regions for a cloud provider
export function useCloudRegions(provider: 'aws' | 'azure' | 'gcp') {
  const setAvailableRegions = useClusterStore((state) => state.setAvailableRegions);
  const setLoadingRegions = useClusterStore((state) => state.setLoadingRegions);

  const query = useQuery({
    queryKey: cloudKeys.regions(provider),
    queryFn: () => client.getRegions(provider),
    staleTime: 10 * 60 * 1000, // 10 minutes - regions don't change often
  });

  // Sync with Zustand store
  useEffect(() => {
    if (query.data) {
      setAvailableRegions(query.data);
    }
    setLoadingRegions(query.isLoading);
  }, [query.data, query.isLoading, setAvailableRegions, setLoadingRegions]);

  return query;
}
