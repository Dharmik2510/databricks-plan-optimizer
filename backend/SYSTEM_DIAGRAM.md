# System Architecture Diagram

## Complete End-to-End Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                          USER INTERFACE                             │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  Databricks Plan Optimizer Dashboard                       │   │
│  │                                                            │   │
│  │  1. Upload Databricks physical plan                       │   │
│  │  2. View DAG visualization                                │   │
│  │  3. Click "Map to Code" button                            │   │
│  │  4. Enter GitHub repo URL                                 │   │
│  │  5. View mapping results with confidence scores           │   │
│  └────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ HTTP POST
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          BACKEND API                                │
│                                                                     │
│  POST /api/agent/map-to-code                                       │
│  ├─ Validate input                                                 │
│  ├─ Create job_id                                                  │
│  ├─ Return 202 Accepted                                            │
│  └─ Trigger async execution                                        │
│                                                                     │
│  GET /api/agent/jobs/:id                                           │
│  ├─ Query job status                                               │
│  └─ Return results + progress                                      │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ Invoke
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    MAPPING ORCHESTRATOR                             │
│                                                                     │
│  Job Management:                                                   │
│  • Create job_id = UUID                                            │
│  • Track job status (pending → running → completed)               │
│  • Process DAG nodes in parallel (max 5 concurrent)                │
│  • Aggregate results                                               │
│  • Track costs ($5/job limit)                                      │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ Execute
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    LANGGRAPH WORKFLOW                               │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ Node 1: load_repo_context                                    │ │
│  │                                                              │ │
│  │ Input:  repoUrl, commitHash                                 │ │
│  │ Output: repoContext (embeddings, AST index)                 │ │
│  │                                                              │ │
│  │ Steps:                                                       │ │
│  │ 1. Clone GitHub repo (public or private)                    │ │
│  │ 2. Parse AST for all .py, .scala, .java files              │ │
│  │ 3. Extract: functions, classes, methods, signatures         │ │
│  │ 4. Generate embeddings (OpenAI text-embedding-3-small)      │ │
│  │ 5. Store in ChromaDB Cloud                                  │ │
│  │ 6. Cache in Supabase for 7 days                             │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                             ↓                                       │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ FOR EACH DAG NODE (Parallel):                                │ │
│  │                                                              │ │
│  │  ┌────────────────────────────────────────────────────────┐ │ │
│  │  │ Node 2: plan_semantics                                 │ │ │
│  │  │                                                        │ │ │
│  │  │ Input:  currentDagNode                                 │ │ │
│  │  │ Output: semanticDescription                            │ │ │
│  │  │                                                        │ │ │
│  │  │ Extract:                                               │ │ │
│  │  │ • Operator type (HashAggregate, Filter, Join, ...)    │ │ │
│  │  │ • Execution behavior (groupBy, filter, aggregate)     │ │ │
│  │  │ • Key columns, functions, filters                     │ │ │
│  │  │ • Spark operator signature for embedding              │ │ │
│  │  └────────────────────────────────────────────────────────┘ │ │
│  │                          ↓                                   │ │
│  │  ┌────────────────────────────────────────────────────────┐ │ │
│  │  │ Node 3: embedding_retrieval                            │ │ │
│  │  │                                                        │ │ │
│  │  │ Input:  semanticDescription, repoContext              │ │ │
│  │  │ Output: retrievedCandidates (top-10)                  │ │ │
│  │  │                                                        │ │ │
│  │  │ Steps:                                                 │ │ │
│  │  │ 1. Embed semantic description (OpenAI)                │ │ │
│  │  │ 2. Query ChromaDB Cloud (cosine similarity)           │ │ │
│  │  │ 3. Return top-K candidates                            │ │ │
│  │  │ 4. Re-rank by complexity (boost business logic)       │ │ │
│  │  └────────────────────────────────────────────────────────┘ │ │
│  │                          ↓                                   │ │
│  │  ┌────────────────────────────────────────────────────────┐ │ │
│  │  │ Node 4: ast_filter                                     │ │ │
│  │  │                                                        │ │ │
│  │  │ Input:  retrievedCandidates, semanticDescription      │ │ │
│  │  │ Output: filteredCandidates (~3-5)                     │ │ │
│  │  │                                                        │ │ │
│  │  │ Filter out:                                            │ │ │
│  │  │ • Utility functions (_helper, log, etc.)              │ │ │
│  │  │ • Test code (test/, _test.py)                         │ │ │
│  │  │ • Dead code (no callers in call graph)                │ │ │
│  │  │ • Structurally incompatible (missing groupBy, agg)    │ │ │
│  │  │                                                        │ │ │
│  │  │ Assign AST compatibility score (0.0-1.0)              │ │ │
│  │  └────────────────────────────────────────────────────────┘ │ │
│  │                          ↓                                   │ │
│  │  ┌────────────────────────────────────────────────────────┐ │ │
│  │  │ Node 5: reasoning_agent (LLM)                          │ │ │
│  │  │                                                        │ │ │
│  │  │ Input:  filteredCandidates (top-3), semanticDesc      │ │ │
│  │  │ Output: finalMapping, explanation, alternatives       │ │ │
│  │  │                                                        │ │ │
│  │  │ LLM Prompt:                                            │ │ │
│  │  │ "Compare Spark operator semantics to code behavior.   │ │ │
│  │  │  Which function implements this operator?"            │ │ │
│  │  │                                                        │ │ │
│  │  │ Model: GPT-4o                                          │ │ │
│  │  │ Temperature: 0.1 (deterministic)                      │ │ │
│  │  │ Max tokens: 1500                                       │ │ │
│  │  │                                                        │ │ │
│  │  │ Returns:                                               │ │ │
│  │  │ • Best match (file, symbol, lines)                    │ │ │
│  │  │ • Explanation (2-3 sentences)                         │ │ │
│  │  │ • Alternatives (if multiple plausible)                │ │ │
│  │  └────────────────────────────────────────────────────────┘ │ │
│  │                          ↓                                   │ │
│  │  ┌────────────────────────────────────────────────────────┐ │ │
│  │  │ Node 6: confidence_gate                                │ │ │
│  │  │                                                        │ │ │
│  │  │ Input:  finalMapping, explanation, alternatives       │ │ │
│  │  │ Output: confidence (0.0-1.0), routing decision        │ │ │
│  │  │                                                        │ │ │
│  │  │ Confidence formula:                                    │ │ │
│  │  │ confidence = 0.3 × embeddingScore                     │ │ │
│  │  │            + 0.2 × astScore                           │ │ │
│  │  │            + 0.4 × llmConfidence                      │ │ │
│  │  │            + 0.1 × keywordMatch                       │ │ │
│  │  │            - 0.1 × alternativesPenalty                │ │ │
│  │  │                                                        │ │ │
│  │  │ Routing:                                               │ │ │
│  │  │ • ≥ 0.8: High confidence → Finalize                   │ │ │
│  │  │ • 0.5-0.8: Medium → Finalize with alternatives        │ │ │
│  │  │ • < 0.5: Low → Manual review needed                   │ │ │
│  │  └────────────────────────────────────────────────────────┘ │ │
│  │                          ↓                                   │ │
│  │  ┌────────────────────────────────────────────────────────┐ │ │
│  │  │ Node 7: final_mapping                                  │ │ │
│  │  │                                                        │ │ │
│  │  │ Input:  All above state                                │ │ │
│  │  │ Output: MappingOutput (persisted)                      │ │ │
│  │  │                                                        │ │ │
│  │  │ Steps:                                                 │ │ │
│  │  │ 1. Build output schema                                │ │ │
│  │  │ 2. Persist to Supabase (code_mappings table)          │ │ │
│  │  │ 3. Append to completedMappings[]                      │ │ │
│  │  │ 4. Emit streaming event (WebSocket)                   │ │ │
│  │  └────────────────────────────────────────────────────────┘ │ │
│  │                                                              │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  State Persistence: Supabase (langgraph_checkpoints table)         │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ Results
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                                │
│                                                                     │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────────────┐ │
│  │   SUPABASE     │  │ CHROMADB CLOUD │  │      OPENAI API      │ │
│  │  (PostgreSQL)  │  │ (Vector Store) │  │                      │ │
│  │                │  │                │  │  • Embeddings        │ │
│  │ • code_mappings│  │ • Embeddings   │  │    text-emb-3-small  │ │
│  │ • checkpoints  │  │ • Similarity   │  │                      │ │
│  │ • job_state    │  │   search       │  │  • LLM Reasoning     │ │
│  │                │  │                │  │    gpt-4o            │ │
│  └────────────────┘  └────────────────┘  └──────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ Poll Status
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          USER INTERFACE                             │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  Mapping Results Display                                   │   │
│  │                                                            │   │
│  │  ┌──────────────────────────────────────────────────────┐ │   │
│  │  │ DAG Node: stage_3 (HashAggregate)                    │ │   │
│  │  │                                                      │ │   │
│  │  │ ✅ Mapped to:                                        │ │   │
│  │  │    src/jobs/customer_aggregation.py                 │ │   │
│  │  │    Function: aggregate_by_customer                  │ │   │
│  │  │    Lines: 45-67                                     │ │   │
│  │  │                                                      │ │   │
│  │  │ Confidence: 87% ████████▒▒ (High)                   │ │   │
│  │  │                                                      │ │   │
│  │  │ Explanation:                                         │ │   │
│  │  │ "This function groups data by customer_id and       │ │   │
│  │  │  applies count(*), matching the HashAggregate       │ │   │
│  │  │  operator's execution semantics."                   │ │   │
│  │  │                                                      │ │   │
│  │  │ [View Code in GitHub] [View Alternatives]           │ │   │
│  │  └──────────────────────────────────────────────────────┘ │   │
│  └────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Summary

