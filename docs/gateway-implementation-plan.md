# BrickOptima MCP Gateway - Implementation Plan

## Overview

This document provides a **step-by-step implementation plan** for the BrickOptima MCP Gateway, based on the requirements:

- ✅ **Proxy/wrapper approach** (no fork of Kubeflow MCP)
- ✅ **Support both public and private SHS** (SSH tunnels)
- ✅ **Hybrid model** (gateway + external MCP for enterprise)
- ✅ **Freemium pricing** (50 free analyses/month, $29 for 500)

---

## Phase 1: Core Gateway Infrastructure (Week 1-2)

### Milestone 1.1: Database Schema

**File:** `supabase/migrations/20260111000000_gateway_datasources.sql`

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================================
-- data_sources: Replaces org_connections for gateway mode
-- ============================================================================
create table if not exists data_sources (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Ownership
  user_id uuid not null,
  org_id uuid null,  -- Null for individual users, set for org-level connections

  -- Connection type: gateway_shs or external_mcp
  connection_type text not null default 'gateway_shs'
    check (connection_type in ('gateway_shs', 'external_mcp')),

  -- Display name
  display_name text not null,

  -- For gateway_shs: SHS connection details
  shs_base_url text null,
  shs_auth_scheme text null
    check (shs_auth_scheme in ('none', 'bearer', 'basic', 'header')),
  shs_auth_header_name text null,
  shs_token_encrypted jsonb null,  -- Envelope encrypted
  shs_token_kid text null,

  -- For gateway_shs + private networks: SSH tunnel config
  tunnel_config jsonb null,
  -- Example: {
  --   "type": "ssh",
  --   "ssh_host": "bastion.company.com",
  --   "ssh_port": 22,
  --   "ssh_user": "brickoptima",
  --   "ssh_private_key_encrypted": "...",
  --   "ssh_private_key_kid": "...",
  --   "remote_host": "10.0.1.100",
  --   "remote_port": 18080,
  --   "local_port": 18080
  -- }

  -- For external_mcp: External MCP server details
  external_mcp_url text null,
  external_mcp_auth_scheme text null
    check (external_mcp_auth_scheme in ('none', 'bearer', 'basic', 'header')),
  external_mcp_auth_header_name text null,
  external_mcp_token_encrypted jsonb null,
  external_mcp_token_kid text null,

  -- Metadata
  is_active boolean not null default true,
  last_validated_at timestamptz null,
  validation_error text null,

  -- Constraints
  constraint data_sources_user_unique unique (user_id, org_id, is_active),

  -- Validation: gateway_shs requires shs_base_url
  constraint data_sources_gateway_shs_check
    check (
      connection_type != 'gateway_shs' or
      (shs_base_url is not null and shs_auth_scheme is not null)
    ),

  -- Validation: external_mcp requires external_mcp_url
  constraint data_sources_external_mcp_check
    check (
      connection_type != 'external_mcp' or
      external_mcp_url is not null
    )
);

-- Indexes
create index if not exists data_sources_user_id_idx on data_sources (user_id);
create index if not exists data_sources_org_id_idx on data_sources (org_id);
create index if not exists data_sources_active_idx on data_sources (is_active)
  where is_active = true;

-- RLS: Users can view their own data sources or org-level sources
alter table data_sources enable row level security;

create policy "data_sources_select_own"
  on data_sources for select
  using (
    user_id = auth.uid() or
    (org_id is not null and org_id = (auth.jwt() ->> 'org_id')::uuid)
  );

-- RLS: Users can insert their own personal data sources
create policy "data_sources_insert_own"
  on data_sources for insert
  with check (user_id = auth.uid() and org_id is null);

-- RLS: Users can update their own personal data sources
create policy "data_sources_update_own"
  on data_sources for update
  using (user_id = auth.uid() and org_id is null)
  with check (user_id = auth.uid() and org_id is null);

-- RLS: Users can delete their own personal data sources
create policy "data_sources_delete_own"
  on data_sources for delete
  using (user_id = auth.uid() and org_id is null);

-- RLS: Admins can insert/update/delete org-level data sources
create policy "data_sources_org_admin_insert"
  on data_sources for insert
  with check (
    org_id is not null and
    org_id = (auth.jwt() ->> 'org_id')::uuid and
    (auth.jwt() ->> 'role') in ('ADMIN', 'SUPER_ADMIN', 'admin')
  );

