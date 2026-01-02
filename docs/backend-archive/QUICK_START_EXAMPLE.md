# Quick Start: Test the LangGraph Mapping System

This guide walks you through testing the DAG → Code mapping system with a minimal example.

---

## Prerequisites

1. ✅ Dependencies installed (`npm install`)
2. ✅ `.env` file configured with `OPENAI_API_KEY`
3. ✅ ChromaDB running (or mock mode)
4. ✅ Backend running (`npm run start:dev`)

---

## Step 1: Create a Test DAG Node

Create `backend/test-data/sample-dag-node.json`:

```json
{
  "id": "stage_3",
  "operator": "HashAggregate",
  "keys": ["customer_id"],
  "aggregations": [
    {
      "func": "count",
      "col": "*"
    }
  ],
  "filters": [],
  "children": ["stage_2"],
  "physicalPlanFragment": "HashAggregate(keys=[customer_id#123], functions=[count(1)])\n+- Exchange hashpartitioning(customer_id#123, 200)\n   +- Filter (age#456 > 18)"
}
```

---

## Step 2: Test Individual Nodes

### Test: plan_semantics_node

```typescript
// backend/test-plan-semantics.ts
import { planSemanticsNode } from './src/modules/agent/langgraph/nodes/plan-semantics.node';
import dagNode from './test-data/sample-dag-node.json';

async function testPlanSemantics() {
  const state = {
    currentDagNode: dagNode,
  };

  const result = await planSemanticsNode(state as any);

  console.log('Semantic Description:');
  console.log(JSON.stringify(result.semanticDescription, null, 2));
}

testPlanSemantics();
```

**Run:**
```bash
npx tsx backend/test-plan-semantics.ts
```

**Expected Output:**
```json
{
  "dagNodeId": "stage_3",
  "operatorType": "HashAggregate",
  "executionBehavior": "Groups data by customer_id and applies aggregate functions: count",
  "dataTransformation": {
    "inputSchema": ["customer_id", "age"],
    "outputSchema": ["customer_id"],
    "keyColumns": ["customer_id"],
    "aggregateFunctions": ["count"],
    "filterConditions": []
  },
  "sparkOperatorSignature": "HashAggregate groupBy customer_id aggregate count"
}
```

---

## Step 3: Test Full Graph Execution

### Create Test Script

```typescript
// backend/test-full-graph.ts
import { compileGraph, invokeGraph } from './src/modules/agent/langgraph/graph/mapping-graph';
import dagNode from './test-data/sample-dag-node.json';

async function testFullGraph() {
  console.log('Compiling graph...');
  const graph = compileGraph();

  const initialState = {
    jobId: 'test_001',
    analysisId: 'analysis_001',
    repoUrl: 'https://github.com/test/sample-repo', // Use a real public repo
    repoCommitHash: null,
    dagNodes: [dagNode],
    currentDagNode: dagNode,
    status: 'running' as const,
    startTime: new Date(),
  };

  console.log('Invoking graph...');
  const result = await invokeGraph(graph, initialState);

  console.log('\n=== RESULTS ===');
  console.log('Status:', result.status);
  console.log('Completed Mappings:', result.completedMappings.length);

  if (result.completedMappings.length > 0) {
    const mapping = result.completedMappings[0];
    console.log('\nMapping Details:');
    console.log('  DAG Node:', mapping.dagNodeId);
    console.log('  Mapped File:', mapping.mappedCode.file);
    console.log('  Mapped Symbol:', mapping.mappedCode.symbol);
    console.log('  Confidence:', mapping.confidence.toFixed(3));
    console.log('  Explanation:', mapping.explanation);
  }

  console.log('\nCost Tracking:');
  console.log('  LLM Calls:', result.costTracking?.llmCalls || 0);
  console.log('  Embedding Calls:', result.costTracking?.embeddingCalls || 0);
  console.log('  Total Cost:', `$${(result.costTracking?.estimatedCostUSD || 0).toFixed(4)}`);
}

testFullGraph().catch(console.error);
```

**Run:**
```bash
npx tsx backend/test-full-graph.ts
```

