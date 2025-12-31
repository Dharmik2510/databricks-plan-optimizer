# LangGraph Architecture: DAG → Code Mapping System

## Executive Summary

This document describes the production architecture for mapping Databricks Spark physical plan DAG nodes to source code using LangGraph orchestration.

**System Type:** Asynchronous, stateful, agentic workflow
**Trigger:** User clicks "Map to Code" button
**Input:** Physical plan + DAG + GitHub repository URL
**Output:** Confidence-scored code mappings per DAG node

---

## Architecture Principles

### 1. Separation of Concerns
- **Retrieval** (embeddings): Find candidate code
- **Filtering** (AST): Remove structurally incompatible code
- **Reasoning** (LLM): Understand execution semantics and map to behavior

### 2. Production Requirements
✅ Asynchronous job execution (non-blocking)
✅ Parallel DAG node processing
✅ Persistent state (PostgreSQL checkpointer)
✅ Node-level retries with exponential backoff
✅ Confidence-scored results with alternatives
✅ Partial result streaming via WebSocket
✅ Private GitHub repository support
✅ Observable (structured logs + metrics)
✅ Cost-controlled (LLM call limits)

### 3. NOT a Prototype
- Real error handling (network failures, API rate limits, malformed code)
- Real security (credential rotation, input validation, sandboxed execution)
- Real scale (handles 1000+ DAG nodes, 100k+ LoC repos)

---

## System Flow

```
User clicks "Map to Code"
          ↓
    POST /api/agent/map-to-code
          ↓
    Create job_id → Return 202 Accepted
          ↓
    Trigger LangGraph (async)
          ↓
┌─────────────────────────────────────┐
│      LangGraph Execution            │
│                                     │
│  1. load_repo_context               │
│     ├─ Clone repo (GitHub API)      │
│     ├─ Parse AST (all files)        │
│     ├─ Generate embeddings (batch)  │
│     └─ Store in ChromaDB            │
│                                     │
│  2. FOR EACH DAG NODE (parallel):   │
│                                     │
│     plan_semantics_node             │
│     ├─ Extract operator type        │
│     ├─ Extract keys/functions       │
│     └─ Build semantic description   │
│              ↓                       │
│     embedding_retrieval_node        │
│     ├─ Embed semantic description   │
│     ├─ Query ChromaDB (top-K)       │
│     └─ Return candidates            │
│              ↓                       │
│     ast_filter_node                 │
│     ├─ Remove utility code          │
│     ├─ Remove dead code             │
│     ├─ Check structural match       │
│     └─ Return filtered candidates   │
│              ↓                       │
│     reasoning_agent_node            │
│     ├─ LLM compares semantics       │
│     ├─ Selects best mapping         │
│     └─ Generates explanation        │
│              ↓                       │
│     confidence_gate_node            │
│     ├─ Compute confidence score     │
│     └─ Branch: high/medium/low      │
│              ↓                       │
│     final_mapping_node              │
│     ├─ Persist to database          │
│     └─ Emit result                  │
│                                     │
│  3. Aggregate results               │
│     └─ Return all mappings          │
└─────────────────────────────────────┘
          ↓
    Update job status → "completed"
          ↓
    Frontend polls GET /api/agent/jobs/:id
          ↓
    Display mappings in UI
```

---

## LangGraph Node Specifications

### Node 1: `load_repo_context`

**Purpose:** Prepare repository for semantic search

**Inputs:**
- `repoUrl` (string)
- `repoCommitHash` (string | null)

**Outputs:**
- `repoContext`:
  ```typescript
  {
    clonePath: string;
    commitHash: string;
    fileCount: number;
    embeddingsGenerated: number;
    astIndexSize: number;
    cacheKey: string; // SHA-256(repoUrl + commitHash)
  }
  ```

**Logic:**
1. Check cache: If `repoContext` exists for this `cacheKey`, skip
2. Clone repository:
   - Public: `git clone <url>`
   - Private: Use `GITHUB_TOKEN` for authentication
   - Checkout specific commit if provided, else HEAD
3. Run AST parsing:
   - Scan all `.py`, `.scala`, `.java` files
   - Extract: functions, classes, methods, imports
   - Build call graph (function → called functions)
   - Store in `astIndex` (in-memory or Redis)
