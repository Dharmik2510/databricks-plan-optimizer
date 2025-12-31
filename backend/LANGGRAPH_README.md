# LangGraph DAG → Code Mapping System

> **Production-ready agentic system for mapping Databricks Spark physical plan DAG nodes to source code using LangGraph orchestration.**

---

## 📋 Table of Contents

1. [What This Is](#what-this-is)
2. [Architecture Overview](#architecture-overview)
3. [Quick Start](#quick-start)
4. [Documentation](#documentation)
5. [Key Features](#key-features)
6. [System Requirements](#system-requirements)
7. [Installation](#installation)
8. [Configuration](#configuration)
9. [API Endpoints](#api-endpoints)
10. [Deployment](#deployment)
11. [Monitoring](#monitoring)
12. [Cost](#cost)
13. [Troubleshooting](#troubleshooting)
14. [Contributing](#contributing)

---

## What This Is

When a user clicks **"Map to Code"** in your Databricks Plan Optimizer UI, this system:

1. ✅ Clones the user's GitHub repository
2. ✅ Parses all source code using AST analysis
3. ✅ Generates embeddings for every function/class
4. ✅ For each DAG node in the physical plan:
   - Extracts execution semantics (groupBy, filter, join, etc.)
   - Retrieves candidate code via semantic similarity (ChromaDB)
   - Filters candidates by structural compatibility (AST)
   - Uses LLM to compare semantics vs. code behavior
   - Computes confidence score
   - Returns mapping with explanation
5. ✅ Displays results in UI with confidence scores and alternatives

**This is NOT a prototype. This is a production system.**

---

## Architecture Overview

```
User clicks "Map to Code" in UI
          ↓
    POST /api/agent/map-to-code
          ↓
    Return job_id (202 Accepted)
          ↓
    LangGraph executes asynchronously
          ↓
┌─────────────────────────────────────┐
│      LangGraph Workflow             │
│                                     │
│  1. load_repo_context               │
│     • Clone repo                    │
│     • Parse AST                     │
│     • Generate embeddings           │
│     • Store in ChromaDB             │
│                                     │
│  2. FOR EACH DAG NODE:              │
│     plan_semantics                  │
│     embedding_retrieval             │
│     ast_filter                      │
│     reasoning_agent (LLM)           │
│     confidence_gate                 │
│     final_mapping                   │
│                                     │
│  3. Return results                  │
└─────────────────────────────────────┘
          ↓
    UI displays mappings
```

**Key Design Principles:**
- ❌ **NOT** retrieval-only (would miss complex logic)
- ❌ **NOT** LLM-only (would be expensive and unreliable)
- ✅ **Hybrid:** Retrieval → AST filtering → LLM reasoning

---

## Quick Start

> **⚡ Already using Supabase + ChromaDB Cloud + OpenAI?**
> See [SETUP_WITH_EXISTING_SERVICES.md](./SETUP_WITH_EXISTING_SERVICES.md) for simplified 5-minute setup (no Docker needed!)

### 1. Install Dependencies

```bash
cd backend
npm install
```

See [DEPENDENCIES.md](./DEPENDENCIES.md) for full list.

### 2. Configure Environment

Add to your existing `.env`:
```bash
# Your existing services
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://...supabase.co...
CHROMA_HOST=your-instance.chromadb.cloud
CHROMA_API_KEY=your-chromadb-api-key

# LangGraph configuration
MAX_PARALLEL_NODES=5
RETRIEVAL_TOP_K=10
CONFIDENCE_THRESHOLD_HIGH=0.8
MAX_JOB_COST_USD=5.0
```

### 3. Create Database Tables

Run SQL in Supabase (see [SETUP_WITH_EXISTING_SERVICES.md](./SETUP_WITH_EXISTING_SERVICES.md))

### 4. Start Backend

```bash
npm run start:dev
```

### 4. Test

```bash
curl -X POST http://localhost:3000/api/agent/map-to-code \
  -H "Content-Type: application/json" \
  -d '{
    "analysisId": "test_001",
    "repoUrl": "https://github.com/your-org/spark-jobs",
    "dagNodes": [...]
  }'
```

See [QUICK_START_EXAMPLE.md](./QUICK_START_EXAMPLE.md) for detailed testing.

---

## Documentation

| Document | Description |
|----------|-------------|
| **[LANGGRAPH_SETUP.md](./LANGGRAPH_SETUP.md)** | Installation, setup, minimal examples |
| **[LANGGRAPH_ARCHITECTURE.md](./LANGGRAPH_ARCHITECTURE.md)** | Complete system design, node specifications |
| **[DEPENDENCIES.md](./DEPENDENCIES.md)** | Required packages and versions |
| **[QUICK_START_EXAMPLE.md](./QUICK_START_EXAMPLE.md)** | Step-by-step testing guide |
| **[OBSERVABILITY_GUIDE.md](./OBSERVABILITY_GUIDE.md)** | Logging, metrics, tracing, cost monitoring |
| **[PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md)** | Kubernetes, security, scaling, disaster recovery |
| **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** | What's built, integration points, next steps |

---

## Key Features

### ✅ Production-Ready

- **Asynchronous job execution** (non-blocking API)
- **Parallel DAG node processing** (configurable concurrency)
- **State persistence** (PostgreSQL checkpointer)
- **Node-level retries** with exponential backoff
- **Graceful error handling** with detailed logging
- **Cost tracking** with per-job limits

### ✅ Separation of Concerns

| Step | Technology | Purpose |
|------|------------|---------|
| **Retrieval** | OpenAI embeddings + ChromaDB | Find candidate code |
| **Filtering** | AST analysis | Remove incompatible code |
| **Reasoning** | LLM (GPT-4o) | Understand semantics |

### ✅ Confidence Scoring

Multi-factor confidence calculation:
- **Embedding score** (0.3 weight): Semantic similarity
- **AST score** (0.2 weight): Structural compatibility
- **LLM confidence** (0.4 weight): Reasoning quality
- **Keyword match** (0.1 weight): Term overlap

**Result routing:**
- **High confidence (≥0.8):** Safe to use
- **Medium confidence (0.5-0.8):** Review alternatives
- **Low confidence (<0.5):** Manual review required

### ✅ Observable

- **Structured logging** (JSON, Elasticsearch-ready)
- **Prometheus metrics** (counters, histograms, gauges)
- **OpenTelemetry tracing** (distributed tracing)
- **Cost tracking** per job and daily aggregates

### ✅ Secure

- **Private GitHub repo support** (token-based auth)
- **Input validation** (class-validator)
- **Rate limiting** (configurable)
- **Secret rotation** (Kubernetes secrets)

---

## System Requirements

### Development

- Node.js: 20.x (LTS)
- PostgreSQL: 15+
- Redis: 7+ (optional, for caching)
- ChromaDB: Latest
- Docker: 20+ (for services)

### Production

| Component | vCPU | RAM | Storage |
|-----------|------|-----|---------|
| Backend API | 4 | 8 GB | 20 GB |
| PostgreSQL | 2 | 4 GB | 100 GB SSD |
| ChromaDB | 4 | 16 GB | 500 GB SSD |
| Redis | 2 | 4 GB | 10 GB |

---

## Installation

### Step 1: Clone Repository

```bash
git clone https://github.com/your-org/databricks-plan-optimizer
cd databricks-plan-optimizer/backend
```

### Step 2: Install Dependencies

```bash
npm install
```

Required packages:
- `langgraph` - Graph orchestration
- `@langchain/openai` - OpenAI integration
- `chromadb` - Vector store
- `@langchain/langgraph-checkpoint-postgres` - State persistence

See [DEPENDENCIES.md](./DEPENDENCIES.md) for full list.

### Step 3: Set Up Environment

```bash
cp .env.example .env
```

Required variables:
```bash
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://...
CHROMA_HOST=localhost
CHROMA_PORT=8000
```

### Step 4: Initialize Database

```bash
npm run migration:run
```

Creates tables:
- `code_mappings` - Mapping results
- `job_state` - LangGraph state persistence

### Step 5: Start Services

```bash
# ChromaDB
docker run -p 8000:8000 chromadb/chroma

# Backend
npm run start:dev
```

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | *(required)* | OpenAI API key |
| `DATABASE_URL` | *(required)* | PostgreSQL connection string |
| `CHROMA_HOST` | `localhost` | ChromaDB host |
| `CHROMA_PORT` | `8000` | ChromaDB port |
| `MAX_PARALLEL_NODES` | `5` | Max concurrent DAG nodes |
| `RETRIEVAL_TOP_K` | `10` | Max retrieval candidates |
| `CONFIDENCE_THRESHOLD_HIGH` | `0.8` | High confidence threshold |
| `CONFIDENCE_THRESHOLD_LOW` | `0.5` | Low confidence threshold |
| `MAX_JOB_COST_USD` | `5.0` | Per-job cost limit |
| `LOG_LEVEL` | `info` | Logging level |

### LangGraph Configuration

```typescript
// backend/src/modules/agent/langgraph/graph/mapping-graph.ts

const graph = compileGraph({
  checkpointer: createPostgresCheckpointer(),  // State persistence
  enableRetries: true,                         // Node-level retries
});
```

---

## API Endpoints

### Create Mapping Job

```http
POST /api/agent/map-to-code
Content-Type: application/json

{
  "analysisId": "analysis_123",
  "repoUrl": "https://github.com/user/repo",
  "commitHash": "abc123",      // Optional
  "githubToken": "ghp_...",     // For private repos
  "dagNodes": [
    {
      "id": "stage_3",
      "operator": "HashAggregate",
      "keys": ["customer_id"],
      "aggregations": [{"func": "count"}],
      "physicalPlanFragment": "..."
    }
  ]
}

Response: 202 Accepted
{
  "jobId": "job_xyz789",
  "status": "submitted"
}
```

### Get Job Status

```http
GET /api/agent/jobs/{jobId}

Response: 200 OK
{
  "jobId": "job_xyz789",
  "status": "completed",
  "progress": {
    "totalNodes": 10,
    "completedNodes": 10,
    "currentNode": null
  },
  "results": [
    {
      "dagNodeId": "stage_3",
      "mappedCode": {
        "file": "src/jobs/customer_agg.py",
        "symbol": "aggregate_customers",
        "lines": "45-67"
      },
      "confidence": 0.87,
      "explanation": "This function groups by customer_id and computes count...",
      "alternatives": []
    }
  ],
  "costTracking": {
    "totalCostUSD": 0.35
  }
}
```

### Stream Job Progress (SSE)

```http
GET /api/agent/jobs/{jobId}/stream

Response: text/event-stream
data: {"jobId":"...","status":"running","progress":{"completedNodes":3}}

data: {"jobId":"...","status":"running","progress":{"completedNodes":7}}

data: {"jobId":"...","status":"completed","progress":{"completedNodes":10}}
```

### Cancel Job

```http
DELETE /api/agent/jobs/{jobId}

Response: 200 OK
{
  "message": "Job job_xyz789 cancelled"
}
```

---

## Deployment

### Docker Compose (Development)

```bash
docker-compose up -d
```

See [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md) for details.

### Kubernetes (Production)

```bash
# Deploy to K8s
kubectl apply -f k8s/

# Check status
kubectl get pods -l app=langgraph-backend

# View logs
kubectl logs -f deployment/langgraph-backend
```

See [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md) for complete guide.

---

## Monitoring

### Prometheus Metrics

```bash
# Expose metrics
curl http://localhost:3000/metrics

# Key metrics
langgraph_jobs_total{status="completed"}
langgraph_node_duration_seconds{node="reasoning_agent"}
langgraph_confidence_score{routing="high"}
langgraph_daily_cost_usd
```

### Grafana Dashboard

```bash
# Import dashboard
curl -X POST http://grafana:3000/api/dashboards/db \
  -H "Content-Type: application/json" \
  -d @grafana/langgraph-dashboard.json
```

### Logs

```bash
# Tail logs
tail -f logs/langgraph.log

# Search logs (Elasticsearch)
curl -X GET "http://elasticsearch:9200/langgraph-*/_search" \
  -H 'Content-Type: application/json' \
  -d '{"query": {"match": {"level": "error"}}}'
```

See [OBSERVABILITY_GUIDE.md](./OBSERVABILITY_GUIDE.md) for complete guide.

---

## Cost

**Per job estimate (10 DAG nodes, 1000-file repo):**

| Component | Cost |
|-----------|------|
| Repo embeddings (once, cached 7 days) | $0.20 |
| DAG node embeddings (10 nodes) | $0.001 |
| LLM reasoning (10 nodes × 1K tokens) | $0.15 |
| **Total (cached repo)** | **$0.35** |
| **Total (fresh repo)** | **$0.55** |

**Monthly estimate (1000 jobs, 80% cache hit):**
- 200 fresh repos × $0.55 = $110
- 800 cached jobs × $0.35 = $280
- **Total: ~$390/month**

**Cost controls:**
- Per-job limit: $5 (configurable)
- Daily budget alerts
- Cache repo embeddings (7-day TTL)
- Batch embeddings for efficiency

---

## Troubleshooting

### Issue: "Graph compilation failed"

**Diagnosis:**
```bash
npm run build
```

**Fix:**
```bash
rm -rf node_modules package-lock.json
npm install
```

### Issue: "OpenAI API key not found"

**Diagnosis:**
```bash
cat .env | grep OPENAI_API_KEY
```

**Fix:**
```bash
echo "OPENAI_API_KEY=sk-..." >> .env
```

### Issue: "ChromaDB connection refused"

**Diagnosis:**
```bash
curl http://localhost:8000/api/v1/heartbeat
```

**Fix:**
```bash
docker run -p 8000:8000 chromadb/chroma
```

### Issue: "Low confidence mappings"

**Diagnosis:**
```bash
curl http://localhost:3000/api/agent/jobs/{jobId} | jq '.results[] | select(.confidence < 0.5)'
```

**Fix:**
- Tune confidence thresholds
- Improve AST filtering rules
- Add more semantic keywords

See [OBSERVABILITY_GUIDE.md](./OBSERVABILITY_GUIDE.md) for more troubleshooting.

---

## Contributing

### Development Workflow

1. Create feature branch
2. Implement changes
3. Add tests
4. Update documentation
5. Submit PR

### Code Style

```bash
# Lint
npm run lint

# Format
npm run format

# Test
npm run test
```

### Adding a New Operator

1. Update `OPERATOR_BEHAVIORS` in [plan-semantics.node.ts](./src/modules/agent/langgraph/nodes/plan-semantics.node.ts)
2. Add AST rules in [ast-filter.node.ts](./src/modules/agent/langgraph/nodes/ast-filter.node.ts)
3. Test with sample DAG node

---

## License

MIT License - See [LICENSE](../LICENSE) for details.

---

## Support

- **Documentation:** See docs listed above
- **Issues:** [GitHub Issues](https://github.com/your-org/databricks-plan-optimizer/issues)
- **Slack:** #langgraph-mapping

---

## Roadmap

- [ ] **Q1 2024:** Initial release (basic operators)
- [ ] **Q2 2024:** Human-in-the-loop feedback
- [ ] **Q3 2024:** Multi-repo support
- [ ] **Q4 2024:** Custom operator rules

---

## Acknowledgments

Built with:
- [LangGraph](https://langchain-ai.github.io/langgraph/) - Graph orchestration
- [OpenAI](https://openai.com/) - Embeddings + LLM
- [ChromaDB](https://www.trychroma.com/) - Vector store
- [NestJS](https://nestjs.com/) - Backend framework

---

**Ready to map DAG nodes to code? Start with [QUICK_START_EXAMPLE.md](./QUICK_START_EXAMPLE.md)!** 🚀
