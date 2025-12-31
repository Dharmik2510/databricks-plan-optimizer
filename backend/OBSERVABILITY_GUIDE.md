# Observability & Production Monitoring Guide

## Overview

This guide covers logging, metrics, tracing, error handling, and cost monitoring for the DAG → Code mapping system.

---

## Logging Strategy

### Structured Logging Format

All logs use structured JSON format for easy parsing:

```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "info",
  "service": "langgraph-mapping",
  "node": "reasoning_agent",
  "jobId": "job_xyz789",
  "dagNodeId": "stage_3",
  "duration_ms": 3100,
  "message": "Node execution completed",
  "metadata": {
    "confidence": 0.78,
    "llm_tokens": 1250,
    "cost_usd": 0.019
  }
}
```

### Log Levels

| Level | Usage |
|-------|-------|
| **ERROR** | Node failures, API errors, unrecoverable errors |
| **WARN** | Retries, fallbacks, degraded performance |
| **INFO** | Node completion, job lifecycle, key decisions |
| **DEBUG** | Detailed execution, intermediate results |

### Key Log Events

```typescript
// Job lifecycle
logger.info('job_created', { jobId, repoUrl, dagNodeCount });
logger.info('job_started', { jobId });
logger.info('job_completed', { jobId, duration, totalCost });
logger.error('job_failed', { jobId, error, stackTrace });

// Node execution
logger.info('node_started', { jobId, nodeName, dagNodeId });
logger.info('node_completed', { jobId, nodeName, duration });
logger.error('node_failed', { jobId, nodeName, error, retryCount });

// Cost tracking
logger.info('llm_call', { jobId, model, tokens, cost });
logger.info('embedding_call', { jobId, count, cost });
logger.warn('cost_limit_approaching', { jobId, currentCost, limit });
logger.error('cost_limit_exceeded', { jobId, totalCost });

// Confidence analysis
logger.info('mapping_completed', {
  jobId,
  dagNodeId,
  confidence,
  confidenceFactors,
  routing: 'high' | 'medium' | 'low',
});
```

### Log Aggregation

**Production Setup:**

```yaml
# Fluentd / Logstash configuration
<source>
  @type tail
  path /var/log/langgraph/*.log
  pos_file /var/log/langgraph.pos
  tag langgraph.mapping
  <parse>
    @type json
  </parse>
</source>

<match langgraph.mapping>
  @type elasticsearch
  host elasticsearch.local
  port 9200
  index_name langgraph-${YYYY.MM.DD}
  <buffer>
    flush_interval 10s
  </buffer>
</match>
```

**Querying Logs (Elasticsearch):**

```json
// Find all failed jobs in last 24h
GET /langgraph-*/_search
{
  "query": {
    "bool": {
      "must": [
        { "term": { "level": "error" } },
        { "match": { "message": "job_failed" } },
        { "range": { "timestamp": { "gte": "now-24h" } } }
      ]
    }
  }
}

// Find jobs exceeding cost limit
GET /langgraph-*/_search
{
  "query": {
    "bool": {
      "must": [
        { "match": { "message": "cost_limit_exceeded" } }
      ]
    }
  },
  "aggs": {
    "total_cost": { "sum": { "field": "metadata.totalCost" } }
  }
}
```

---

## Metrics (Prometheus)

### Counter Metrics

```typescript
// Job metrics
langgraph_jobs_total{status="completed|failed|cancelled"}
langgraph_dag_nodes_processed_total{operator_type="HashAggregate|Filter|..."}

// Node metrics
langgraph_node_executions_total{node="load_repo|plan_semantics|...", status="success|failure"}
langgraph_node_retries_total{node="..."}

// API metrics
langgraph_api_requests_total{endpoint="/map-to-code", status_code="202|400|500"}

// Cost metrics
langgraph_llm_calls_total{model="gpt-4o"}
langgraph_embedding_calls_total{model="text-embedding-3-small"}
```

### Histogram Metrics

```typescript
// Duration metrics (buckets: 0.1, 0.5, 1, 5, 10, 30, 60 seconds)
langgraph_node_duration_seconds{node="..."}
langgraph_job_duration_seconds
langgraph_llm_latency_seconds
langgraph_chromadb_query_latency_seconds

// Confidence distribution (buckets: 0.1, 0.3, 0.5, 0.7, 0.8, 0.9, 1.0)
langgraph_confidence_score{routing="high|medium|low"}
```

### Gauge Metrics

```typescript
// Active jobs
langgraph_active_jobs
langgraph_queued_jobs

// Resource usage
langgraph_repo_cache_size_bytes
langgraph_chromadb_collections_count

// Cost tracking
langgraph_daily_cost_usd
langgraph_monthly_cost_usd
```

### Metrics Implementation

