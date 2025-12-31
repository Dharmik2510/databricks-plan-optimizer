# Setup Guide with Existing Supabase, ChromaDB Cloud & OpenAI

## ✅ What You Already Have

Great! Since you already have:
- ✅ **Supabase** (PostgreSQL database)
- ✅ **ChromaDB Cloud** (vector store)
- ✅ **OpenAI API key**

The setup is significantly simpler. No need to run local Docker containers!

---

## Quick Setup (5 Minutes)

### Step 1: Install Dependencies

```bash
cd backend
npm install langgraph @langchain/core @langchain/openai chromadb uuid
npm install @langchain/langgraph-checkpoint-postgres pg
npm install --save-dev @types/uuid
```

### Step 2: Update Environment Variables

Add these to your existing `.env` file:

```bash
# ============================================================================
# Existing Services (You already have these)
# ============================================================================

# OpenAI (already configured)
OPENAI_API_KEY=sk-proj-...

# Supabase (already configured)
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres

# ChromaDB Cloud (add your credentials)
CHROMA_HOST=your-instance.chromadb.cloud
CHROMA_PORT=443
CHROMA_API_KEY=your-chromadb-cloud-api-key
CHROMA_USE_SSL=true

# ============================================================================
# LangGraph Configuration (New)
# ============================================================================

# Job Processing
MAX_PARALLEL_NODES=5
RETRIEVAL_TOP_K=10

# Confidence Thresholds
CONFIDENCE_THRESHOLD_HIGH=0.8
CONFIDENCE_THRESHOLD_LOW=0.5

# Cost Control
MAX_JOB_COST_USD=5.0

# Repo Processing
REPO_CLONE_DIR=/tmp/code-mapping-repos
REPO_CACHE_TTL=604800  # 7 days

# Logging
LOG_LEVEL=info
METRICS_ENABLED=true
```

### Step 3: Create Database Tables (Supabase)

Run this in your Supabase SQL Editor:

```sql
-- Table for storing mapping results
CREATE TABLE IF NOT EXISTS code_mappings (
  id SERIAL PRIMARY KEY,
  job_id VARCHAR(255) NOT NULL,
  dag_node_id VARCHAR(255) NOT NULL,
  file VARCHAR(500) NOT NULL,
  symbol VARCHAR(255) NOT NULL,
  lines VARCHAR(50),
  confidence DECIMAL(3, 2),
  explanation TEXT,
  alternatives JSONB,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table for LangGraph state persistence
CREATE TABLE IF NOT EXISTS langgraph_checkpoints (
  thread_id TEXT NOT NULL,
  checkpoint_id TEXT NOT NULL,
  parent_id TEXT,
  checkpoint JSONB NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (thread_id, checkpoint_id)
);

-- Indexes for performance
CREATE INDEX idx_code_mappings_job_id ON code_mappings(job_id);
CREATE INDEX idx_code_mappings_confidence ON code_mappings(confidence);
CREATE INDEX idx_checkpoints_thread_id ON langgraph_checkpoints(thread_id);
```

### Step 4: Configure ChromaDB Cloud Connection

Create `backend/src/modules/agent/services/chromadb-cloud.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ChromaClient } from 'chromadb';

@Injectable()
export class ChromaDBCloudService {
  private readonly logger = new Logger(ChromaDBCloudService.name);
  private client: ChromaClient;

  constructor() {
    this.client = new ChromaClient({
      path: `https://${process.env.CHROMA_HOST}`,
      auth: {
        provider: 'token',
        credentials: process.env.CHROMA_API_KEY,
      },
    });
  }

  async createCollection(name: string) {
    try {
      const collection = await this.client.createCollection({
        name,
        metadata: { description: 'Code embeddings for DAG mapping' },
      });
      this.logger.log(`Collection created: ${name}`);
      return collection;
    } catch (error) {
      if (error.message.includes('already exists')) {
        this.logger.log(`Collection already exists: ${name}`);
        return await this.client.getCollection({ name });
      }
      throw error;
    }
  }

  async addEmbeddings(
    collectionName: string,
    embeddings: number[][],
    metadatas: any[],
    ids: string[],
  ) {
    const collection = await this.client.getCollection({ name: collectionName });

    await collection.add({
      embeddings,
      metadatas,
      ids,
    });

    this.logger.log(`Added ${embeddings.length} embeddings to ${collectionName}`);
  }

  async query(
    collectionName: string,
    queryEmbedding: number[],
    topK: number = 10,
  ) {
    const collection = await this.client.getCollection({ name: collectionName });

    const results = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: topK,
    });

    this.logger.log(`Query returned ${results.ids[0].length} results`);

    return results.ids[0].map((id, idx) => ({
      id,
      score: results.distances?.[0]?.[idx] || 0,
      metadata: results.metadatas?.[0]?.[idx] || {},
    }));
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.heartbeat();
      return true;
    } catch (error) {
      this.logger.error('ChromaDB Cloud health check failed', error);
      return false;
    }
  }
}
```

### Step 5: Configure Supabase Checkpointer

Update `backend/src/modules/agent/langgraph/graph/mapping-graph.ts`:

```typescript
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { compileGraph } from './mapping-graph';

