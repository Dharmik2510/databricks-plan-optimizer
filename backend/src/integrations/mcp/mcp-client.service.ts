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
    const startTime = Date.now();
    const url = this.configService.get<string>('MCP_SERVER_URL');

    this.logger.log('🔌 Initializing MCP client service', {
      url: url ? this.maskSensitiveUrl(url) : undefined,
      protocolVersion: this.configService.get<string>('MCP_PROTOCOL_VERSION', '2024-11-05'),
      timeout: this.getTimeoutMs(),
    });

    if (!url) {
      const error = new Error('MCP_SERVER_URL is required for MCP client startup validation');
      this.logger.error('❌ MCP client initialization failed: missing MCP_SERVER_URL', error);
      throw error;
    }

    try {
      await this.urlSafety.assertSafeUrl(url);
      this.logger.log('✅ MCP server URL safety validated', { url: this.maskSensitiveUrl(url) });
    } catch (error) {
      this.logger.error('❌ MCP server URL safety validation failed', error as Error, {
        url: this.maskSensitiveUrl(url),
      });
      throw error;
    }

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
      const initStartTime = Date.now();
      this.logger.log('🔄 Initializing MCP client connection', {
        connectionId: 'default',
        url: this.maskSensitiveUrl(url),
      });

      await client.initialize();
      const initLatency = Date.now() - initStartTime;
      this.logger.log('✅ MCP client connection initialized', {
        connectionId: 'default',
        latencyMs: initLatency,
      });

      const toolsStartTime = Date.now();
      const tools = await client.listTools();
      const toolsLatency = Date.now() - toolsStartTime;

      this.clients.set('default', {
        client,
        tools: this.buildToolMap(tools),
      });

      const totalLatency = Date.now() - startTime;
      this.logger.log(`✅ MCP client initialized successfully with ${tools.length} tools`, {
        connectionId: 'default',
        toolCount: tools.length,
        toolNames: tools.map(t => t.name),
        initLatencyMs: initLatency,
        toolsListLatencyMs: toolsLatency,
        totalLatencyMs: totalLatency,
      });
    } catch (error) {
      const latency = Date.now() - startTime;
      this.logger.error('❌ Failed to initialize MCP client', error as Error, {
        connectionId: 'default',
        url: this.maskSensitiveUrl(url),
        latencyMs: latency,
      });
      throw error;
    }
  }

  async callTool<T>(connection: McpConnectionConfig, toolName: string, args: Record<string, any>): Promise<T> {
    const circuitKey = connection.id || connection.mcpServerUrl;
    const startTime = Date.now();

    this.logger.log(`🔧 Calling MCP tool: ${toolName}`, {
      connectionId: connection.id,
      toolName,
      argsKeys: Object.keys(args),
      circuitKey,
    });

    try {
      const bundle = await this.getClientBundle(connection);
      const tool = bundle.tools.get(toolName);

      if (!tool) {
        const error = new Error(`MCP tool not found: ${toolName}`);
        this.logger.error(`❌ MCP tool not found: ${toolName}`, error, {
          connectionId: connection.id,
          toolName,
          availableTools: Array.from(bundle.tools.keys()),
        });
        throw error;
      }

      this.logger.log(`✅ MCP tool found: ${toolName}`, {
        connectionId: connection.id,
        toolName,
        hasInputSchema: !!tool.inputSchema,
      });

      this.validateToolArgs(tool, args);

      this.assertCircuitClosed(circuitKey);

      const callStartTime = Date.now();

      try {
        const result = await this.withRetries(async () => {
          return bundle.client.callTool(toolName, args);
        }, toolName, circuitKey);

        const callLatency = Date.now() - callStartTime;
        const totalLatency = Date.now() - startTime;

        mcpCallLatencyMs.observe({ tool: toolName, status: 'ok' }, callLatency);
        this.resetCircuit(circuitKey);

        const extractedResult = this.extractToolResult(result);

        this.logger.log(`✅ MCP tool call succeeded: ${toolName}`, {
          connectionId: connection.id,
          toolName,
          circuitKey,
          callLatencyMs: callLatency,
          totalLatencyMs: totalLatency,
          resultType: typeof extractedResult,
          resultIsArray: Array.isArray(extractedResult),
        });

        return extractedResult as T;
      } catch (error) {
        const callLatency = Date.now() - callStartTime;
        const totalLatency = Date.now() - startTime;

        mcpCallLatencyMs.observe({ tool: toolName, status: 'error' }, callLatency);
        mcpErrorsTotal.inc({ tool: toolName, code: (error as any)?.code?.toString() || 'unknown' });
        this.recordCircuitFailure(circuitKey);

        this.logger.error(`❌ MCP tool call failed: ${toolName}`, error as Error, {
          connectionId: connection.id,
          toolName,
          circuitKey,
          errorCode: (error as any)?.code,
          callLatencyMs: callLatency,
          totalLatencyMs: totalLatency,
        });

        throw error;
      }
    } catch (error) {
      const totalLatency = Date.now() - startTime;

      // Log only if not already logged above
      if (!(error instanceof Error && error.message.includes('circuit breaker'))) {
        this.logger.error(`❌ MCP tool execution failed: ${toolName}`, error as Error, {
          connectionId: connection.id,
          toolName,
          totalLatencyMs: totalLatency,
        });
      }

      throw error;
    }
  }

  private async getClientBundle(connection: McpConnectionConfig): Promise<ClientBundle> {
    const key = connection.id || connection.mcpServerUrl;
    const startTime = Date.now();

    this.logger.log('🔍 Getting MCP client bundle', {
      connectionId: connection.id,
      key,
      cached: this.clients.has(key),
    });

    const existing = this.clients.get(key);
    if (existing) {
      const latency = Date.now() - startTime;
      this.logger.log('✅ MCP client bundle found in cache', {
        connectionId: connection.id,
        key,
        toolCount: existing.tools.size,
        latencyMs: latency,
      });
      return existing;
    }

    this.logger.log('🔄 Creating new MCP client bundle', {
      connectionId: connection.id,
      key,
      url: this.maskSensitiveUrl(connection.mcpServerUrl),
    });

    try {
      await this.urlSafety.assertSafeUrl(connection.mcpServerUrl);
      this.logger.log('✅ MCP connection URL safety validated', {
        connectionId: connection.id,
        url: this.maskSensitiveUrl(connection.mcpServerUrl),
      });
    } catch (error) {
      this.logger.error('❌ MCP connection URL safety validation failed', error as Error, {
        connectionId: connection.id,
        url: this.maskSensitiveUrl(connection.mcpServerUrl),
      });
      throw error;
    }

    try {
      const client = new McpHttpClient({
        url: this.normalizeMcpUrl(connection.mcpServerUrl),
        headers: this.buildAuthHeaders(connection),
        timeoutMs: this.getTimeoutMs(),
        protocolVersion: this.configService.get<string>('MCP_PROTOCOL_VERSION', '2024-11-05'),
      });

      const initStartTime = Date.now();
      this.logger.log('🔄 Initializing MCP client connection', {
        connectionId: connection.id,
        key,
        url: this.maskSensitiveUrl(connection.mcpServerUrl),
      });

      await client.initialize();
      const initLatency = Date.now() - initStartTime;
      this.logger.log('✅ MCP client connection initialized', {
        connectionId: connection.id,
        key,
        latencyMs: initLatency,
      });

      const toolsStartTime = Date.now();
      const tools = await client.listTools();
      const toolsLatency = Date.now() - toolsStartTime;

      const bundle = {
        client,
        tools: this.buildToolMap(tools),
      };

      this.clients.set(key, bundle);

      const totalLatency = Date.now() - startTime;
      this.logger.log('✅ MCP client bundle created and cached', {
        connectionId: connection.id,
        key,
        toolCount: tools.length,
        toolNames: tools.map(t => t.name),
        initLatencyMs: initLatency,
        toolsListLatencyMs: toolsLatency,
        totalLatencyMs: totalLatency,
      });

      return bundle;
    } catch (error) {
      const latency = Date.now() - startTime;
      this.logger.error('❌ Failed to create MCP client bundle', error as Error, {
        connectionId: connection.id,
        key,
        url: this.maskSensitiveUrl(connection.mcpServerUrl),
        latencyMs: latency,
      });
      throw error;
    }
  }

  private buildToolMap(tools: McpToolDefinition[]): Map<string, McpToolDefinition> {
    this.logger.log('🔨 Building MCP tool map', { toolCount: tools.length });

    try {
      const map = new Map<string, McpToolDefinition>();
      for (const tool of tools) {
        map.set(tool.name, tool);
      }

      this.logger.log('✅ MCP tool map built', {
        toolCount: map.size,
        toolNames: Array.from(map.keys()),
      });

      return map;
    } catch (error) {
      this.logger.error('❌ Failed to build MCP tool map', error as Error, {
        toolCount: tools.length,
      });
      throw error;
    }
  }

  private validateToolArgs(tool: McpToolDefinition, args: Record<string, any>): void {
    this.logger.log(`🔍 Validating MCP tool arguments: ${tool.name}`, {
      toolName: tool.name,
      argsKeys: Object.keys(args),
      hasInputSchema: !!tool.inputSchema,
    });

    if (!tool.inputSchema) {
      this.logger.log(`✅ No input schema defined for tool: ${tool.name}, skipping validation`, {
        toolName: tool.name,
      });
      return;
    }

    try {
      const validate = this.ajv.compile(tool.inputSchema);
      const valid = validate(args);

      if (!valid) {
        const errors = validate.errors?.map(err => `${err.instancePath || 'arg'} ${err.message}`) || [];
        const errorMessage = `Invalid MCP tool arguments for ${tool.name}: ${errors.join(', ')}`;
        const error = new Error(errorMessage);

        this.logger.error(`❌ MCP tool argument validation failed: ${tool.name}`, error, {
          toolName: tool.name,
          validationErrors: validate.errors,
          errorMessages: errors,
          args: args,
          schema: tool.inputSchema,
        });

        throw error;
      }

      this.logger.log(`✅ MCP tool arguments validated: ${tool.name}`, {
        toolName: tool.name,
        argsKeys: Object.keys(args),
      });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Invalid MCP tool arguments')) {
        throw error;
      }

      this.logger.error(`❌ MCP tool argument validation error: ${tool.name}`, error as Error, {
        toolName: tool.name,
        args: args,
        schema: tool.inputSchema,
      });
      throw error;
    }
  }

  private buildAuthHeaders(connection: McpConnectionConfig): Record<string, string> {
    this.logger.log('🔐 Building MCP authentication headers', {
      connectionId: connection.id,
      authScheme: connection.authScheme,
      hasAuthToken: !!connection.authToken,
      authHeaderName: connection.authHeaderName,
    });

    try {
      if (!connection.authToken || connection.authScheme === 'none') {
        this.logger.log('✅ No authentication configured', {
          connectionId: connection.id,
          authScheme: connection.authScheme,
        });
        return {};
      }

      if (connection.authScheme === 'basic') {
        const encoded = Buffer.from(connection.authToken).toString('base64');
        this.logger.log('✅ Basic authentication headers built', {
          connectionId: connection.id,
          authScheme: connection.authScheme,
        });
        return { Authorization: `Basic ${encoded}` };
      }

      if (connection.authScheme === 'header') {
        const headerName = connection.authHeaderName || 'X-MCP-Auth';
        this.logger.log('✅ Custom header authentication headers built', {
          connectionId: connection.id,
          authScheme: connection.authScheme,
          headerName,
        });
        return { [headerName]: connection.authToken } as Record<string, string>;
      }

      this.logger.log('✅ Bearer authentication headers built', {
        connectionId: connection.id,
        authScheme: connection.authScheme,
      });
      return { Authorization: `Bearer ${connection.authToken}` };
    } catch (error) {
      this.logger.error('❌ Failed to build authentication headers', error as Error, {
        connectionId: connection.id,
        authScheme: connection.authScheme,
      });
      throw error;
    }
  }

  private normalizeMcpUrl(rawUrl: string): string {
    this.logger.log('🔗 Normalizing MCP URL', {
      rawUrl: this.maskSensitiveUrl(rawUrl),
    });

    try {
      const trimmed = rawUrl.replace(/\/+$/, '');
      const normalized = trimmed.endsWith('/mcp') ? `${trimmed}/` : `${trimmed}/mcp/`;

      this.logger.log('✅ MCP URL normalized', {
        rawUrl: this.maskSensitiveUrl(rawUrl),
        normalized: this.maskSensitiveUrl(normalized),
      });

      return normalized;
    } catch (error) {
      this.logger.error('❌ Failed to normalize MCP URL', error as Error, {
        rawUrl: this.maskSensitiveUrl(rawUrl),
      });
      throw error;
    }
  }

  private getTimeoutMs(): number {
    const timeout = this.configService.get<number>('MCP_TIMEOUT_MS', 15000);
    this.logger.log('⏱️ MCP timeout configured', { timeoutMs: timeout });
    return timeout;
  }

  private async withRetries<T>(fn: () => Promise<T>, toolName?: string, circuitKey?: string): Promise<T> {
    const attempts = this.configService.get<number>('MCP_RETRY_ATTEMPTS', 2);
    const baseDelay = this.configService.get<number>('MCP_RETRY_BASE_MS', 250);

    this.logger.log('🔄 Starting MCP operation with retry logic', {
      toolName,
      circuitKey,
      maxAttempts: attempts + 1,
      baseDelayMs: baseDelay,
    });

    let lastError: any;

    for (let attempt = 0; attempt <= attempts; attempt++) {
      try {
        if (attempt > 0) {
          this.logger.log(`🔄 Retry attempt ${attempt} for MCP operation`, {
            toolName,
            circuitKey,
            attempt,
            maxAttempts: attempts + 1,
          });
        }

        const result = await fn();

        if (attempt > 0) {
          this.logger.log(`✅ MCP operation succeeded on retry attempt ${attempt}`, {
            toolName,
            circuitKey,
            attempt,
          });
        }

        return result;
      } catch (error) {
        lastError = error;

        if (attempt >= attempts) {
          this.logger.error('❌ MCP operation failed after all retry attempts', error as Error, {
            toolName,
            circuitKey,
            attempt,
            maxAttempts: attempts + 1,
            totalAttempts: attempt + 1,
          });
          break;
        }

        const delay = baseDelay * Math.pow(2, attempt);
        this.logger.warn(`⚠️ MCP operation failed, retrying after ${delay}ms`, {
          toolName,
          circuitKey,
          attempt,
          maxAttempts: attempts + 1,
          delayMs: delay,
          errorMessage: error instanceof Error ? error.message : String(error),
        });

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  private extractToolResult(result: any): any {
    this.logger.log('🔍 Extracting MCP tool result', {
      resultType: typeof result,
      isArray: Array.isArray(result),
      hasContent: result && Array.isArray(result.content),
    });

    try {
      if (!result) {
        this.logger.log('✅ MCP tool result is null/undefined, returning as-is');
        return result;
      }

      if (Array.isArray(result.content) && result.content.length > 0) {
        this.logger.log('🔍 Extracting from content array', {
          contentLength: result.content.length,
          contentTypes: result.content.map((item: any) => item.type),
        });

        const jsonItem = result.content.find((item: any) => item.type === 'json');
        if (jsonItem && jsonItem.json !== undefined) {
          this.logger.log('✅ MCP tool result extracted from JSON content', {
            resultType: typeof jsonItem.json,
            isArray: Array.isArray(jsonItem.json),
          });
          return jsonItem.json;
        }

        const textItem = result.content.find((item: any) => item.type === 'text');
        if (textItem && typeof textItem.text === 'string') {
          try {
            const parsed = JSON.parse(textItem.text);
            this.logger.log('✅ MCP tool result extracted from text content (parsed as JSON)', {
              resultType: typeof parsed,
              isArray: Array.isArray(parsed),
            });
            return parsed;
          } catch (parseError) {
            this.logger.log('✅ MCP tool result extracted from text content (as string)', {
              textLength: textItem.text.length,
            });
            return textItem.text;
          }
        }
      }

      this.logger.log('✅ MCP tool result returned as-is', {
        resultType: typeof result,
        isArray: Array.isArray(result),
      });
      return result;
    } catch (error) {
      this.logger.error('❌ Failed to extract MCP tool result', error as Error, {
        resultType: typeof result,
      });
      throw error;
    }
  }

  private assertCircuitClosed(key: string): void {
    const state = this.circuitState.get(key);

    this.logger.log('🔍 Checking MCP circuit breaker state', {
      circuitKey: key,
      hasState: !!state,
      failures: state?.failures,
      isOpen: !!(state?.openedAt),
    });

    if (!state || !state.openedAt) {
      this.logger.log('✅ MCP circuit breaker is closed', {
        circuitKey: key,
        failures: state?.failures || 0,
      });
      return;
    }

    const cooldownMs = this.configService.get<number>('MCP_CIRCUIT_BREAKER_TIMEOUT_MS', 30000);
    const elapsedMs = Date.now() - state.openedAt;
    const remainingMs = cooldownMs - elapsedMs;

    if (elapsedMs < cooldownMs) {
      const error = new Error('MCP circuit breaker is open; please retry shortly');
      this.logger.error('❌ MCP circuit breaker is OPEN, rejecting request', error, {
        circuitKey: key,
        failures: state.failures,
        openedAt: new Date(state.openedAt).toISOString(),
        elapsedMs,
        remainingMs,
        cooldownMs,
      });
      throw error;
    }

    this.logger.log('🔄 MCP circuit breaker cooldown expired, transitioning to HALF-OPEN', {
      circuitKey: key,
      failures: state.failures,
      elapsedMs,
      cooldownMs,
    });

    this.circuitState.set(key, { failures: 0 });
  }

  private recordCircuitFailure(key: string): void {
    const state = this.circuitState.get(key) || { failures: 0 };
    const previousFailures = state.failures;
    state.failures += 1;

    const threshold = this.configService.get<number>('MCP_CIRCUIT_BREAKER_THRESHOLD', 5);

    this.logger.log('⚠️ Recording MCP circuit breaker failure', {
      circuitKey: key,
      previousFailures,
      currentFailures: state.failures,
      threshold,
      willOpen: state.failures >= threshold,
    });

    if (state.failures >= threshold) {
      state.openedAt = Date.now();
      const cooldownMs = this.configService.get<number>('MCP_CIRCUIT_BREAKER_TIMEOUT_MS', 30000);

      this.logger.warn('⚠️ MCP circuit breaker OPENED due to failures', {
        circuitKey: key,
        failures: state.failures,
        threshold,
        openedAt: new Date(state.openedAt).toISOString(),
        cooldownMs,
      });
    }

    this.circuitState.set(key, state);
  }

  private resetCircuit(key: string): void {
    const state = this.circuitState.get(key);
    const previousState = state ? { ...state } : null;

    this.circuitState.set(key, { failures: 0 });

    if (previousState && (previousState.failures > 0 || previousState.openedAt)) {
      this.logger.log('✅ MCP circuit breaker RESET to CLOSED', {
        circuitKey: key,
        previousFailures: previousState.failures,
        wasOpen: !!previousState.openedAt,
        openedAt: previousState.openedAt ? new Date(previousState.openedAt).toISOString() : undefined,
      });
    }
  }

  private maskSensitiveUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      if (urlObj.password) {
        urlObj.password = '***';
      }
      if (urlObj.username) {
        urlObj.username = '***';
      }
      return urlObj.toString();
    } catch {
      return url;
    }
  }
}