4. Generate embeddings:
   - For each code symbol (function/class):
     - Combine: signature + docstring + first 10 lines
     - Embed using OpenAI `text-embedding-3-small`
   - Batch embed (100 symbols/request) for cost efficiency
5. Store in ChromaDB:
   - Collection name: `code_embeddings_{repoHash}`
   - Metadata: `{ file, symbol, lines, type, complexity }`
6. Return `repoContext` with cache key

**Error Handling:**
- Git clone fails → Return error, mark job as failed
- AST parse fails on file → Log warning, skip file
- Embedding API rate limit → Exponential backoff + retry

**Caching Strategy:**
- Cache `repoContext` in Redis with TTL=7 days
- Key: `repo_cache:{cacheKey}`
- Invalidate on new commit detection

**Observability:**
- Metric: `repo_load_duration_seconds`
- Metric: `embeddings_generated_count`
- Metric: `ast_parse_failures_count`
- Log: Repo URL, commit hash, file count, duration

---

### Node 2: `plan_semantics_node`

**Purpose:** Extract execution semantics from DAG node

**Inputs:**
- `currentDagNode`:
  ```typescript
  {
    id: string;           // "stage_3"
    operator: string;     // "HashAggregate"
    keys: string[];       // ["customer_id"]
    aggregations: any[];  // [{ func: "count", col: "*" }]
    filters: any[];       // [{ col: "age", op: ">", val: 18 }]
    children: string[];   // ["stage_2"]
    physicalPlanFragment: string; // Raw Spark plan text
  }
  ```

**Outputs:**
- `semanticDescription`:
  ```typescript
  {
    dagNodeId: string;
    operatorType: string;
    executionBehavior: string; // Human-readable description
    dataTransformation: {
      inputSchema: string[];
      outputSchema: string[];
      keyColumns: string[];
      aggregateFunctions: string[];
      filterConditions: string[];
    };
    sparkOperatorSignature: string; // For embedding
  }
  ```

**Logic:**
1. Parse operator type:
   - Map Spark operator → execution behavior
   - Examples:
     - `HashAggregate` → "Groups data by keys and applies aggregate functions"
     - `Filter` → "Filters rows based on predicate"
     - `Sort` → "Sorts data by specified columns"
2. Extract data transformation:
   - Keys: Columns used for grouping/joining
   - Functions: Aggregate functions (count, sum, avg, etc.)
   - Filters: WHERE clause conditions
3. Build natural language description:
   ```
   "This operator groups data by customer_id and computes count(*)
    after filtering rows where age > 18"
   ```
4. Create embedding-friendly signature:
   ```
   "HashAggregate groupBy customer_id aggregateFunction count filter age greater than 18"
   ```

**Error Handling:**
- Unknown operator → Use generic description
- Missing keys → Log warning, proceed

**Observability:**
- Metric: `semantics_extraction_duration_ms`
- Log: DAG node ID, operator type, extracted semantics

---

### Node 3: `embedding_retrieval_node`

**Purpose:** Find code candidates using semantic similarity

**Inputs:**
- `semanticDescription`
- `repoContext`

**Outputs:**
- `retrievedCandidates`:
  ```typescript
  Array<{
    file: string;
    symbol: string;
    lines: string;
    embeddingScore: number;
    metadata: {
      type: "function" | "class" | "method";
      complexity: number;
      callGraph: string[];
    };
  }>
  ```

**Logic:**
1. Embed semantic description:
   - Use same model as repo embeddings (`text-embedding-3-small`)
   - Input: `semanticDescription.sparkOperatorSignature`
2. Query ChromaDB:
   - Collection: `code_embeddings_{repoHash}`
   - Query vector: Embedded semantic description
   - Top-K: 10 (configurable via `RETRIEVAL_TOP_K`)
   - Filter: `metadata.type IN ['function', 'method']` (exclude utility classes)
3. Re-rank by metadata:
   - Boost candidates with higher complexity (likely business logic)
   - Penalize utility functions (names like `utils`, `helpers`)
4. Return top-K candidates

**Error Handling:**
- ChromaDB unavailable → Retry 3x, then fail
- No candidates found → Return empty array (handled by confidence gate)

