// frontend/store/useUIStore.ts
// UI state management with Zustand - handles tabs, modals, and UI preferences

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { ActiveTab } from '../../shared/types';

interface UIState {
  // Tab and Navigation
  activeTab: ActiveTab;

  // Modal States
  showUserGuide: boolean;
  showComingSoon: boolean;
  comingSoonFeature: string;
  showCommandPalette: boolean;
  showShortcutsHelp: boolean;
  showAuth: boolean;

  // DAG Visualization
  dagExpanded: boolean;
  selectedNodeId: string | null;

  // Actions
  setActiveTab: (tab: ActiveTab) => void;
  setShowUserGuide: (show: boolean) => void;
  setShowComingSoon: (show: boolean, feature?: string) => void;
  setShowCommandPalette: (show: boolean) => void;
  setShowShortcutsHelp: (show: boolean) => void;
  setShowAuth: (show: boolean) => void;
  setDagExpanded: (expanded: boolean) => void;
  setSelectedNodeId: (nodeId: string | null) => void;
  closeAllModals: () => void;
}

export const useUIStore = create<UIState>()(
  devtools(
    (set) => ({
      // Initial State
      activeTab: ActiveTab.HOME,
      showUserGuide: false,
      showComingSoon: false,
      comingSoonFeature: '',
      showCommandPalette: false,
      showShortcutsHelp: false,
      showAuth: false,
      dagExpanded: false,
      selectedNodeId: null,

      // Actions
      setActiveTab: (activeTab) => set({ activeTab }),
      setShowUserGuide: (showUserGuide) => set({ showUserGuide }),
      setShowComingSoon: (showComingSoon, comingSoonFeature = '') =>
        set({ showComingSoon, comingSoonFeature }),
      setShowCommandPalette: (showCommandPalette) => set({ showCommandPalette }),
      setShowShortcutsHelp: (showShortcutsHelp) => set({ showShortcutsHelp }),
      setShowAuth: (showAuth) => set({ showAuth }),
      setDagExpanded: (dagExpanded) => set({ dagExpanded }),
      setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId }),
      closeAllModals: () =>
        set({
          showUserGuide: false,
          showComingSoon: false,
          showCommandPalette: false,
          showShortcutsHelp: false,
        }),
    }),
    { name: 'UIStore' }
  )
);