**Expected Output:**
```
Compiling graph...
Invoking graph...
[LoadRepoContextNode] Starting repo context load for https://github.com/test/sample-repo
[LoadRepoContextNode] Cloning repository...
[PlanSemanticsNode] Planning semantics for DAG node: stage_3
[EmbeddingRetrievalNode] Retrieving candidates for: HashAggregate groupBy customer_id aggregate count
[ASTFilterNode] Filtering 10 candidates for operator: HashAggregate
[ReasoningAgentNode] Reasoning over 3 candidates
[ConfidenceGateNode] Confidence: 0.850 (high) - emb:0.92 ast:0.85 llm:0.90 kw:0.80
[FinalMappingNode] Finalizing mapping for DAG node: stage_3

=== RESULTS ===
Status: completed
Completed Mappings: 1

Mapping Details:
  DAG Node: stage_3
  Mapped File: src/jobs/customer_aggregation.py
  Mapped Symbol: aggregate_by_customer
  Confidence: 0.850
  Explanation: This function groups data by customer_id and computes count(*), matching the HashAggregate operator.

Cost Tracking:
  LLM Calls: 1
  Embedding Calls: 1
  Total Cost: $0.0190
```

---

## Step 4: Test API Endpoints

### Start Backend

```bash
npm run start:dev
```

### Test: Create Mapping Job

```bash
curl -X POST http://localhost:3000/api/agent/map-to-code \
  -H "Content-Type: application/json" \
  -d '{
    "analysisId": "analysis_001",
    "repoUrl": "https://github.com/test/sample-repo",
    "dagNodes": [
      {
        "id": "stage_3",
        "operator": "HashAggregate",
        "keys": ["customer_id"],
        "aggregations": [{"func": "count", "col": "*"}],
        "physicalPlanFragment": "HashAggregate(keys=[customer_id#123], functions=[count(1)])"
      }
    ]
  }'
```

**Expected Response (202 Accepted):**
```json
{
  "jobId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "status": "submitted"
}
```

### Test: Get Job Status

```bash
curl http://localhost:3000/api/agent/jobs/f47ac10b-58cc-4372-a567-0e02b2c3d479
```

**Expected Response (200 OK):**
```json
{
  "jobId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "status": "running",
  "progress": {
    "totalNodes": 1,
    "completedNodes": 0,
    "currentNode": "stage_3"
  },
  "results": [],
  "error": null,
  "startTime": "2024-01-15T10:30:00.000Z",
  "endTime": null
}
```

**Wait a few seconds, then poll again:**

```bash
curl http://localhost:3000/api/agent/jobs/f47ac10b-58cc-4372-a567-0e02b2c3d479
```

**Expected Response (Completed):**
```json
{
  "jobId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "status": "completed",
  "progress": {
    "totalNodes": 1,
    "completedNodes": 1,
    "currentNode": null
  },
  "results": [
    {
      "dagNodeId": "stage_3",
      "mappedCode": {
        "file": "src/jobs/customer_aggregation.py",
        "symbol": "aggregate_by_customer",
        "lines": "45-67"
      },
      "confidence": 0.85,
      "explanation": "This function groups data by customer_id and computes count, matching the HashAggregate operator.",
      "alternatives": []
    }
  ],
  "error": null,
  "startTime": "2024-01-15T10:30:00.000Z",
  "endTime": "2024-01-15T10:30:45.000Z",
  "costTracking": {
    "totalCostUSD": 0.019
  }
}
```

---

## Step 5: Test Streaming (Server-Sent Events)

### Using curl

```bash
curl -N http://localhost:3000/api/agent/jobs/f47ac10b-58cc-4372-a567-0e02b2c3d479/stream
```

**Expected Output:**
```
data: {"jobId":"f47ac10b-...","status":"running","progress":{"completedNodes":0}}

data: {"jobId":"f47ac10b-...","status":"running","progress":{"completedNodes":1}}

data: {"jobId":"f47ac10b-...","status":"completed","progress":{"completedNodes":1}}
```

### Using JavaScript (Browser)

```javascript
const eventSource = new EventSource('http://localhost:3000/api/agent/jobs/f47ac10b-58cc-4372-a567-0e02b2c3d479/stream');

eventSource.onmessage = (event) => {
  const status = JSON.parse(event.data);
  console.log('Job status:', status);

  if (status.status === 'completed') {
    console.log('Results:', status.results);
    eventSource.close();
  }
};
```

