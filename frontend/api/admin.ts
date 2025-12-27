import apiClient from './client';

// ═══════════════════════════════════════════════════════════════
// ANALYTICS & METRICS
// ═══════════════════════════════════════════════════════════════

export const getAnalyticsOverview = async () => {
  const response = await apiClient.get('/admin/analytics/overview');
  return response;
};

export const getUserGrowth = async (days: number = 30) => {
  const response = await apiClient.get(`/admin/analytics/user-growth?days=${days}`);
  return response;
};

export const getUsageStats = async (days: number = 30) => {
  const response = await apiClient.get(`/admin/analytics/usage-stats?days=${days}`);
  return response;
};

export const getPopularFeatures = async () => {
  const response = await apiClient.get('/admin/analytics/popular-features');
  return response;
};

export const getSystemHealth = async () => {
  const response = await apiClient.get('/admin/analytics/system-health');
  return response;
};

// ═══════════════════════════════════════════════════════════════
// USER MANAGEMENT
// ═══════════════════════════════════════════════════════════════

export const getAllUsers = async (params: {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  isActive?: boolean;
}) => {
  const queryParams = new URLSearchParams();
  if (params.page) queryParams.append('page', params.page.toString());
  if (params.limit) queryParams.append('limit', params.limit.toString());
  if (params.search) queryParams.append('search', params.search);
  if (params.role) queryParams.append('role', params.role);
  if (params.isActive !== undefined) queryParams.append('isActive', params.isActive.toString());

  const response = await apiClient.get(`/admin/users?${queryParams.toString()}`);
  return response;
};

export const getUserDetails = async (userId: string) => {
  const response = await apiClient.get(`/admin/users/${userId}`);
  return response;
};

export const updateUser = async (userId: string, data: {
  role?: string;
  isActive?: boolean;
  quotaLimit?: number;
}) => {
  const response = await apiClient.patch(`/admin/users/${userId}`, data);
  return response;
};

export const suspendUser = async (userId: string) => {
  const response = await apiClient.patch(`/admin/users/${userId}/suspend`);
  return response;
};

export const activateUser = async (userId: string) => {
  const response = await apiClient.patch(`/admin/users/${userId}/activate`);
  return response;
};

export const getUserActivity = async (userId: string, days: number = 30) => {
  const response = await apiClient.get(`/admin/users/${userId}/activity?days=${days}`);
  return response;
};

// ═══════════════════════════════════════════════════════════════
// ANALYSIS MANAGEMENT
// ═══════════════════════════════════════════════════════════════

export const getRecentAnalyses = async (limit: number = 50) => {
  const response = await apiClient.get(`/admin/analyses/recent?limit=${limit}`);
  return response;
};

export const getFailedAnalyses = async (limit: number = 50) => {
  const response = await apiClient.get(`/admin/analyses/failed?limit=${limit}`);
  return response;
};
