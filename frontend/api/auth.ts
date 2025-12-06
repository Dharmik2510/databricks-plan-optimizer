// src/api/auth.ts
// Authentication API functions

import apiClient from './client';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  settings?: Record<string, any>;
  analysisCount?: number;
  createdAt?: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export const authApi = {
  register: async (data: RegisterData): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/register', data);
    
    // Store tokens
    apiClient.setAccessToken(response.accessToken);
    localStorage.setItem('refreshToken', response.refreshToken);
    
    return response;
  },

  login: async (data: LoginData): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/login', data);
    
    // Store tokens
    apiClient.setAccessToken(response.accessToken);
    localStorage.setItem('refreshToken', response.refreshToken);
    
    return response;
  },

  logout: async (): Promise<void> => {
    const refreshToken = localStorage.getItem('refreshToken');
    
    try {
      if (refreshToken) {
        await apiClient.post('/auth/logout', { refreshToken });
      }
    } finally {
      // Clear tokens regardless of API response
      apiClient.setAccessToken(null);
      localStorage.removeItem('refreshToken');
    }
  },

  logoutAll: async (): Promise<void> => {
    await apiClient.post('/auth/logout-all');
    apiClient.setAccessToken(null);
    localStorage.removeItem('refreshToken');
  },

  getCurrentUser: async (): Promise<{ user: User }> => {
    return apiClient.get<{ user: User }>('/auth/me');
  },

  getActiveSessions: async () => {
    return apiClient.get('/auth/sessions');
  },
};

export default authApi;