| Step | Component | Input | Output | Technology |
|------|-----------|-------|--------|------------|
| 1 | UI | User clicks "Map to Code" | repoUrl, dagNodes | React/TypeScript |
| 2 | API | POST request | job_id (202) | NestJS |
| 3 | Orchestrator | job_id, repoUrl, dagNodes | Job execution | TypeScript |
| 4 | Node: load_repo | repoUrl | embeddings → ChromaDB | Git, AST, OpenAI |
| 5 | Node: plan_semantics | dagNode | semanticDescription | TypeScript |
| 6 | Node: embedding_retrieval | semanticDescription | top-10 candidates | OpenAI, ChromaDB |
| 7 | Node: ast_filter | candidates | filtered (3-5) | AST parser |
| 8 | Node: reasoning_agent | candidates + semantics | bestMatch + explanation | GPT-4o |
| 9 | Node: confidence_gate | bestMatch | confidence score | TypeScript |
| 10 | Node: final_mapping | All above | MappingOutput | Supabase |
| 11 | API | Poll job status | Results + confidence | NestJS |
| 12 | UI | Results | Display mappings | React/TypeScript |

---

## Confidence Scoring Breakdown

```
Example Calculation:

Embedding Score:     0.92  (semantic similarity)
AST Score:           0.85  (structural match)
LLM Confidence:      0.90  (high certainty in explanation)
Keyword Match:       0.80  (80% of keywords found)
Alternatives Penalty: -0.10 (1 alternative exists)

Final Confidence = (0.92 × 0.3) + (0.85 × 0.2) + (0.90 × 0.4) + (0.80 × 0.1) - 0.10
                 = 0.276 + 0.170 + 0.360 + 0.080 - 0.100
                 = 0.786 → 78.6% (MEDIUM confidence)

Routing: 78.6% is between 0.5 and 0.8
Action:  Finalize with alternatives shown to user
```

