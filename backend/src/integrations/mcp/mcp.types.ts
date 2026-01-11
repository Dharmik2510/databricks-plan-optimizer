export interface McpConnectionConfig {
  id: string;
  mcpServerUrl: string;
  authScheme: 'none' | 'bearer' | 'basic' | 'header';
  authToken?: string | null;
  authHeaderName?: string | null;
}