// Create checkpointer using your Supabase connection
function createSupabaseCheckpointer() {
  return new PostgresSaver({
    connectionString: process.env.DATABASE_URL,
  });
}

// Compile graph with Supabase checkpointer
export function compileGraphWithSupabase() {
  const workflow = createMappingGraph();

  return workflow.compile({
    checkpointer: createSupabaseCheckpointer(),
  });
}
```

### Step 6: Update Node Implementations

#### Update: embedding-retrieval.node.ts

```typescript
// Replace mock ChromaDB with your cloud service
import { ChromaDBCloudService } from '../../services/chromadb-cloud.service';

export async function embeddingRetrievalNode(
  state: MappingState,
): Promise<Partial<MappingState>> {
  const chromaService = new ChromaDBCloudService();

  // Embed query
  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY,
  });
  const queryEmbedding = await embeddings.embedQuery(
    state.semanticDescription.sparkOperatorSignature,
  );

  // Query ChromaDB Cloud
  const results = await chromaService.query(
    state.repoContext.cacheKey,
    queryEmbedding,
    CONFIG.RETRIEVAL_TOP_K,
  );

  const candidates = results.map((result) => ({
    file: result.metadata.file,
    symbol: result.metadata.symbol,
    lines: result.metadata.lines,
    embeddingScore: 1 - result.score, // ChromaDB returns distance, convert to similarity
    metadata: result.metadata,
  }));

  return {
    retrievedCandidates: candidates,
  };
}
```

#### Update: load-repo-context.node.ts

```typescript
// Store embeddings in ChromaDB Cloud
import { ChromaDBCloudService } from '../../services/chromadb-cloud.service';
import { OpenAIEmbeddings } from '@langchain/openai';

async function generateEmbeddings(
  astIndex: any,
  collectionName: string,
): Promise<EmbeddingResult> {
  const chromaService = new ChromaDBCloudService();
  const embedder = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: 'text-embedding-3-small',
  });

  // Create collection
  await chromaService.createCollection(collectionName);

  // Extract code snippets from AST
  const codeSnippets = astIndex.files.flatMap((file) =>
    file.symbols.map((symbol) => ({
      id: `${file.path}:${symbol.name}`,
      text: `${symbol.signature} ${symbol.docstring}`,
      metadata: {
        file: file.path,
        symbol: symbol.name,
        lines: `${symbol.startLine}-${symbol.endLine}`,
        type: symbol.type,
      },
    })),
  );

  // Batch embed (100 at a time)
  const BATCH_SIZE = 100;
  let totalEmbedded = 0;

  for (let i = 0; i < codeSnippets.length; i += BATCH_SIZE) {
    const batch = codeSnippets.slice(i, i + BATCH_SIZE);
    const texts = batch.map((s) => s.text);

    // Generate embeddings
    const embeddings = await embedder.embedDocuments(texts);

    // Store in ChromaDB Cloud
    await chromaService.addEmbeddings(
      collectionName,
      embeddings,
      batch.map((s) => s.metadata),
      batch.map((s) => s.id),
    );

    totalEmbedded += batch.length;
  }

  return {
    embeddingsGenerated: totalEmbedded,
    collectionName,
  };
}
```

### Step 7: Test Connection

Create `backend/test-cloud-services.ts`:

```typescript
import { ChromaDBCloudService } from './src/modules/agent/services/chromadb-cloud.service';
import { Client } from 'pg';

async function testServices() {
  console.log('Testing cloud services...\n');

  // Test Supabase
  console.log('1. Testing Supabase connection...');
  const supabase = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await supabase.connect();
    const result = await supabase.query('SELECT NOW()');
    console.log('✅ Supabase connected:', result.rows[0].now);
    await supabase.end();
  } catch (error) {
    console.error('❌ Supabase connection failed:', error.message);
  }

  // Test ChromaDB Cloud
  console.log('\n2. Testing ChromaDB Cloud...');
  const chromaService = new ChromaDBCloudService();

  try {
    const isHealthy = await chromaService.healthCheck();
    console.log(`${isHealthy ? '✅' : '❌'} ChromaDB Cloud health check:`, isHealthy);
  } catch (error) {
    console.error('❌ ChromaDB Cloud connection failed:', error.message);
  }

  // Test OpenAI
  console.log('\n3. Testing OpenAI API...');
  try {
    const { OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: 'test',
    });

    console.log('✅ OpenAI API connected, embedding dimensions:', response.data[0].embedding.length);
  } catch (error) {
    console.error('❌ OpenAI API failed:', error.message);
  }

  console.log('\n✅ All services tested!');
}

