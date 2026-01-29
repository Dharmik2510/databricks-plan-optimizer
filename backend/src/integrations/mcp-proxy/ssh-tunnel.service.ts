import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

export interface SshTunnelConfig {
  sshHost: string;
  sshPort: number;
  sshUser: string;
  sshPrivateKey: string; // Decrypted
  remoteHost: string;
  remotePort: number;
  localPort: number;
}

interface SshTunnel {
  configKey: string;
  process: ChildProcess;
  localPort: number;
  keyPath: string;
  createdAt: Date;
  lastUsedAt: Date;
}

@Injectable()
export class SshTunnelService implements OnModuleDestroy {
  private readonly logger = new Logger(SshTunnelService.name);
  private readonly tunnels = new Map<string, SshTunnel>();

  constructor(private readonly config: ConfigService) {}

  async ensureTunnel(config: SshTunnelConfig): Promise<number> {
    const logContext = `ensureTunnel(${config.sshHost}:${config.sshPort})`;
    try {
      this.logger.log(
        `${logContext} - Ensuring SSH tunnel to ${config.sshHost}:${config.sshPort} → ${config.remoteHost}:${config.remotePort}`,
      );

      const configKey = this.generateConfigKey(config);
      this.logger.debug(
        `${logContext} - Generated config key: ${configKey}`,
      );

      const existing = this.tunnels.get(configKey);
      if (existing) {
        this.logger.debug(
          `${logContext} - Found existing tunnel, checking health`,
        );

        const healthy = await this.isHealthy(existing, config);
        if (healthy) {
          existing.lastUsedAt = new Date();
          this.logger.log(
            `✅ ${logContext} - Reusing healthy SSH tunnel ${configKey} on port ${existing.localPort}`,
          );
          return existing.localPort;
        } else {
          this.logger.warn(
            `❌ ${logContext} - SSH tunnel ${configKey} is unhealthy, recreating`,
          );
          await this.terminateTunnel(existing);
        }
      } else {
        this.logger.debug(
          `${logContext} - No existing tunnel found, creating new one`,
        );
      }

      // Create new tunnel
      const localPort = await this.createTunnel(configKey, config);
      this.logger.log(
        `✅ ${logContext} - Successfully ensured SSH tunnel on port ${localPort}`,
      );
      return localPort;
    } catch (error) {
      this.logger.error(
        `❌ ${logContext} - Failed to ensure SSH tunnel: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async createTunnel(
    configKey: string,
    config: SshTunnelConfig,
  ): Promise<number> {
    const logContext = `createTunnel(${configKey})`;
    let keyPath: string | null = null;

    try {
      this.logger.log(
        `${logContext} - Creating SSH tunnel: ${config.localPort} → ${config.sshHost}:${config.sshPort} → ${config.remoteHost}:${config.remotePort}`,
      );

      // Write private key to temporary file with secure permissions
      keyPath = path.join(os.tmpdir(), `ssh-key-${configKey}`);
      this.logger.debug(
        `${logContext} - Writing SSH private key to temporary file: ${keyPath}`,
      );

      try {
        await fs.writeFile(keyPath, config.sshPrivateKey, { mode: 0o600 });
        this.logger.log(
          `✅ ${logContext} - SSH private key file created with secure permissions (0600)`,
        );
      } catch (error) {
        this.logger.error(
          `❌ ${logContext} - Failed to write SSH private key file: ${error.message}`,
          error.stack,
        );
        throw new Error(`Failed to write SSH private key: ${error.message}`);
      }

      // Verify key file was created
      try {
        const stats = await fs.stat(keyPath);
        const permissions = (stats.mode & parseInt('777', 8)).toString(8);
        this.logger.debug(
          `${logContext} - Key file created successfully (permissions: ${permissions}, size: ${stats.size} bytes)`,
        );
      } catch (error) {
        this.logger.error(
          `❌ ${logContext} - Failed to verify key file: ${error.message}`,
        );
        throw new Error(`Failed to verify SSH key file: ${error.message}`);
      }

      const sshArgs = [
        '-N', // No command
        '-L',
        `${config.localPort}:${config.remoteHost}:${config.remotePort}`,
        '-o',
        'StrictHostKeyChecking=accept-new',
        '-o',
        'ServerAliveInterval=30',
        '-o',
        'ServerAliveCountMax=3',
        '-o',
        'ExitOnForwardFailure=yes',
        '-i',
        keyPath,
        '-p',
        config.sshPort.toString(),
        `${config.sshUser}@${config.sshHost}`,
      ];

      this.logger.debug(
        `${logContext} - SSH command arguments prepared (user: ${config.sshUser}, host: ${config.sshHost}, port: ${config.sshPort})`,
      );

      let sshProcess: ChildProcess;
      try {
        this.logger.log(
          `${logContext} - Spawning SSH process: ssh -N -L ${config.localPort}:${config.remoteHost}:${config.remotePort} ${config.sshUser}@${config.sshHost}:${config.sshPort}`,
        );
        sshProcess = spawn('ssh', sshArgs, {
          detached: false,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        this.logger.log(
          `✅ ${logContext} - SSH process spawned successfully (PID: ${sshProcess.pid})`,
        );
      } catch (error) {
        this.logger.error(
          `❌ ${logContext} - Failed to spawn SSH process: ${error.message}`,
          error.stack,
        );
        // Cleanup key file on failure
        try {
          await fs.unlink(keyPath);
          this.logger.debug(
            `${logContext} - Cleaned up key file after spawn failure`,
          );
        } catch (cleanupError) {
          this.logger.warn(
            `${logContext} - Failed to cleanup key file: ${cleanupError.message}`,
          );
        }
        throw new Error(`Failed to spawn SSH process: ${error.message}`);
      }

      // Monitor SSH stdout
      sshProcess.stdout?.on('data', (data) => {
        try {
          const output = data.toString().trim();
          // Sanitize output - don't log anything that looks like a key or password
          const sanitized = this.sanitizeOutput(output);
          if (sanitized) {
            this.logger.debug(`[SSH ${configKey} STDOUT] ${sanitized}`);
          }
        } catch (error) {
          this.logger.warn(
            `${logContext} - Error processing SSH stdout: ${error.message}`,
          );
        }
      });

      // Monitor SSH stderr
      sshProcess.stderr?.on('data', (data) => {
        try {
          const output = data.toString().trim();
          // Sanitize output - don't log anything that looks like a key or password
          const sanitized = this.sanitizeOutput(output);
          if (sanitized) {
            this.logger.warn(`[SSH ${configKey} STDERR] ${sanitized}`);
          }
        } catch (error) {
          this.logger.warn(
            `${logContext} - Error processing SSH stderr: ${error.message}`,
          );
        }
      });

      // Monitor SSH process errors
      sshProcess.on('error', (error) => {
        this.logger.error(
          `❌ [SSH ${configKey}] Process error: ${error.message}`,
          error.stack,
        );
      });

      // Monitor SSH process exit
      sshProcess.on('exit', (code, signal) => {
        try {
          if (code === 0) {
            this.logger.log(
              `✅ [SSH ${configKey}] Process exited cleanly (code: ${code})`,
            );
          } else if (signal) {
            this.logger.warn(
              `❌ [SSH ${configKey}] Process terminated by signal: ${signal}`,
            );
          } else {
            this.logger.error(
              `❌ [SSH ${configKey}] Process exited with non-zero code: ${code}`,
            );
          }

          this.logger.debug(
            `[SSH ${configKey}] Cleaning up tunnel (exit code: ${code}, signal: ${signal})`,
          );
          this.tunnels.delete(configKey);

          // Cleanup key file
          if (keyPath) {
            fs.unlink(keyPath)
              .then(() => {
                this.logger.log(
                  `✅ [SSH ${configKey}] Key file cleaned up: ${keyPath}`,
                );
              })
              .catch((error) => {
                this.logger.warn(
                  `❌ [SSH ${configKey}] Failed to cleanup key file ${keyPath}: ${error.message}`,
                );
              });
          }
        } catch (error) {
          this.logger.error(
            `❌ [SSH ${configKey}] Error in exit handler: ${error.message}`,
            error.stack,
          );
        }
      });

      const tunnel: SshTunnel = {
        configKey,
        process: sshProcess,
        localPort: config.localPort,
        keyPath,
        createdAt: new Date(),
        lastUsedAt: new Date(),
      };

      this.tunnels.set(configKey, tunnel);
      this.logger.debug(
        `${logContext} - Tunnel registered in map (total tunnels: ${this.tunnels.size})`,
      );

      // Wait for tunnel to be ready
      this.logger.log(
        `${logContext} - Waiting for tunnel to be ready on port ${config.localPort}`,
      );
      try {
        await this.waitForTunnelReady(config.localPort, 10000);
        this.logger.log(
          `✅ ${logContext} - SSH tunnel is ready on port ${config.localPort}`,
        );
      } catch (error) {
        this.logger.error(
          `❌ ${logContext} - Tunnel failed to become ready: ${error.message}`,
        );
        // Cleanup on failure
        await this.terminateTunnel(tunnel);
        throw error;
      }

      return config.localPort;
    } catch (error) {
      this.logger.error(
        `❌ ${logContext} - Failed to create SSH tunnel: ${error.message}`,
        error.stack,
      );

      // Final cleanup attempt if we created a key file
      if (keyPath) {
        try {
          await fs.unlink(keyPath);
          this.logger.debug(
            `${logContext} - Cleaned up key file after failure`,
          );
        } catch (cleanupError) {
          this.logger.warn(
            `${logContext} - Failed to cleanup key file: ${cleanupError.message}`,
          );
        }
      }

      throw error;
    }
  }

  private async waitForTunnelReady(
    port: number,
    timeoutMs: number,
  ): Promise<void> {
    const logContext = `waitForTunnelReady(port:${port})`;
    const startTime = Date.now();

    try {
      this.logger.debug(
        `${logContext} - Waiting up to ${timeoutMs}ms for tunnel readiness`,
      );

      let attempts = 0;
      while (Date.now() - startTime < timeoutMs) {
        attempts++;
        try {
          this.logger.debug(
            `${logContext} - Health check attempt ${attempts} for port ${port}`,
          );

          // Try to connect to the tunneled port
          const response = await fetch(
            `http://localhost:${port}/api/v1/applications?limit=1`,
            {
              signal: AbortSignal.timeout(2000),
            },
          );

          // 401 is OK (means SHS is responding, just needs auth)
          if (response.ok || response.status === 401) {
            this.logger.log(
              `✅ ${logContext} - Tunnel is ready on port ${port} (status: ${response.status}, attempts: ${attempts})`,
            );
            return;
          } else {
            this.logger.debug(
              `${logContext} - Unexpected response status: ${response.status}`,
            );
          }
        } catch (error) {
          this.logger.debug(
            `${logContext} - Attempt ${attempts} failed: ${error.message}`,
          );
          // Not ready yet, continue waiting
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      const elapsed = Date.now() - startTime;
      this.logger.error(
        `❌ ${logContext} - Tunnel failed to establish within ${timeoutMs}ms (elapsed: ${elapsed}ms, attempts: ${attempts})`,
      );
      throw new Error(
        `SSH tunnel failed to establish within ${timeoutMs}ms`,
      );
    } catch (error) {
      // If it's already our timeout error, just re-throw it
      if (error.message?.includes('failed to establish')) {
        throw error;
      }

      // Otherwise, wrap it
      this.logger.error(
        `❌ ${logContext} - Error while waiting for tunnel: ${error.message}`,
        error.stack,
      );
      throw new Error(`Error waiting for tunnel readiness: ${error.message}`);
    }
  }

