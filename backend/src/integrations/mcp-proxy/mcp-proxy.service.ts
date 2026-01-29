import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChildProcess, spawn } from 'child_process';
import * as crypto from 'crypto';
import { SshTunnelService } from './ssh-tunnel.service';

export interface ShsConfig {
  baseUrl: string;
  authScheme: 'none' | 'bearer' | 'basic' | 'header';
  authToken?: string;
  authHeaderName?: string;
}

export interface SshTunnelConfig {
  sshHost: string;
  sshPort: number;
  sshUser: string;
  sshPrivateKey: string; // Decrypted
  remoteHost: string;
  remotePort: number;
  localPort: number;
}

interface McpInstance {
  configKey: string;
  process: ChildProcess;
  port: number;
  baseUrl: string;
  createdAt: Date;
  lastUsedAt: Date;
  requestCount: number;
}

@Injectable()
export class McpProxyService implements OnModuleDestroy {
  private readonly logger = new Logger(McpProxyService.name);
  private readonly instances = new Map<string, McpInstance>();
  private readonly portRange = { min: 9000, max: 9999 };
  private nextPort = this.portRange.min;

  constructor(
    private readonly config: ConfigService,
    private readonly sshTunnelService: SshTunnelService,
  ) {
    this.logger.log('✅ MCP Proxy Service initialized');
    this.logger.log(
      `Port allocation range: ${this.portRange.min}-${this.portRange.max}`,
    );

    // Cleanup idle instances every 5 minutes
    setInterval(() => {
      try {
        this.cleanupIdleInstances();
      } catch (error) {
        this.logger.error('❌ Error during idle instance cleanup', error);
      }
    }, 5 * 60 * 1000);
  }

