# Historical Analysis (Spark History)

## Feature Overview

Historical Analysis lets users analyze completed Spark batch runs, or compare two runs, using Spark History Server data. The backend pulls SHS metrics via MCP tools, computes deterministic heuristics, and generates an evidence-grounded narrative report stored in Supabase.

**Primary capabilities**
- Analyze a single run by `appId` or by resolving an app name + time range to the latest run.
- Compare exactly two runs by `appIdA` and `appIdB`.
- Run-level heuristics for skew, spills, shuffle-heavy stages, GC time, and failed tasks.
- Save results to history with searchable metadata.

Relevant code:
- UI: `frontend/components/historical/HistoricalPage.tsx`
- API client: `frontend/api/historical.ts`
- Controller: `backend/src/modules/historical/historical.controller.ts`
- Service + heuristics: `backend/src/modules/historical/historical.service.ts`, `backend/src/modules/historical/historical.heuristics.ts`

---

## UX and UI Flow

### Entry Point
- The feature is registered in `frontend/App.tsx` as a lazily loaded page.
- The UI supports two modes: `Analyze` (single run) and `Compare` (two runs).

### Connection Routing UI (MCP + Non-MCP)
- The Historical page now includes a **Connection Routing** panel:
  - Auto mode (recommended): datasource-first, then org MCP fallback
  - Explicit datasource mode: user selects a specific datasource ID
- The UI runs a preflight check (`GET /historical/access-status`) and disables Analyze/Compare when no valid route exists.
- Users can create credentials directly from Historical via **Add Connection**:
  - `Gateway SHS (No MCP)` for users without MCP
  - `External MCP` for users with their own MCP server
- Selected datasource is passed to:
  - `GET /historical/runs`
  - `POST /historical/analyze`
  - `POST /historical/compare`

### Access Status
`GET /historical/access-status?datasourceId=...`
- Returns:
  - `ready`: whether analysis can run now
  - resolved route metadata (`mode`, `selectedBy`, datasource info)
  - `message`: user-facing status or error guidance

### Analyze Mode (Single Run)
1. User enters:
   - `appId` **or** `appName + startTime + endTime`
   - Optional question
2. UI calls `POST /historical/analyze`.
3. UI shows simulated progress steps while the backend executes:
   - `Resolving app…`
   - `Fetching stages…`
   - `Computing diffs…`
   - `Writing findings…`
4. UI renders results:
   - Summary metrics
   - Heuristic findings (slow stages, shuffle/spill, skew)
   - Markdown narrative (LLM generated)

### Compare Mode (Two Runs)
1. User supplies a common `appName + date range` to fetch runs.
2. The run list is retrieved via `GET /historical/runs` and the user selects two runs.
3. UI calls `POST /historical/compare` with `appIdA` and `appIdB`.
4. UI renders side-by-side summaries and delta metrics.

### History Panel
- `GET /historical/history?search=...` loads saved results.
- Results show status, title, tags, and allow tag/title updates via `PATCH /historical/:id`.

---

## API Contracts

### Analyze
`POST /historical/analyze`
```json
{
  "appId": "spark-xyz",            // optional if appName+range provided
  "appName": "my-job",             // optional if appId provided
  "startTime": "2025-01-01T00:00:00Z",
  "endTime": "2025-01-02T00:00:00Z",
  "question": "Why was this run slow?", // optional
  "datasourceId": "uuid-optional"       // optional
}
```

Validations (`AnalyzeHistoricalDto`):
- `appId` must match `spark-<id>`.
- `appName` max 200 chars.
- `question` max 2000 chars.
- If `appId` is not provided, `appName + startTime + endTime` are required.

### Compare
`POST /historical/compare`
```json
{
  "appIdA": "spark-aaa",
  "appIdB": "spark-bbb",
  "question": "What changed between runs?",
  "datasourceId": "uuid-optional"
}
```

Validations (`CompareHistoricalDto`):
- `appIdA` and `appIdB` must be different.
- Both must match `spark-<id>`.

### Runs Lookup
`GET /historical/runs?appName=...&start=...&end=...&limit=50&datasourceId=...`
- Returns a list of completed runs (latest first).
- Used to resolve run IDs for selection.

### History
`GET /historical/history?search=...&mode=single|compare&appName=...&appId=...`
- Returns all saved records for the current user.

### Update
`PATCH /historical/:id`
```json
{
  "title": "January batch regression",
  "tags": ["regression", "shuffle"]
}
```

---

## Backend Processing Pipeline

### Analyze (Single Run)
1. **Quota check** (`QuotaService.assertQuotaAvailable`).
2. **Resolve `appId`**
   - If `appId` is provided, use it directly.
   - Otherwise, `list_applications` via MCP, filter by `appName`, and choose the latest run in the range.
