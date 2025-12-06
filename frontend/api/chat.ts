// src/api/chat.ts
// Chat API functions

import apiClient from './client';

export interface ChatMessage {
  id: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  tokensUsed?: number;
  createdAt: string;
}

export interface ChatSession {
  id: string;
  title?: string;
  analysisId?: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  messages?: ChatMessage[];
  analysis?: {
    id: string;
    title?: string;
    result?: any;
  };
}

export interface CreateSessionData {
  analysisId?: string;
  title?: string;
}

export interface SendMessageResponse {
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
}

export const chatApi = {
  createSession: async (data?: CreateSessionData): Promise<ChatSession> => {
    return apiClient.post<ChatSession>('/chat/sessions', data || {});
  },

  listSessions: async (): Promise<ChatSession[]> => {
    return apiClient.get<ChatSession[]>('/chat/sessions');
  },

  getSession: async (id: string): Promise<ChatSession> => {
    return apiClient.get<ChatSession>(`/chat/sessions/${id}`);
  },

  sendMessage: async (sessionId: string, content: string): Promise<SendMessageResponse> => {
    return apiClient.post<SendMessageResponse>(`/chat/sessions/${sessionId}/messages`, { content });
  },

  deleteSession: async (id: string): Promise<{ success: boolean; message: string }> => {
    return apiClient.delete(`/chat/sessions/${id}`);
  },
};

export default chatApi;
