// frontend/api/feedback.ts
// Feedback API client for user ticket management

import { apiClient } from './client';

// Types
export interface FeedbackTicket {
    id: string;
    ticketId: string;
    title: string;
    status: string;
    severity: string;
    category: string;
    feature: string;
    createdAt: string;
    updatedAt: string;
    resolvedAt?: string;
    _count?: {
        events: number;
        attachments: number;
    };
}

export interface FeedbackEvent {
    id: string;
    eventType: string;
    content: string | null;
    createdAt: string;
    isInternal: boolean;
    author: {
        id: string;
        name: string;
        avatar?: string;
        role?: string;
    } | null;
}

export interface FeedbackAttachment {
    id: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    isScreenshot: boolean;
    viewUrl: string;
    uploadedAt: string;
}

export interface FeedbackDetail extends FeedbackTicket {
    description: string;
    pageUrl?: string;
    userAgent?: string;
    user: {
        id: string;
        name: string;
        email: string;
        avatar?: string;
    };
    assignedTo?: {
        id: string;
        name: string;
        avatar?: string;
    };
    attachments: FeedbackAttachment[];
    events: FeedbackEvent[];
}

export interface CreateFeedbackPayload {
    title: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    category: 'bug' | 'feature' | 'question' | 'other';
    feature?: string;
    pageUrl?: string;
    userAgent?: string;
    browserInfo?: Record<string, any>;
    appVersion?: string;
    lastAction?: string;
    screenshot?: string;
}

export interface FeedbackListResponse {
    tickets: FeedbackTicket[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

// API Functions
export const feedbackApi = {
    /**
     * Create a new feedback ticket
     */
    async createFeedback(payload: CreateFeedbackPayload): Promise<FeedbackTicket> {
        return apiClient.post('/feedback', payload);
    },

    /**
     * Get user's tickets with optional filtering
     */
    async getMyTickets(params?: {
        status?: string;
        category?: string;
        page?: number;
        limit?: number;
    }): Promise<FeedbackListResponse> {
        const queryParams = new URLSearchParams();
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    queryParams.append(key, String(value));
                }
            });
        }
        const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
        return apiClient.get(`/feedback${queryString}`);
    },

    /**
     * Get ticket detail by ticketId
     */
    async getTicketDetail(ticketId: string): Promise<FeedbackDetail> {
        return apiClient.get(`/feedback/${ticketId}`);
    },

    /**
     * Add a reply to a ticket
     */
    async addReply(ticketId: string, content: string): Promise<FeedbackEvent> {
        return apiClient.post(`/feedback/${ticketId}/reply`, { content });
    },

    /**
     * Upload an attachment to a ticket
     */
    async uploadAttachment(
        ticketId: string,
        data: string,
        fileName: string,
        isScreenshot = false
    ): Promise<FeedbackAttachment> {
        return apiClient.post(`/feedback/${ticketId}/attachments`, {
            data,
            fileName,
            isScreenshot,
        });
    },

    /**
     * Delete a feedback ticket
     */
    async deleteFeedback(ticketId: string): Promise<void> {
        return apiClient.delete(`/feedback/${ticketId}`);
    },
};
