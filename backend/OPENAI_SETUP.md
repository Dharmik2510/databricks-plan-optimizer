# OpenAI Embeddings Setup Guide

## Production-Ready Configuration for Semantic Code Matching

This guide will help you set up OpenAI embeddings for the semantic code matching feature in the Databricks Plan Optimizer.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Obtaining OpenAI API Key](#obtaining-openai-api-key)
4. [Configuration](#configuration)
5. [ChromaDB Setup](#chromadb-setup)
6. [Testing the Setup](#testing-the-setup)
7. [Cost Optimization](#cost-optimization)
8. [Troubleshooting](#troubleshooting)
9. [Production Best Practices](#production-best-practices)

---

## Prerequisites

- Node.js 18+ installed
- Active OpenAI account with billing enabled
- Docker (for ChromaDB) - optional but recommended

---

## Quick Start

### Step 1: Get Your OpenAI API Key

1. Visit [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Sign in or create an account
3. Click "Create new secret key"
4. **IMPORTANT**: Copy the key immediately (you won't be able to see it again)

### Step 2: Add to Environment Variables

Add the following to your `.env` file in the `backend/` directory:

```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-your-actual-api-key-here

# ChromaDB Configuration (optional - defaults to in-memory)
CHROMA_URL=http://localhost:8000
```

### Step 3: Install Dependencies

```bash
cd backend
npm install
```

The required packages are already added to `package.json`:
- `@langchain/openai` - OpenAI embeddings
- `@langchain/community` - Vector store integrations
- `chromadb` - Vector database client

### Step 4: Start ChromaDB (Optional but Recommended)

**Option A: Using Docker (Recommended)**

```bash
docker run -d -p 8000:8000 chromadb/chroma
```

**Option B: Using pip**

```bash
pip install chromadb
chroma run --path ./chroma_data
```

### Step 5: Verify Setup

```bash
npm run start:dev
```

Check logs for:
```
✅ Semantic matching service initialized successfully
```

If you see this warning instead:
```
⚠️  OPENAI_API_KEY not configured - Semantic matching disabled
```

Verify your `.env` file is in the correct location and the key is set.

---

## Obtaining OpenAI API Key

### Detailed Steps

1. **Create OpenAI Account**
   - Go to [https://platform.openai.com/signup](https://platform.openai.com/signup)
   - Sign up with email or Google/Microsoft account
   - Verify your email address

2. **Set Up Billing**
   - Navigate to [https://platform.openai.com/account/billing](https://platform.openai.com/account/billing)
   - Click "Add payment method"
   - Enter credit card details
   - **Recommended**: Set usage limits to prevent unexpected charges
     - Go to "Usage limits"
     - Set hard limit (e.g., $50/month)
     - Enable email notifications at 50%, 75%, 90% usage

3. **Create API Key**
   - Go to [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
   - Click "+ Create new secret key"
   - Name it (e.g., "Databricks-Plan-Optimizer-Prod")
   - **CRITICAL**: Copy the key immediately and store securely
   - The key format looks like: `sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

4. **Verify Key Works**
   ```bash
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer YOUR_API_KEY"
   ```

   You should see a list of available models.

---

## Configuration

### Environment Variables

Create or update `backend/.env`:

```bash
# ===========================================
# OpenAI Configuration
# ===========================================

# Your OpenAI API key (REQUIRED for semantic matching)
OPENAI_API_KEY=sk-proj-your-key-here

# Embedding model (default: text-embedding-3-small)
# Options:
#   - text-embedding-3-small (Recommended, $0.02/1M tokens)
#   - text-embedding-3-large (Higher quality, $0.13/1M tokens)
#   - text-embedding-ada-002 (Legacy, $0.10/1M tokens)
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# Request timeout in ms (default: 30000)
OPENAI_TIMEOUT=30000

# Batch size for embedding requests (default: 512)
# Higher = faster but more memory usage
OPENAI_BATCH_SIZE=512

# ===========================================
# ChromaDB Configuration
# ===========================================

# ChromaDB server URL (default: http://localhost:8000)
CHROMA_URL=http://localhost:8000

# Collection name for code embeddings
CHROMA_COLLECTION=codebase_functions

# ===========================================
# Feature Flags
# ===========================================

# Enable semantic matching (default: true if OPENAI_API_KEY is set)
ENABLE_SEMANTIC_MATCHING=true

# Minimum semantic similarity threshold (0-1, default: 0.7)
SEMANTIC_SIMILARITY_THRESHOLD=0.7
```

### TypeScript Configuration (Optional)

If you want to customize the service, edit `backend/src/modules/agent/semantic-matching.service.ts`:

```typescript
this.embeddings = new OpenAIEmbeddings({
    openAIApiKey: apiKey,
    modelName: 'text-embedding-3-small', // Change model here
    batchSize: 512, // Adjust batch size
    timeout: 30000 // Adjust timeout
});
```

---

## ChromaDB Setup

### Why ChromaDB?

ChromaDB is a vector database optimized for semantic search. It:
- Stores code embeddings efficiently
- Enables fast similarity search
- Persists data across restarts
- Scales to millions of vectors

### Setup Options

#### Option 1: Docker (Production Recommended)

```bash
# Run ChromaDB in Docker
docker run -d \
  --name chromadb \
  -p 8000:8000 \
  -v $(pwd)/chroma_data:/chroma/chroma \
  chromadb/chroma

# Verify it's running
curl http://localhost:8000/api/v1/heartbeat
```

**Expected response**: `{"nanosecond heartbeat":...}`

#### Option 2: Python Package

```bash
# Install ChromaDB
pip install chromadb

# Run server
chroma run --path ./chroma_data --port 8000
```

#### Option 3: In-Memory (Development Only)

If `CHROMA_URL` is not set, the service will use in-memory storage.

**⚠️ Warning**: Data will be lost on restart!

### Docker Compose (Recommended for Production)

Add to your `docker-compose.yml`:

```yaml
services:
  chromadb:
    image: chromadb/chroma:latest
    ports:
      - "8000:8000"
    volumes:
      - ./chroma_data:/chroma/chroma
    environment:
      - ALLOW_RESET=true
      - ANONYMIZED_TELEMETRY=false
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/v1/heartbeat"]
      interval: 30s
      timeout: 10s
      retries: 3
```

Run with:
```bash
docker-compose up -d chromadb
```

---

## Testing the Setup

### 1. Verify Environment Variables

```bash
# Check if API key is set
echo $OPENAI_API_KEY

# Should output: sk-proj-...
```

### 2. Test OpenAI Connection

Create `backend/test-openai.js`:

```javascript
const { OpenAI } = require('openai');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function test() {
  try {
    const embedding = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: 'Hello, world!'
    });
    console.log('✅ OpenAI connection successful!');
    console.log(`Embedding dimensions: ${embedding.data[0].embedding.length}`);
  } catch (error) {
    console.error('❌ OpenAI connection failed:', error.message);
  }
}

test();
```

Run:
```bash
node backend/test-openai.js
```

### 3. Test Semantic Matching

Use the API endpoint:

```bash
curl -X POST http://localhost:3000/api/agent/test-semantic \
  -H "Content-Type: application/json" \
  -d '{
    "query": "find function that reads parquet files"
  }'
```

Expected response:
```json
{
  "success": true,
  "matches": [
    {
      "filePath": "src/data_loader.py",
      "functionName": "load_parquet_data",
      "confidence": 92,
      "semanticSimilarity": 0.89
    }
  ]
}
```

---

## Cost Optimization

### Understanding Costs

**OpenAI Pricing** (as of 2024):
- `text-embedding-3-small`: **$0.02 per 1M tokens** ⭐ Recommended
- `text-embedding-3-large`: $0.13 per 1M tokens
- `text-embedding-ada-002`: $0.10 per 1M tokens (legacy)

### Cost Estimation

For a typical repository:

| Repository Size | Functions | Avg Tokens/Function | Total Tokens | Cost (small) | Cost (large) |
|----------------|-----------|---------------------|--------------|--------------|--------------|
| Small (100 files) | 500 | 200 | 100K | **$0.002** | $0.013 |
| Medium (500 files) | 2,500 | 200 | 500K | **$0.01** | $0.065 |
| Large (2,000 files) | 10,000 | 200 | 2M | **$0.04** | $0.26 |
| Enterprise (10K files) | 50,000 | 200 | 10M | **$0.20** | $1.30 |

### Cost Optimization Strategies

1. **Use `text-embedding-3-small`** (default)
   - 70% cheaper than ada-002
   - Similar quality for code search
   - Faster embedding generation

2. **Enable Caching**
   ```typescript
   // Files are only re-indexed when changed
   const fileHash = crypto.createHash('sha256').update(content).digest('hex');
   ```

3. **Batch Processing**
   ```typescript
   // Already configured: processes 512 embeddings per request
   batchSize: 512
   ```

4. **Selective Indexing**
   - Only index files matching patterns:
   ```typescript
   const validExts = ['.py', '.java', '.scala', '.sql'];
   ```

5. **Set Usage Limits in OpenAI Dashboard**
   - Hard limit: $50/month
   - Soft limit: $25/month
   - Email alerts at 50%, 75%, 90%

### Monitoring Costs

1. **OpenAI Dashboard**
   - Visit [https://platform.openai.com/usage](https://platform.openai.com/usage)
   - View daily/monthly usage
   - Set up budget alerts

2. **Application Metrics**
   ```bash
   # Check metrics endpoint
   curl http://localhost:3000/metrics | grep embedding
   ```

---

## Troubleshooting

### Issue: "OPENAI_API_KEY not configured"

**Solution**:
```bash
# Verify .env file location
ls -la backend/.env

# Check if key is set
grep OPENAI_API_KEY backend/.env

# Restart server
npm run start:dev
```

### Issue: "Rate limit exceeded"

**Solution**:
```typescript
// Reduce batch size
OPENAI_BATCH_SIZE=256

// Add retry logic (already built-in)
```

### Issue: "Connection to ChromaDB failed"

**Solution**:
```bash
# Check if ChromaDB is running
docker ps | grep chroma

# Verify connection
curl http://localhost:8000/api/v1/heartbeat

# Check environment variable
echo $CHROMA_URL
```

### Issue: "Invalid API key"

**Solution**:
```bash
# Verify key format (should start with sk-proj- or sk-)
echo $OPENAI_API_KEY

# Test manually
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# Regenerate key if invalid
```

### Issue: "Timeout errors"

**Solution**:
```bash
# Increase timeout
OPENAI_TIMEOUT=60000

# Check network connectivity
ping api.openai.com
```

---

## Production Best Practices

### 1. Security

**✅ DO**:
- Store API key in environment variables, never in code
- Use secrets management (AWS Secrets Manager, HashiCorp Vault)
- Rotate API keys quarterly
- Set usage limits in OpenAI dashboard

**❌ DON'T**:
- Commit `.env` files to Git
- Share API keys via email/Slack
- Use production keys in development

### 2. Error Handling

```typescript
try {
    const matches = await semanticMatchingService.findSemanticMatches(stage, 5);
} catch (error) {
    logger.error('Semantic matching failed, falling back to regex matching');
    // Graceful degradation to non-AI matching
}
```

### 3. Monitoring

```bash
# Set up alerts
- OpenAI usage > $50/day
- ChromaDB disk usage > 80%
- Embedding API errors > 5%

# Monitor logs
tail -f logs/semantic-matching.log | grep ERROR
```

### 4. Performance

```typescript
// Cache embeddings (already implemented)
// Index incrementally (only changed files)
// Use connection pooling for ChromaDB
```

### 5. Backup & Recovery

```bash
# Backup ChromaDB data
docker exec chromadb tar -czf /tmp/chroma-backup.tar.gz /chroma/chroma
docker cp chromadb:/tmp/chroma-backup.tar.gz ./backups/

# Restore
docker cp ./backups/chroma-backup.tar.gz chromadb:/tmp/
docker exec chromadb tar -xzf /tmp/chroma-backup.tar.gz -C /
```

---

## Support

### Resources

- OpenAI Documentation: [https://platform.openai.com/docs](https://platform.openai.com/docs)
- ChromaDB Documentation: [https://docs.trychroma.com](https://docs.trychroma.com)
- LangChain Documentation: [https://js.langchain.com/docs](https://js.langchain.com/docs)

### Getting Help

1. Check logs: `tail -f backend/logs/app.log`
2. Review metrics: `curl http://localhost:3000/metrics`
3. Test endpoints manually with curl/Postman
4. Open GitHub issue with error logs

---

## Summary

You're all set! 🎉

**Quick Checklist**:
- ✅ OpenAI API key obtained and added to `.env`
- ✅ ChromaDB running (Docker or standalone)
- ✅ Dependencies installed (`npm install`)
- ✅ Server started successfully
- ✅ Usage limits configured in OpenAI dashboard
- ✅ Monitoring alerts set up

**Next Steps**:
1. Index your first repository
2. Test semantic search
3. Monitor costs and performance
4. Adjust configuration as needed

Happy coding! 🚀
