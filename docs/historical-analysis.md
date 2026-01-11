# Historical Job Analysis (Batch) - v1

## Table of Contents
- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Data Flow: Single Run Analysis](#data-flow-single-run-analysis)
- [MCP Protocol Communication](#mcp-protocol-communication)
  - [MCP Client Initialization Flow](#mcp-client-initialization-flow)
  - [MCP Tool Call Flow](#mcp-tool-call-flow)
  - [Authentication & Security](#authentication--security)
- [Data Flow: Compare Two Runs](#data-flow-compare-two-runs)
- [Architecture Components](#architecture-components)
- [MCP Tools Available](#mcp-tools-available)
- [Deterministic Heuristics](#deterministic-heuristics)
- [Prerequisites & Setup](#prerequisites--setup)
- [REST API Endpoints](#rest-api-endpoints)
- [Security & Validation](#security--validation)
- [Environment Variables](#environment-variables)
- [Key Features Summary](#key-features-summary)
- [Implementation Files Reference](#implementation-files-reference)

## Overview
Historical Job Analysis enables users to analyze a single completed Spark batch run or compare exactly two completed batch runs. The backend queries Spark History Server (SHS) through the Kubeflow MCP Spark History Server tools and stores evidence-backed analysis in Supabase.

**Key capabilities:**
- Single-run analysis (appId or appName + date range)
- Two-run comparison (exactly two appIds)
- Evidence-backed narrative and deterministic heuristics
- Saved history per user with search and filtering
- Optional natural language questions to guide analysis
- LLM-generated markdown narratives grounded in evidence

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│                            FRONTEND (React/Vite)                                │
│                      frontend/components/historical/                            │
│                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │  HistoricalPage.tsx                                                      │  │
│  │  • Analyze Run / Compare Runs Mode                                       │  │
│  │  • AppId or AppName + Date Range Search                                  │  │
│  │  • Optional User Question Input                                          │  │
│  │  • Progress Steps UI (4 stages)                                          │  │
│  │  • Results Display: Metrics, Heuristics, Narrative                       │  │
│  │  • History List with Search & Filtering                                  │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                   │                                             │
│                                   │ HTTP/REST                                   │
│                                   ▼                                             │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │
┌───────────────────────────────────┴─────────────────────────────────────────────┐
│                                                                                 │
│                          BACKEND (NestJS/TypeScript)                            │
│                      backend/src/modules/historical/                            │
│                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │  HistoricalController                                                    │  │
│  │  POST /api/v1/historical/analyze                                         │  │
│  │  POST /api/v1/historical/compare                                         │  │
│  │  GET  /api/v1/historical/history                                         │  │
│  │  GET  /api/v1/historical/runs                                            │  │
│  │  GET  /api/v1/historical/:id                                             │  │
│  │  PATCH /api/v1/historical/:id                                            │  │
│  └────────────────────────┬─────────────────────────────────────────────────┘  │
│                           │                                                     │
│                           ▼                                                     │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │  HistoricalService                                                       │  │
│  │  • Resolves AppId from appName + date range                              │  │
│  │  • Validates batch-only & completed jobs                                 │  │
│  │  • Orchestrates MCP calls                                                │  │
│  │  • Computes deterministic heuristics                                     │  │
│  │  • Generates LLM narrative via Gemini                                    │  │
│  │  • Saves to Supabase with RLS                                            │  │
│  └────────────┬──────────────────────────────────┬──────────────────────────┘  │
│               │                                   │                             │
│               │                                   │                             │
│               ▼                                   ▼                             │
│  ┌──────────────────────────┐      ┌──────────────────────────────────────┐    │
│  │  McpClientService        │      │  GeminiService                      │    │
│  │  (MCP Protocol Client)   │      │  • Generates narrative_md           │    │
│  │  • HTTP/SSE transport    │      │  • Extracts highlights              │    │
│  │  • Tool discovery        │      │  • Suggests action_items            │    │
│  │  • Validation & retry    │      │  • Evidence-grounded prompting      │    │
│  │  • Circuit breaker       │      └──────────────────────────────────────┘    │
│  └────────────┬─────────────┘                                                   │
│               │                                                                 │
│               │ MCP over HTTP/SSE                                               │
│               │ (POST /mcp/)                                                    │
└───────────────┴─────────────────────────────────────────────────────────────────┘
                │
                │
┌───────────────┴─────────────────────────────────────────────────────────────────┐
│                                                                                 │
│                    MCP SERVER (Kubeflow MCP for Spark History)                  │
│                        (External Service/Container)                             │
│                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │  MCP Protocol Server                                                     │  │
│  │  • Implements MCP 2024-11-05 protocol                                    │  │
│  │  • JSON-RPC 2.0 over HTTP + SSE                                          │  │
│  │  • Session management (mcp-session-id header)                            │  │
│  │                                                                          │  │
│  │  Available Tools:                                                        │  │
│  │  ├── list_applications(status, min_date, max_date, limit)                │  │
│  │  ├── get_application(app_id)                                             │  │
│  │  ├── list_jobs(app_id)                                                   │  │
│  │  ├── list_stages(app_id, with_summaries)                                 │  │
│  │  ├── get_executor_summary(app_id)                                        │  │
│  │  ├── get_environment(app_id)                                             │  │
│  │  ├── list_slowest_stages(app_id, n)                                      │  │
│  │  └── list_slowest_sql_queries(app_id, top_n, include_running)           │  │
│  └────────────────────────┬─────────────────────────────────────────────────┘  │
│                           │                                                     │
│                           │ REST API calls                                      │
│                           ▼                                                     │
└─────────────────────────────────────────────────────────────────────────────────┘
                            │
                            │
┌───────────────────────────┴─────────────────────────────────────────────────────┐
│                                                                                 │
│                      SPARK HISTORY SERVER (SHS)                                 │
│                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │  Spark REST API v1                                                       │  │
│  │  • /api/v1/applications                                                  │  │
│  │  • /api/v1/applications/{appId}                                          │  │
│  │  • /api/v1/applications/{appId}/jobs                                     │  │
│  │  • /api/v1/applications/{appId}/stages                                   │  │
│  │  • /api/v1/applications/{appId}/executors                                │  │
│  │  • /api/v1/applications/{appId}/environment                              │  │
│  └────────────────────────┬─────────────────────────────────────────────────┘  │
│                           │                                                     │
│                           │ Reads event logs                                    │
│                           ▼                                                     │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │  Spark Event Logs (S3/DBFS/GCS/HDFS)                                     │  │
│  │  • spark-events/                                                         │  │
│  │    ├── app-{timestamp}-0001                                              │  │
│  │    ├── app-{timestamp}-0002                                              │  │
│  │    └── ...                                                               │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│                          SUPABASE (PostgreSQL + RLS)                            │
│                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │  historical_analysis                                                     │  │
│  │  • id (uuid, PK)                                                         ���  │
│  │  • user_id (uuid) [RLS: auth.uid()]                                      │  │
│  │  • mode ('single' | 'compare')                                           │  │
│  │  • app_id_a, app_id_b                                                    │  │
│  │  • evidence_json (jsonb) - metrics, heuristics, summaries                │  │
│  │  • narrative_md (text) - LLM-generated markdown                          │  │
│  │  • status ('pending' | 'complete' | 'error')                             │  │
│  │  • tags (text[]) - highlights array                                      │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │  org_connections                                                         │  │
│  │  • id (uuid, PK)                                                         │  │
│  │  • org_id (uuid) [RLS: auth.jwt()->>'org_id']                            │  │
│  │  • type ('mcp_shs')                                                      │  │
│  │  • mcp_server_url (text)                                                 │  │
│  │  • auth_scheme ('none'|'bearer'|'basic'|'header')                        │  │
│  │  • token_encrypted (jsonb) - envelope encrypted with KMS                 │  │
│  │  • is_active (boolean)                                                   │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │  audit_events                                                            │  │
│  │  • id, created_at, org_id, user_id                                       │  │
│  │  • action ('historical_analysis_requested', ...)                         │  │
│  │  • target (analysis_id)                                                  │  │
│  │  • metadata (jsonb)                                                      │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow: Single Run Analysis

```
┌──────────┐
│  User    │
└────┬─────┘
     │ 1. POST /api/v1/historical/analyze
     │    { appId: "spark-xyz", question: "..." }
     ▼
┌─────────────────────────────────────────────────────────────────┐
│  HistoricalService                                              │
│                                                                 │
│  Step 1: Create pending record in Supabase                      │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ INSERT INTO historical_analysis                           │ │
│  │ (user_id, mode, app_id_a, status='pending')               │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Step 2: Get MCP connection config from org_connections         │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ SELECT * FROM org_connections                             │ │
│  │ WHERE org_id = ? AND is_active = true                     │ │
│  │                                                           │ │
│  │ Decrypt token_encrypted using KMS                         │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Step 3: Fetch application data via MCP (parallel)              │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ McpClient.callTool(connection, tools...)                  │ │
│  │  ├─ get_application(appId)                                │ │
│  │  ├─ list_jobs(appId)                                      │ │
│  │  ├─ list_stages(appId, with_summaries=true)               │ │
│  │  ├─ get_executor_summary(appId)                           │ │
│  │  ├─ get_environment(appId)                                │ │
│  │  ├─ list_slowest_stages(appId, n=5)                       │ │
│  │  └─ list_slowest_sql_queries(appId, top_n=5)              │ │
│  └──────────────┬────────────────────────────────────────────┘ │
│                 │                                               │
│                 ▼                                               │
│         MCP over HTTP                                           │
│                 │                                               │
└─────────────────┼───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  MCP Server                                                     │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Receives JSON-RPC 2.0 request:                            │ │
│  │ {                                                         │ │
│  │   "jsonrpc": "2.0",                                       │ │
│  │   "id": 1,                                                │ │
│  │   "method": "tools/call",                                 │ │
│  │   "params": {                                             │ │
│  │     "name": "get_application",                            │ │
│  │     "arguments": { "app_id": "spark-xyz" }               │ │
│  │   }                                                       │ │
│  │ }                                                         │ │
│  └──────────────┬────────────────────────────────────────────┘ │
│                 │                                               │
│                 ▼                                               │
│  Calls Spark History Server REST API                           │
│                 │                                               │
└─────────────────┼───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  Spark History Server                                           │
│  GET /api/v1/applications/spark-xyz                             │
│  GET /api/v1/applications/spark-xyz/jobs                        │
│  GET /api/v1/applications/spark-xyz/stages                      │
│  GET /api/v1/applications/spark-xyz/executors                   │
│  GET /api/v1/applications/spark-xyz/environment                 │
│  ...                                                            │
│                                                                 │
│  Returns JSON with stage metrics, executor stats, etc.          │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  │ Returns data
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  HistoricalService (continued)                                  │
│                                                                 │
│  Step 4: Validate constraints                                   │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ assertBatchOnly(environment)                              │ │
│  │ • Check spark.streaming.* properties absent              │ │
│  │                                                           │ │
│  │ assertCompleted(application)                              │ │
│  │ • Verify attempts[0].completed === true                   │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Step 5: Compute deterministic heuristics                       │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ buildSummaryMetrics()                                     │ │
│  │  • durationMs, shuffleReadBytes, shuffleWriteBytes        │ │
│  │  • spillBytes, gcTimeMs, executorCount                    │ │
│  │                                                           │ │
│  │ buildHeuristics()                                         │ │
│  │  • topSlowStages (top 3 by duration)                      │ │
│  │  • shuffleHeavyStages (top 3 by shuffle bytes)            │ │
│  │  • spillAnomalies (stages with spill > threshold)         │ │
│  │  • gcAnomaly (GC time > 10% of execution)                 │ │
│  │  • skewSuspicions (max task time >> median)               │ │
│  │  • failedTasks summary                                    │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Step 6: Generate LLM narrative                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ GeminiService.generateHistoricalNarrative()               │ │
│  │  Prompt: Evidence JSON + user question                    │ │
│  │  Returns:                                                 │ │
│  │   {                                                       │ │
│  │     narrative_md: "## Summary\n...",                      │ │
│  │     highlights: ["Stage 3 is slow", ...],                 │ │
│  │     action_items: ["Increase partitions", ...]            │ │
│  │   }                                                       │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Step 7: Save to Supabase                                       │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ UPDATE historical_analysis                                │ │
│  │ SET                                                       │ │
│  │   status = 'complete',                                    │ │
│  │   evidence_json = {...},                                  │ │
│  │   narrative_md = "...",                                   │ │
│  │   tags = highlights,                                      │ │
│  │   latency_ms = ?                                          │ │
│  │ WHERE id = ?                                              │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Step 8: Record audit event                                     │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ INSERT INTO audit_events                                  │ │
│  │ (org_id, user_id, action, target, metadata)               │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Return analysis result                                         │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  │ Response with evidence_json + narrative_md
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  Frontend                                                       │
│  • Display summary cards (duration, shuffle, spill, GC)         │
│  • Show bottlenecks (slow stages, shuffle heavy, spill)         │
│  • Render agent findings (markdown narrative)                   │
│  • Expandable evidence JSON                                     │
│  • Save to history list                                         │
└─────────────────────────────────────────────────────────────────┘
```

## MCP Protocol Communication

The system uses the **Model Context Protocol (MCP)** version **2024-11-05** to communicate with the Spark History Server tools. MCP is a JSON-RPC 2.0 based protocol that supports both HTTP and Server-Sent Events (SSE).

### MCP Client Initialization Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│  NestJS Backend Startup (OnModuleInit)                                 │
│                                                                         │
│  1. McpClientService.onModuleInit()                                     │
│     ├─ Read MCP_SERVER_URL from config                                 │
│     ├─ Validate URL safety (SSRF protection)                           │
│     └─ Create McpHttpClient instance                                   │
│                                                                         │
│  2. client.initialize()                                                 │
│     ├─ Send JSON-RPC request:                                          │
│     │  {                                                               │
│     │    "jsonrpc": "2.0",                                             │
│     │    "id": 1,                                                      │
│     │    "method": "initialize",                                       │
│     │    "params": {                                                   │
│     │      "protocolVersion": "2024-11-05",                            │
│     │      "capabilities": { "roots": { "listChanged": false } },      │
│     │      "clientInfo": {                                             │
│     │        "name": "brickoptima-historical",                         │
│     │        "version": "1.48.0"                                       │
│     │      }                                                           │
│     │    }                                                             │
│     │  }                                                               │
│     │                                                                  │
│     └─ MCP Server responds with serverInfo + capabilities              │
│                                                                         │
│  3. client.notify('notifications/initialized', {})                      │
│     └─ Completes handshake (no response expected)                      │
│                                                                         │
│  4. client.listTools()                                                  │
│     ├─ Send JSON-RPC request:                                          │
│     │  {                                                               │
│     │    "jsonrpc": "2.0",                                             │
│     │    "id": 2,                                                      │
│     │    "method": "tools/list",                                       │
│     │    "params": {}                                                  │
│     │  }                                                               │
│     │                                                                  │
│     └─ MCP Server returns array of tool definitions with schemas       │
│                                                                         │
│  5. Build tool map & cache client                                       │
│     └─ Ready to handle historical analysis requests                    │
└─────────────────────────────────────────────────────────────────────────┘
```

### MCP Tool Call Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Runtime: McpClientService.callTool()                                   │
│                                                                         │
│  1. Validate tool exists in discovered tools map                        │
│                                                                         │
│  2. Validate arguments against tool's JSON schema (Ajv)                 │
│                                                                         │
│  3. Check circuit breaker state (< threshold failures)                  │
│                                                                         │
│  4. Send tool call request with retry logic:                            │
│     POST {MCP_SERVER_URL}/mcp/                                          │
│     Headers:                                                            │
│       - Content-Type: application/json                                  │
│       - Accept: application/json, text/event-stream                     │
│       - Authorization: Bearer {token} (if auth_scheme=bearer)           │
│       - mcp-session-id: {sessionId} (if established)                    │
│       - mcp-protocol-version: 2024-11-05                                │
│                                                                         │
│     Body:                                                               │
│       {                                                                 │
│         "jsonrpc": "2.0",                                               │
│         "id": 3,                                                        │
│         "method": "tools/call",                                         │
│         "params": {                                                     │
│           "name": "get_application",                                    │
│           "arguments": { "app_id": "spark-xyz" }                        │
│         }                                                               │
│       }                                                                 │
│                                                                         │
│  5. MCP Server processes and responds:                                  │
│     • For JSON response:                                                │
│       {                                                                 │
│         "jsonrpc": "2.0",                                               │
│         "id": 3,                                                        │
│         "result": {                                                     │
│           "content": [                                                  │
│             {                                                           │
│               "type": "json",                                           │
│               "json": { ... SHS data ... }                              │
│             }                                                           │
│           ]                                                             │
│         }                                                               │
│       }                                                                 │
│                                                                         │
│     • For SSE response:                                                 │
│       data: {"jsonrpc":"2.0","id":3,"result":{...}}                     │
│                                                                         │
│  6. Extract result from content array (json or text type)               │
│                                                                         │
│  7. Update metrics: latency, status, circuit breaker state              │
│                                                                         │
│  8. Return typed result to caller                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

### Authentication & Security

```
┌─────────────────────────────────────────────────────────────────────────┐
│  org_connections table stores MCP connection config per organization    │
│                                                                         │
│  • mcp_server_url: The base URL of MCP server                           │
│  • auth_scheme: 'none' | 'bearer' | 'basic' | 'header'                  │
│  • token_encrypted: Encrypted token using envelope encryption           │
│  • token_kid: Key ID for decryption (KMS or local AEAD)                 │
│                                                                         │
│  When making MCP calls:                                                 │
│  1. Fetch active connection for user's org                              │
│  2. Decrypt token using EncryptionService                               │
│  3. Build auth headers based on scheme:                                 │
│     • bearer: Authorization: Bearer {token}                             │
│     • basic:  Authorization: Basic {base64(token)}                      │
│     • header: {auth_header_name}: {token}                               │
│     • none:   No auth headers                                           │
│                                                                         │
│  Security measures:                                                     │
│  • URL safety validation (SSRF protection via allowlist)                │
│  • Private IP blocking unless explicitly allowed                        │
│  • Token encryption at rest (AES-256-GCM)                               │
│  • Circuit breaker on repeated failures                                 │
│  • Request timeout (default 15s, configurable)                          │
│  • Retry with exponential backoff (default 2 attempts)                  │
└─────────────────────────────────────────────────────────────────────────┘
```

## Data Flow: Compare Two Runs

```
┌──────────┐
│  User    │
└────┬─────┘
     │ 1. POST /api/v1/historical/compare
     │    { appIdA: "spark-abc", appIdB: "spark-xyz", question: "..." }
     ▼
┌─────────────────────────────────────────────────────────────────┐
│  HistoricalService.compare()                                    │
│                                                                 │
│  Step 1: Validate inputs                                        │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ if (appIdA === appIdB) throw BadRequest                   │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Step 2: Create pending record                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ INSERT INTO historical_analysis                           │ │
│  │ (mode='compare', app_id_a, app_id_b, status='pending')    │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Step 3: Fetch both apps in parallel via MCP                    │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Promise.all([                                             │ │
│  │   fetchApplicationData(appIdA),  // 7 parallel MCP calls  │ │
│  │   fetchApplicationData(appIdB)   // 7 parallel MCP calls  │ │
│  │ ])                                                        │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Step 4: Validate both apps                                     │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ assertBatchOnly(dataA.environment)                        │ │
│  │ assertBatchOnly(dataB.environment)                        │ │
│  │ assertCompleted(dataA.application)                        │ │
│  │ assertCompleted(dataB.application)                        │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Step 5: Compute metrics & heuristics for both                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ summaryA = buildSummaryMetrics(dataA)                     │ │
│  │ summaryB = buildSummaryMetrics(dataB)                     │ │
│  │ heuristicsA = buildHeuristics(dataA)                      │ │
│  │ heuristicsB = buildHeuristics(dataB)                      │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Step 6: Build comparison deltas                                │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ comparison = {                                            │ │
│  │   appA: { name, summary: summaryA },                      │ │
│  │   appB: { name, summary: summaryB },                      │ │
│  │   deltas: {                                               │ │
│  │     durationMs: percentChange(A, B),                      │ │
│  │     shuffleReadBytes: percentChange(A, B),                │ │
│  │     shuffleWriteBytes: percentChange(A, B),               │ │
│  │     spillBytes: percentChange(A, B),                      │ │
│  │     gcTimeMs: percentChange(A, B)                         │ │
│  │   }                                                       │ │
│  │ }                                                         │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Step 7: Build evidence JSON                                    │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ evidence = {                                              │ │
│  │   mode: 'compare',                                        │ │
│  │   appA: { id, name, summary, heuristics, ... },          │ │
│  │   appB: { id, name, summary, heuristics, ... },          │ │
│  │   comparison: { appA, appB, deltas }                      │ │
│  │ }                                                         │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Step 8: Generate comparison narrative via Gemini               │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ narrative = generateNarrative({                           │ │
│  │   mode: 'compare',                                        │ │
│  │   evidence,                                               │ │
│  │   question                                                │ │
│  │ })                                                        │ │
│  │                                                           │ │
│  │ Returns:                                                  │ │
│  │ {                                                         │ │
│  │   narrative_md: "## Comparison\nRun B is 25% slower...",  │ │
│  │   highlights: ["Duration increased", "More spill", ...],  │ │
│  │   action_items: ["Check partition count", ...]           │ │
│  │ }                                                         │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Step 9: Save & audit                                           │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ UPDATE historical_analysis SET status='complete', ...     │ │
│  │ INSERT INTO audit_events ...                              │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Return comparison result                                       │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  Frontend                                                       │
│  • Display side-by-side run summaries                           │
│  • Show delta table with percent changes                        │
│  • Highlight regressions (red) vs improvements (green)          │
│  • Display bottlenecks for each run                             │
│  • Render comparison narrative                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Architecture Components

### Frontend Components
- **[HistoricalPage.tsx](../frontend/components/historical/HistoricalPage.tsx)**: Main UI component
  - Dual mode: Analyze single run vs Compare two runs
  - AppId input or AppName + date range search
  - Lists available runs from SHS
  - Progress indicator (4 steps)
  - Results display with metrics cards, heuristics, and narrative
  - History list with search and filtering

### Backend Modules

#### Historical Module ([backend/src/modules/historical](../backend/src/modules/historical))
- **HistoricalController**: REST API endpoints
- **HistoricalService**: Orchestration logic
  - App resolution from name + date range
  - MCP tool calls orchestration
  - Batch-only and completed job validation
  - Deterministic heuristics computation
  - LLM narrative generation
  - Supabase persistence with RLS
- **Heuristics Functions**: Deterministic analysis algorithms
  - Top slow stages by duration
  - Shuffle-heavy stages
  - Spill anomalies detection
  - GC anomaly detection (>10% of execution time)
  - Data skew suspicions (max task >> median)
  - Failed task/stage summarization

#### MCP Integration ([backend/src/integrations/mcp](../backend/src/integrations/mcp))
- **McpClientService**: Protocol client with lifecycle management
  - Tool discovery and caching
  - Argument validation against JSON schemas
  - Retry logic with exponential backoff
  - Circuit breaker pattern (5 failures → 30s cooldown)
  - Session management
- **McpHttpClient**: Low-level HTTP/SSE transport
  - JSON-RPC 2.0 message handling
  - Both JSON and SSE response parsing
  - Request/response correlation by ID
  - Session header management

### Database Schema

#### historical_analysis
```sql
create table historical_analysis (
  id uuid primary key,
  created_at timestamptz,
  user_id uuid not null,  -- RLS: auth.uid()
  mode text check (mode in ('single','compare')),
  app_id_a text not null,
  app_id_b text null,
  app_name text null,
  title text null,
  user_question text null,
  evidence_json jsonb not null,  -- All metrics & heuristics
  narrative_md text not null,    -- LLM-generated markdown
  status text check (status in ('pending','complete','error')),
  error text null,
  latency_ms int null,
  tags text[] null  -- highlights array
);
```

#### org_connections
```sql
create table org_connections (
  id uuid primary key,
  org_id uuid not null,  -- RLS: auth.jwt()->>'org_id'
  type text check (type in ('mcp_shs')),
  mcp_server_url text not null,
  auth_scheme text check (auth_scheme in ('none','bearer','basic','header')),
  token_encrypted jsonb not null,  -- Envelope encrypted
  token_kid text not null,         -- KMS key ID
  is_active boolean default true
);
```

#### audit_events
```sql
create table audit_events (
  id uuid primary key,
  created_at timestamptz,
  org_id uuid not null,
  user_id uuid not null,
  action text not null,  -- 'historical_analysis_requested', etc.
  target text not null,   -- analysis_id
  metadata jsonb null
);
```

## MCP Tools Available

The Kubeflow MCP server provides these Spark History Server tools:

| Tool | Arguments | Returns | Purpose |
|------|-----------|---------|---------|
| `list_applications` | status[], min_date, max_date, limit | Array of app summaries | Resolve appName to appId within date range |
| `get_application` | app_id | App details + attempts | Get app metadata and completion status |
| `list_jobs` | app_id | Array of jobs | Job-level metrics |
| `list_stages` | app_id, with_summaries | Array of stages | Stage-level metrics (duration, shuffle, spill) |
| `get_executor_summary` | app_id | Executor aggregates | Total shuffle, GC time, executor count |
| `get_environment` | app_id | Spark properties | Validate batch-only (no streaming props) |
| `list_slowest_stages` | app_id, n | Top N slow stages | Pre-computed slowest stages |
| `list_slowest_sql_queries` | app_id, top_n, include_running | Top N SQL queries | SQL-level bottlenecks (if available) |

## Deterministic Heuristics

The system computes evidence-backed heuristics before LLM narrative generation:

### Summary Metrics
- **durationMs**: Total application duration from first attempt
- **shuffleReadBytes/shuffleWriteBytes**: Total shuffle I/O from executor summary
- **spillBytes**: Sum of memory + disk spill across all stages
- **gcTimeMs**: Total garbage collection time across executors
- **executorCount/activeExecutors**: Executor utilization

### Bottleneck Detection
- **topSlowStages**: Top 3 stages by duration
- **shuffleHeavyStages**: Top 3 stages by shuffle read + write bytes
- **spillAnomalies**: Stages with spill > 1GB (configurable threshold)
- **gcAnomaly**: Flagged if GC time > 10% of total executor time
- **skewSuspicions**: Stages where max task duration >> median (>3x)
- **failedTasks**: Count of failed tasks and failed stages

### Comparison Deltas
For compare mode, percent change is computed:
```
delta = ((B - A) / A) * 100
```
Positive deltas (red) indicate regressions, negative (green) indicate improvements.

## Prerequisites & Setup

### Spark History Server (SHS) Requirements
- Spark event logs are persisted to durable storage (S3/DBFS/GCS/HDFS)
- Spark History Server is running and can read the event log location
- Applications must be completed batch jobs (streaming apps are rejected by validation)
- SHS must expose standard REST API v1 endpoints

### MCP Server Requirements
- Kubeflow MCP Server for Spark History Server deployed and accessible
- MCP server has network access to SHS (direct or via VPC connector)
- MCP server is reachable from backend (Cloud Run, K8s, etc.)
- Authentication configured (bearer, basic, custom header, or none)

### Backend Configuration
On application startup, the MCP client validates connectivity:
1. Reads `MCP_SERVER_URL` from environment
2. Validates URL safety (SSRF protection)
3. Initializes MCP client with protocol handshake
4. Discovers available tools via `tools/list`
5. Fails fast if MCP is unavailable (prevents degraded state)

## REST API Endpoints

All endpoints require JWT authentication via `JwtAuthGuard`.

### `POST /api/v1/historical/analyze`
Analyze a single Spark batch run.

**Request Body:**
```json
{
  "appId": "spark-abc123",           // Optional: direct appId
  "appName": "MySparkJob",           // Optional: search by name
  "startTime": "2024-01-01T00:00:00Z", // Required with appName
  "endTime": "2024-01-02T00:00:00Z",   // Required with appName
  "question": "Why is this job slow?" // Optional: user question
}
```

**Response:**
```json
{
  "id": "uuid",
  "mode": "single",
  "status": "complete",
  "app_id_a": "spark-abc123",
  "app_name": "MySparkJob",
  "evidence_json": { /* metrics, heuristics, summaries */ },
  "narrative_md": "## Summary\n...",
  "tags": ["Stage 3 is slow", "High shuffle"],
  "latency_ms": 3500,
  "created_at": "2024-01-10T..."
}
```

### `POST /api/v1/historical/compare`
Compare exactly two Spark batch runs.

**Request Body:**
```json
{
  "appIdA": "spark-abc123",
  "appIdB": "spark-xyz789",
  "question": "Why did performance regress?" // Optional
}
```

**Response:**
```json
{
  "id": "uuid",
  "mode": "compare",
  "status": "complete",
  "app_id_a": "spark-abc123",
  "app_id_b": "spark-xyz789",
  "evidence_json": {
    "appA": { /* metrics, heuristics */ },
    "appB": { /* metrics, heuristics */ },
    "comparison": {
      "deltas": {
        "durationMs": 25.3,
        "shuffleReadBytes": 15.7,
        "spillBytes": 50.2
      }
    }
  },
  "narrative_md": "## Comparison\n...",
  "latency_ms": 5200
}
```

### `GET /api/v1/historical/history`
List user's historical analyses with optional filtering.

**Query Parameters:**
- `search`: Filter by appName or appId (substring match)
- `mode`: Filter by mode (`single` | `compare` | `all`)
- `appName`: Filter by appName (ILIKE)
- `appId`: Filter by appIdA or appIdB (ILIKE)

**Response:** Array of analysis records

### `GET /api/v1/historical/runs`
List available runs from SHS for a given appName and date range.

**Query Parameters:**
- `appName`: Application name to search (required)
- `start`: Start date (ISO 8601)
- `end`: End date (ISO 8601)
- `limit`: Max results (default 50)

**Response:**
```json
[
  {
    "appId": "spark-abc123",
    "appName": "MySparkJob",
    "startTime": "2024-01-10T12:00:00Z",
    "endTime": "2024-01-10T12:15:00Z",
    "durationMs": 900000,
    "completed": true
  }
]
```

### `GET /api/v1/historical/:id`
Retrieve a specific analysis by ID.

### `PATCH /api/v1/historical/:id`
Update analysis title and tags.

**Request Body:**
```json
{
  "title": "Production Job Analysis",
  "tags": ["production", "regression"]
}
```

## Security & Validation

### Input Validation
- **AppId format**: Validated against regex pattern
- **Date range bounds**: Max range configurable (default 30 days, 90 for admins)
- **String length limits**: Max lengths enforced on all text fields
- **Mode validation**: Only `single` or `compare` allowed

### Application Constraints
- **Batch-only enforcement**: Detects streaming apps by checking for `spark.streaming.*` or `spark.sql.streaming.*` properties
- **Completed-only enforcement**: Verifies `attempts[0].completed === true`
- **Same-app prevention**: Compare mode rejects if `appIdA === appIdB`

### Rate Limiting
- **Per-user limits**: Configurable via `HISTORICAL_RATE_LIMIT_USER`
- **Per-org limits**: Configurable via `HISTORICAL_RATE_LIMIT_ORG`
- Applied via `HistoricalRateLimitGuard`

### MCP Security
- **SSRF protection**: URL allowlist + private IP blocking via `UrlSafetyService`
- **Token encryption**: Envelope encryption with KMS or local AEAD
  - Token stored as `token_encrypted` JSONB with `token_kid`
  - Decrypted on-demand per request
- **Circuit breaker**: 5 failures → 30s cooldown (prevents cascading failures)
- **Timeout controls**: Default 15s per MCP call, configurable
- **Retry logic**: Exponential backoff (2 attempts by default)

### Supabase Row-Level Security (RLS)
```sql
-- historical_analysis: Users can only access their own analyses
CREATE POLICY "historical_analysis_select_own"
  ON historical_analysis FOR SELECT
  USING (user_id = auth.uid());

-- org_connections: Users can access their org's connections
CREATE POLICY "org_connections_select_org"
  ON org_connections FOR SELECT
  USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

-- org_connections: Only admins can insert/update/delete
CREATE POLICY "org_connections_admin_insert"
  ON org_connections FOR INSERT
  WITH CHECK (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    AND (auth.jwt() ->> 'role') IN ('ADMIN', 'SUPER_ADMIN')
  );
```

### Data Sanitization
Evidence JSON is sanitized before storage:
- Remove keys containing: `token`, `authorization`, `auth`, `cookie`, `headers`
- Strip query parameters from URLs (keep path only)
- Prevents accidental secret leakage in stored evidence

### Audit Trail
All analysis requests are logged to `audit_events`:
- `action`: `historical_analysis_requested` or `historical_compare_requested`
- `target`: Analysis ID
- `metadata`: Mode, appIds, status, latency
- Immutable log for compliance and debugging

## Environment Variables

### Backend (NestJS)

**Supabase:**
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for RLS bypass (backend only)

**MCP Configuration:**
- `MCP_SERVER_URL`: MCP server base URL (required, validated on startup)
- `MCP_AUTH_SCHEME`: Auth scheme (`none` | `bearer` | `basic` | `header`, default: `bearer`)
- `MCP_AUTH_TOKEN`: Auth token for default MCP connection
- `MCP_AUTH_HEADER`: Custom header name for `header` auth scheme
- `MCP_PROTOCOL_VERSION`: MCP protocol version (default: `2024-11-05`)

**MCP Resilience:**
- `MCP_TIMEOUT_MS`: Request timeout in milliseconds (default: `15000`)
- `MCP_RETRY_ATTEMPTS`: Max retry attempts (default: `2`)
- `MCP_RETRY_BASE_MS`: Base delay for exponential backoff (default: `250`)
- `MCP_CIRCUIT_BREAKER_THRESHOLD`: Failures before circuit opens (default: `5`)
- `MCP_CIRCUIT_BREAKER_TIMEOUT_MS`: Circuit cooldown duration (default: `30000`)

**Historical Module:**
- `HISTORICAL_MAX_RANGE_DAYS`: Max date range for regular users (default: `30`)
- `HISTORICAL_MAX_RANGE_DAYS_ADMIN`: Max date range for admins (default: `90`)
- `HISTORICAL_RATE_LIMIT_USER`: Per-user rate limit
- `HISTORICAL_RATE_LIMIT_ORG`: Per-org rate limit

**Encryption:**
- `KMS_KEY_NAME`: Google Cloud KMS key name for token encryption (preferred)
- `TOKEN_ENCRYPTION_KEY`: Local AEAD key for token encryption (fallback)

**Gemini (for narrative generation):**
- `GEMINI_API_KEY`: Google AI API key
- `GEMINI_MODEL`: Model name (default: `gemini-1.5-flash`)

### Frontend (React/Vite)

- `VITE_API_URL`: Backend API base URL
- `VITE_SUPABASE_URL`: Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Supabase anonymous key (for RLS-protected client)

## Key Features Summary

### Evidence-Backed Analysis
- **Deterministic heuristics** computed from SHS data before LLM generation
- **Transparent evidence JSON** stored and displayed to users
- **Grounded narratives** that cite specific metrics from evidence

### Multi-Mode Analysis
- **Single run**: Analyze one completed batch job for bottlenecks
- **Compare runs**: Side-by-side comparison with percent deltas
- **User questions**: Optional natural language questions guide narrative focus

### Robust MCP Integration
- **Protocol-based**: Standard MCP 2024-11-05 JSON-RPC over HTTP/SSE
- **Resilient**: Retry logic, circuit breaker, timeout controls
- **Secure**: Encrypted tokens, SSRF protection, URL validation
- **Multi-tenant**: Per-org connections with admin-only management

### Comprehensive Security
- **Row-level security**: Supabase RLS enforces user/org isolation
- **Batch-only enforcement**: Rejects streaming applications
- **Rate limiting**: Per-user and per-org guards
- **Audit trail**: Immutable log of all analysis requests
- **Data sanitization**: Removes secrets from stored evidence

### User Experience
- **Fast search**: AppName + date range → list runs → select → analyze
- **Progress tracking**: 4-step progress indicator during analysis
- **Rich results**: Metrics cards, heuristics tables, LLM narrative, evidence JSON
- **Persistent history**: Searchable, filterable history of past analyses
- **Shareable**: Copy markdown report to clipboard

## Implementation Files Reference

### Frontend
- [HistoricalPage.tsx](../frontend/components/historical/HistoricalPage.tsx) - Main UI component
- [historical.ts](../frontend/api/historical.ts) - API client

### Backend
- [historical.controller.ts](../backend/src/modules/historical/historical.controller.ts) - REST endpoints
- [historical.service.ts](../backend/src/modules/historical/historical.service.ts) - Business logic
- [historical.heuristics.ts](../backend/src/modules/historical/historical.heuristics.ts) - Deterministic analysis
- [mcp-client.service.ts](../backend/src/integrations/mcp/mcp-client.service.ts) - MCP protocol client
- [mcp-http-client.ts](../backend/src/integrations/mcp/mcp-http-client.ts) - HTTP/SSE transport
- [gemini.service.ts](../backend/src/integrations/gemini/gemini.service.ts) - LLM narrative generation

### Database
- [20260208120000_historical_analysis.sql](../supabase/migrations/20260208120000_historical_analysis.sql) - Schema & RLS policies

### Documentation
- [historical-analysis.md](../docs/historical-analysis.md) - This document
- [security-cloudrun.md](../docs/security-cloudrun.md) - Cloud Run security considerations

---

**Version:** 1.0
**Last Updated:** 2026-01-10
**Status:** Production