```typescript
// backend/src/modules/agent/services/metrics.service.ts
import { Injectable } from '@nestjs/common';
import * as prometheus from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly jobsTotal: prometheus.Counter;
  private readonly nodeDuration: prometheus.Histogram;
  private readonly confidenceScore: prometheus.Histogram;

  constructor() {
    // Counter
    this.jobsTotal = new prometheus.Counter({
      name: 'langgraph_jobs_total',
      help: 'Total number of mapping jobs',
      labelNames: ['status'],
    });

    // Histogram
    this.nodeDuration = new prometheus.Histogram({
      name: 'langgraph_node_duration_seconds',
      help: 'Node execution duration',
      labelNames: ['node'],
      buckets: [0.1, 0.5, 1, 5, 10, 30, 60],
    });

    this.confidenceScore = new prometheus.Histogram({
      name: 'langgraph_confidence_score',
      help: 'Mapping confidence distribution',
      labelNames: ['routing'],
      buckets: [0.1, 0.3, 0.5, 0.7, 0.8, 0.9, 1.0],
    });
  }

  recordJobCompleted(status: string) {
    this.jobsTotal.inc({ status });
  }

  recordNodeDuration(node: string, durationSeconds: number) {
    this.nodeDuration.observe({ node }, durationSeconds);
  }

  recordConfidence(confidence: number, routing: string) {
    this.confidenceScore.observe({ routing }, confidence);
  }

  // Expose metrics endpoint
  getMetrics(): string {
    return prometheus.register.metrics();
  }
}
```

### Grafana Dashboard

**Sample Panel Queries:**

```promql
# Job completion rate
rate(langgraph_jobs_total{status="completed"}[5m])

# Job failure rate
rate(langgraph_jobs_total{status="failed"}[5m])

# Average node duration
rate(langgraph_node_duration_seconds_sum[5m]) /
rate(langgraph_node_duration_seconds_count[5m])

# P95 confidence score
histogram_quantile(0.95, langgraph_confidence_score_bucket)

# Daily cost
increase(langgraph_llm_calls_total[1d]) * 0.015
```

**Alerts (Prometheus AlertManager):**

```yaml
groups:
  - name: langgraph
    rules:
      # High failure rate
      - alert: HighJobFailureRate
        expr: rate(langgraph_jobs_total{status="failed"}[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High job failure rate detected"

      # Cost limit approaching
      - alert: CostLimitApproaching
        expr: langgraph_daily_cost_usd > 100
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "Daily cost exceeding $100"

      # Low confidence rate
      - alert: LowConfidenceMappings
        expr: rate(langgraph_confidence_score_bucket{routing="low"}[10m]) > 0.3
        for: 10m
        labels:
          severity: info
        annotations:
          summary: "High rate of low-confidence mappings"
```

---

## Error Handling

### Retry Strategy (Node-Level)

```typescript
// Node retry configuration
const RETRY_CONFIG = {
  retryableNodes: [
    'load_repo_context',
    'embedding_retrieval',
    'reasoning_agent',
  ],
  maxRetries: 3,
  backoffStrategy: 'exponential', // 1s, 2s, 4s
  retryableErrors: [
    'ECONNREFUSED',
    'ETIMEDOUT',
    'RateLimitError',
    'ChromaDBError',
    'OpenAIError',
  ],
};

// Implementation
async function executeNodeWithRetry(
  node: Function,
  state: MappingState,
  retryCount = 0,
): Promise<Partial<MappingState>> {
  try {
    return await node(state);
  } catch (error) {
    const isRetryable = RETRY_CONFIG.retryableErrors.some((err) =>
      error.message.includes(err),
    );

    if (isRetryable && retryCount < RETRY_CONFIG.maxRetries) {
      const delayMs = Math.pow(2, retryCount) * 1000;
      logger.warn(`Retrying node (attempt ${retryCount + 1}) after ${delayMs}ms`);

      await sleep(delayMs);
      return executeNodeWithRetry(node, state, retryCount + 1);
    }

    throw error;
  }
}
```

### Timeout Handling

```typescript
// Per-node timeouts
const NODE_TIMEOUTS = {
  load_repo_context: 300_000,      // 5 min
  plan_semantics: 5_000,           // 5 sec
  embedding_retrieval: 30_000,     // 30 sec
  ast_filter: 60_000,              // 1 min
  reasoning_agent: 120_000,        // 2 min
  confidence_gate: 5_000,          // 5 sec
  final_mapping: 10_000,           // 10 sec
};

async function executeNodeWithTimeout(
  node: Function,
  state: MappingState,
  nodeName: string,
): Promise<Partial<MappingState>> {
  const timeout = NODE_TIMEOUTS[nodeName];

  return Promise.race([
    node(state),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Node ${nodeName} timed out after ${timeout}ms`)), timeout),
    ),
  ]);
}
```

### Error Context Propagation

```typescript
// Capture rich error context
try {
  await reasoningAgentNode(state);
} catch (error) {
  const errorContext = {
    nodeName: 'reasoning_agent',
    dagNodeId: state.currentDagNode?.id,
    errorType: error.constructor.name,
    retryCount: state.retryCount,
    stackTrace: error.stack,
    state: {
      semanticDescription: state.semanticDescription,
      candidatesCount: state.filteredCandidates?.length,
    },
  };

  logger.error('Node execution failed', errorContext);

  // Store in state for debugging
  return {
    error: errorContext,
    status: 'failed',
  };
}
```

---

## Cost Monitoring

### Cost Tracking

```typescript
// Track costs in state
interface CostTracking {
  embeddingCalls: number;
  llmCalls: number;
  totalTokens: number;
  estimatedCostUSD: number;
}

