# Required Dependencies for LangGraph DAG → Code Mapping

## Installation Commands

### Core LangGraph Dependencies

```bash
cd backend

# LangGraph and LangChain Core
npm install langgraph @langchain/core @langchain/langgraph

# OpenAI Integration
npm install @langchain/openai openai

# ChromaDB Client
npm install chromadb

# PostgreSQL Checkpointer (for state persistence)
npm install @langchain/langgraph-checkpoint-postgres pg

# Utilities
npm install uuid
npm install --save-dev @types/uuid
```

### Optional Dependencies (Production)

```bash
# Prometheus metrics
npm install prom-client

# OpenTelemetry tracing
npm install @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node

# Redis (for caching)
npm install ioredis
npm install --save-dev @types/ioredis

# Rate limiting
npm install @nestjs/throttler
```

---

## Updated package.json

Add these to your existing `backend/package.json`:

```json
{
  "dependencies": {
    "langgraph": "^0.0.25",
    "@langchain/core": "^0.1.0",
    "@langchain/langgraph": "^0.0.25",
    "@langchain/openai": "^0.0.19",
    "@langchain/langgraph-checkpoint-postgres": "^0.0.3",
    "openai": "^4.24.0",
    "chromadb": "^1.7.0",
    "pg": "^8.11.3",
    "uuid": "^9.0.1",
    "prom-client": "^15.1.0",
    "ioredis": "^5.3.2",
    "@nestjs/throttler": "^5.1.0",
    "@opentelemetry/api": "^1.7.0",
    "@opentelemetry/sdk-node": "^0.45.0",
    "@opentelemetry/auto-instrumentations-node": "^0.39.0"
  },
  "devDependencies": {
    "@types/uuid": "^9.0.7",
    "@types/ioredis": "^5.0.0"
  }
}
```

---

## Dependency Overview

| Package | Purpose | Required? |
|---------|---------|-----------|
| `langgraph` | Core LangGraph framework | ✅ Required |
| `@langchain/core` | LangChain base primitives | ✅ Required |
| `@langchain/openai` | OpenAI embeddings + LLM | ✅ Required |
| `openai` | OpenAI SDK | ✅ Required |
| `chromadb` | Vector store client | ✅ Required |
| `@langchain/langgraph-checkpoint-postgres` | State persistence | ✅ Required (production) |
| `pg` | PostgreSQL client | ✅ Required (production) |
| `uuid` | Job ID generation | ✅ Required |
| `prom-client` | Prometheus metrics | ⚠️ Recommended |
| `ioredis` | Redis caching | ⚠️ Recommended |
| `@nestjs/throttler` | Rate limiting | ⚠️ Recommended |
| `@opentelemetry/*` | Distributed tracing | ⚡ Optional |

---

## Version Compatibility

**Tested with:**
- Node.js: `20.x` (LTS)
- TypeScript: `5.3.x`
- NestJS: `10.x`
- LangGraph: `0.0.25+`
- OpenAI API: `v1` (2024)

---

## Environment Variables Required

After installing dependencies, set these in `.env`:

```bash
# OpenAI
OPENAI_API_KEY=sk-...

# ChromaDB
CHROMA_HOST=localhost
CHROMA_PORT=8000

# PostgreSQL (for checkpointer)
DATABASE_URL=postgresql://user:pass@localhost:5432/langgraph

# Redis (optional, for caching)
REDIS_URL=redis://localhost:6379

# GitHub (for private repos)
GITHUB_TOKEN=ghp_...

# LangGraph Config
MAX_PARALLEL_NODES=5
RETRIEVAL_TOP_K=10
CONFIDENCE_THRESHOLD_HIGH=0.8
CONFIDENCE_THRESHOLD_LOW=0.5
MAX_JOB_COST_USD=5.0
```

---

## Installation Verification

```bash
# Install all dependencies
npm install

# Verify LangGraph installation
npm list langgraph

# Expected output:
# langgraph@0.0.25

# Verify OpenAI installation
npm list @langchain/openai

# Expected output:
# @langchain/openai@0.0.19
```

---

## Troubleshooting

### Issue: `Cannot find module 'langgraph'`

**Solution:**
```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Issue: `OpenAI API key not found`

**Solution:**
```bash
# Verify .env file exists and has OPENAI_API_KEY
cat .env | grep OPENAI_API_KEY

# If missing, add it:
echo "OPENAI_API_KEY=sk-your-key-here" >> .env
```

### Issue: ChromaDB connection failed

**Solution:**
```bash
# Start ChromaDB in Docker
docker run -p 8000:8000 chromadb/chroma:latest

# Verify it's running
curl http://localhost:8000/api/v1/heartbeat
```

### Issue: PostgreSQL checkpointer error

**Solution:**
```bash
# Ensure PostgreSQL is running
psql $DATABASE_URL -c "SELECT 1"

# Create required tables (run migrations)
npm run migration:run
```

---

## Next Steps

1. Run `npm install` to install all dependencies
2. Copy `.env.example` to `.env` and fill in values
3. Start ChromaDB: `docker run -p 8000:8000 chromadb/chroma`
4. Start PostgreSQL (or use existing instance)
5. Run backend: `npm run start:dev`
6. Test health endpoint: `curl http://localhost:3000/api/agent/health`

---

## Dependency Update Policy

- **Major versions**: Review breaking changes, test thoroughly
- **Minor versions**: Update monthly
- **Patch versions**: Update weekly (security fixes)
- **OpenAI SDK**: Monitor for API changes (notify if breaking)

---

## License Compliance

All dependencies are MIT or Apache 2.0 licensed:
- `langgraph`: MIT
- `@langchain/*`: MIT
- `openai`: MIT
- `chromadb`: Apache 2.0
- `pg`: MIT

No GPL dependencies.