**Observability:**
- Metric: `retrieval_candidates_count`
- Metric: `retrieval_duration_ms`
- Metric: `chromadb_query_latency_ms`
- Log: Query vector, top-K, result count

**Cost Control:**
- Limit: Max 1 embedding call per DAG node
- Cache: Embed identical semantic descriptions once

---

### Node 4: `ast_filter_node`

**Purpose:** Remove structurally incompatible candidates using AST analysis

**Inputs:**
- `retrievedCandidates`
- `semanticDescription`
- `repoContext.astIndex`

**Outputs:**
- `filteredCandidates`:
  ```typescript
  Array<{
    file: string;
    symbol: string;
    lines: string;
    embeddingScore: number;
    astScore: number;
    astReasoning: string;
  }>
  ```

**Logic:**
1. For each candidate:
   - Load AST from `astIndex`
   - Check structural compatibility:

     **a. Operator-specific rules:**
     - `HashAggregate` → Must contain:
       - `groupBy()` or `groupByKey()`
       - Aggregate function call (`count`, `sum`, `avg`)
     - `Filter` → Must contain:
       - `filter()` or `where()`
       - Boolean predicate
     - `Join` → Must contain:
       - `join()`, `leftJoin()`, etc.
       - Key columns

     **b. Data flow analysis:**
     - Does function read from DataFrame/RDD?
     - Does function call `.agg()`, `.select()`, etc.?
     - Is function reachable from main job entry point?

     **c. Exclude patterns:**
     - Utility functions: `def _helper()`, `def log()`
     - Dead code: No callers in call graph
     - Test code: File path contains `test/` or `_test.py`

2. Assign AST compatibility score (0.0 - 1.0):
   - Full match (all rules pass): 1.0
   - Partial match (some rules pass): 0.5
   - No match: 0.0

3. Filter candidates:
   - Keep only `astScore >= 0.5`
   - Sort by: `(embeddingScore * 0.6) + (astScore * 0.4)`

**Error Handling:**
- AST parse error → Assign `astScore = 0.5` (neutral), log warning
- Missing symbol in AST index → Skip candidate

**Observability:**
- Metric: `ast_filter_input_count`
- Metric: `ast_filter_output_count`
- Metric: `ast_filter_reduction_ratio` (output/input)
- Log: Filtered symbols, exclusion reasons

**Performance:**
- Cache AST parsing results per file
- Parallel filter (use worker threads for large candidate sets)

---

### Node 5: `reasoning_agent_node`

**Purpose:** Use LLM to compare execution semantics vs code behavior and select best mapping

**Inputs:**
- `semanticDescription`
- `filteredCandidates` (top 3 only, to control cost)
- `currentDagNode.physicalPlanFragment`

**Outputs:**
- `finalMapping`:
  ```typescript
  {
    file: string;
    symbol: string;
    lines: string;
  }
  ```
- `explanation`: string (human-readable reasoning)
- `alternatives`: Array<{ file, symbol, reasoning }>

**Logic:**
1. Build LLM prompt:
   ```
   You are analyzing a Spark physical plan operator and must map it to source code.

   OPERATOR SEMANTICS:
   {semanticDescription.executionBehavior}

   PHYSICAL PLAN FRAGMENT:
   {physicalPlanFragment}

   CANDIDATE CODE:
   [For each candidate]
   File: {candidate.file}
   Function: {candidate.symbol}
   Code:
   ```
   {loadCodeSnippet(candidate.file, candidate.lines)}
   ```

   TASK:
   1. Compare the OPERATOR SEMANTICS to each CANDIDATE CODE
   2. Select the code that MOST LIKELY implements this operator's behavior
   3. Explain WHY this code matches the operator
   4. Provide alternative matches if multiple are plausible

   OUTPUT (JSON):
   {
     "bestMatch": {
       "file": "...",
       "symbol": "...",
       "reasoning": "..."
     },
     "alternatives": [
       { "file": "...", "symbol": "...", "reasoning": "..." }
     ]
   }
   ```

2. Call LLM:
   - Model: `gpt-4o` (reasoning capability required)
   - Temperature: 0.1 (deterministic)
   - Max tokens: 1000
   - Response format: JSON

