// frontend/store/useFeedbackStore.ts
// Zustand store for feedback state management

import { create } from 'zustand';
import { apiClient } from '../api/client';

interface FeedbackContext {
    pageUrl?: string;
    userAgent?: string;
    errorMessage?: string;
    lastAction?: string;
    componentStack?: string;
}

interface FeedbackState {
    isModalOpen: boolean;
    context: FeedbackContext;
    selectedTicketId: string | null;

    // Actions
    openModal: (context?: FeedbackContext) => void;
    closeModal: () => void;
    setContext: (context: FeedbackContext) => void;
    setSelectedTicketId: (ticketId: string | null) => void;
    captureContext: () => FeedbackContext;
}

export const useFeedbackStore = create<FeedbackState>((set, get) => ({
    isModalOpen: false,
    context: {},
    selectedTicketId: null,

    openModal: (context?: FeedbackContext) => {
        const capturedContext = get().captureContext();
        set({
            isModalOpen: true,
            context: { ...capturedContext, ...context },
        });
    },

    closeModal: () => {
        set({
            isModalOpen: false,
            context: {},
        });
    },

    setContext: (context: FeedbackContext) => {
        set({ context });
    },

    setSelectedTicketId: (ticketId: string | null) => {
        set({ selectedTicketId: ticketId });
    },

    captureContext: (): FeedbackContext => {
        return {
            pageUrl: window.location.href,
            userAgent: navigator.userAgent,
            lastAction: sessionStorage.getItem('lastAction') || undefined,
        };
    },
}));

// Helper to track last action for context capture
export const trackAction = (action: string): void => {
    sessionStorage.setItem('lastAction', action);
};
