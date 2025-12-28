// frontend/store/useClusterStore.ts
// Cluster context and cloud instance state management with Zustand

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { ClusterContext, CloudInstance } from '../../shared/types';

interface ClusterState {
  // State
  clusterContext: ClusterContext;
  availableInstances: CloudInstance[];
  loadingInstances: boolean;
  cloudProvider: 'aws' | 'azure' | 'gcp';
  availableRegions: Array<{ id: string; name: string }>;
  loadingRegions: boolean;

  // Actions
  setClusterContext: (context: ClusterContext | ((prev: ClusterContext) => ClusterContext)) => void;
  setAvailableInstances: (instances: CloudInstance[]) => void;
  setLoadingInstances: (loading: boolean) => void;
  setCloudProvider: (provider: 'aws' | 'azure' | 'gcp') => void;
  setAvailableRegions: (regions: Array<{ id: string; name: string }>) => void;
  setLoadingRegions: (loading: boolean) => void;
}

const initialState = {
  clusterContext: {
    clusterType: 'm5.xlarge',
    dbrVersion: '13.3 LTS',
    sparkConf: '',
    region: 'us-east-1',
  },
  availableInstances: [],
  loadingInstances: false,
  cloudProvider: 'aws' as const,
  availableRegions: [],
  loadingRegions: false,
};

export const useClusterStore = create<ClusterState>()(
  devtools(
    (set) => ({
      ...initialState,

      setClusterContext: (context) =>
        set((state) => ({
          clusterContext:
            typeof context === 'function' ? context(state.clusterContext) : context,
        })),
      setAvailableInstances: (availableInstances) => set({ availableInstances }),
      setLoadingInstances: (loadingInstances) => set({ loadingInstances }),
      setCloudProvider: (cloudProvider) => set({ cloudProvider }),
      setAvailableRegions: (availableRegions) => set({ availableRegions }),
      setLoadingRegions: (loadingRegions) => set({ loadingRegions }),
    }),
    { name: 'ClusterStore' }
  )
);