3. Parse LLM response:
   - Extract `bestMatch` → `finalMapping`
   - Extract reasoning → `explanation`
   - Extract alternatives → `alternatives`

4. Validate output:
   - Ensure `bestMatch` is one of the input candidates
   - If LLM hallucinates → Default to top embedding candidate

**Error Handling:**
- LLM API timeout → Retry 2x with exponential backoff
- Invalid JSON response → Parse with lenient parser, log warning
- Rate limit → Queue request, retry after delay
- No match returned → Use top embedding candidate as fallback

**Observability:**
- Metric: `llm_reasoning_duration_ms`
- Metric: `llm_api_calls_count`
- Metric: `llm_token_usage` (prompt + completion)
- Metric: `llm_cost_usd` (calculated from token usage)
- Log: Prompt (truncated), response, selected mapping

**Cost Control:**
- Hard limit: Max 3 candidates per LLM call
- Budget limit: Fail job if cost exceeds $5/job
- Caching: Cache identical (semantics, candidates) pairs for 1 hour

---

### Node 6: `confidence_gate_node`

**Purpose:** Compute confidence score and branch workflow

**Inputs:**
- `finalMapping`
- `explanation`
- `alternatives`
- `filteredCandidates`
- `semanticDescription`

**Outputs:**
- `confidence`: number (0.0 - 1.0)
- Routing decision: `"high"` | `"medium"` | `"low"`

**Logic:**
1. Compute confidence score using weighted factors:

   ```typescript
   const embeddingScore = finalMapping.embeddingScore;
   const astScore = finalMapping.astScore;
   const llmConfidence = extractConfidenceFromExplanation(explanation);
   const alternativesPenalty = alternatives.length > 0 ? 0.1 : 0.0;
   const keywordMatch = checkKeywordOverlap(semanticDescription, explanation);

   const confidence = (
     embeddingScore * 0.3 +
     astScore * 0.2 +
     llmConfidence * 0.4 +
     keywordMatch * 0.1 -
     alternativesPenalty
   );
   ```

2. Extract LLM confidence:
   - Parse explanation for confidence indicators:
     - "definitely", "clearly" → 0.9
     - "likely", "probably" → 0.7
     - "possibly", "might" → 0.5
     - "unsure", "unclear" → 0.3

3. Keyword matching:
   - Extract keywords from semantic description (e.g., "groupBy", "count")
   - Check if present in mapped code
   - Score: `matchedKeywords / totalKeywords`

4. Branching logic:
   - `confidence >= 0.8` → `"high"` → Finalize immediately
   - `0.5 <= confidence < 0.8` → `"medium"` → Include alternatives
   - `confidence < 0.5` → `"low"` → Mark as unresolved

**Error Handling:**
- Invalid confidence value → Default to 0.5 (medium)

**Observability:**
- Metric: `confidence_score_distribution` (histogram)
- Metric: `high_confidence_ratio` (count high / total)
- Log: Confidence breakdown, routing decision

**Output Format:**
```typescript
{
  confidence: 0.87,
  routing: "high",
  factors: {
    embeddingScore: 0.92,
    astScore: 0.85,
    llmConfidence: 0.90,
    keywordMatch: 0.80,
  }
}
```

---

### Node 7: `final_mapping_node`

**Purpose:** Persist results and emit UI-friendly output

**Inputs:**
- All state fields

**Outputs:**
- `completedMappings[]` (appended)
- Side effect: Update database

**Logic:**
1. Build output schema:
   ```typescript
   const output = {
     dagNodeId: currentDagNode.id,
     mappedCode: {
       file: finalMapping.file,
       symbol: finalMapping.symbol,
       lines: finalMapping.lines,
     },
     confidence: confidence,
     explanation: explanation,
     alternatives: alternatives.map(alt => ({
       file: alt.file,
       symbol: alt.symbol,
       reasoning: alt.reasoning,
     })),
     metadata: {
       operatorType: semanticDescription.operatorType,
       embeddingScore: finalMapping.embeddingScore,
       astScore: finalMapping.astScore,
       processedAt: new Date().toISOString(),
     },
   };
   ```

2. Persist to database:
   ```sql
   INSERT INTO code_mappings (
     job_id, dag_node_id, file, symbol, lines,
     confidence, explanation, alternatives, metadata
   ) VALUES (...);
   ```