// Update costs per node
const costUpdate = {
  costTracking: {
    embeddingCalls: 1,
    llmCalls: 0,
    totalTokens: 500,
    estimatedCostUSD: 0.00001, // $0.02 per 1M tokens
  },
};

// Pricing (as of 2024)
const PRICING = {
  'text-embedding-3-small': 0.00002,  // $0.02 per 1M tokens
  'gpt-4o': 0.015,                     // $0.015 per 1K tokens (input)
};
```

### Cost Limits

```typescript
// Per-job cost limit
const MAX_JOB_COST_USD = 5.0;

// Check before expensive operations
if (state.costTracking.estimatedCostUSD > MAX_JOB_COST_USD) {
  throw new Error(`Job cost limit exceeded: $${state.costTracking.estimatedCostUSD}`);
}

// Daily budget alert
if (dailyCost > 100) {
  alertOps('Daily LangGraph cost exceeding $100');
}
```

### Cost Optimization Tips

1. **Cache repo embeddings** (7-day TTL)
2. **Batch embed** multiple DAG nodes
3. **Limit LLM candidates** to top-3
4. **Use cheaper models** for non-critical paths (e.g., `gpt-4o-mini` for confidence extraction)
5. **Cache identical queries** (same semantic description)

---

## Tracing (OpenTelemetry)

```typescript
// Instrument LangGraph execution
import { trace, context } from '@opentelemetry/api';

const tracer = trace.getTracer('langgraph-mapping');

async function executeNodeWithTracing(
  node: Function,
  state: MappingState,
  nodeName: string,
): Promise<Partial<MappingState>> {
  const span = tracer.startSpan(nodeName, {
    attributes: {
      'job.id': state.jobId,
      'dag.node.id': state.currentDagNode?.id,
      'operator.type': state.semanticDescription?.operatorType,
    },
  });

  try {
    const result = await context.with(trace.setSpan(context.active(), span), () =>
      node(state),
    );

    span.setStatus({ code: 1 }); // OK
    return result;
  } catch (error) {
    span.setStatus({ code: 2, message: error.message }); // ERROR
    span.recordException(error);
    throw error;
  } finally {
    span.end();
  }
}
```

---

## Production Monitoring Checklist

- [ ] Structured logging to Elasticsearch
- [ ] Prometheus metrics exported at `/metrics`
- [ ] Grafana dashboards for job status, latency, confidence
- [ ] AlertManager rules for failures, cost, latency
- [ ] OpenTelemetry tracing to Jaeger/Tempo
- [ ] Daily cost reports
- [ ] Weekly confidence analysis
- [ ] On-call runbook for common failures

---

## Example Grafana Dashboard JSON

See `backend/grafana/langgraph-dashboard.json` (to be created)

---

## Troubleshooting Common Issues

### Issue: High LLM failure rate

**Symptoms:** `llm_call_failed` errors, timeouts

**Diagnosis:**
```bash
# Check error logs
curl -X GET "http://elasticsearch:9200/langgraph-*/_search" -H 'Content-Type: application/json' -d '
{
  "query": { "match": { "message": "llm_call_failed" } },
  "size": 10
}'
```

**Fixes:**
- Increase `LLM_TIMEOUT_MS`
- Check OpenAI API status
- Verify API key rotation

### Issue: Low confidence mappings

**Symptoms:** High `routing=low` rate

**Diagnosis:**
```promql
rate(langgraph_confidence_score_bucket{routing="low"}[10m])
```

**Fixes:**
- Improve AST filtering rules
- Tune confidence thresholds
- Add more semantic keywords

### Issue: Cost overruns

**Symptoms:** `cost_limit_exceeded` errors

**Diagnosis:**
```bash
# Check cost metrics
curl http://localhost:3000/metrics | grep langgraph_daily_cost
```

**Fixes:**
- Reduce `RETRIEVAL_TOP_K`
- Cache more aggressively
- Use `gpt-4o-mini` for non-critical paths

---

## Next Steps

1. Set up Prometheus + Grafana
2. Configure AlertManager
3. Create runbook for on-call
4. Weekly review of confidence metrics
5. Monthly cost analysis