testServices();
```

Run test:

```bash
npx tsx backend/test-cloud-services.ts
```

**Expected output:**
```
Testing cloud services...

1. Testing Supabase connection...
✅ Supabase connected: 2024-01-15 10:30:45.123+00

2. Testing ChromaDB Cloud...
✅ ChromaDB Cloud health check: true

3. Testing OpenAI API...
✅ OpenAI API connected, embedding dimensions: 1536

✅ All services tested!
```

---

## What's Different from Docker Setup

| Component | Docker Setup | Your Setup |
|-----------|--------------|------------|
| **PostgreSQL** | Local Docker container | ✅ Supabase (cloud) |
| **ChromaDB** | Local Docker container | ✅ ChromaDB Cloud |
| **OpenAI** | API key required | ✅ Already have key |
| **Setup time** | ~30 minutes | ~5 minutes |
| **Maintenance** | Manage containers | Zero - fully managed |

---

## Integration Checklist

- [x] Dependencies installed
- [x] Environment variables configured
- [x] Supabase tables created
- [x] ChromaDB Cloud service implemented
- [x] Supabase checkpointer configured
- [x] Connection tests passed
- [ ] Integrate with existing AST parser (your service)
- [ ] Test with sample DAG node
- [ ] Deploy to production

---

## Environment Variable Summary

Your complete `.env` should now have:

```bash
# ============================================================================
# Existing (You already have)
# ============================================================================
OPENAI_API_KEY=sk-proj-...
DATABASE_URL=postgresql://postgres:...@db.xxx.supabase.co:5432/postgres
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbG...

# ============================================================================
# ChromaDB Cloud (Add these)
# ============================================================================
CHROMA_HOST=your-instance.chromadb.cloud
CHROMA_PORT=443
CHROMA_API_KEY=your-chromadb-cloud-api-key
CHROMA_USE_SSL=true

# ============================================================================
# LangGraph Configuration (Add these)
# ============================================================================
MAX_PARALLEL_NODES=5
RETRIEVAL_TOP_K=10
CONFIDENCE_THRESHOLD_HIGH=0.8
CONFIDENCE_THRESHOLD_LOW=0.5
MAX_JOB_COST_USD=5.0
REPO_CLONE_DIR=/tmp/code-mapping-repos
REPO_CACHE_TTL=604800
LOG_LEVEL=info
```

---

## Benefits of Your Cloud Setup

✅ **No Docker required** - Everything is cloud-managed
✅ **Automatic backups** - Supabase handles PostgreSQL backups
✅ **Scalable** - ChromaDB Cloud scales automatically
✅ **Secure** - Managed SSL/TLS connections
✅ **Lower operational overhead** - No containers to maintain

---

## Next Steps

1. ✅ Test cloud services connection (run test script above)
2. ⚠️ Create Supabase tables (SQL above)
3. ⚠️ Implement ChromaDB Cloud service
4. ⚠️ Update node implementations to use cloud services
5. ⚠️ Test full workflow with sample DAG node
6. ⚠️ Integrate with your existing AST parser
7. ⚠️ Deploy to production

---

## Troubleshooting Cloud Services

### Issue: Supabase connection timeout

**Fix:**
```bash
# Check if IP is whitelisted in Supabase dashboard
# Settings → Database → Connection Pooling → Add your IP
```

### Issue: ChromaDB Cloud authentication failed

**Fix:**
```bash
# Verify API key in ChromaDB Cloud dashboard
# Ensure CHROMA_API_KEY is set correctly in .env
```

### Issue: OpenAI rate limit

**Fix:**
```bash
# Check usage at https://platform.openai.com/usage
# Upgrade plan or reduce RETRIEVAL_TOP_K
```

---

## Cost Estimate (With Your Cloud Setup)

**Monthly costs:**

| Service | Cost | Notes |
|---------|------|-------|
| Supabase | $25/month | Pro plan (already paying) |
| ChromaDB Cloud | $0-50/month | Depends on usage |
| OpenAI API | ~$390/month | 1000 jobs (see main docs) |
| **Total** | **~$415-465/month** | Fully managed, zero ops |

**Compared to self-hosted:**
- Self-hosted infrastructure: ~$200/month (EC2, RDS, etc.)
- DevOps time: ~10 hours/month
- Your setup: **Simpler, more reliable, comparable cost**

---

## You're Ready! 🚀

Since you already have Supabase, ChromaDB Cloud, and OpenAI configured, you're 80% done!

**Just:**
1. Run the test script to verify connections
2. Create the Supabase tables
3. Implement the ChromaDB Cloud service
4. Start building!

**No Docker containers needed. No infrastructure to manage. Just code.** ✨