3. Append to state:
   ```typescript
   return {
     completedMappings: [...state.completedMappings, output],
   };
   ```

4. Emit event (for streaming):
   ```typescript
   eventEmitter.emit('mapping_completed', {
     jobId: state.jobId,
     dagNodeId: currentDagNode.id,
     result: output,
   });
   ```

**Error Handling:**
- Database insert fails → Retry 3x, then log error and continue
- Invalid output schema → Log validation errors, use fallback values

**Observability:**
- Metric: `mappings_completed_count`
- Metric: `mappings_persisted_count`
- Log: Mapping summary, database insert status

---

## State Schema (Complete)

See [state/mapping-state.schema.ts](./langgraph/state/mapping-state.schema.ts) for full TypeScript definition.

**Key State Fields:**

```typescript
{
  // Job metadata
  jobId: string;
  repoUrl: string;
  repoCommitHash: string | null;
  analysisId: string;

  // Repo context (cached)
  repoContext: {
    clonePath: string;
    commitHash: string;
    cacheKey: string;
    embeddings: any[];
    astIndex: any;
  } | null;

  // DAG processing
  dagNodes: Array<DagNode>;
  currentNodeIndex: number;
  currentDagNode: DagNode | null;

  // Pipeline state
  semanticDescription: SemanticDescription | null;
  retrievedCandidates: Candidate[];
  filteredCandidates: Candidate[];

  // Results
  finalMapping: CodeMapping | null;
  confidence: number;
  explanation: string;
  alternatives: Alternative[];

  // Aggregated results
  completedMappings: MappingOutput[];

  // Job state
  status: "pending" | "running" | "completed" | "failed";
  error: string | null;
  startTime: Date;
  endTime: Date | null;
}
```

**State Version:** `v1` (for future migrations)

---

## Execution Flow Example

### Scenario: User maps a 3-node DAG

**Input:**
```json
{
  "repoUrl": "https://github.com/acme/spark-jobs",
  "commitHash": "abc123",
  "dagNodes": [
    {
      "id": "stage_1",
      "operator": "Filter",
      "filters": [{ "col": "age", "op": ">", "val": 18 }]
    },
    {
      "id": "stage_2",
      "operator": "HashAggregate",
      "keys": ["customer_id"],
      "aggregations": [{ "func": "count" }]
    },
    {
      "id": "stage_3",
      "operator": "Sort",
      "sortColumns": ["count_desc"]
    }
  ]
}
```

**Execution Timeline:**

```
T+0s:    POST /api/agent/map-to-code
         → jobId: "job_xyz789"
         → Status: 202 Accepted

T+1s:    Node: load_repo_context
         → Clone repo
         → Parse 1,200 Python files
         → Generate 5,400 embeddings
         → Store in ChromaDB
         → Duration: 45s

T+46s:   Process DAG nodes in parallel (max 3 concurrent)

         ┌─ stage_1 ────────────────────┐
         │ plan_semantics: 0.2s         │
         │ embedding_retrieval: 0.5s    │
         │ ast_filter: 1.2s             │
         │ reasoning_agent: 3.1s        │
         │ confidence_gate: 0.1s        │
         │   → confidence: 0.92 (high)  │
         │ final_mapping: 0.3s          │
         │ TOTAL: 5.4s                  │
         └──────────────────────────────┘

         ┌─ stage_2 ────────────────────┐
         │ plan_semantics: 0.2s         │
         │ embedding_retrieval: 0.5s    │
         │ ast_filter: 1.1s             │
         │ reasoning_agent: 3.3s        │
         │ confidence_gate: 0.1s        │
         │   → confidence: 0.78 (medium)│
         │ final_mapping: 0.3s          │
         │ TOTAL: 5.5s                  │
         └──────────────────────────────┘

         ┌─ stage_3 ────────────────────┐
         │ plan_semantics: 0.2s         │
         │ embedding_retrieval: 0.5s    │
         │ ast_filter: 0.9s             │
         │ reasoning_agent: 3.0s        │
         │ confidence_gate: 0.1s        │
         │   → confidence: 0.45 (low)   │
         │ final_mapping: 0.3s          │
         │ TOTAL: 5.0s                  │
         └──────────────────────────────┘

T+51s:   All nodes completed
         → Status: "completed"

T+52s:   Frontend polls: GET /api/agent/jobs/job_xyz789
         → Returns 3 mappings
```

