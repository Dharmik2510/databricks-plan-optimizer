# Production Deployment Guide

## Overview

This guide covers deploying the LangGraph DAG → Code mapping system to production with:
- High availability
- State persistence
- Scalability
- Security
- Monitoring

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Load Balancer                        │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                 Backend API (NestJS)                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         MappingJobController                         │  │
│  │  POST /map-to-code  GET /jobs/:id                    │  │
│  └──────────────────┬───────────────────────────────────┘  │
│                     ▼                                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         MappingOrchestrator                          │  │
│  │  - Job management                                    │  │
│  │  - Parallel DAG processing                           │  │
│  │  - Cost tracking                                     │  │
│  └──────────────────┬───────────────────────────────────┘  │
│                     ▼                                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         LangGraph Compiled Graph                     │  │
│  │  - State management                                  │  │
│  │  - Node execution                                    │  │
│  │  - Conditional routing                               │  │
│  └──────────────────┬───────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
┌──────────────┐ ┌────────┐ ┌───────────┐
│  PostgreSQL  │ │ChromaDB│ │  OpenAI   │
│  (State +    │ │(Vector │ │  API      │
│   Results)   │ │ Store) │ │           │
└──────────────┘ └────────┘ └───────────┘
        │
        ▼
┌──────────────┐
│    Redis     │
│  (Repo Cache)│
└──────────────┘
```

---

## Infrastructure Requirements

### Compute

| Component | vCPU | RAM | Storage | Scaling |
|-----------|------|-----|---------|---------|
| Backend API | 4 | 8 GB | 20 GB | Horizontal (2-10 pods) |
| PostgreSQL | 2 | 4 GB | 100 GB SSD | Vertical + Read replicas |
| ChromaDB | 4 | 16 GB | 500 GB SSD | Vertical |
| Redis | 2 | 4 GB | 10 GB | Cluster mode (3 nodes) |

### Networking

- **API**: HTTPS only (TLS 1.3)
- **Internal services**: Private VPC
- **Egress**: Allow OpenAI API, GitHub API

---

## Step-by-Step Deployment

### 1. Environment Setup

```bash
# Clone repository
git clone https://github.com/your-org/databricks-plan-optimizer
cd databricks-plan-optimizer/backend

# Install dependencies
npm install
```

### 2. Environment Variables (Production)

Create `.env.production`:

```bash
# Database
DATABASE_URL=postgresql://user:pass@postgres:5432/langgraph_prod

# Redis
REDIS_URL=redis://redis:6379

# ChromaDB
CHROMA_HOST=chromadb.internal
CHROMA_PORT=8000

# OpenAI
OPENAI_API_KEY=sk-prod-...

# GitHub (for private repos)
GITHUB_TOKEN=ghp_...

# LangGraph Configuration
MAX_PARALLEL_NODES=5
RETRIEVAL_TOP_K=10
CONFIDENCE_THRESHOLD_HIGH=0.8
CONFIDENCE_THRESHOLD_LOW=0.5

# Cost Control
MAX_JOB_COST_USD=5.0

# Observability
LOG_LEVEL=info
METRICS_ENABLED=true

# Job Settings
REPO_CLONE_DIR=/data/repos
REPO_CACHE_TTL=604800  # 7 days

# Security
NODE_ENV=production
CORS_ORIGINS=https://your-frontend.com
```

### 3. Database Setup (PostgreSQL)

```bash
# Run migrations
npm run migration:run

# Create tables
psql $DATABASE_URL <<EOF
CREATE TABLE code_mappings (
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
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_job_id (job_id),
  INDEX idx_confidence (confidence)
);