3. **Create pending record** in `historical_analysis`.
4. **Fetch data** from SHS via MCP tools:
   - `get_application`, `list_jobs`, `list_stages`, `get_executor_summary`, `get_environment`, `list_slowest_stages`, `list_slowest_sql_queries`.
5. **Validate**
   - Reject streaming apps (checks `spark.streaming`/`spark.sql.streaming` properties).
   - Require completed attempts.
6. **Compute summary metrics**
   - Duration, shuffle read/write, spill bytes, GC time, executor counts.
7. **Compute heuristics**
   - Slowest stages, shuffle-heavy stages, spill anomalies, skew suspicions, failed tasks.
8. **Generate narrative** (Gemini) using evidence JSON.
   - If model fails, fallback narrative is produced.
9. **Persist result** with `status=complete` and audit event.
10. **Increment quota usage** on success.

### Compare (Two Runs)
- Executes steps similar to single-run for `appIdA` and `appIdB` in parallel.
- Computes a comparison object with percent deltas for duration, shuffle, spill, and GC time.
- Generates a narrative focused on deltas and comparative insights.

---

## Heuristics and Thresholds

Defined in `backend/src/modules/historical/historical.heuristics.ts`.

- **Top Slow Stages**: Top 3 stages by duration.
- **Shuffle-Heavy Stages**:
  - Threshold: 256 MB combined shuffle read + write.
  - Top 3 stages by shuffle size.
- **Spill Anomalies**:
  - Threshold: 128 MB combined memory + disk spill.
  - Top 3 stages by spill size.
- **GC Anomaly**:
  - Ratio = total GC time / total executor duration.
  - Reported if both values are present.
- **Skew Suspicions**:
  - Uses task duration distributions.
  - Flagged when `p95 / p50 >= 3`.
- **Failed Tasks Summary**:
  - Aggregates failed tasks, failed stages, failed jobs.

---

## Data Sources and MCP Routing

The service fetches SHS data via one of these routes:

1. **Org Connection (default)**
   - Uses `OrgConnectionsService` to load MCP connection configuration.
   - Tokens are decrypted by `EncryptionService`.
   - MCP client calls `list_applications`, `get_application`, `list_jobs`, etc.

2. **Datasource-based**
   - `gateway_shs`: goes through `McpProxyService` to reach SHS directly (optionally via SSH tunnel).
   - `external_mcp`: connects to a user-configured MCP server.

These routes share the same tool calls and normalization logic.

### Automatic Provider Resolution (Production Routing)

For each `analyze`, `compare`, and `runs` request:
1. If `datasourceId` is provided, use that datasource (strict selection).
2. Else, if the user has an active datasource, use it.
3. Else, fallback to legacy active org MCP connection.
4. If neither exists, return a configuration error with setup guidance.

Implementation:
- Resolver: `backend/src/modules/historical/historical-data-access-resolver.service.ts`
- Service integration: `backend/src/modules/historical/historical.service.ts`

This gives one production path for:
- users without MCP (Gateway SHS datasource)
- users with MCP (External MCP datasource or legacy org connection)

---

## Persistence Model

Stored in Supabase table `historical_analysis` (see `docs/historical-analysis.md` for schema details):
- `mode`: `single` or `compare`
- `app_id_a`, `app_id_b`
- `evidence_json`: structured evidence for metrics and heuristics
- `narrative_md`: LLM-generated markdown narrative
- `status`: `pending` | `complete` | `error`
- `tags`, `title`, `latency_ms`

Records are per-user (RLS enforced via `user_id`).

---

## Security, Validation, and Limits

- **Auth**: `JwtAuthGuard` required for all endpoints.
- **Rate limiting**: `HistoricalRateLimitGuard` enforces per-user and per-org limits.
- **Input validation**: `class-validator` DTOs enforce formats and size limits.
- **Date range limits**:
  - Maximum range comes from config:
    - `HISTORICAL_MAX_RANGE_DAYS`
    - `HISTORICAL_MAX_RANGE_DAYS_ADMIN`
- **Batch-only enforcement**:
  - Rejects streaming jobs by inspecting Spark properties.

---

## Observability and Auditing

- Prometheus histogram: `analysisLatencyMs` by mode and status.
- Audit events:
  - `historical_analysis_requested`
  - `historical_compare_requested`
- Structured logs contain:
  - appId/appName
  - latency timings
  - record status transitions

---

## Key Files

Frontend:
- `frontend/components/historical/HistoricalPage.tsx`
- `frontend/api/historical.ts`

Backend:
- `backend/src/modules/historical/historical.controller.ts`
- `backend/src/modules/historical/historical.service.ts`
- `backend/src/modules/historical/historical.heuristics.ts`
- `backend/src/modules/historical/historical-rate-limit.guard.ts`

Related Docs:
- `docs/historical-analysis.md`