create policy "data_sources_org_admin_update"
  on data_sources for update
  using (
    org_id is not null and
    org_id = (auth.jwt() ->> 'org_id')::uuid and
    (auth.jwt() ->> 'role') in ('ADMIN', 'SUPER_ADMIN', 'admin')
  )
  with check (
    org_id is not null and
    org_id = (auth.jwt() ->> 'org_id')::uuid and
    (auth.jwt() ->> 'role') in ('ADMIN', 'SUPER_ADMIN', 'admin')
  );

create policy "data_sources_org_admin_delete"
  on data_sources for delete
  using (
    org_id is not null and
    org_id = (auth.jwt() ->> 'org_id')::uuid and
    (auth.jwt() ->> 'role') in ('ADMIN', 'SUPER_ADMIN', 'admin')
  );

-- ============================================================================
-- user_quotas: Track usage and enforce tier limits
-- ============================================================================
create table if not exists user_quotas (
  user_id uuid primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Tier
  tier text not null default 'free'
    check (tier in ('free', 'pro', 'team', 'enterprise')),

  -- Usage tracking
  mcp_calls_this_month int not null default 0,
  mcp_calls_reset_at timestamptz not null default date_trunc('month', now() + interval '1 month'),

  -- Tier limits
  mcp_calls_limit int not null default 50,
  concurrent_analyses_limit int not null default 1,
  datasources_max int not null default 1,
  retention_days int not null default 7
);

-- RLS: Users can view their own quota
alter table user_quotas enable row level security;

create policy "user_quotas_select_own"
  on user_quotas for select
  using (user_id = auth.uid());

-- Function to reset monthly quotas
create or replace function reset_monthly_quotas()
returns void
language sql
security definer
as $$
  update user_quotas
  set
    mcp_calls_this_month = 0,
    mcp_calls_reset_at = date_trunc('month', now() + interval '1 month'),
    updated_at = now()
  where mcp_calls_reset_at < now();
$$;

-- Function to create default quota for new users
create or replace function create_default_user_quota()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into user_quotas (user_id, tier, mcp_calls_limit, concurrent_analyses_limit, datasources_max, retention_days)
  values (new.id, 'free', 50, 1, 1, 7)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- Trigger to auto-create quota when user signs up
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function create_default_user_quota();

-- ============================================================================
-- Update audit_events to track datasource_id
-- ============================================================================
alter table audit_events add column if not exists datasource_id uuid null;

comment on column audit_events.datasource_id is 'ID of the data_source used for this action (if applicable)';
```

**Migration checklist:**
- [ ] Create migration file
- [ ] Run locally: `supabase db reset`
- [ ] Verify RLS policies work
- [ ] Test with multiple users/orgs
- [ ] Deploy to staging: `supabase db push`

---

### Milestone 1.2: MCP Proxy Service (Core)

**File:** `backend/src/integrations/mcp-proxy/mcp-proxy.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { McpProxyService } from './mcp-proxy.service';
import { SshTunnelService } from './ssh-tunnel.service';
import { EncryptionModule } from '../../common/security/encryption.module';
import { LoggingModule } from '../../common/logging/logging.module';