  private async isHealthy(
    tunnel: SshTunnel,
    config: SshTunnelConfig,
  ): Promise<boolean> {
    const logContext = `isHealthy(${tunnel.configKey})`;

    try {
      this.logger.debug(
        `${logContext} - Checking tunnel health (port: ${tunnel.localPort}, age: ${Date.now() - tunnel.createdAt.getTime()}ms)`,
      );

      // Check if process is still alive
      if (tunnel.process.killed) {
        this.logger.warn(
          `❌ ${logContext} - Process is marked as killed`,
        );
        return false;
      }

      if (tunnel.process.exitCode !== null) {
        this.logger.warn(
          `❌ ${logContext} - Process has exited with code: ${tunnel.process.exitCode}`,
        );
        return false;
      }

      this.logger.debug(
        `${logContext} - Process is alive (PID: ${tunnel.process.pid}), checking endpoint`,
      );

      // Check if tunnel endpoint is responsive
      try {
        const response = await fetch(
          `http://localhost:${tunnel.localPort}/api/v1/applications?limit=1`,
          { signal: AbortSignal.timeout(2000) },
        );

        const healthy = response.ok || response.status === 401;
        if (healthy) {
          this.logger.log(
            `✅ ${logContext} - Tunnel is healthy (status: ${response.status})`,
          );
        } else {
          this.logger.warn(
            `❌ ${logContext} - Tunnel endpoint returned unhealthy status: ${response.status}`,
          );
        }
        return healthy;
      } catch (error) {
        this.logger.warn(
          `❌ ${logContext} - Tunnel endpoint is not responsive: ${error.message}`,
        );
        return false;
      }
    } catch (error) {
      this.logger.error(
        `❌ ${logContext} - Error during health check: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  private async terminateTunnel(tunnel: SshTunnel): Promise<void> {
    const logContext = `terminateTunnel(${tunnel.configKey})`;

    try {
      this.logger.log(
        `${logContext} - Terminating SSH tunnel (PID: ${tunnel.process.pid}, port: ${tunnel.localPort})`,
      );

      if (!tunnel.process.killed) {
        this.logger.debug(
          `${logContext} - Sending SIGTERM to SSH process`,
        );
        try {
          tunnel.process.kill('SIGTERM');
          this.logger.log(
            `✅ ${logContext} - SIGTERM sent to SSH process`,
          );
        } catch (error) {
          this.logger.error(
            `❌ ${logContext} - Failed to send SIGTERM: ${error.message}`,
          );
        }

        // Force kill after 5 seconds if still alive
        setTimeout(() => {
          try {
            if (!tunnel.process.killed && tunnel.process.exitCode === null) {
              this.logger.warn(
                `❌ ${logContext} - Process still alive after 5s, sending SIGKILL`,
              );
              tunnel.process.kill('SIGKILL');
              this.logger.log(
                `✅ ${logContext} - SIGKILL sent to SSH process`,
              );
            }
          } catch (error) {
            this.logger.error(
              `❌ ${logContext} - Failed to send SIGKILL: ${error.message}`,
            );
          }
        }, 5000);
      } else {
        this.logger.debug(
          `${logContext} - Process already killed, skipping termination`,
        );
      }

      // Cleanup key file
      this.logger.debug(
        `${logContext} - Attempting to cleanup key file: ${tunnel.keyPath}`,
      );
      try {
        await fs.unlink(tunnel.keyPath);
        this.logger.log(
          `✅ ${logContext} - Key file cleaned up successfully`,
        );

        // Verify cleanup
        try {
          await fs.access(tunnel.keyPath);
          this.logger.warn(
            `❌ ${logContext} - Key file still exists after cleanup attempt`,
          );
        } catch {
          this.logger.log(
            `✅ ${logContext} - Key file cleanup verified (file no longer exists)`,
          );
        }
      } catch (error) {
        if (error.code === 'ENOENT') {
          this.logger.debug(
            `${logContext} - Key file already removed: ${tunnel.keyPath}`,
          );
        } else {
          this.logger.warn(
            `❌ ${logContext} - Failed to cleanup key file: ${error.message}`,
          );
        }
      }

      // Remove from tunnels map
      this.tunnels.delete(tunnel.configKey);
      this.logger.log(
        `✅ ${logContext} - Tunnel removed from registry (remaining tunnels: ${this.tunnels.size})`,
      );
    } catch (error) {
      this.logger.error(
        `❌ ${logContext} - Error during tunnel termination: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private generateConfigKey(config: SshTunnelConfig): string {
    const logContext = 'generateConfigKey';

    try {
      const canonical = JSON.stringify({
        sshHost: config.sshHost,
        sshPort: config.sshPort,
        sshUser: config.sshUser,
        remoteHost: config.remoteHost,
        remotePort: config.remotePort,
      });

      const key = crypto
        .createHash('sha256')
        .update(canonical)
        .digest('hex')
        .substring(0, 16);

      this.logger.debug(
        `${logContext} - Generated key for ${config.sshUser}@${config.sshHost}:${config.sshPort} → ${config.remoteHost}:${config.remotePort}`,
      );

      return key;
    } catch (error) {
      this.logger.error(
        `❌ ${logContext} - Failed to generate config key: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to generate config key: ${error.message}`);
    }
  }

  /**
   * Sanitizes SSH output to prevent logging sensitive information
   */
  private sanitizeOutput(output: string): string {
    try {
      // Don't log empty output
      if (!output || output.trim().length === 0) {
        return '';
      }

      // Patterns that might indicate sensitive data
      const sensitivePatterns = [
        /BEGIN.*PRIVATE KEY/i,
        /END.*PRIVATE KEY/i,
        /password/i,
        /passphrase/i,
        /[A-Za-z0-9+/]{40,}={0,2}/, // Base64-like strings
        /-----BEGIN/i,
        /-----END/i,
      ];

      // Check if output contains sensitive patterns
      for (const pattern of sensitivePatterns) {
        if (pattern.test(output)) {
          return '[REDACTED - Potentially sensitive SSH output]';
        }
      }

      // Truncate very long output
      if (output.length > 500) {
        return output.substring(0, 500) + '... [truncated]';
      }

      return output;
    } catch (error) {
      this.logger.warn(
        `Error sanitizing output: ${error.message}`,
      );
      return '[Error sanitizing output]';
    }
  }

  onModuleDestroy(): void {
    const logContext = 'onModuleDestroy';

    try {
      this.logger.log(
        `${logContext} - Terminating all SSH tunnels (count: ${this.tunnels.size})`,
      );

      let successCount = 0;
      let errorCount = 0;

      for (const tunnel of this.tunnels.values()) {
        try {
          this.terminateTunnel(tunnel);
          successCount++;
        } catch (error) {
          errorCount++;
          this.logger.error(
            `❌ ${logContext} - Failed to terminate tunnel ${tunnel.configKey}: ${error.message}`,
          );
        }
      }

      if (errorCount === 0) {
        this.logger.log(
          `✅ ${logContext} - All SSH tunnels terminated successfully (${successCount} tunnels)`,
        );
      } else {
        this.logger.warn(
          `⚠️ ${logContext} - SSH tunnels terminated with errors (success: ${successCount}, errors: ${errorCount})`,
        );
      }
    } catch (error) {
      this.logger.error(
        `❌ ${logContext} - Error during module destroy: ${error.message}`,
        error.stack,
      );
    }
  }
}
