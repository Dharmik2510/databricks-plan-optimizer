# ChromaDB Production Setup Guide

## 🚀 Production Deployment Options

You have **3 options** for running ChromaDB in production. Choose based on your infrastructure:

---

## Option 1: Docker (Recommended for Self-Hosted)

### Prerequisites
- Docker Desktop installed and running
- Port 8000 available

### Setup Steps

#### 1. Start Docker Desktop
Make sure Docker Desktop is running on your machine.

#### 2. Start ChromaDB Container

**Using Docker Compose** (Recommended):
```bash
# File already created: docker-compose.chroma.yml
docker-compose -f docker-compose.chroma.yml up -d
```

**Or Using Docker CLI**:
```bash
docker run -d \
  --name databricks-chromadb \
  -p 8000:8000 \
  -v $(pwd)/chroma_data:/chroma/chroma \
  -e IS_PERSISTENT=TRUE \
  -e ANONYMIZED_TELEMETRY=FALSE \
  chromadb/chroma:latest
```

#### 3. Verify It's Running
```bash
# Check container status
docker ps | grep chroma

# Test health endpoint
curl http://localhost:8000/api/v1/heartbeat
# Expected: {"nanosecond heartbeat": ...}
```

#### 4. Configure Your Application
```bash
# In backend/.env
CHROMA_URL=http://localhost:8000
OPENAI_API_KEY=sk-proj-your-actual-key-here
```

#### 5. Management Commands
```bash
# View logs
docker logs -f databricks-chromadb

# Stop ChromaDB
docker-compose -f docker-compose.chroma.yml down

# Restart ChromaDB
docker-compose -f docker-compose.chroma.yml restart

# Remove ChromaDB (keeps data)
docker-compose -f docker-compose.chroma.yml down

# Remove ChromaDB and data
docker-compose -f docker-compose.chroma.yml down -v
```

### Production Configuration

For production, update `docker-compose.chroma.yml`:

```yaml
version: '3.8'

services:
  chromadb:
    image: chromadb/chroma:latest
    container_name: databricks-chromadb
    ports:
      - "8000:8000"
    volumes:
      - chroma_data:/chroma/chroma
    environment:
      - IS_PERSISTENT=TRUE
      - ANONYMIZED_TELEMETRY=FALSE
      # Optional: Add authentication
      - CHROMA_SERVER_AUTH_CREDENTIALS_PROVIDER=chromadb.auth.token.TokenConfigServerAuthCredentialsProvider
      - CHROMA_SERVER_AUTH_TOKEN_TRANSPORT_HEADER=X-Chroma-Token
      - CHROMA_SERVER_AUTH_CREDENTIALS=your-secret-token-here
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/v1/heartbeat"]
      interval: 30s
      timeout: 10s
      retries: 3
    # Resource limits for production
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G

volumes:
  chroma_data:
    driver: local
```

---

## Option 2: ChromaDB Cloud (Easiest for Production)

### Why Choose Cloud?
- ✅ Zero infrastructure management
- ✅ Automatic scaling
- ✅ Built-in backups
- ✅ Free tier available
- ✅ Global CDN

### Setup Steps

#### 1. Sign Up for ChromaDB Cloud
Visit: https://www.trychroma.com/cloud

#### 2. Create a Database
- Click "Create Database"
- Choose region closest to your users
- Copy the connection details

#### 3. Get Your Credentials
You'll receive:
- **API URL**: `https://api.trychroma.com`
- **Database ID**: `your-database-id`
- **API Key**: `your-api-key`

#### 4. Configure Your Application
```bash
# In backend/.env
CHROMA_URL=https://api.trychroma.com
CHROMA_API_KEY=your-api-key
CHROMA_TENANT=your-database-id
CHROMA_DATABASE=default

OPENAI_API_KEY=sk-proj-your-actual-key-here
```

#### 5. Update semantic-matching.service.ts

Add cloud authentication (if not already configured):

```typescript
// In semantic-matching.service.ts, update the vectorStore initialization
this.vectorStore = await Chroma.fromExistingCollection(this.embeddings, {
    collectionName: 'code_functions',
    url: chromaUrl,
    // Add for ChromaDB Cloud:
    chromaCloudAPIKey: this.configService.get<string>('CHROMA_API_KEY'),
});
```

### Pricing (as of 2025)
- **Free Tier**: 1GB storage, 1M requests/month
- **Pro**: $29/month - 10GB storage, 10M requests
- **Enterprise**: Custom pricing

---

## Option 3: In-Memory Mode (Development Only)

**NOT recommended for production** - data is lost on restart.

### When to Use
- Local development
- Testing
- Proof of concept

### Configuration
```bash
# In backend/.env
# Don't set CHROMA_URL - will default to in-memory
OPENAI_API_KEY=sk-proj-your-actual-key-here
```

System will automatically use in-memory storage if `CHROMA_URL` is not set.

---

## 🔧 Production Best Practices

### 1. Enable Authentication (Docker)

```yaml
# In docker-compose.chroma.yml
environment:
  - CHROMA_SERVER_AUTH_CREDENTIALS=your-secret-token-here
```

```bash
# In backend/.env
CHROMA_AUTH_TOKEN=your-secret-token-here
```

### 2. Set Up Backups (Docker)

```bash
# Backup script
#!/bin/bash
BACKUP_DIR="./backups/chromadb"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
docker run --rm \
  -v databricks-plan-optimizer_chroma_data:/source \
  -v $BACKUP_DIR:/backup \
  alpine tar czf /backup/chroma_backup_$DATE.tar.gz -C /source .

echo "Backup created: $BACKUP_DIR/chroma_backup_$DATE.tar.gz"
```