**Output:**
```json
{
  "jobId": "job_xyz789",
  "status": "completed",
  "results": [
    {
      "dagNodeId": "stage_1",
      "mappedCode": {
        "file": "src/etl/customer_filter.py",
        "symbol": "filter_adult_customers",
        "lines": "23-28"
      },
      "confidence": 0.92,
      "explanation": "This function filters customers where age > 18, matching the Filter operator semantics.",
      "alternatives": []
    },
    {
      "dagNodeId": "stage_2",
      "mappedCode": {
        "file": "src/etl/customer_aggregation.py",
        "symbol": "count_by_customer",
        "lines": "45-67"
      },
      "confidence": 0.78,
      "explanation": "This function groups by customer_id and computes count, matching HashAggregate behavior.",
      "alternatives": [
        {
          "file": "src/etl/legacy/customer_stats.py",
          "symbol": "aggregate_customers",
          "reasoning": "Similar groupBy logic but includes additional metrics not in operator"
        }
      ]
    },
    {
      "dagNodeId": "stage_3",
      "mappedCode": {
        "file": "src/etl/customer_aggregation.py",
        "symbol": "count_by_customer",
        "lines": "65-67"
      },
      "confidence": 0.45,
      "explanation": "Sort operation is embedded within the aggregation function, but exact column unclear.",
      "alternatives": []
    }
  ]
}
```

---

## Production Hardening

### 1. Retry Strategy (Node-Level)

```typescript
const retryableNodes = [
  "load_repo_context",      // Network failures
  "embedding_retrieval",    // ChromaDB timeouts
  "reasoning_agent",        // LLM rate limits
];

const retryConfig = {
  maxRetries: 3,
  backoff: "exponential", // 1s, 2s, 4s
  retryableErrors: [
    "ECONNREFUSED",
    "ETIMEDOUT",
    "RateLimitError",
    "ChromaDBError",
  ],
};
```

### 2. Timeout Handling

```typescript
const nodeTimeouts = {
  load_repo_context: 300_000,      // 5 min (large repos)
  plan_semantics: 5_000,           // 5 sec
  embedding_retrieval: 30_000,     // 30 sec
  ast_filter: 60_000,              // 1 min
  reasoning_agent: 120_000,        // 2 min (LLM calls)
  confidence_gate: 5_000,          // 5 sec
  final_mapping: 10_000,           // 10 sec
};
```

### 3. Cost Control

```typescript
// Per-job limits
const MAX_LLM_CALLS = 100;           // Max DAG nodes
const MAX_EMBEDDING_CALLS = 1;        // Per repo (cached)
const MAX_JOB_COST_USD = 5.00;

// Track costs
let jobCost = 0;
jobCost += embeddingCalls * 0.00002;  // $0.02/1M tokens
jobCost += llmCalls * 0.015;          // $0.015/1K tokens (GPT-4)

if (jobCost > MAX_JOB_COST_USD) {
  throw new Error("Job cost limit exceeded");
}
```

### 4. Security (Private Repos)

```typescript
// GitHub token validation
const validateGitHubToken = async (token: string) => {
  const response = await fetch("https://api.github.com/user", {
    headers: { Authorization: `token ${token}` },
  });
  if (!response.ok) throw new Error("Invalid GitHub token");
};

// Clone with credentials
const clonePrivateRepo = async (url: string, token: string) => {
  const authUrl = url.replace(
    "https://",
    `https://x-access-token:${token}@`
  );
  await exec(`git clone ${authUrl} /tmp/repo`);
};

// Cleanup
process.on("exit", () => {
  exec("rm -rf /tmp/repo"); // Remove cloned repo
});
```

### 5. Observability (Structured Logging)

```typescript
// Example log entry
logger.info("node_execution_completed", {
  jobId: "job_xyz",
  nodeName: "reasoning_agent",
  dagNodeId: "stage_2",
  duration_ms: 3100,
  confidence: 0.78,
  llm_tokens: 1250,
  cost_usd: 0.019,
  success: true,
});
```

### 6. Metrics (Prometheus-compatible)

```typescript
// Counter
metrics.increment("langgraph_node_executions_total", {
  node: "reasoning_agent",
  status: "success",
});

