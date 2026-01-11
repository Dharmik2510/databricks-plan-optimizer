import apiClient from './client';

export interface OrgConnection {
  id: string;
  orgId: string;
  createdAt: string;
  createdBy: string;
  type: 'mcp_shs';
  mcpServerUrl: string;
  shsBaseUrl?: string | null;
  authScheme: 'none' | 'bearer' | 'basic' | 'header';
  authHeaderName?: string | null;
  isActive: boolean;
  lastValidatedAt?: string | null;
  validationError?: string | null;
}

export const orgConnectionsApi = {
  list: () => apiClient.get<OrgConnection[]>('/org/connections'),
  create: (payload: {
    mcpServerUrl: string;
    shsBaseUrl?: string;
    authScheme?: 'none' | 'bearer' | 'basic' | 'header';
    authToken?: string;
    authHeaderName?: string;
  }) => apiClient.post<OrgConnection>('/org/connections', payload),
  update: (id: string, payload: {
    mcpServerUrl?: string;
    shsBaseUrl?: string;
    authScheme?: 'none' | 'bearer' | 'basic' | 'header';
    authToken?: string;
    authHeaderName?: string;
    isActive?: boolean;
  }) => apiClient.patch<OrgConnection>(`/org/connections/${id}`, payload),
  validate: (connectionId: string) => apiClient.post<OrgConnection>('/org/connections/validate', { connectionId }),
};
