// src/api/client.ts
// Centralized API client with authentication handling and observability

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  timestamp: string;
}

interface ApiError {
  statusCode: number;
  message: string | string[];
  error: string;
}

// Generate a session ID that persists across page reloads
const getSessionId = (): string => {
  let sessionId = sessionStorage.getItem('x-session-id');
  if (!sessionId) {
    sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    sessionStorage.setItem('x-session-id', sessionId);
  }
  return sessionId;
};

// Generate a correlation ID that persists across page reloads (different from session)
const getCorrelationId = (): string => {
  let correlationId = localStorage.getItem('x-correlation-id');
  if (!correlationId) {
    correlationId = `corr_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    localStorage.setItem('x-correlation-id', correlationId);
  }
  return correlationId;
};

class ApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private refreshPromise: Promise<string | null> | null = null;
  private sessionId: string;
  private correlationId: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.accessToken = localStorage.getItem('accessToken');
    this.sessionId = getSessionId();
    this.correlationId = getCorrelationId();
  }

  setAccessToken(token: string | null) {
    this.accessToken = token;
    if (token) {
      localStorage.setItem('accessToken', token);
    } else {
      localStorage.removeItem('accessToken');
    }
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  getCorrelationId(): string {
    return this.correlationId;
  }

  private async refreshAccessToken(): Promise<string | null> {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        throw new Error('Refresh failed');
      }

      const data = await response.json();
      const newAccessToken = data.data?.accessToken || data.accessToken;
      const newRefreshToken = data.data?.refreshToken || data.refreshToken;

      if (newAccessToken) {
        this.setAccessToken(newAccessToken);
        if (newRefreshToken) {
          localStorage.setItem('refreshToken', newRefreshToken);
        }
        return newAccessToken;
      }
      return null;
    } catch (error) {
      // Clear tokens on refresh failure
      this.setAccessToken(null);
      localStorage.removeItem('refreshToken');
      return null;
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    // Build headers with observability context
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'X-Session-ID': this.sessionId,
      'X-Correlation-ID': this.correlationId,
      ...options.headers,
    };

    if (this.accessToken) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.accessToken}`;
    }

    let response = await fetch(url, { ...options, headers });

    // Handle 401 - try to refresh token
    if (response.status === 401 && this.accessToken) {
      // Prevent multiple simultaneous refresh requests
      if (!this.refreshPromise) {
        this.refreshPromise = this.refreshAccessToken();
      }

      const newToken = await this.refreshPromise;
      this.refreshPromise = null;

      if (newToken) {
        // Retry with new token
        (headers as Record<string, string>)['Authorization'] = `Bearer ${newToken}`;
        response = await fetch(url, { ...options, headers });
      } else {
        // Redirect to login
        window.dispatchEvent(new CustomEvent('auth:logout'));
        throw new Error('Session expired. Please log in again.');
      }
    }

    const data = await response.json();

    if (!response.ok) {
      const error = data as ApiError;
      const message = Array.isArray(error.message)
        ? error.message[0]
        : error.message || 'An error occurred';
      throw new Error(message);
    }

    // Handle wrapped response - only unwrap if it matches ApiResponse structure
    if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
      return (data as ApiResponse<T>).data;
    }
    return data;
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  // Analysis Endpoints
  async getRecentAnalyses() {
    return this.get<any[]>('/analyses/recent');
  }

  async getAnalysisHistory(params?: any) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.keys(params).forEach(key => {
        const value = params[key];
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, String(value));
        }
      });
    }
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return this.get<any>(`/analyses${queryString}`);
  }

  async updateAnalysis(id: string, data: { title?: string }) {
    return this.patch<any>(`/analyses/${id}`, data);
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
export default apiClient;