CREATE TABLE job_state (
  job_id VARCHAR(255) PRIMARY KEY,
  state JSONB NOT NULL,
  status VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
EOF
```

### 4. ChromaDB Setup

```bash
# Run ChromaDB in Docker
docker run -d \
  --name chromadb \
  -p 8000:8000 \
  -v /data/chromadb:/chroma/chroma \
  -e CHROMA_SERVER_AUTH_PROVIDER=token \
  -e CHROMA_SERVER_AUTH_CREDENTIALS=your-secret-token \
  chromadb/chroma:latest

# Verify
curl http://localhost:8000/api/v1/heartbeat
```

### 5. Redis Setup (Cluster Mode)

```bash
# Redis cluster for caching
docker-compose -f docker-compose.redis.yml up -d

# Verify
redis-cli -h localhost -p 6379 ping
```

### 6. Build Backend

```bash
# Production build
npm run build

# Verify
ls -lh dist/
```

### 7. Docker Deployment

**Dockerfile:**

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

# Install git for repo cloning
RUN apk add --no-cache git

# Create data directory
RUN mkdir -p /data/repos

EXPOSE 3000

CMD ["node", "dist/main.js"]
```

**docker-compose.yml:**

```yaml
version: '3.8'

services:
  backend:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env.production
    volumes:
      - /data/repos:/data/repos
    depends_on:
      - postgres
      - redis
      - chromadb
    restart: unless-stopped
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '4'
          memory: 8G

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: langgraph_prod
      POSTGRES_USER: langgraph
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data
    restart: unless-stopped

  chromadb:
    image: chromadb/chroma:latest
    environment:
      CHROMA_SERVER_AUTH_PROVIDER: token
      CHROMA_SERVER_AUTH_CREDENTIALS: ${CHROMA_TOKEN}
    volumes:
      - chromadb-data:/chroma/chroma
    restart: unless-stopped

volumes:
  postgres-data:
  redis-data:
  chromadb-data:
```

**Deploy:**

```bash
docker-compose up -d
docker-compose ps
docker-compose logs -f backend
```

---

## Kubernetes Deployment

### 1. ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: langgraph-config
data:
  MAX_PARALLEL_NODES: "5"
  RETRIEVAL_TOP_K: "10"
  LOG_LEVEL: "info"
```

### 2. Secret

```bash
kubectl create secret generic langgraph-secrets \
  --from-literal=OPENAI_API_KEY=sk-... \
  --from-literal=GITHUB_TOKEN=ghp_... \
  --from-literal=DATABASE_URL=postgresql://...
```

### 3. Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: langgraph-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: langgraph-backend
  template:
    metadata:
      labels:
        app: langgraph-backend
    spec:
      containers:
      - name: backend
        image: your-registry/langgraph-backend:latest
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: langgraph-config
        - secretRef:
            name: langgraph-secrets
        resources:
          requests:
            cpu: 2
            memory: 4Gi
          limits:
            cpu: 4
            memory: 8Gi
        livenessProbe:
          httpGet:
            path: /api/agent/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/agent/health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
```

### 4. Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: langgraph-backend
spec:
  selector:
    app: langgraph-backend
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: ClusterIP
```

### 5. Ingress

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: langgraph-ingress
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - api.yourdomain.com
    secretName: langgraph-tls
  rules:
  - host: api.yourdomain.com
    http:
      paths:
      - path: /api/agent
        pathType: Prefix
        backend:
          service:
            name: langgraph-backend
            port:
              number: 80
```

**Deploy to K8s:**

```bash
kubectl apply -f k8s/
kubectl get pods -l app=langgraph-backend
kubectl logs -f deployment/langgraph-backend
```

---

## State Persistence (PostgreSQL Checkpointer)

### Install Checkpointer

```bash
npm install @langchain/langgraph-checkpoint-postgres
```

### Configure

```typescript
// backend/src/modules/agent/langgraph/checkpointers/postgres.checkpointer.ts
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';

export function createCheckpointer() {
  return new PostgresSaver({
    connectionString: process.env.DATABASE_URL,
  });
}

// Update graph compilation
import { createCheckpointer } from '../checkpointers/postgres.checkpointer';

const graph = compileGraph({
  checkpointer: createCheckpointer(),
});
```

### Benefits

- ✅ Resume failed jobs from last checkpoint
- ✅ Audit trail of all state transitions
- ✅ Debugging: replay specific nodes
- ✅ Survive backend restarts

---

## Security Hardening

### 1. API Authentication

```typescript
// Add JWT middleware
import { JwtAuthGuard } from '@nestjs/passport';

@UseGuards(JwtAuthGuard)
@Controller('api/agent')
export class MappingJobController {
  // ...
}
```

### 2. Input Validation

```typescript
import { IsUrl, IsArray, MinLength } from 'class-validator';

class CreateMappingJobDto {
  @IsUrl()
  repoUrl: string;

  @IsArray()
  @MinLength(1)
  dagNodes: any[];
}
```

### 3. Rate Limiting

```typescript
import { ThrottlerGuard } from '@nestjs/throttler';

@UseGuards(ThrottlerGuard)
@Throttle(10, 60) // 10 requests per 60 seconds
@Post('map-to-code')
async createMappingJob() {
  // ...
}
```

### 4. Secret Rotation

```bash
# Rotate OpenAI key
kubectl create secret generic langgraph-secrets \
  --from-literal=OPENAI_API_KEY=sk-new-key \
  --dry-run=client -o yaml | kubectl apply -f -

# Restart pods
kubectl rollout restart deployment/langgraph-backend
```

### 5. Network Policies

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: langgraph-netpol
spec:
  podSelector:
    matchLabels:
      app: langgraph-backend
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: frontend
    ports:
    - protocol: TCP
      port: 3000
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: postgres
  - to:
    - namespaceSelector: {}
    ports:
    - protocol: TCP
      port: 443  # OpenAI API
```

---

## Monitoring Setup

### 1. Prometheus

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'langgraph'
    static_configs:
      - targets: ['langgraph-backend:3000']
    metrics_path: '/metrics'
```

### 2. Grafana

```bash
# Import dashboard
curl -X POST http://grafana:3000/api/dashboards/db \
  -H "Content-Type: application/json" \
  -d @grafana/langgraph-dashboard.json
```

### 3. AlertManager

```yaml
# alerts.yml
groups:
  - name: langgraph
    rules:
      - alert: HighJobFailureRate
        expr: rate(langgraph_jobs_total{status="failed"}[5m]) > 0.1
        for: 5m
        annotations:
          summary: "High job failure rate"
```

---

## Scaling Strategy

### Horizontal Scaling (API)

```bash
# Scale up
kubectl scale deployment langgraph-backend --replicas=5

# Autoscaling
kubectl autoscale deployment langgraph-backend \
  --min=3 --max=10 --cpu-percent=70
```

### Vertical Scaling (Database)

```bash
# Increase PostgreSQL resources
kubectl edit statefulset postgres
# Update resources.limits.memory: 16Gi
```

### ChromaDB Scaling

- Use persistent volumes (SSD)
- Consider sharding by repository
- Monitor query latency

---

## Disaster Recovery

### Backup Strategy

```bash
# PostgreSQL backup (daily)
0 2 * * * pg_dump $DATABASE_URL | gzip > /backups/langgraph_$(date +%F).sql.gz

# ChromaDB backup (weekly)
0 3 * * 0 tar czf /backups/chromadb_$(date +%F).tar.gz /data/chromadb
```

### Restore Procedure

```bash
# Restore PostgreSQL
gunzip < /backups/langgraph_2024-01-15.sql.gz | psql $DATABASE_URL

# Restore ChromaDB
tar xzf /backups/chromadb_2024-01-15.tar.gz -C /data/
```

---

## Performance Tuning

### 1. Connection Pooling

```typescript
// Database connection pool
{
  max: 20,
  min: 5,
  idleTimeoutMillis: 30000,
}
```

### 2. Redis Caching

```typescript
// Cache repo context for 7 days
await redis.setex(`repo:${cacheKey}`, 604800, JSON.stringify(repoContext));
```

### 3. Parallel DAG Processing

```typescript
// Increase parallelism
MAX_PARALLEL_NODES=10  # Default: 5
```

---

## Production Checklist

- [ ] PostgreSQL checkpointer enabled
- [ ] Redis cache configured
- [ ] ChromaDB persistent storage
- [ ] SSL/TLS certificates
- [ ] API authentication enabled
- [ ] Rate limiting configured
- [ ] Prometheus metrics exposed
- [ ] Grafana dashboards imported
- [ ] AlertManager alerts configured
- [ ] Daily backups scheduled
- [ ] Secret rotation policy
- [ ] Load testing completed
- [ ] On-call runbook created

---

## Go-Live

```bash
# Final deployment
kubectl apply -f k8s/
kubectl rollout status deployment/langgraph-backend

# Verify health
curl https://api.yourdomain.com/api/agent/health

# Test mapping job
curl -X POST https://api.yourdomain.com/api/agent/map-to-code \
  -H "Content-Type: application/json" \
  -d '{
    "analysisId": "test_001",
    "repoUrl": "https://github.com/test/repo",
    "dagNodes": [...]
  }'

# Monitor metrics
open http://grafana:3000/d/langgraph-dashboard
```

---

## Support & Maintenance

- **On-call rotation**: See `RUNBOOK.md`
- **Weekly reviews**: Confidence metrics, cost analysis
- **Monthly**: Update dependencies, security patches
- **Quarterly**: ChromaDB re-indexing, cost optimization

---

## Next Steps

1. Deploy to staging environment
2. Run load tests (100 concurrent jobs)
3. Test failover scenarios
4. Train ops team on runbook
5. Schedule go-live