  async callTool<T>(
    shsConfig: ShsConfig,
    tunnelConfig: SshTunnelConfig | null,
    toolName: string,
    args: Record<string, any>,
    userId: string,
    datasourceId: string,
  ): Promise<T> {
    this.logger.debug(
      `Tool call initiated: datasource=${datasourceId}, user=${userId}, tool=${toolName}`,
    );

    try {
      let effectiveShsConfig = shsConfig;

      // If tunnel config provided, establish tunnel first
      if (tunnelConfig) {
        this.logger.debug(
          `SSH tunnel required for datasource ${datasourceId}: ${tunnelConfig.sshHost}:${tunnelConfig.sshPort} → ${tunnelConfig.remoteHost}:${tunnelConfig.remotePort}`,
        );

        try {
          const localPort =
            await this.sshTunnelService.ensureTunnel(tunnelConfig);
          effectiveShsConfig = {
            ...shsConfig,
            baseUrl: `http://localhost:${localPort}`,
          };
          this.logger.log(
            `✅ SSH tunnel established for datasource ${datasourceId}: local port ${localPort}`,
          );
        } catch (error) {
          this.logger.error(
            `❌ SSH tunnel failed for datasource ${datasourceId}`,
            error,
          );
          throw error;
        }
      }

      // Get or create MCP instance for this SHS config
      const instance = await this.getOrCreateInstance(effectiveShsConfig);

      // Build JSON-RPC request
      const requestId = Math.floor(Math.random() * 1000000);
      const mcpRequest = {
        jsonrpc: '2.0',
        id: requestId,
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args,
        },
      };

      this.logger.debug(
        `Forwarding request to MCP instance ${instance.configKey}: tool=${toolName}, requestId=${requestId}`,
      );

      // Call MCP instance
      try {
        const response = await fetch(`${instance.baseUrl}/mcp/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
          },
          body: JSON.stringify(mcpRequest),
          signal: AbortSignal.timeout(this.getTimeoutMs()),
        });

        if (!response.ok) {
          const text = await response.text().catch(() => '');
          this.logger.error(
            `❌ MCP instance returned error: status=${response.status}, datasource=${datasourceId}, tool=${toolName}`,
          );
          throw new Error(
            `MCP instance returned ${response.status}: ${text || response.statusText}`,
          );
        }

        const result = await response.json();

        if (result.error) {
          this.logger.error(
            `❌ MCP tool execution error: ${result.error.message}, datasource=${datasourceId}, tool=${toolName}`,
          );
          throw new Error(`MCP error: ${result.error.message}`);
        }

        // Update instance stats
        instance.lastUsedAt = new Date();
        instance.requestCount++;

        this.logger.debug(
          `✅ MCP tool call successful: datasource=${datasourceId}, tool=${toolName}, requestCount=${instance.requestCount}`,
        );

        // Extract and return result
        return this.extractToolResult(result.result);
      } catch (error) {
        if (error.name === 'TimeoutError' || error.name === 'AbortError') {
          this.logger.error(
            `❌ MCP request timeout: datasource=${datasourceId}, tool=${toolName}, timeout=${this.getTimeoutMs()}ms`,
          );
        } else {
          this.logger.error(
            `❌ MCP request forwarding failed: datasource=${datasourceId}, user=${userId}, tool=${toolName}`,
            error,
          );
        }
        throw error;
      }
    } catch (error) {
      this.logger.error(
        `❌ MCP proxy call failed: datasource=${datasourceId}, user=${userId}, tool=${toolName}`,
        error,
      );
      throw error;
    }
  }

  private async getOrCreateInstance(
    shsConfig: ShsConfig,
  ): Promise<McpInstance> {
    const configKey = this.generateConfigKey(shsConfig);

    try {
      // Check if instance exists and is healthy
      const existing = this.instances.get(configKey);
      if (existing) {
        this.logger.debug(
          `Checking health of existing MCP instance ${configKey} (port: ${existing.port}, requests: ${existing.requestCount})`,
        );

        const healthy = await this.isHealthy(existing);
        if (healthy) {
          this.logger.debug(
            `✅ Reusing healthy MCP instance ${configKey} (requests: ${existing.requestCount})`,
          );
          return existing;
        }

        // Cleanup stale instance
        this.logger.warn(
          `❌ MCP instance ${configKey} is unhealthy (port: ${existing.port}), terminating`,
        );
        this.terminateInstance(existing);
      }

      // Spawn new instance
      return await this.spawnInstance(configKey, shsConfig);
    } catch (error) {
      this.logger.error(
        `❌ Failed to get or create MCP instance for config ${configKey}`,
        error,
      );
      throw error;
    }
  }

  private async spawnInstance(
    configKey: string,
    shsConfig: ShsConfig,
  ): Promise<McpInstance> {
    try {
      const port = this.allocatePort();
      const baseUrl = `http://localhost:${port}`;

      this.logger.log(
        `Spawning MCP instance: configKey=${configKey}, port=${port}, shsUrl=${shsConfig.baseUrl}, authScheme=${shsConfig.authScheme}`,
      );

      // Build environment variables for this SHS config
      const env: Record<string, string> = {
        ...process.env,
        PORT: port.toString(),
        SHS_BASE_URL: shsConfig.baseUrl,
        NODE_ENV: 'production',
      };

      // Add auth based on scheme
      if (shsConfig.authScheme === 'bearer' && shsConfig.authToken) {
        env.SHS_AUTH_TOKEN = shsConfig.authToken;
        this.logger.debug(`Using bearer token authentication for ${configKey}`);
      } else if (shsConfig.authScheme === 'basic' && shsConfig.authToken) {
        env.SHS_BASIC_AUTH = shsConfig.authToken;
        this.logger.debug(`Using basic authentication for ${configKey}`);
      } else if (shsConfig.authScheme === 'header' && shsConfig.authToken) {
        env.SHS_CUSTOM_HEADER_NAME = shsConfig.authHeaderName || 'X-Auth';
        env.SHS_CUSTOM_HEADER_VALUE = shsConfig.authToken;
        this.logger.debug(
          `Using custom header authentication for ${configKey}: ${env.SHS_CUSTOM_HEADER_NAME}`,
        );
      } else {
        this.logger.debug(`No authentication configured for ${configKey}`);
      }

      // Spawn MCP server process
      const mcpProcess = spawn(
        'npx',
        ['@kubeflow/mcp-apache-spark-history-server'],
        {
          env,
          detached: false,
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );

      this.logger.log(
        `✅ MCP process spawned: configKey=${configKey}, pid=${mcpProcess.pid}, port=${port}`,
      );

      mcpProcess.stdout?.on('data', (data) => {
        this.logger.debug(`[MCP ${configKey}:${mcpProcess.pid}] ${data.toString().trim()}`);
      });

      mcpProcess.stderr?.on('data', (data) => {
        this.logger.warn(
          `[MCP ${configKey}:${mcpProcess.pid}] ${data.toString().trim()}`,
        );
      });

      mcpProcess.on('exit', (code, signal) => {
        if (code === 0) {
          this.logger.log(
            `MCP process exited cleanly: configKey=${configKey}, pid=${mcpProcess.pid}, code=${code}`,
          );
        } else {
          this.logger.warn(
            `❌ MCP process exited unexpectedly: configKey=${configKey}, pid=${mcpProcess.pid}, exitCode=${code}, signal=${signal}`,
          );
        }
        this.instances.delete(configKey);
      });

      mcpProcess.on('error', (error) => {
        this.logger.error(
          `❌ MCP process error: configKey=${configKey}, pid=${mcpProcess.pid}`,
          error,
        );
      });

      const instance: McpInstance = {
        configKey,
        process: mcpProcess,
        port,
        baseUrl,
        createdAt: new Date(),
        lastUsedAt: new Date(),
        requestCount: 0,
      };

      this.instances.set(configKey, instance);
      this.logger.log(
        `✅ MCP instance created: configKey=${configKey}, totalInstances=${this.instances.size}`,
      );

      // Wait for MCP server to be ready
      try {
        await this.waitForReady(instance, 10000);
        this.logger.log(
          `✅ MCP instance ready: configKey=${configKey}, port=${port}, pid=${mcpProcess.pid}`,
        );
      } catch (error) {
        this.logger.error(
          `❌ MCP instance failed to become ready: configKey=${configKey}, port=${port}, pid=${mcpProcess.pid}`,
          error,
        );
        this.terminateInstance(instance);
        this.instances.delete(configKey);
        throw error;
      }

      return instance;
    } catch (error) {
      this.logger.error(
        `❌ Failed to spawn MCP instance: configKey=${configKey}`,
        error,
      );
      throw error;
    }
  }

  private async waitForReady(
    instance: McpInstance,
    timeoutMs: number,
  ): Promise<void> {
    const startTime = Date.now();
    let attemptCount = 0;

    this.logger.debug(
      `Waiting for MCP instance to become ready: configKey=${instance.configKey}, timeout=${timeoutMs}ms`,
    );

    while (Date.now() - startTime < timeoutMs) {
      attemptCount++;
      try {
        const response = await fetch(`${instance.baseUrl}/mcp/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
              protocolVersion: '2024-11-05',
              capabilities: {},
              clientInfo: { name: 'proxy-health-check', version: '1.0' },
            },
          }),
          signal: AbortSignal.timeout(2000),
        });

        if (response.ok) {
          this.logger.debug(
            `✅ MCP instance responded to health check after ${attemptCount} attempts (${Date.now() - startTime}ms)`,
          );
          return;
        }

        this.logger.debug(
          `MCP instance health check returned ${response.status} (attempt ${attemptCount})`,
        );
      } catch (error) {
        this.logger.debug(
          `MCP instance not ready yet (attempt ${attemptCount}): ${error.message}`,
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    this.logger.error(
      `❌ MCP instance failed to start within timeout: configKey=${instance.configKey}, timeout=${timeoutMs}ms, attempts=${attemptCount}`,
    );
    throw new Error(
      `MCP instance ${instance.configKey} failed to start within ${timeoutMs}ms`,
    );
  }

  private async isHealthy(instance: McpInstance): Promise<boolean> {
    try {
      const response = await fetch(`${instance.baseUrl}/mcp/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 999,
          method: 'ping',
          params: {},
        }),
        signal: AbortSignal.timeout(2000),
      });

      const healthy = response.ok;
      if (!healthy) {
        this.logger.debug(
          `MCP instance health check failed: configKey=${instance.configKey}, status=${response.status}`,
        );
      }
      return healthy;
    } catch (error) {
      this.logger.debug(
        `MCP instance health check error: configKey=${instance.configKey}, error=${error.message}`,
      );
      return false;
    }
  }

