// frontend/store/useRepositoryStore.ts
// Repository state management with Zustand

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { RepoConfig, RepoFile } from '../../shared/types';

interface RepositoryState {
  // State
  repoConfig: RepoConfig;
  repoFiles: RepoFile[];
  isFetchingRepo: boolean;

  // Actions
  setRepoConfig: (config: RepoConfig | ((prev: RepoConfig) => RepoConfig)) => void;
  setRepoFiles: (files: RepoFile[]) => void;
  setIsFetchingRepo: (isFetching: boolean) => void;
  reset: () => void;
}

const initialState = {
  repoConfig: { url: '', branch: 'main', token: '' },
  repoFiles: [],
  isFetchingRepo: false,
};

export const useRepositoryStore = create<RepositoryState>()(
  devtools(
    (set) => ({
      ...initialState,

      setRepoConfig: (config) =>
        set((state) => ({
          repoConfig: typeof config === 'function' ? config(state.repoConfig) : config,
        })),
      setRepoFiles: (repoFiles) => set({ repoFiles }),
      setIsFetchingRepo: (isFetchingRepo) => set({ isFetchingRepo }),
      reset: () => set(initialState),
    }),
    { name: 'RepositoryStore' }
  )
);