---

## Cost Flow

```
Per Job (10 DAG nodes):

1. Repo Embedding (one-time):
   • 1000 code symbols × 200 tokens avg = 200,000 tokens
   • Cost: 200,000 / 1,000,000 × $0.02 = $0.004

2. DAG Node Embedding (per node):
   • 10 nodes × 50 tokens = 500 tokens
   • Cost: 500 / 1,000,000 × $0.02 = $0.00001

3. LLM Reasoning (per node):
   • 10 nodes × 1000 tokens × $0.015/1K = $0.15

Total (fresh repo):  $0.154
Total (cached repo): $0.150 (skip step 1)

Monthly (1000 jobs, 80% cache hit):
• 200 fresh repos × $0.154 = $30.80
• 800 cached jobs × $0.150 = $120.00
• Total: ~$150/month OpenAI costs
```

---

## State Persistence (Supabase)

```
langgraph_checkpoints table:

thread_id        | checkpoint_id | checkpoint (JSONB)
-----------------+---------------+-----------------------------------
job_xyz789       | cp_001        | { repoContext: {...}, ... }
job_xyz789       | cp_002        | { semanticDescription: {...} }
job_xyz789       | cp_003        | { retrievedCandidates: [...] }
...

Benefits:
• Resume failed jobs from last checkpoint
• Debug: replay specific nodes
• Audit trail of all state transitions
• Survive backend restarts
```

---

## Example Output

```json
{
  "jobId": "job_xyz789",
  "status": "completed",
  "results": [
    {
      "dagNodeId": "stage_3",
      "mappedCode": {
        "file": "src/jobs/customer_aggregation.py",
        "symbol": "aggregate_by_customer",
        "lines": "45-67"
      },
      "confidence": 0.87,
      "explanation": "This function groups data by customer_id and applies count(*), matching the HashAggregate operator.",
      "alternatives": [],
      "metadata": {
        "operatorType": "HashAggregate",
        "embeddingScore": 0.92,
        "astScore": 0.85,
        "processedAt": "2024-01-15T10:30:45.123Z"
      }
    }
  ],
  "costTracking": {
    "totalCostUSD": 0.35
  }
}
```

---

## Production Deployment

```
Kubernetes Cluster:

┌────────────────────────────────────────────────────┐
│  Load Balancer (HTTPS)                             │
└────────────────┬───────────────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
   ┌────▼────┐      ┌────▼────┐
   │ Backend │      │ Backend │  (Horizontal scaling)
   │  Pod 1  │      │  Pod 2  │
   └────┬────┘      └────┬────┘
        │                 │
        └────────┬────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
    ▼            ▼            ▼
┌────────┐  ┌────────┐  ┌────────┐
│Supabase│  │ChromaDB│  │ OpenAI │
│  DB    │  │ Cloud  │  │  API   │
└────────┘  └────────┘  └────────┘
```

---

This diagram shows the complete end-to-end flow of your DAG → Code mapping system!