  private cleanupIdleInstances(): void {
    const now = Date.now();
    const idleTimeoutMs = this.config.get<number>(
      'MCP_INSTANCE_IDLE_TIMEOUT_MS',
      15 * 60 * 1000,
    );

    this.logger.debug(
      `Starting idle instance cleanup: totalInstances=${this.instances.size}, idleTimeout=${idleTimeoutMs}ms`,
    );

    let terminatedCount = 0;

    try {
      for (const [configKey, instance] of this.instances.entries()) {
        const idleMs = now - instance.lastUsedAt.getTime();
        const ageMs = now - instance.createdAt.getTime();

        if (idleMs > idleTimeoutMs) {
          this.logger.log(
            `Terminating idle MCP instance: configKey=${configKey}, port=${instance.port}, pid=${instance.process.pid}, ` +
              `idle=${Math.floor(idleMs / 1000)}s, age=${Math.floor(ageMs / 1000)}s, requests=${instance.requestCount}`,
          );

          try {
            this.terminateInstance(instance);
            this.instances.delete(configKey);
            terminatedCount++;
            this.logger.log(
              `✅ Idle MCP instance terminated: configKey=${configKey}`,
            );
          } catch (error) {
            this.logger.error(
              `❌ Failed to terminate idle instance: configKey=${configKey}`,
              error,
            );
          }
        } else {
          this.logger.debug(
            `MCP instance still active: configKey=${configKey}, idle=${Math.floor(idleMs / 1000)}s, requests=${instance.requestCount}`,
          );
        }
      }

      if (terminatedCount > 0) {
        this.logger.log(
          `✅ Idle cleanup completed: terminated=${terminatedCount}, remaining=${this.instances.size}`,
        );
      } else {
        this.logger.debug(
          `Idle cleanup completed: no instances to terminate, active=${this.instances.size}`,
        );
      }
    } catch (error) {
      this.logger.error('❌ Error during idle instance cleanup loop', error);
    }
  }