@Module({
  imports: [EncryptionModule, LoggingModule],
  providers: [McpProxyService, SshTunnelService],
  exports: [McpProxyService],
})
export class McpProxyModule {}
```

**File:** `backend/src/integrations/mcp-proxy/mcp-proxy.service.ts`

```typescript
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
  sshPrivateKey: string;  // Decrypted
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
    // Cleanup idle instances every 5 minutes
    setInterval(() => this.cleanupIdleInstances(), 5 * 60 * 1000);
  }

  async callTool<T>(
    shsConfig: ShsConfig,
    tunnelConfig: SshTunnelConfig | null,
    toolName: string,
    args: Record<string, any>,
    userId: string,
    datasourceId: string,
  ): Promise<T> {
    let effectiveShsConfig = shsConfig;

    // If tunnel config provided, establish tunnel first
    if (tunnelConfig) {
      const localPort = await this.sshTunnelService.ensureTunnel(tunnelConfig);
      effectiveShsConfig = {
        ...shsConfig,
        baseUrl: `http://localhost:${localPort}`,
      };
      this.logger.debug(
        `Using SSH tunnel for datasource ${datasourceId}: ` +
        `${tunnelConfig.sshHost} → ${tunnelConfig.remoteHost}:${tunnelConfig.remotePort}`,
      );
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

    // Call MCP instance
    try {
      const response = await fetch(`${instance.baseUrl}/mcp/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
        },
        body: JSON.stringify(mcpRequest),
        signal: AbortSignal.timeout(this.getTimeoutMs()),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`MCP instance returned ${response.status}: ${text || response.statusText}`);
      }

      const result = await response.json();

      if (result.error) {
        throw new Error(`MCP error: ${result.error.message}`);
      }

      // Update instance stats
      instance.lastUsedAt = new Date();
      instance.requestCount++;

      // Extract and return result
      return this.extractToolResult(result.result);
    } catch (error) {
      this.logger.error(
        `MCP proxy call failed: datasource=${datasourceId}, user=${userId}, tool=${toolName}`,
        error,
      );
      throw error;
    }
  }

  private async getOrCreateInstance(shsConfig: ShsConfig): Promise<McpInstance> {
    const configKey = this.generateConfigKey(shsConfig);

    // Check if instance exists and is healthy
    const existing = this.instances.get(configKey);
    if (existing && await this.isHealthy(existing)) {
      this.logger.debug(`Reusing MCP instance ${configKey} (requests: ${existing.requestCount})`);
      return existing;
    }

    // Cleanup stale instance
    if (existing) {
      this.logger.warn(`MCP instance ${configKey} is unhealthy, terminating`);
      this.terminateInstance(existing);
    }

    // Spawn new instance
    return await this.spawnInstance(configKey, shsConfig);
  }

  private async spawnInstance(configKey: string, shsConfig: ShsConfig): Promise<McpInstance> {
    const port = this.allocatePort();
    const baseUrl = `http://localhost:${port}`;

    this.logger.log(`Spawning MCP instance ${configKey} on port ${port} for SHS ${shsConfig.baseUrl}`);

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
    } else if (shsConfig.authScheme === 'basic' && shsConfig.authToken) {
      env.SHS_BASIC_AUTH = shsConfig.authToken;
    } else if (shsConfig.authScheme === 'header' && shsConfig.authToken) {
      env.SHS_CUSTOM_HEADER_NAME = shsConfig.authHeaderName || 'X-Auth';
      env.SHS_CUSTOM_HEADER_VALUE = shsConfig.authToken;
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

    mcpProcess.stdout?.on('data', (data) => {
      this.logger.debug(`[MCP ${configKey}] ${data.toString().trim()}`);
    });

    mcpProcess.stderr?.on('data', (data) => {
      this.logger.warn(`[MCP ${configKey}] ${data.toString().trim()}`);
    });

    mcpProcess.on('exit', (code, signal) => {
      this.logger.log(`MCP instance ${configKey} exited: code=${code}, signal=${signal}`);
      this.instances.delete(configKey);
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

    // Wait for MCP server to be ready
    await this.waitForReady(instance, 10000);

    this.logger.log(`MCP instance ${configKey} is ready on port ${port}`);

    return instance;
  }

  private async waitForReady(instance: McpInstance, timeoutMs: number): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
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
          return;
        }
      } catch {
        // Not ready yet
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    throw new Error(`MCP instance ${instance.configKey} failed to start within ${timeoutMs}ms`);
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

      return response.ok;
    } catch {
      return false;
    }
  }

  private cleanupIdleInstances(): void {
    const now = Date.now();
    const idleTimeoutMs = this.config.get<number>('MCP_INSTANCE_IDLE_TIMEOUT_MS', 15 * 60 * 1000);

    for (const [configKey, instance] of this.instances.entries()) {
      const idleMs = now - instance.lastUsedAt.getTime();

      if (idleMs > idleTimeoutMs) {
        this.logger.log(
          `Terminating idle MCP instance ${configKey} ` +
          `(idle: ${Math.floor(idleMs / 60000)}m, requests: ${instance.requestCount})`,
        );
        this.terminateInstance(instance);
        this.instances.delete(configKey);
      }
    }
  }

  private terminateInstance(instance: McpInstance): void {
    if (!instance.process.killed) {
      instance.process.kill('SIGTERM');

      setTimeout(() => {
        if (!instance.process.killed) {
          this.logger.warn(`Force-killing MCP instance ${instance.configKey}`);
          instance.process.kill('SIGKILL');
        }
      }, 5000);
    }
  }

  private allocatePort(): number {
    const port = this.nextPort++;
    if (this.nextPort > this.portRange.max) {
      this.nextPort = this.portRange.min;
    }
    return port;
  }

  private generateConfigKey(shsConfig: ShsConfig): string {
    const canonical = JSON.stringify({
      baseUrl: shsConfig.baseUrl.toLowerCase().replace(/\/$/, ''),
      authScheme: shsConfig.authScheme,
      authHash: shsConfig.authToken
        ? crypto.createHash('sha256').update(shsConfig.authToken).digest('hex').substring(0, 16)
        : 'none',
    });

    return crypto.createHash('sha256').update(canonical).digest('hex').substring(0, 16);
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

  private getTimeoutMs(): number {
    return this.config.get<number>('MCP_TIMEOUT_MS', 15000);
  }

  onModuleDestroy(): void {
    this.logger.log('Terminating all MCP instances');
    for (const instance of this.instances.values()) {
      this.terminateInstance(instance);
    }
  }
}
```

**Implementation checklist:**
- [ ] Create MCP proxy service
- [ ] Test with mock SHS endpoint
- [ ] Verify instance pooling works
- [ ] Test idle timeout cleanup
- [ ] Add metrics (Prometheus counters/gauges)

---

### Milestone 1.3: SSH Tunnel Service

**File:** `backend/src/integrations/mcp-proxy/ssh-tunnel.service.ts`

```typescript
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
  sshPrivateKey: string;  // Decrypted
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
    const configKey = this.generateConfigKey(config);

    const existing = this.tunnels.get(configKey);
    if (existing && await this.isHealthy(existing, config)) {
      existing.lastUsedAt = new Date();
      this.logger.debug(`Reusing SSH tunnel ${configKey}`);
      return existing.localPort;
    }

    // Cleanup stale tunnel
    if (existing) {
      this.logger.warn(`SSH tunnel ${configKey} is unhealthy, recreating`);
      this.terminateTunnel(existing);
    }

    // Create new tunnel
    return await this.createTunnel(configKey, config);
  }

  private async createTunnel(configKey: string, config: SshTunnelConfig): Promise<number> {
    // Write private key to temporary file with secure permissions
    const keyPath = path.join(os.tmpdir(), `ssh-key-${configKey}`);
    await fs.writeFile(keyPath, config.sshPrivateKey, { mode: 0o600 });

    this.logger.log(
      `Creating SSH tunnel ${configKey}: ` +
      `${config.localPort} → ${config.sshHost}:${config.sshPort} → ${config.remoteHost}:${config.remotePort}`,
    );

    const sshArgs = [
      '-N',  // No command
      '-L', `${config.localPort}:${config.remoteHost}:${config.remotePort}`,
      '-o', 'StrictHostKeyChecking=accept-new',
      '-o', 'ServerAliveInterval=30',
      '-o', 'ServerAliveCountMax=3',
      '-o', 'ExitOnForwardFailure=yes',
      '-i', keyPath,
      '-p', config.sshPort.toString(),
      `${config.sshUser}@${config.sshHost}`,
    ];

    const sshProcess = spawn('ssh', sshArgs, {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    sshProcess.stdout?.on('data', (data) => {
      this.logger.debug(`[SSH ${configKey}] ${data.toString().trim()}`);
    });

    sshProcess.stderr?.on('data', (data) => {
      this.logger.warn(`[SSH ${configKey}] ${data.toString().trim()}`);
    });

    sshProcess.on('exit', (code, signal) => {
      this.logger.log(`SSH tunnel ${configKey} exited: code=${code}, signal=${signal}`);
      this.tunnels.delete(configKey);
      fs.unlink(keyPath).catch(() => {});  // Cleanup key file
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

    // Wait for tunnel to be ready
    await this.waitForTunnelReady(config.localPort, 10000);

    this.logger.log(`SSH tunnel ${configKey} is ready on port ${config.localPort}`);

    return config.localPort;
  }

  private async waitForTunnelReady(port: number, timeoutMs: number): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        // Try to connect to the tunneled port
        const response = await fetch(`http://localhost:${port}/api/v1/applications?limit=1`, {
          signal: AbortSignal.timeout(2000),
        });

        // 401 is OK (means SHS is responding, just needs auth)
        if (response.ok || response.status === 401) {
          return;
        }
      } catch {
        // Not ready yet
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    throw new Error(`SSH tunnel failed to establish within ${timeoutMs}ms`);
  }

  private async isHealthy(tunnel: SshTunnel, config: SshTunnelConfig): Promise<boolean> {
    // Check if process is still alive
    if (tunnel.process.killed || tunnel.process.exitCode !== null) {
      return false;
    }

    // Check if tunnel endpoint is responsive
    try {
      const response = await fetch(
        `http://localhost:${tunnel.localPort}/api/v1/applications?limit=1`,
        { signal: AbortSignal.timeout(2000) },
      );

      return response.ok || response.status === 401;
    } catch {
      return false;
    }
  }

  private terminateTunnel(tunnel: SshTunnel): void {
    if (!tunnel.process.killed) {
      tunnel.process.kill('SIGTERM');

      setTimeout(() => {
        if (!tunnel.process.killed) {
          this.logger.warn(`Force-killing SSH tunnel ${tunnel.configKey}`);
          tunnel.process.kill('SIGKILL');
        }
      }, 5000);
    }

    // Cleanup key file
    fs.unlink(tunnel.keyPath).catch(() => {});
  }

  private generateConfigKey(config: SshTunnelConfig): string {
    const canonical = JSON.stringify({
      sshHost: config.sshHost,
      sshPort: config.sshPort,
      sshUser: config.sshUser,
      remoteHost: config.remoteHost,
      remotePort: config.remotePort,
    });

    return crypto.createHash('sha256').update(canonical).digest('hex').substring(0, 16);
  }

  onModuleDestroy(): void {
    this.logger.log('Terminating all SSH tunnels');
    for (const tunnel of this.tunnels.values()) {
      this.terminateTunnel(tunnel);
    }
  }
}
```

**Implementation checklist:**
- [ ] Create SSH tunnel service
- [ ] Test with private SHS (VPN/bastion)
- [ ] Verify automatic reconnection
- [ ] Test key file cleanup
- [ ] Handle SSH auth failures gracefully

---

## Phase 2: Data Sources API & Quota System (Week 2)

### Milestone 2.1: Data Sources Controller

**File:** `backend/src/modules/datasources/datasources.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { DataSourcesController } from './datasources.controller';
import { DataSourcesService } from './datasources.service';
import { QuotaModule } from '../../common/quota/quota.module';
import { EncryptionModule } from '../../common/security/encryption.module';
import { SupabaseModule } from '../../common/supabase/supabase.module';
import { AuditModule } from '../../common/audit/audit.module';
import { McpProxyModule } from '../../integrations/mcp-proxy/mcp-proxy.module';

@Module({
  imports: [QuotaModule, EncryptionModule, SupabaseModule, AuditModule, McpProxyModule],
  controllers: [DataSourcesController],
  providers: [DataSourcesService],
  exports: [DataSourcesService],
})
export class DataSourcesModule {}
```

**File:** `backend/src/modules/datasources/datasources.controller.ts`

```typescript
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DataSourcesService } from './datasources.service';
import { CreateDataSourceDto, UpdateDataSourceDto, TestConnectionDto } from './dto';

@Controller('api/v1/datasources')
@UseGuards(JwtAuthGuard)
export class DataSourcesController {
  constructor(private readonly dataSourcesService: DataSourcesService) {}

  @Get()
  async list(@CurrentUser() user: any) {
    return this.dataSourcesService.list(user.id, user.orgId);
  }

  @Get(':id')
  async get(@CurrentUser() user: any, @Param('id') id: string) {
    return this.dataSourcesService.get(id, user.id);
  }

  @Post()
  async create(@CurrentUser() user: any, @Body() dto: CreateDataSourceDto) {
    return this.dataSourcesService.create(user.id, user.orgId, dto);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateDataSourceDto,
  ) {
    return this.dataSourcesService.update(id, user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@CurrentUser() user: any, @Param('id') id: string) {
    await this.dataSourcesService.delete(id, user.id);
  }

  @Post('test')
  async testConnection(@CurrentUser() user: any, @Body() dto: TestConnectionDto) {
    return this.dataSourcesService.testConnection(dto);
  }
}
```

**Implementation checklist:**
- [ ] Create DataSources module/controller/service
- [ ] Implement CRUD endpoints
- [ ] Add test connection endpoint
- [ ] Validate input DTOs
- [ ] Test with Postman/REST client

---

### Milestone 2.2: Quota Service

**File:** `backend/src/common/quota/quota.service.ts`

```typescript
import { Injectable, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

interface UserQuota {
  user_id: string;
  tier: 'free' | 'pro' | 'team' | 'enterprise';
  mcp_calls_this_month: number;
  mcp_calls_limit: number;
  concurrent_analyses_limit: number;
  datasources_max: number;
  retention_days: number;
}

@Injectable()
export class QuotaService {
  constructor(private readonly supabase: SupabaseService) {}

  async assertQuotaAvailable(userId: string): Promise<void> {
    const quota = await this.getUserQuota(userId);

    if (quota.mcp_calls_this_month >= quota.mcp_calls_limit) {
      throw new ForbiddenException(
        `Monthly quota exceeded (${quota.mcp_calls_limit} analyses). ` +
        `Upgrade to Pro for 500 analyses/month.`,
      );
    }
  }

  async incrementUsage(userId: string, mcpCalls: number = 1): Promise<void> {
    const { error } = await this.supabase.client
      .from('user_quotas')
      .update({
        mcp_calls_this_month: this.supabase.client.raw('mcp_calls_this_month + ?', [mcpCalls]),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to increment quota: ${error.message}`);
    }
  }

  async getUserQuota(userId: string): Promise<UserQuota> {
    const { data, error } = await this.supabase.client
      .from('user_quotas')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      // Create default quota if not exists
      return this.createDefaultQuota(userId);
    }

    return data;
  }

  private async createDefaultQuota(userId: string): Promise<UserQuota> {
    const defaultQuota = {
      user_id: userId,
      tier: 'free' as const,
      mcp_calls_limit: 50,
      concurrent_analyses_limit: 1,
      datasources_max: 1,
      retention_days: 7,
    };

    const { data, error } = await this.supabase.client
      .from('user_quotas')
      .insert(defaultQuota)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create default quota: ${error.message}`);
    }

    return { ...data, mcp_calls_this_month: 0 };
  }
}
```

**Implementation checklist:**
- [ ] Create QuotaService
- [ ] Test quota enforcement
- [ ] Test quota increment
- [ ] Handle quota reset (monthly)
- [ ] Add quota middleware/guard

---

## Phase 3: Integration with Historical Module (Week 3)

### Milestone 3.1: Update Historical Service

**File:** `backend/src/modules/historical/historical.service.ts` (modifications)

```typescript
// Add new imports
import { DataSourcesService } from '../datasources/datasources.service';
import { McpProxyService } from '../../integrations/mcp-proxy/mcp-proxy.service';
import { QuotaService } from '../../common/quota/quota.service';

@Injectable()
export class HistoricalService {
  constructor(
    // ... existing dependencies
    private readonly dataSourcesService: DataSourcesService,
    private readonly mcpProxyService: McpProxyService,
    private readonly quotaService: QuotaService,
  ) {}

  async analyze(userId: string, dto: AnalyzeDto) {
    // 1. Check quota BEFORE doing anything
    await this.quotaService.assertQuotaAvailable(userId);

    // 2. Load user's active data source
    const dataSource = await this.dataSourcesService.getActive(userId);

    if (!dataSource) {
      throw new NotFoundException(
        'No data source configured. Please connect your Spark History Server in Settings.',
      );
    }

    // 3. Route based on connection type
    if (dataSource.connection_type === 'gateway_shs') {
      return this.analyzeViaGateway(userId, dataSource, dto);
    } else if (dataSource.connection_type === 'external_mcp') {
      return this.analyzeViaExternalMcp(userId, dataSource, dto);
    }

    throw new Error(`Unknown connection type: ${dataSource.connection_type}`);
  }

  private async analyzeViaGateway(userId: string, dataSource: any, dto: AnalyzeDto) {
    // Decrypt SHS token
    const shsToken = await this.encryption.decryptToken(
      dataSource.shs_token_encrypted,
      dataSource.shs_token_kid,
    );

    // Build SHS config
    const shsConfig = {
      baseUrl: dataSource.shs_base_url,
      authScheme: dataSource.shs_auth_scheme,
      authToken: shsToken,
      authHeaderName: dataSource.shs_auth_header_name,
    };

    // Build tunnel config (if applicable)
    const tunnelConfig = dataSource.tunnel_config
      ? await this.buildTunnelConfig(dataSource.tunnel_config)
      : null;

    // Fetch evidence via MCP proxy (7 parallel calls)
    const evidence = await this.fetchEvidenceViaProxy(
      shsConfig,
      tunnelConfig,
      dto.appId,
      userId,
      dataSource.id,
    );

    // Increment quota (7 MCP calls)
    await this.quotaService.incrementUsage(userId, 7);

    // ... rest of analysis flow (heuristics, narrative, save)
  }

  private async analyzeViaExternalMcp(userId: string, dataSource: any, dto: AnalyzeDto) {
    // Decrypt MCP token
    const mcpToken = await this.encryption.decryptToken(
      dataSource.external_mcp_token_encrypted,
      dataSource.external_mcp_token_kid,
    );

    // Build MCP config
    const mcpConfig = {
      id: dataSource.id,
      mcpServerUrl: dataSource.external_mcp_url,
      authScheme: dataSource.external_mcp_auth_scheme,
      authToken: mcpToken,
    };

    // Use existing McpClientService
    const evidence = await this.fetchEvidenceViaExternalMcp(mcpConfig, dto.appId);

    // Increment quota (7 MCP calls)
    await this.quotaService.incrementUsage(userId, 7);

    // ... rest of analysis flow
  }

  private async fetchEvidenceViaProxy(
    shsConfig: any,
    tunnelConfig: any,
    appId: string,
    userId: string,
    datasourceId: string,
  ) {
    const [app, jobs, stages, executors, env, slow, sql] = await Promise.all([
      this.mcpProxyService.callTool(
        shsConfig,
        tunnelConfig,
        'get_application',
        { app_id: appId },
        userId,
        datasourceId,
      ),
      this.mcpProxyService.callTool(
        shsConfig,
        tunnelConfig,
        'list_jobs',
        { app_id: appId },
        userId,
        datasourceId,
      ),
      // ... (5 more calls)
    ]);

    return { application: app, jobs, stages, executors, environment: env, slowStages: slow, slowSql: sql };
  }

  private async buildTunnelConfig(tunnelConfigEncrypted: any) {
    // Decrypt SSH private key
    const sshPrivateKey = await this.encryption.decryptToken(
      tunnelConfigEncrypted.ssh_private_key_encrypted,
      tunnelConfigEncrypted.ssh_private_key_kid,
    );

    return {
      sshHost: tunnelConfigEncrypted.ssh_host,
      sshPort: tunnelConfigEncrypted.ssh_port,
      sshUser: tunnelConfigEncrypted.ssh_user,
      sshPrivateKey,
      remoteHost: tunnelConfigEncrypted.remote_host,
      remotePort: tunnelConfigEncrypted.remote_port,
      localPort: tunnelConfigEncrypted.local_port,
    };
  }
}
```

**Implementation checklist:**
- [ ] Update HistoricalService with routing logic
- [ ] Test gateway mode end-to-end
- [ ] Test external MCP mode end-to-end
- [ ] Verify quota enforcement
- [ ] Add integration tests

---

## Phase 4: Frontend UI (Week 3-4)

### Milestone 4.1: Data Sources Settings Page

**File:** `frontend/components/settings/DataSourcesPage.tsx`

```tsx
import React, { useState, useEffect } from 'react';
import { api } from '../../api';

export function DataSourcesPage() {
  const [dataSources, setDataSources] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    loadDataSources();
  }, []);

  const loadDataSources = async () => {
    const response = await api.get('/api/v1/datasources');
    setDataSources(response.data);
  };

  const handleAddDataSource = () => {
    setShowAddModal(true);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Data Sources</h1>
        <button
          onClick={handleAddDataSource}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + Add Data Source
        </button>
      </div>

      {dataSources.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed">
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No data sources configured
          </h3>
          <p className="text-gray-600 mb-4">
            Connect your Spark History Server to start analyzing jobs
          </p>
          <button
            onClick={handleAddDataSource}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Connect Spark History Server
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {dataSources.map((ds) => (
            <DataSourceCard key={ds.id} dataSource={ds} onUpdate={loadDataSources} />
          ))}
        </div>
      )}

      {showAddModal && (
        <AddDataSourceModal onClose={() => setShowAddModal(false)} onSuccess={loadDataSources} />
      )}
    </div>
  );
}

function DataSourceCard({ dataSource, onUpdate }) {
  const [showDetails, setShowDetails] = useState(false);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this data source?')) return;

    await api.delete(`/api/v1/datasources/${dataSource.id}`);
    onUpdate();
  };

  return (
    <div className="border rounded-lg p-4 bg-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${dataSource.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
          <div>
            <h3 className="font-medium">{dataSource.display_name}</h3>
            <p className="text-sm text-gray-600">
              {dataSource.connection_type === 'gateway_shs' ? (
                <>Hosted Gateway • {dataSource.shs_base_url}</>
              ) : (
                <>External MCP • {dataSource.external_mcp_url}</>
              )}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
          >
            {showDetails ? 'Hide' : 'Details'}
          </button>
          <button
            onClick={handleDelete}
            className="px-3 py-1 text-sm text-red-600 border border-red-600 rounded hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>

      {showDetails && (
        <div className="mt-4 pt-4 border-t text-sm text-gray-700">
          <dl className="grid grid-cols-2 gap-2">
            <dt className="font-medium">Connection Type:</dt>
            <dd>{dataSource.connection_type}</dd>

            <dt className="font-medium">Created:</dt>
            <dd>{new Date(dataSource.created_at).toLocaleDateString()}</dd>

            <dt className="font-medium">Last Validated:</dt>
            <dd>
              {dataSource.last_validated_at
                ? new Date(dataSource.last_validated_at).toLocaleString()
                : 'Never'}
            </dd>

            {dataSource.tunnel_config && (
              <>
                <dt className="font-medium">SSH Tunnel:</dt>
                <dd>
                  {dataSource.tunnel_config.ssh_user}@{dataSource.tunnel_config.ssh_host} →{' '}
                  {dataSource.tunnel_config.remote_host}:{dataSource.tunnel_config.remote_port}
                </dd>
              </>
            )}
          </dl>
        </div>
      )}
    </div>
  );
}
```

**Implementation checklist:**
- [ ] Create DataSources settings page
- [ ] Add form for creating SHS connection
- [ ] Add SSH tunnel configuration UI
- [ ] Test connection validation
- [ ] Show quota usage on page

---

## Summary: 4-Week Implementation Timeline

| Week | Milestone | Deliverables |
|------|-----------|-------------|
| **1** | Database + MCP Proxy Core | Migrations, McpProxyService, basic instance pooling |
| **2** | SSH Tunnels + Data Sources API | SshTunnelService, CRUD endpoints, quota service |
| **3** | Historical Integration | Update HistoricalService routing, E2E tests |
| **4** | Frontend UI | Settings page, onboarding flow, quota display |

---

## Testing Strategy

### Unit Tests
```typescript
// backend/src/integrations/mcp-proxy/mcp-proxy.service.spec.ts
describe('McpProxyService', () => {
  it('should reuse existing instance for same SHS config', async () => {
    // Test instance pooling
  });

  it('should spawn new instance for different auth token', async () => {
    // Test config key generation
  });

  it('should terminate idle instances after timeout', async () => {
    // Test cleanup
  });
});
```

### Integration Tests
```typescript
// backend/test/datasources.e2e-spec.ts
describe('DataSources (e2e)', () => {
  it('/POST datasources (gateway_shs)', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/datasources')
      .send({
        connection_type: 'gateway_shs',
        display_name: 'Test SHS',
        shs_base_url: 'http://localhost:18080',
        shs_auth_scheme: 'none',
      })
      .expect(201);

    expect(response.body.id).toBeDefined();
  });
});
```

---

## Deployment Checklist

### Environment Variables (Add to `.env`)
```bash
# MCP Proxy
MCP_INSTANCE_IDLE_TIMEOUT_MS=900000  # 15 minutes
MCP_PROXY_PORT_RANGE_MIN=9000
MCP_PROXY_PORT_RANGE_MAX=9999

# SSH Tunnels
ALLOW_SSH_TUNNELS=true
SSH_TUNNEL_TIMEOUT_MS=10000

# Quota
QUOTA_FREE_TIER_LIMIT=50
QUOTA_PRO_TIER_LIMIT=500
```

### Cloud Run Deployment
```yaml
# cloud-run/backend.yaml
spec:
  template:
    spec:
      containers:
      - image: gcr.io/brickoptima/backend:latest
        resources:
          limits:
            memory: 4Gi  # Increased for MCP instances
            cpu: "2"
        env:
        - name: MCP_INSTANCE_IDLE_TIMEOUT_MS
          value: "900000"
```

---

## Next Steps

1. **Start with Phase 1, Milestone 1.1**: Create database migration
2. **Run migration locally**: Test with mock users
3. **Implement MCP Proxy Service**: Get basic instance pooling working
4. **Add SSH Tunnel Support**: Test with private SHS
5. **Build Data Sources API**: CRUD + test connection
6. **Update Historical Module**: Add routing logic
7. **Create Frontend UI**: Settings page for data sources
8. **Deploy to staging**: Test end-to-end
9. **Launch MVP**: Enable for free tier users
10. **Iterate**: Add features based on feedback

Would you like me to start implementing any specific milestone?
