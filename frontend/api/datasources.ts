import { apiClient } from './index';

export interface DataSource {
  id: string;
  user_id: string;
  org_id: string | null;
  name: string;
  description: string | null;
  connection_type: 'gateway_shs' | 'external_mcp';
  shs_base_url: string | null;
  shs_auth_scheme: string | null;
  tunnel_config: any | null;
  external_mcp_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateDataSourceDto {
  name: string;
  description?: string;
  connection_type: 'gateway_shs' | 'external_mcp';
  // Gateway SHS fields
  shs_base_url?: string;
  shs_auth_scheme?: 'none' | 'bearer' | 'basic' | 'header';
  shs_auth_token?: string;
  shs_auth_header_name?: string;
  tunnel_config?: {
    ssh_host: string;
    ssh_port: number;
    ssh_user: string;
    ssh_private_key: string;
    remote_host: string;
    remote_port: number;
  };
  // External MCP fields
  external_mcp_url?: string;
  external_mcp_token?: string;
}

export interface UpdateDataSourceDto extends Partial<CreateDataSourceDto> {
  is_active?: boolean;
}

export interface TestConnectionDto extends CreateDataSourceDto {}

export interface TestConnectionResponse {
  success: boolean;
  message: string;
}

export const datasourcesApi = {
  async getAll(): Promise<DataSource[]> {
    const response = await apiClient.get('/datasources');
    return response.data;
  },

  async getById(id: string): Promise<DataSource> {
    const response = await apiClient.get(`/datasources/${id}`);
    return response.data;
  },

  async create(data: CreateDataSourceDto): Promise<DataSource> {
    const response = await apiClient.post('/datasources', data);
    return response.data;
  },

  async update(id: string, data: UpdateDataSourceDto): Promise<DataSource> {
    const response = await apiClient.put(`/datasources/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/datasources/${id}`);
  },

  async testConnection(data: TestConnectionDto): Promise<TestConnectionResponse> {
    const response = await apiClient.post('/datasources/test-connection', data);
    return response.data;
  },
};