---

## Step 6: Test with Real Repository

### Example: Analyze a Public Spark Repository

```bash
curl -X POST http://localhost:3000/api/agent/map-to-code \
  -H "Content-Type: application/json" \
  -d '{
    "analysisId": "analysis_002",
    "repoUrl": "https://github.com/databricks/koalas",
    "dagNodes": [
      {
        "id": "stage_1",
        "operator": "HashAggregate",
        "keys": ["user_id"],
        "aggregations": [{"func": "sum", "col": "amount"}],
        "physicalPlanFragment": "HashAggregate(keys=[user_id#123], functions=[sum(amount#456)])"
      }
    ]
  }'
```

**This will:**
1. Clone the Koalas repository
2. Parse all Python files
3. Generate embeddings for ~1000 functions
4. Map the DAG node to actual Koalas code
5. Return confidence-scored results

---

## Step 7: Validate Results

### Check Confidence Distribution

```bash
curl http://localhost:3000/api/agent/jobs/<jobId> | jq '.results[] | {dagNodeId, confidence}'
```

**Expected:**
```json
{"dagNodeId":"stage_1","confidence":0.92}
{"dagNodeId":"stage_2","confidence":0.78}
{"dagNodeId":"stage_3","confidence":0.45}
```

### Review Low-Confidence Mappings

```bash
curl http://localhost:3000/api/agent/jobs/<jobId> | jq '.results[] | select(.confidence < 0.5)'
```

---

## Common Test Scenarios

### Scenario 1: High Confidence Mapping

**DAG Node:** Simple `Filter` operator
**Expected:** Confidence > 0.8, single mapping

### Scenario 2: Medium Confidence Mapping

**DAG Node:** Complex `HashAggregate` with multiple keys
**Expected:** Confidence 0.5-0.8, alternatives provided

### Scenario 3: Low Confidence Mapping

**DAG Node:** Obscure operator with no obvious code match
**Expected:** Confidence < 0.5, manual review needed

---

## Debugging Tips

### Enable Debug Logging

```bash
# In .env
LOG_LEVEL=debug

# Restart backend
npm run start:dev
```

### Check Node Execution

```bash
# Tail logs
tail -f logs/langgraph.log | grep "Node completed"
```

### Inspect State

```typescript
// Add to any node
console.log('Current state:', JSON.stringify(state, null, 2));
```

### Test Single Node in Isolation

```typescript
import { reasoningAgentNode } from './src/modules/agent/langgraph/nodes/reasoning-agent.node';

const testState = {
  semanticDescription: {...},
  filteredCandidates: [...],
};

const result = await reasoningAgentNode(testState as any);
console.log(result);
```

---

## Troubleshooting

### Issue: "OpenAI API key not found"

**Fix:**
```bash
echo "OPENAI_API_KEY=sk-your-key-here" >> .env
```

### Issue: "ChromaDB connection refused"

**Fix:**
```bash
docker run -p 8000:8000 chromadb/chroma
```

### Issue: "Graph compilation failed"

**Fix:**
```bash
# Check for TypeScript errors
npm run build

# Check node imports
npm list langgraph
```

---

## Next Steps

1. ✅ Test with mock data (this guide)
2. ⚠️ Integrate with your AST parser service
3. ⚠️ Connect to your ChromaDB instance
4. ⚠️ Set up PostgreSQL checkpointer
5. ⚠️ Deploy to staging environment

---

## Success Criteria

- [ ] `plan_semantics` extracts correct operator semantics
- [ ] `embedding_retrieval` returns relevant candidates
- [ ] `ast_filter` reduces candidates by 50%+
- [ ] `reasoning_agent` selects correct mapping
- [ ] `confidence_gate` computes reasonable scores (0.3-0.9 range)
- [ ] Full graph execution completes in <2 minutes
- [ ] API returns 202 Accepted immediately
- [ ] Job status polls return valid results
- [ ] Streaming emits real-time updates

Once all tests pass, you're ready for production deployment! 🚀