  private terminateInstance(instance: McpInstance): void {
    try {
      if (!instance.process.killed) {
        this.logger.debug(
          `Sending SIGTERM to MCP instance: configKey=${instance.configKey}, pid=${instance.process.pid}`,
        );
        instance.process.kill('SIGTERM');

        setTimeout(() => {
          try {
            if (!instance.process.killed) {
              this.logger.warn(
                `❌ Force-killing unresponsive MCP instance: configKey=${instance.configKey}, pid=${instance.process.pid}`,
              );
              instance.process.kill('SIGKILL');
            }
          } catch (error) {
            this.logger.error(
              `❌ Failed to force-kill instance: configKey=${instance.configKey}`,
              error,
            );
          }
        }, 5000);

        this.logger.log(
          `✅ MCP instance termination initiated: configKey=${instance.configKey}, pid=${instance.process.pid}`,
        );
      } else {
        this.logger.debug(
          `MCP instance already killed: configKey=${instance.configKey}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `❌ Error terminating MCP instance: configKey=${instance.configKey}`,
        error,
      );
      throw error;
    }
  }

  private allocatePort(): number {
    const port = this.nextPort++;
    if (this.nextPort > this.portRange.max) {
      this.logger.debug(
        `Port allocation wrapped around: resetting to ${this.portRange.min}`,
      );
      this.nextPort = this.portRange.min;
    }

    this.logger.debug(
      `✅ Port allocated: ${port} (next: ${this.nextPort}, range: ${this.portRange.min}-${this.portRange.max})`,
    );
    return port;
  }

  private generateConfigKey(shsConfig: ShsConfig): string {
    try {
      const canonical = JSON.stringify({
        baseUrl: shsConfig.baseUrl.toLowerCase().replace(/\/$/, ''),
        authScheme: shsConfig.authScheme,
        authHash: shsConfig.authToken
          ? crypto
              .createHash('sha256')
              .update(shsConfig.authToken)
              .digest('hex')
              .substring(0, 16)
          : 'none',
      });

      const configKey = crypto
        .createHash('sha256')
        .update(canonical)
        .digest('hex')
        .substring(0, 16);

      this.logger.debug(
        `Generated config key: ${configKey} for ${shsConfig.baseUrl}`,
      );
      return configKey;
    } catch (error) {
      this.logger.error('❌ Failed to generate config key', error);
      throw error;
    }
  }

  private extractToolResult(result: any): any {
    try {
      if (!result) return result;

      if (Array.isArray(result.content) && result.content.length > 0) {
        const jsonItem = result.content.find((item: any) => item.type === 'json');
        if (jsonItem && jsonItem.json !== undefined) {
          this.logger.debug('Extracted JSON result from MCP response');
          return jsonItem.json;
        }

        const textItem = result.content.find((item: any) => item.type === 'text');
        if (textItem && typeof textItem.text === 'string') {
          try {
            const parsed = JSON.parse(textItem.text);
            this.logger.debug('Parsed text result as JSON from MCP response');
            return parsed;
          } catch {
            this.logger.debug('Returning raw text result from MCP response');
            return textItem.text;
          }
        }
      }

      return result;
    } catch (error) {
      this.logger.error('❌ Error extracting tool result', error);
      return result;
    }
  }

  private getTimeoutMs(): number {
    return this.config.get<number>('MCP_TIMEOUT_MS', 15000);
  }

  onModuleDestroy(): void {
    this.logger.log(
      `Module destruction initiated: terminating ${this.instances.size} MCP instances`,
    );

    try {
      let terminatedCount = 0;
      for (const instance of this.instances.values()) {
        try {
          this.terminateInstance(instance);
          terminatedCount++;
        } catch (error) {
          this.logger.error(
            `❌ Error terminating instance during module destroy: configKey=${instance.configKey}`,
            error,
          );
        }
      }

      this.logger.log(
        `✅ MCP Proxy Service destroyed: terminated ${terminatedCount} instances`,
      );
    } catch (error) {
      this.logger.error(
        '❌ Error during module destruction cleanup',
        error,
      );
    }
  }
}
