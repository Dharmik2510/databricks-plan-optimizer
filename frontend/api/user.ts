
import apiClient from './client';
import { User } from './auth';

export interface UpdateUserDto {
    name?: string;
    email?: string;
    avatar?: string;
    settings?: Record<string, any>;
}

export interface UserStats {
    analysisCount: number;
    chatSessionCount: number;
    totalMessages: number;
    recentAnalyses?: any[];
}

export const userApi = {
    getProfile: async (): Promise<User> => {
        return apiClient.get<User>('/users/me');
    },

    updateProfile: async (data: UpdateUserDto): Promise<User> => {
        return apiClient.patch<User>('/users/me', data);
    },

    getStats: async (): Promise<UserStats> => {
        return apiClient.get<UserStats>('/users/me/stats');
    },

    deleteAccount: async (): Promise<void> => {
        return apiClient.delete('/users/me');
    }
};
