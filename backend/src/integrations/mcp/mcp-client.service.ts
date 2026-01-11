import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Ajv from 'ajv';
import { AppLoggerService } from '../../common/logging/app-logger.service';
import { UrlSafetyService } from '../../common/security/url-safety.service';
import { McpHttpClient, McpToolDefinition } from './mcp-http-client';
import { McpConnectionConfig } from './mcp.types';
import { mcpCallLatencyMs, mcpErrorsTotal } from './mcp.metrics';

interface ClientBundle {
  client: McpHttpClient;
  tools: Map<string, McpToolDefinition>;
}

interface CircuitState {
  failures: number;
  openedAt?: number;
}

@Injectable()
export class McpClientService implements OnModuleInit {
  private readonly ajv = new Ajv({ allErrors: true, strict: false });
  private readonly clients = new Map<string, ClientBundle>();
  private readonly circuitState = new Map<string, CircuitState>();

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: AppLoggerService,
    private readonly urlSafety: UrlSafetyService,
  ) {}

  async onModuleInit(): Promise<void> {
    const url = this.configService.get<string>('MCP_SERVER_URL');
    if (!url) {
      throw new Error('MCP_SERVER_URL is required for MCP client startup validation');
    }

    await this.urlSafety.assertSafeUrl(url);

    const client = new McpHttpClient({
      url: this.normalizeMcpUrl(url),
      headers: this.buildAuthHeaders({
        id: 'default',
        mcpServerUrl: url,
        authScheme: this.configService.get<'none' | 'bearer' | 'basic' | 'header'>('MCP_AUTH_SCHEME', 'bearer'),
        authToken: this.configService.get<string>('MCP_AUTH_TOKEN') || undefined,
        authHeaderName: this.configService.get<string>('MCP_AUTH_HEADER') || undefined,
      }),
      timeoutMs: this.getTimeoutMs(),
      protocolVersion: this.configService.get<string>('MCP_PROTOCOL_VERSION', '2024-11-05'),
    });

    try {
      await client.initialize();
      const tools = await client.listTools();
      this.clients.set('default', {
        client,
        tools: this.buildToolMap(tools),
      });
      this.logger.log(`MCP client initialized with ${tools.length} tools`);
    } catch (error) {
      this.logger.error('Failed to initialize MCP client', error as Error);
      throw error;
    }
  }

  async callTool<T>(connection: McpConnectionConfig, toolName: string, args: Record<string, any>): Promise<T> {
    const bundle = await this.getClientBundle(connection);
    const tool = bundle.tools.get(toolName);

    if (!tool) {
      throw new Error(`MCP tool not found: ${toolName}`);
    }

    this.validateToolArgs(tool, args);

    const circuitKey = connection.id || connection.mcpServerUrl;
    this.assertCircuitClosed(circuitKey);

    const start = Date.now();

    try {
      const result = await this.withRetries(async () => {
        return bundle.client.callTool(toolName, args);
      });

      const latency = Date.now() - start;
      mcpCallLatencyMs.observe({ tool: toolName, status: 'ok' }, latency);
      this.resetCircuit(circuitKey);

      return this.extractToolResult(result) as T;
    } catch (error) {
      const latency = Date.now() - start;
      mcpCallLatencyMs.observe({ tool: toolName, status: 'error' }, latency);
      mcpErrorsTotal.inc({ tool: toolName, code: (error as any)?.code?.toString() || 'unknown' });
      this.recordCircuitFailure(circuitKey);
      throw error;
    }
  }

  private async getClientBundle(connection: McpConnectionConfig): Promise<ClientBundle> {
    const key = connection.id || connection.mcpServerUrl;
    const existing = this.clients.get(key);
    if (existing) {
      return existing;
    }

    await this.urlSafety.assertSafeUrl(connection.mcpServerUrl);

    const client = new McpHttpClient({
      url: this.normalizeMcpUrl(connection.mcpServerUrl),
      headers: this.buildAuthHeaders(connection),
      timeoutMs: this.getTimeoutMs(),
      protocolVersion: this.configService.get<string>('MCP_PROTOCOL_VERSION', '2024-11-05'),
    });

    await client.initialize();
    const tools = await client.listTools();
    const bundle = {
      client,
      tools: this.buildToolMap(tools),
    };
    this.clients.set(key, bundle);
    return bundle;
  }

  private buildToolMap(tools: McpToolDefinition[]): Map<string, McpToolDefinition> {
    const map = new Map<string, McpToolDefinition>();
    for (const tool of tools) {
      map.set(tool.name, tool);
    }
    return map;
  }

  private validateToolArgs(tool: McpToolDefinition, args: Record<string, any>): void {
    if (!tool.inputSchema) {
      return;
    }

    const validate = this.ajv.compile(tool.inputSchema);
    const valid = validate(args);
    if (!valid) {
      const errors = validate.errors?.map(err => `${err.instancePath || 'arg'} ${err.message}`) || [];
      throw new Error(`Invalid MCP tool arguments for ${tool.name}: ${errors.join(', ')}`);
    }
  }

  private buildAuthHeaders(connection: McpConnectionConfig): Record<string, string> {
    if (!connection.authToken || connection.authScheme === 'none') {
      return {};
    }

    if (connection.authScheme === 'basic') {
      const encoded = Buffer.from(connection.authToken).toString('base64');
      return { Authorization: `Basic ${encoded}` };
    }

    if (connection.authScheme === 'header') {
      const headerName = connection.authHeaderName || 'X-MCP-Auth';
      return { [headerName]: connection.authToken } as Record<string, string>;
    }

    return { Authorization: `Bearer ${connection.authToken}` };
  }

  private normalizeMcpUrl(rawUrl: string): string {
    const trimmed = rawUrl.replace(/\/+$/, '');
    return trimmed.endsWith('/mcp') ? `${trimmed}/` : `${trimmed}/mcp/`;
  }

  private getTimeoutMs(): number {
    return this.configService.get<number>('MCP_TIMEOUT_MS', 15000);
  }

  private async withRetries<T>(fn: () => Promise<T>): Promise<T> {
    const attempts = this.configService.get<number>('MCP_RETRY_ATTEMPTS', 2);
    const baseDelay = this.configService.get<number>('MCP_RETRY_BASE_MS', 250);

    let lastError: any;

    for (let attempt = 0; attempt <= attempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt >= attempts) break;
        await new Promise(resolve => setTimeout(resolve, baseDelay * Math.pow(2, attempt)));
      }
    }

    throw lastError;
  }

  private extractToolResult(result: any): any {
    if (!result) return result;

    if (Array.isArray(result.content) && result.content.length > 0) {
      const jsonItem = result.content.find((item: any) => item.type === 'json');
      if (jsonItem && jsonItem.json !== undefined) {
        return jsonItem.json;
      }

      const textItem = result.content.find((item: any) => item.type === 'text');
      if (textItem && typeof textItem.text === 'string') {
        try {
          return JSON.parse(textItem.text);
        } catch {
          return textItem.text;
        }
      }
    }

    return result;
  }

  private assertCircuitClosed(key: string): void {
    const state = this.circuitState.get(key);
    if (!state || !state.openedAt) {
      return;
    }

    const cooldownMs = this.configService.get<number>('MCP_CIRCUIT_BREAKER_TIMEOUT_MS', 30000);
    if (Date.now() - state.openedAt < cooldownMs) {
      throw new Error('MCP circuit breaker is open; please retry shortly');
    }

    this.circuitState.set(key, { failures: 0 });
  }

  private recordCircuitFailure(key: string): void {
    const state = this.circuitState.get(key) || { failures: 0 };
    state.failures += 1;

    const threshold = this.configService.get<number>('MCP_CIRCUIT_BREAKER_THRESHOLD', 5);
    if (state.failures >= threshold) {
      state.openedAt = Date.now();
      this.logger.warn('MCP circuit breaker opened', { key });
    }

    this.circuitState.set(key, state);
  }

  private resetCircuit(key: string): void {
    this.circuitState.set(key, { failures: 0 });
  }
}
