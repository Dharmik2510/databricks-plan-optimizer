# BrickOptima MCP Gateway Architecture

## Overview

The **BrickOptima MCP Gateway** is a hosted service that eliminates the need for users to deploy and manage their own MCP (Model Context Protocol) servers. Users simply connect their Spark History Server (SHS) credentials, and BrickOptima handles all MCP infrastructure, scaling, and operations.

## Key Benefits

### For Individual Users
- **Zero infrastructure**: No Docker, Kubernetes, or Cloud Run deployment needed
- **2-minute onboarding**: Just enter SHS URL + token in the UI
- **No ops burden**: BrickOptima handles updates, monitoring, security patches
- **Pay-as-you-go**: Freemium model with usage-based pricing

### For Organizations
- **Simplified deployment**: No MCP server to deploy/manage
- **Centralized security**: All credentials encrypted and managed by BrickOptima
- **Better observability**: Unified metrics, logging, audit trails
- **Cost optimization**: Shared infrastructure vs. dedicated MCP per org

### For BrickOptima
- **Monetization**: Control infrastructure, enable freemium tiers
- **Quality control**: Single version across all users, faster rollout of features
- **Operational excellence**: Centralized monitoring, scaling, incident response

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER'S INFRASTRUCTURE                             │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  Spark History Server (SHS)                                           │ │
│  │  • User-managed (Databricks, EMR, on-prem, etc.)                      │ │
│  │  • Must be internet-accessible OR tunneled                            │ │
│  │  • REST API: /api/v1/applications, /jobs, /stages, /executors         │ │
│  └─────────────────────────────┬─────────────────────────────────────────┘ │
│                                │                                             │
└────────────────────────────────┼─────────────────────────────────────────────┘
                                 │
                                 │ HTTP (secured with user's token)
                                 │
┌────────────────────────────────┼─────────────────────────────────────────────┐
│                                │                                             │
│                    BRICKOPTIMA PLATFORM (Hosted Gateway)                    │
│                                │                                             │
│  ┌─────────────────────────────▼───────────────────────────────────────┐   │
│  │  Frontend (React/Vite)                                              │   │
│  │                                                                     │   │
│  │  User Flow:                                                         │   │
│  │  1. Settings → "Connect Data Source"                               │   │
│  │  2. Form:                                                           │   │
│  │     - SHS URL: https://my-shs.company.com:18080                     │   │
│  │     - Auth: [None | Bearer Token | Basic Auth]                     │   │
│  │     - Token: ••••••••••••                                           │   │
│  │  3. Click "Test Connection" → validates SHS is reachable           │   │
│  │  4. Click "Save" → stores encrypted credentials                    │   │
│  │  5. Navigate to Historical → immediately run analysis              │   │
│  └─────────────────────────────┬───────────────────────────────────────┘   │
│                                │                                             │
│                                │ HTTPS                                       │
│                                ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Gateway API (NestJS)                                               │   │
│  │                                                                     │   │
│  │  POST /api/v1/datasources                                          │   │
│  │  ├─ Validate SHS URL (SSRF protection)                             │   │
│  │  ├─ Test connection to user's SHS                                  │   │
│  │  ├─ Encrypt token (envelope encryption with KMS)                   │   │
│  │  └─ Store in data_sources table (RLS: user_id)                     │   │
│  │                                                                     │   │
│  │  POST /api/v1/historical/analyze                                   │   │
│  │  ├─ Authenticate user (Supabase JWT)                               │   │
│  │  ├─ Load user's data_sources record                                │   │
│  │  ├─ Decrypt SHS token                                              │   │
│  │  ├─ Select MCP worker from pool (least-loaded)                     │   │
│  │  ├─ Call MCP with runtime config:                                  │   │
│  │  │  {                                                               │   │
│  │  │    toolName: "get_application",                                 │   │
│  │  │    args: { app_id: "spark-xyz" },                               │   │
│  │  │    __runtime_shs_config: {          // ✅ Injected per-request  │   │
│  │  │      baseUrl: "https://user-shs...",                            │   │
│  │  │      authHeaders: { "Authorization": "Bearer ..." }             │   │
│  │  │    }                                                             │   │
│  │  │  }                                                               │   │
│  │  ├─ Enforce user quota (free: 50/mo, pro: 500/mo)                  │   │
│  │  ├─ Store results in historical_analysis table                     │   │
│  │  └─ Audit log (action, user_id, datasource_id, latency)            │   │
│  └─────────────────────────────┬───────────────────────────────────────┘   │
│                                │                                             │
│                                │ Internal RPC/gRPC                           │
│                                ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Hosted MCP Pool (Kubernetes/Cloud Run)                            │   │
│  │                                                                     │   │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐          │   │
│  │  │ MCP Worker 1  │  │ MCP Worker 2  │  │ MCP Worker N  │          │   │
│  │  │               │  │               │  │               │          │   │
│  │  │ Stateless     │  │ Stateless     │  │ Stateless     │          │   │
│  │  │ Accepts:      │  │ Accepts:      │  │ Accepts:      │          │   │
│  │  │ - toolName    │  │ - toolName    │  │ - toolName    │          │   │
│  │  │ - args        │  │ - args        │  │ - args        │          │   │
│  │  │ - __runtime_  │  │ - __runtime_  │  │ - __runtime_  │          │   │
│  │  │   shs_config  │  │   shs_config  │  │   shs_config  │          │   │
│  │  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘          │   │
│  │          │                  │                  │                    │   │
│  │          └──────────────────┼──────────────────┘                    │   │
│  │                             │                                        │   │
│  │  Auto-scaling: 10-100 pods based on queue depth                    │   │
│  │  Deployment: Cloud Run (serverless) or GKE (reserved capacity)     │   │
│  │  Circuit breaker: Per-datasource failure tracking                  │   │
│  │  Observability: Prometheus metrics, Grafana dashboards             │   │
│  └─────────────────────────────┬───────────────────────────────────────┘   │
│                                │                                             │
│                                │ HTTP (to user's SHS)                        │
│                                │                                             │
└────────────────────────────────┼─────────────────────────────────────────────┘
                                 │
                                 ▼
                     (Routes to user's SHS endpoint)


┌─────────────────────────────────────────────────────────────────────────────┐
│                         DATA LAYER (Supabase)                               │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  data_sources (NEW - replaces org_connections for gateway mode)      │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │ │
│  │  │ id               uuid primary key                               │ │ │
│  │  │ created_at       timestamptz                                    │ │ │
│  │  │ user_id          uuid not null  [RLS: auth.uid()]               │ │ │
│  │  │ org_id           uuid null      [RLS: auth.jwt()->>'org_id']    │ │ │
│  │  │                                                                 │ │ │
│  │  │ -- SHS connection details (NOT MCP)                            │ │ │
│  │  │ shs_base_url         text not null                             │ │ │
│  │  │ shs_auth_scheme      text not null ('none'|'bearer'|'basic')   │ │ │
│  │  │ shs_auth_header_name text null                                 │ │ │
│  │  │ shs_token_encrypted  jsonb not null  -- Envelope encrypted     │ │ │
│  │  │ shs_token_kid        text not null   -- KMS key ID             │ │ │
│  │  │                                                                 │ │ │
│  │  │ -- Metadata                                                     │ │ │
│  │  │ is_active            boolean default true                      │ │ │
│  │  │ last_validated_at    timestamptz null                          │ │ │
│  │  │ validation_error     text null                                 │ │ │
│  │  │ display_name         text null  -- User-friendly label         │ │ │
│  │  └─────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                       │ │
│  │  RLS Policies:                                                        │ │
│  │  • Users can SELECT/INSERT/UPDATE/DELETE their own data_sources      │ │
│  │  • Org members can SELECT org-level data_sources                     │ │
│  │  • Only admins can INSERT/UPDATE/DELETE org-level data_sources       │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  historical_analysis (existing, unchanged)                            │ │
│  │  • id, user_id, mode, app_id_a, app_id_b                             │ │
│  │  • evidence_json, narrative_md, status, tags                          │ │
│  │  • RLS: user_id = auth.uid()                                          │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  audit_events (existing, enhanced)                                    │ │
│  │  • NEW: datasource_id tracked in metadata                             │ │
│  │  • action: 'datasource_created', 'datasource_validated', ...          │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  user_quotas (NEW - for freemium tiers)                               │ │
│  │  • user_id, tier ('free'|'pro'|'team'|'enterprise')                   │ │
│  │  • mcp_calls_this_month, mcp_calls_limit                              │ │
│  │  • concurrent_analyses_limit, datasources_max                         │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Request Flow: End-to-End

### 1. User Connects Data Source

```
┌──────────┐
│  User    │
└────┬─────┘
     │
     │ 1. Navigate to Settings → Data Sources → "Add SHS Connection"
     ▼
┌─────────────────────────────────────────────────────────────────┐
│  Frontend Form                                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ SHS URL: [https://my-databricks.cloud.databricks.com    ] │ │
│  │ Auth:    [● Bearer Token  ○ Basic Auth  ○ None          ] │ │
│  │ Token:   [••••••••••••••••••••••••••••••••••••••••••••••] │ │
│  │                                                           │ │
│  │ [Test Connection]  [Save]                                 │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  │ POST /api/v1/datasources
                  │ {
                  │   "shsBaseUrl": "https://my-databricks...",
                  │   "shsAuthScheme": "bearer",
                  │   "shsToken": "dapi123...",
                  │   "displayName": "Production Databricks"
                  │ }
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  Gateway API: DataSourcesController                             │
│                                                                 │
│  async createDataSource(userId, dto) {                          │
│    // 1. Validate URL (SSRF protection)                         │
│    await urlSafety.assertSafeUrl(dto.shsBaseUrl);              │
│                                                                 │
│    // 2. Test connection to user's SHS                          │
│    const testResult = await this.testShsConnection({           │
│      baseUrl: dto.shsBaseUrl,                                  │
│      authScheme: dto.shsAuthScheme,                            │
│      token: dto.shsToken                                       │
│    });                                                          │
│                                                                 │
│    if (!testResult.success) {                                  │
│      throw new BadRequestException(                            │
│        `Cannot connect to SHS: ${testResult.error}`            │
│      );                                                         │
│    }                                                            │
│                                                                 │
│    // 3. Encrypt token (envelope encryption)                   │
│    const { encrypted, kid } = await encryption.encryptToken(   │
│      dto.shsToken                                              │
│    );                                                           │
│                                                                 │
│    // 4. Store in Supabase with RLS                            │
│    const dataSource = await supabase                           │
│      .from('data_sources')                                     │
│      .insert({                                                 │
│        user_id: userId,                                        │
│        org_id: user.orgId || null,                             │
│        shs_base_url: dto.shsBaseUrl,                           │
│        shs_auth_scheme: dto.shsAuthScheme,                     │
│        shs_token_encrypted: encrypted,                         │
│        shs_token_kid: kid,                                     │
│        display_name: dto.displayName,                          │
│        is_active: true,                                        │
│        last_validated_at: new Date()                           │
│      })                                                         │
│      .select()                                                 │
│      .single();                                                │
│                                                                 │
│    // 5. Audit log                                             │
│    await audit.log({                                           │
│      action: 'datasource_created',                             │
│      userId,                                                   │
│      target: dataSource.id                                     │
│    });                                                          │
│                                                                 │
│    return dataSource;                                           │
│  }                                                              │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  Response: { id: "uuid", status: "connected" }                  │
│                                                                 │
│  Frontend shows: ✓ Successfully connected to Production SHS     │
└─────────────────────────────────────────────────────────────────┘
```

### 2. User Runs Historical Analysis

```
┌──────────┐
│  User    │
└────┬─────┘
     │
     │ 1. Navigate to Historical → "Analyze Run"
     │ 2. Enter appId: "spark-abc123"
     │ 3. Ask: "Why is stage 3 slow?"
     │ 4. Click "Analyze"
     ▼
┌─────────────────────────────────────────────────────────────────┐
│  Frontend                                                       │
│  POST /api/v1/historical/analyze                                │
│  {                                                              │
│    "appId": "spark-abc123",                                     │
│    "question": "Why is stage 3 slow?"                           │
│  }                                                              │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  │ HTTPS (JWT auth)
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  Gateway API: HistoricalController                              │
│                                                                 │
│  @UseGuards(JwtAuthGuard, QuotaGuard)                           │
│  async analyze(@CurrentUser() user, @Body() dto) {             │
│    // 1. Load user's data source                               │
│    const dataSource = await supabase                           │
│      .from('data_sources')                                     │
│      .select('*')                                              │
│      .eq('user_id', user.id)                                   │
│      .eq('is_active', true)                                    │
│      .order('created_at', { ascending: false })                │
│      .limit(1)                                                 │
│      .single();                                                │
│                                                                 │
│    if (!dataSource) {                                          │
│      throw new NotFoundException(                              │
│        'No data source configured. Please connect your SHS.'   │
│      );                                                         │
│    }                                                            │
│                                                                 │
│    // 2. Decrypt SHS token                                     │
│    const shsToken = await encryption.decryptToken(             │
│      dataSource.shs_token_encrypted,                           │
│      dataSource.shs_token_kid                                  │
│    );                                                           │
│                                                                 │
│    // 3. Build runtime SHS config                              │
│    const shsConfig = {                                         │
│      baseUrl: dataSource.shs_base_url,                         │
│      authHeaders: this.buildAuthHeaders(                       │
│        shsToken,                                               │
│        dataSource.shs_auth_scheme                              │
│      )                                                          │
│    };                                                           │
│                                                                 │
│    // 4. Create pending analysis record                        │
│    const analysis = await supabase                             │
│      .from('historical_analysis')                              │
│      .insert({                                                 │
│        user_id: user.id,                                       │
│        mode: 'single',                                         │
│        app_id_a: dto.appId,                                    │
│        user_question: dto.question,                            │
│        status: 'pending'                                       │
│      })                                                         │
│      .select()                                                 │
│      .single();                                                │
│                                                                 │
│    // 5. Fetch app data via hosted MCP pool                    │
│    const evidence = await this.gatewayMcp.analyzeApp({         │
│      appId: dto.appId,                                         │
│      shsConfig,  // ✅ User's SHS config passed to MCP         │
│      userId: user.id,                                          │
│      datasourceId: dataSource.id                               │
│    });                                                          │
│                                                                 │
│    // 6. Generate narrative, save results                      │
│    const narrative = await gemini.generateNarrative(evidence); │
│    await supabase                                              │
│      .from('historical_analysis')                              │
│      .update({                                                 │
│        status: 'complete',                                     │
│        evidence_json: evidence,                                │
│        narrative_md: narrative.narrative_md,                   │
│        tags: narrative.highlights                              │
│      })                                                         │
│      .eq('id', analysis.id);                                   │
│                                                                 │
│    // 7. Audit log                                             │
│    await audit.log({                                           │
│      action: 'historical_analysis_completed',                  │
│      userId: user.id,                                          │
│      target: analysis.id,                                      │
│      metadata: { datasourceId: dataSource.id }                 │
│    });                                                          │
│                                                                 │
│    return analysis;                                             │
│  }                                                              │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  │ Internal gRPC/HTTP
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  GatewayMcpService                                              │
│                                                                 │
│  async analyzeApp({ appId, shsConfig, userId, datasourceId }) {│
│    // 1. Check quota                                           │
│    await quotaService.assertQuotaAvailable(userId);            │
│                                                                 │
│    // 2. Select MCP worker from pool (least-loaded)            │
│    const worker = await mcpPool.getLeastLoadedWorker();       │
│                                                                 │
│    // 3. Call 7 MCP tools in parallel, injecting shsConfig    │
│    const [app, jobs, stages, executors, env, slow, sql] =     │
│      await Promise.all([                                       │
│        worker.callTool('get_application', {                    │
│          app_id: appId,                                        │
│          __runtime_shs_config: shsConfig  // ✅ Injected      │
│        }),                                                      │
│        worker.callTool('list_jobs', {                          │
│          app_id: appId,                                        │
│          __runtime_shs_config: shsConfig                       │
│        }),                                                      │
│        // ... (5 more calls)                                   │
│      ]);                                                        │
│                                                                 │
│    // 4. Increment quota usage                                 │
│    await quotaService.incrementUsage(userId, 7);               │
│                                                                 │
│    // 5. Build evidence JSON                                   │
│    return {                                                     │
│      application: app,                                         │
│      jobs,                                                      │
│      stages,                                                    │
│      executors,                                                 │
│      environment: env,                                          │
│      slowStages: slow,                                          │
│      slowSql: sql                                               │
│    };                                                           │
│  }                                                              │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  │ HTTP POST /mcp/ (internal)
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  MCP Worker Pod (Stateless)                                     │
│                                                                 │
│  Receives JSON-RPC request:                                     │
│  {                                                              │
│    "jsonrpc": "2.0",                                            │
│    "id": 1,                                                     │
│    "method": "tools/call",                                      │
│    "params": {                                                  │
│      "name": "get_application",                                 │
│      "arguments": {                                             │
│        "app_id": "spark-abc123",                                │
│        "__runtime_shs_config": {       // ✅ Runtime config    │
│          "baseUrl": "https://my-databricks...",                │
│          "authHeaders": {                                       │
│            "Authorization": "Bearer dapi123..."                 │
│          }                                                       │
│        }                                                         │
│      }                                                           │
│    }                                                             │
│  }                                                               │
│                                                                 │
│  Worker extracts __runtime_shs_config and uses it to call:     │
│  GET https://my-databricks.../api/v1/applications/spark-abc123 │
│  Headers: { Authorization: "Bearer dapi123..." }                │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  │ HTTP (to user's SHS)
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  User's Spark History Server                                    │
│  Returns: { id: "spark-abc123", attempts: [...], ... }          │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  │ Response flows back through MCP → Gateway → Frontend
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  Frontend displays analysis results                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Implementation Details

### 1. Modified MCP Server (Runtime Config)

The critical change: MCP workers must accept **runtime SHS configuration** instead of using environment variables.

**Current MCP Implementation (Static):**
```typescript
// ❌ Environment-based (current)
const SHS_BASE_URL = process.env.SHS_BASE_URL;
const SHS_AUTH_TOKEN = process.env.SHS_AUTH_TOKEN;

async function getApplication(args: { app_id: string }) {
  const response = await fetch(
    `${SHS_BASE_URL}/api/v1/applications/${args.app_id}`,
    {
      headers: {
        Authorization: `Bearer ${SHS_AUTH_TOKEN}`
      }
    }
  );
  return response.json();
}
```

**Gateway-Compatible MCP (Dynamic):**
```typescript
// ✅ Runtime config (gateway model)
interface ToolArgs {
  app_id: string;
  __runtime_shs_config?: {
    baseUrl: string;
    authHeaders: Record<string, string>;
  };
}

async function getApplication(args: ToolArgs) {
  // Use runtime config if provided, fallback to env for backward compat
  const shsBaseUrl = args.__runtime_shs_config?.baseUrl
    || process.env.SHS_BASE_URL;

  const headers = args.__runtime_shs_config?.authHeaders
    || { Authorization: `Bearer ${process.env.SHS_AUTH_TOKEN}` };

  const response = await fetch(
    `${shsBaseUrl}/api/v1/applications/${args.app_id}`,
    { headers }
  );

  return response.json();
}
```

### 2. Database Schema Changes

**New Table: `data_sources`**

```sql
create table data_sources (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null,
  org_id uuid null,  -- Null for individual users, set for org-level connections

  -- SHS connection details
  shs_base_url text not null,
  shs_auth_scheme text not null default 'bearer'
    check (shs_auth_scheme in ('none','bearer','basic','header')),
  shs_auth_header_name text null,
  shs_token_encrypted jsonb not null,  -- Envelope encrypted with KMS
  shs_token_kid text not null,

  -- Metadata
  display_name text null,
  is_active boolean not null default true,
  last_validated_at timestamptz null,
  validation_error text null,

  -- Unique constraint: one active datasource per user (or per user+org)
  constraint data_sources_user_unique unique (user_id, org_id)
);

-- RLS: Users can manage their own data sources
create policy "data_sources_select_own"
  on data_sources for select
  using (user_id = auth.uid() or org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy "data_sources_insert_own"
  on data_sources for insert
  with check (user_id = auth.uid());

create policy "data_sources_update_own"
  on data_sources for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Org-level data sources: only admins can create/modify
create policy "data_sources_org_admin_insert"
  on data_sources for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and (auth.jwt() ->> 'role') in ('ADMIN','SUPER_ADMIN')
  );
```

**New Table: `user_quotas`**

```sql
create table user_quotas (
  user_id uuid primary key references auth.users(id),
  tier text not null default 'free'
    check (tier in ('free','pro','team','enterprise')),

  -- Usage tracking
  mcp_calls_this_month int not null default 0,
  mcp_calls_reset_at timestamptz not null default date_trunc('month', now() + interval '1 month'),

  -- Tier limits
  mcp_calls_limit int not null default 50,  -- Free tier default
  concurrent_analyses_limit int not null default 1,
  datasources_max int not null default 1,
  retention_days int not null default 7
);

-- Function to reset monthly quotas
create or replace function reset_monthly_quotas()
returns void as $$
  update user_quotas
  set
    mcp_calls_this_month = 0,
    mcp_calls_reset_at = date_trunc('month', now() + interval '1 month')
  where mcp_calls_reset_at < now();
$$ language sql;

-- Cron job (via pg_cron or external scheduler)
-- select cron.schedule('reset-quotas', '0 0 1 * *', 'select reset_monthly_quotas()');
```

### 3. Quota Enforcement

```typescript
// backend/src/common/quota/quota.service.ts
@Injectable()
export class QuotaService {
  async assertQuotaAvailable(userId: string): Promise<void> {
    const quota = await this.supabase
      .from('user_quotas')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!quota) {
      // Create default quota for new users
      await this.createDefaultQuota(userId);
      return;
    }

    // Check if monthly reset needed
    if (new Date(quota.mcp_calls_reset_at) < new Date()) {
      await this.resetMonthlyQuota(userId);
      return;
    }

    // Check limit
    if (quota.mcp_calls_this_month >= quota.mcp_calls_limit) {
      throw new ForbiddenException(
        `Monthly quota exceeded (${quota.mcp_calls_limit} analyses). ` +
        `Upgrade to Pro for 500 analyses/month.`
      );
    }
  }

  async incrementUsage(userId: string, mcpCalls: number): Promise<void> {
    await this.supabase
      .from('user_quotas')
      .update({
        mcp_calls_this_month: this.supabase.raw('mcp_calls_this_month + ?', [mcpCalls])
      })
      .eq('user_id', userId);
  }

  private async createDefaultQuota(userId: string): Promise<void> {
    await this.supabase
      .from('user_quotas')
      .insert({
        user_id: userId,
        tier: 'free',
        mcp_calls_limit: 50,
        concurrent_analyses_limit: 1,
        datasources_max: 1,
        retention_days: 7
      });
  }
}
```

---

## Security Model

### Token Encryption

```typescript
// backend/src/common/security/encryption.service.ts
@Injectable()
export class EncryptionService {
  async encryptToken(plaintext: string): Promise<{ encrypted: any; kid: string }> {
    // Use Google Cloud KMS (preferred) or local AEAD
    if (this.config.get('KMS_KEY_NAME')) {
      const kmsClient = new KeyManagementServiceClient();
      const [result] = await kmsClient.encrypt({
        name: this.config.get('KMS_KEY_NAME'),
        plaintext: Buffer.from(plaintext, 'utf8')
      });

      return {
        encrypted: {
          ciphertext: result.ciphertext.toString('base64'),
          method: 'kms'
        },
        kid: this.config.get('KMS_KEY_NAME')
      };
    }

    // Fallback: local AEAD with Tink
    const aead = this.getLocalAead();
    const ciphertext = await aead.encrypt(
      Buffer.from(plaintext, 'utf8'),
      Buffer.from('') // empty AAD
    );

    return {
      encrypted: {
        ciphertext: ciphertext.toString('base64'),
        method: 'local'
      },
      kid: 'local-aead-key'
    };
  }

  async decryptToken(encrypted: any, kid: string): Promise<string> {
    if (encrypted.method === 'kms') {
      const kmsClient = new KeyManagementServiceClient();
      const [result] = await kmsClient.decrypt({
        name: kid,
        ciphertext: Buffer.from(encrypted.ciphertext, 'base64')
      });

      return result.plaintext.toString('utf8');
    }

    // Local AEAD
    const aead = this.getLocalAead();
    const plaintext = await aead.decrypt(
      Buffer.from(encrypted.ciphertext, 'base64'),
      Buffer.from('')
    );

    return plaintext.toString('utf8');
  }
}
```

### Multi-Tenant Isolation

**6 Layers of Isolation:**

1. **Database RLS**: `data_sources` table enforces `user_id = auth.uid()`
2. **JWT Authentication**: Gateway API validates Supabase JWT before every request
3. **Quota Enforcement**: Per-user limits prevent resource abuse
4. **Audit Logging**: Every MCP call tracked with `user_id + datasource_id`
5. **Runtime Config Injection**: MCP workers receive ONLY the current user's SHS config (no DB access)
6. **Network Policies**: MCP workers can't access Supabase or internal services

### SSRF Protection

```typescript
// backend/src/common/security/url-safety.service.ts
@Injectable()
export class UrlSafetyService {
  private readonly allowedHosts = new Set([
    'databricks.com',
    'cloud.databricks.com',
    'gcp.databricks.com',
    'azuredatabricks.net',
    // Customer domains must be explicitly allowed
  ]);

  async assertSafeUrl(url: string): Promise<void> {
    const parsed = new URL(url);

    // Block private IPs (unless explicitly allowed in config)
    if (!this.config.get('ALLOW_PRIVATE_IPS')) {
      const ip = await dns.lookup(parsed.hostname);
      if (isPrivateIp(ip.address)) {
        throw new BadRequestException(
          `Private IP addresses are not allowed: ${parsed.hostname}`
        );
      }
    }

    // Check allowlist (optional, for strict mode)
    if (this.config.get('SHS_URL_ALLOWLIST_ENABLED')) {
      const hostAllowed = Array.from(this.allowedHosts).some(
        allowed => parsed.hostname.endsWith(allowed)
      );

      if (!hostAllowed) {
        throw new BadRequestException(
          `SHS hostname not in allowlist: ${parsed.hostname}`
        );
      }
    }

    // Block localhost, metadata endpoints
    const blocked = ['localhost', '127.0.0.1', '169.254.169.254', '::1'];
    if (blocked.includes(parsed.hostname)) {
      throw new BadRequestException(`Blocked hostname: ${parsed.hostname}`);
    }
  }
}
```

---

## Freemium Business Model

### Pricing Tiers

| Tier | Price | MCP Calls | Data Sources | Retention | Features |
|------|-------|-----------|--------------|-----------|----------|
| **Free** | $0/mo | 50/month | 1 | 7 days | Basic analysis, single mode |
| **Pro** | $29/mo | 500/month | 3 | 90 days | Compare mode, API access |
| **Team** | $99/mo | 2,000/month | Unlimited | 1 year | SSO, shared connections, audit logs |
| **Enterprise** | Custom | Unlimited | Unlimited | Custom | Dedicated MCP pool, SLA, priority support |

### Quota Configuration

```typescript
const TIER_CONFIGS = {
  free: {
    mcpCallsLimit: 50,
    datasourcesMax: 1,
    concurrentAnalyses: 1,
    retentionDays: 7,
    features: ['single_analysis']
  },
  pro: {
    mcpCallsLimit: 500,
    datasourcesMax: 3,
    concurrentAnalyses: 3,
    retentionDays: 90,
    features: ['single_analysis', 'compare_analysis', 'api_access']
  },
  team: {
    mcpCallsLimit: 2000,
    datasourcesMax: 999,
    concurrentAnalyses: 10,
    retentionDays: 365,
    features: ['all', 'sso', 'shared_connections', 'audit_logs']
  },
  enterprise: {
    mcpCallsLimit: 999999,
    datasourcesMax: 999,
    concurrentAnalyses: 100,
    retentionDays: 730,
    features: ['all', 'dedicated_pool', 'sla', 'custom_integrations']
  }
};
```

---

## Migration Path

### Phase 1: Add Gateway Mode (Backward Compatible)

**Week 1-2:**
1. Create `data_sources` and `user_quotas` tables
2. Build `DataSourcesController` with CRUD endpoints
3. Add `GatewayMcpService` alongside existing `McpClientService`
4. Implement quota enforcement middleware
5. Deploy 3-5 MCP workers with runtime config support

**Testing:**
- Individual users can create data sources
- Quota limits enforced
- MCP calls work with runtime config

### Phase 2: Default New Users to Gateway

**Week 3:**
1. Update signup flow to show "Connect SHS" onboarding
2. Default new users to gateway mode
3. Add UI toggle: "Use hosted gateway (recommended)" vs "Use external MCP"
4. Update docs with gateway-first approach

**Testing:**
- New signups → gateway mode by default
- Existing users with `org_connections` → continue using external MCP
- Hybrid mode works (some users gateway, some external)

### Phase 3: Migrate Existing Users (Optional)

**Week 4+:**
1. Build migration wizard: "Switch to Hosted Gateway"
   - Extracts SHS URL from existing MCP server config
   - Guides user to enter SHS credentials directly
   - Validates connection, stores in `data_sources`
2. Email campaign to existing users with migration benefits
3. Deprecation timeline for external MCP mode (12 months)

---

## Comparison: Current vs Gateway

| Aspect | Current (External MCP) | Gateway (Proposed) |
|--------|------------------------|---------------------|
| **User onboarding** | Deploy MCP server (2-4 hours) | Enter SHS URL (2 minutes) |
| **Infrastructure cost** | User pays for MCP hosting | BrickOptima pays, monetizes via tiers |
| **Operational burden** | User manages updates, monitoring | Zero ops for users |
| **Individual users** | ❌ Can't use (no infrastructure) | ✅ First-class support |
| **Multi-tenancy** | Per-org MCP servers | Shared pool with dynamic config |
| **Scalability** | Each org scales independently | Auto-scale shared pool (10-100 pods) |
| **Security audit** | Must audit each org's MCP | Single deployment to audit |
| **Version control** | Each org on different versions | All users on latest version |
| **Monetization** | Limited (subscription only) | Freemium tiers + usage-based |
| **Observability** | Fragmented across orgs | Unified metrics & logs |
| **Enterprise option** | ✅ Full control | ✅ Can still use external MCP OR dedicated pool |

---

## Open Questions

### 1. SHS Accessibility

**Question**: Do you expect most users' SHS endpoints to be:
- **Publicly accessible** (e.g., Databricks Cloud URLs with token auth)
- **Private networks** (e.g., on-prem behind firewall)

**Impact**:
- If private, need to support **SSH tunnels** or **VPN connectors**
- Recommend: Start with public SHS only, add tunneling in Phase 2

### 2. MCP Server Modifications

**Question**: Are you willing to:
- **Fork** `kubeflow/mcp-apache-spark-history-server` and add runtime config?
- **Contribute upstream** to Kubeflow MCP project?
- **Build a wrapper/proxy** that injects runtime config?

**Recommendation**: Fork + contribute upstream. This is a valuable feature for the MCP ecosystem.

### 3. Hybrid Model

**Question**: Should enterprise orgs have the option to:
- **Use hosted gateway** (simpler)
- **Use external MCP** (more control)
- **Use dedicated MCP pool** (isolated infrastructure within BrickOptima)

**Recommendation**: Support all three:
- **Default**: Hosted gateway (80% of users)
- **Advanced**: External MCP (10% of users, enterprise with strict requirements)
- **Premium**: Dedicated pool (10% of users, enterprise with high volume)

### 4. Pricing Validation

**Question**: Does this pricing align with your target market?
- Free: 50 analyses/month
- Pro: $29 for 500 analyses/month ($0.058/analysis)
- Team: $99 for 2,000 analyses/month ($0.0495/analysis)

**Comparable Pricing:**
- Datadog APM: $31/host/month
- New Relic: $25/user/month + $0.30/GB ingested
- Your model is usage-based, which is more aligned with Spark use cases

---

## Recommendation Summary

**Implement the Gateway Model** with this prioritization:

### ✅ Must Have (Phase 1 - MVP)
1. `data_sources` table + CRUD API
2. Gateway MCP service with runtime config injection
3. Deploy 3-5 MCP worker pods (Cloud Run)
4. Quota enforcement (free tier: 50/mo)
5. Modified MCP server (fork Kubeflow MCP)

### 🎯 Should Have (Phase 2 - Production)
6. User onboarding flow (connect SHS wizard)
7. Freemium tier management (upgrade to Pro flow)
8. Monitoring & alerting (Prometheus + Grafana)
9. Rate limiting (per-user and global)
10. Audit logging enhancements

### 💡 Nice to Have (Phase 3 - Scale)
11. SSH tunnel support for private SHS
12. Dedicated MCP pools for enterprise tier
13. API access for programmatic usage
14. Comparison baselines (avg of last 10 runs)
15. Cost estimation per analysis

This gateway model is **significantly better** than the current approach for your use case. It removes friction for individual users, simplifies operations, and creates a clear monetization path. I recommend proceeding with Phase 1 implementation.

Would you like me to start implementing any specific component of this architecture?