### 3. Monitor Performance

```bash
# Check ChromaDB metrics
curl http://localhost:8000/api/v1/pre-flight-checks

# Monitor Docker stats
docker stats databricks-chromadb
```

### 4. Set Resource Limits

```yaml
# In docker-compose.chroma.yml
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 4G
```

### 5. Enable SSL/TLS (Production)

Use a reverse proxy like Nginx or Traefik:

```nginx
# nginx.conf
server {
    listen 443 ssl;
    server_name chroma.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
# Update .env
CHROMA_URL=https://chroma.yourdomain.com
```

---

## 🧪 Testing Your Setup

### 1. Test ChromaDB Connection

```bash
# Test heartbeat
curl http://localhost:8000/api/v1/heartbeat

# Expected response:
# {"nanosecond heartbeat": 1735479907123456789}
```

### 2. Test with Your Application

```bash
# Start your backend
npm run start:dev

# Look for this log:
# [SemanticMatchingService] ✅ Connected to ChromaDB at http://localhost:8000
# [SemanticMatchingService] ✅ Semantic matching service initialized successfully
```

### 3. Test Semantic Search

```bash
# Test endpoint (create this test endpoint)
curl -X POST http://localhost:3002/api/agent/test-semantic \
  -H "Content-Type: application/json" \
  -d '{
    "query": "find function that reads parquet files"
  }'
```

### 4. Verify Data Persistence

```bash
# Index some data
# Restart ChromaDB
docker-compose -f docker-compose.chroma.yml restart

# Verify data still exists
# (Collections should still be there)
```

---

## 🆘 Troubleshooting

### Issue: Docker not running
```bash
Error: Connection aborted, FileNotFoundError
```

**Solution**: Start Docker Desktop application first.

### Issue: Port 8000 already in use
```bash
Error: Bind for 0.0.0.0:8000 failed: port is already allocated
```

**Solution**: Change port in docker-compose.yml:
```yaml
ports:
  - "8001:8000"  # Use 8001 instead

# Update .env
CHROMA_URL=http://localhost:8001
```

### Issue: ChromaDB won't start
```bash
# Check logs
docker logs databricks-chromadb

# Common issues:
# 1. Corrupted data volume - remove and recreate
docker-compose -f docker-compose.chroma.yml down -v
docker-compose -f docker-compose.chroma.yml up -d
```

### Issue: Connection timeout from app
```bash
# Verify ChromaDB is accessible
curl -v http://localhost:8000/api/v1/heartbeat

# Check firewall rules
# Check Docker network
docker network inspect bridge
```

### Issue: Out of memory
```bash
# Increase Docker memory limit in Docker Desktop settings
# Or set resource limits in docker-compose.yml
```

---

## 📊 Recommended Setup by Environment

### Development
```bash
# Option 1: Docker (if you have Docker Desktop)
docker-compose -f docker-compose.chroma.yml up -d

# Option 2: In-memory (simplest)
# Just don't set CHROMA_URL in .env
```

### Staging
```bash
# Docker with persistence
# Use docker-compose.chroma.yml with backups
docker-compose -f docker-compose.chroma.yml up -d
```

### Production
```bash
# Option A: ChromaDB Cloud (easiest)
# Sign up at https://www.trychroma.com/cloud

# Option B: Self-hosted Docker with:
# - Authentication enabled
# - SSL/TLS via reverse proxy
# - Automated backups
# - Resource limits
# - Monitoring
```

---

## 📈 Capacity Planning

### Estimated Storage Requirements

| Repository Size | Functions | Vector Dimensions | Storage Needed |
|----------------|-----------|-------------------|----------------|
| Small (100 files) | 500 | 1536 | ~5 MB |
| Medium (500 files) | 2,500 | 1536 | ~25 MB |
| Large (2,000 files) | 10,000 | 1536 | ~100 MB |
| Enterprise (10K files) | 50,000 | 1536 | ~500 MB |

### Memory Requirements
- **Minimum**: 512 MB
- **Recommended**: 2 GB
- **Large repos (>10K functions)**: 4 GB

---

## 🎯 Quick Start Summary

### For Immediate Testing (Development)
```bash
# 1. Start Docker Desktop
# 2. Start ChromaDB
docker-compose -f docker-compose.chroma.yml up -d

# 3. Add to .env
echo "CHROMA_URL=http://localhost:8000" >> .env
echo "OPENAI_API_KEY=sk-proj-your-key-here" >> .env

# 4. Start your app
npm run start:dev

# 5. Look for success message:
# ✅ Semantic matching service initialized successfully
```

### For Production Deployment
1. Choose: **ChromaDB Cloud** (easiest) or **Docker with SSL/backups**
2. Configure authentication
3. Set up monitoring
4. Enable automated backups
5. Test disaster recovery

---

## 🔗 Useful Resources

- **ChromaDB Docs**: https://docs.trychroma.com
- **Docker Image**: https://hub.docker.com/r/chromadb/chroma
- **ChromaDB Cloud**: https://www.trychroma.com/cloud
- **Discord Support**: https://discord.gg/MMeYNTmh3x

---

**Next Steps**:
1. Choose your deployment option above
2. Follow the setup steps
3. Test the connection
4. Start using enhanced code mapping!

_Last Updated: December 29, 2025_