// Histogram
metrics.histogram("langgraph_node_duration_seconds", duration, {
  node: "reasoning_agent",
});

// Gauge
metrics.gauge("langgraph_active_jobs", activeJobCount);
```

### 7. Partial Result Streaming (WebSocket)

```typescript
// Backend
eventEmitter.on("mapping_completed", (result) => {
  io.to(result.jobId).emit("partial_result", result);
});

// Frontend
socket.on("partial_result", (result) => {
  updateUI(result.dagNodeId, result);
});
```

---

## API Endpoints

### 1. Create Mapping Job

```http
POST /api/agent/map-to-code
Content-Type: application/json

{
  "analysisId": "analysis_123",
  "repoUrl": "https://github.com/user/repo",
  "commitHash": "abc123",  // Optional
  "githubToken": "ghp_..."  // For private repos
}

Response: 202 Accepted
{
  "jobId": "job_xyz789",
  "status": "submitted",
  "estimatedDuration": "60s"
}
```

### 2. Get Job Status

```http
GET /api/agent/jobs/:jobId

Response: 200 OK
{
  "jobId": "job_xyz789",
  "status": "running",  // pending | running | completed | failed
  "progress": {
    "totalNodes": 10,
    "completedNodes": 3,
    "currentNode": "stage_4"
  },
  "results": [...],  // Partial results if streaming enabled
  "error": null
}
```

### 3. Stream Results (WebSocket)

```javascript
// Connect to WebSocket
const socket = io("ws://localhost:3000");

// Join job room
socket.emit("join_job", { jobId: "job_xyz789" });

// Listen for partial results
socket.on("partial_result", (result) => {
  console.log("Mapping completed for", result.dagNodeId);
  updateUI(result);
});

// Listen for job completion
socket.on("job_completed", (summary) => {
  console.log("All mappings completed", summary);
});
```

### 4. Cancel Job

```http
DELETE /api/agent/jobs/:jobId

Response: 200 OK
{
  "jobId": "job_xyz789",
  "status": "cancelled"
}
```

---

## Extensibility for Future Agentic UX

### 1. Human-in-the-Loop Feedback

```typescript
// Node: human_review (conditional)
.addConditionalEdges("confidence_gate", (state) => {
  if (state.confidence < 0.5) return "human_review";
  return "final_mapping";
});

// Human review node
const humanReviewNode = async (state: MappingState) => {
  // Emit request for human review
  await requestHumanReview({
    jobId: state.jobId,
    dagNodeId: state.currentDagNode.id,
    candidates: state.filteredCandidates,
  });

  // Wait for human response
  const humanSelection = await waitForHumanResponse(state.jobId);

  return {
    finalMapping: humanSelection.mapping,
    confidence: 1.0, // Human-verified
    explanation: `Verified by ${humanSelection.reviewer}`,
  };
};
```

### 2. Iterative Refinement

```typescript
// Add feedback loop
.addConditionalEdges("confidence_gate", (state) => {
  if (state.retryCount < 2 && state.confidence < 0.6) {
    return "refine_semantics"; // Loop back with more context
  }
  return "final_mapping";
});
```

### 3. Multi-User Collaboration

```typescript
// State includes reviewer assignments
{
  reviewers: [
    { dagNodeId: "stage_3", assignedTo: "user_123", status: "pending" }
  ]
}
```

---

## Summary

This architecture provides:

✅ **Production-ready**: Async, stateful, persistent, retryable
✅ **Scalable**: Parallel DAG processing, batched embeddings
✅ **Observable**: Logs, metrics, tracing
✅ **Cost-controlled**: Hard limits on LLM/embedding usage
✅ **Secure**: Private repo support, credential management
✅ **Extensible**: Human-in-the-loop, iterative refinement
✅ **Correct**: Separation of retrieval, filtering, reasoning

**Next Steps:**
1. Implement state schema ([STATE_SCHEMA.md](./STATE_SCHEMA.md))
2. Implement nodes ([IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md))
3. Deploy with PostgreSQL checkpointer
4. Monitor metrics and iterate
