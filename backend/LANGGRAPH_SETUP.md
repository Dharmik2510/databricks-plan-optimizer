# LangGraph Setup Guide for DAG → Code Mapping

## What is LangGraph?

**LangGraph** is a framework for building stateful, multi-actor applications with LLMs, designed as a graph-based orchestration layer. Unlike LangChain chains (linear, sequential flows), LangGraph uses **nodes** (functions) and **edges** (transitions) to create cyclical, conditional workflows with persistent state—ideal for agentic, production systems.

**Key difference from LangChain in this system:**
- **LangChain**: Linear chains → `retrieval → LLM → output`
- **LangGraph**: Stateful graph → `load_repo → plan_semantics → retrieval → AST_filter → reasoning → confidence_gate → finalize` with branching, retries, and state persistence

---

## Installation

### 1. Install LangGraph and Dependencies

```bash
cd backend
npm install --save langgraph @langchain/core @langchain/openai
npm install --save chromadb openai
npm install --save @types/node tsx
```

**Why these packages:**
- `langgraph`: Core orchestration framework
- `@langchain/core`: Base primitives (messages, schemas)
- `@langchain/openai`: OpenAI embeddings + LLM integration
- `chromadb`: Vector store for code embeddings
- `tsx`: TypeScript execution for development

### 2. Environment Variables

Add to your `.env`:

```bash
# OpenAI
OPENAI_API_KEY=sk-...

# ChromaDB (production)
CHROMA_HOST=localhost
CHROMA_PORT=8000
CHROMA_COLLECTION=code_embeddings

# GitHub (for private repos)
GITHUB_TOKEN=ghp_...

# Job Configuration
MAX_PARALLEL_NODES=5
RETRIEVAL_TOP_K=10
CONFIDENCE_THRESHOLD_HIGH=0.8
CONFIDENCE_THRESHOLD_LOW=0.5

# Observability
LOG_LEVEL=info
METRICS_ENABLED=true
```

---

## Project Structure

```
backend/src/modules/agent/
├── langgraph/
│   ├── nodes/                      # Individual LangGraph nodes
│   │   ├── load-repo-context.node.ts
│   │   ├── plan-semantics.node.ts
│   │   ├── embedding-retrieval.node.ts
│   │   ├── ast-filter.node.ts
│   │   ├── reasoning-agent.node.ts
│   │   ├── confidence-gate.node.ts
│   │   └── final-mapping.node.ts
│   ├── state/                      # State schema definitions
│   │   ├── mapping-state.schema.ts
│   │   └── state.types.ts
│   ├── graph/                      # Graph definition
│   │   ├── mapping-graph.ts
│   │   └── graph.config.ts
│   ├── checkpointers/              # State persistence
│   │   └── postgres.checkpointer.ts
│   └── orchestrator/               # Job orchestrator
│       └── mapping.orchestrator.ts
├── services/
│   ├── github-clone.service.ts     # Repo cloning
│   ├── ast-parser.service.ts       # Existing AST parser
│   ├── chromadb.service.ts         # Vector store
│   └── metrics.service.ts          # Observability
└── controllers/
    └── mapping-job.controller.ts   # API endpoints
```

---

## Minimal Working Example

### Step 1: Define State Schema

```typescript
// backend/src/modules/agent/langgraph/state/mapping-state.schema.ts
import { Annotation } from "@langchain/langgraph";

export const MappingStateAnnotation = Annotation.Root({
  // Job metadata
  jobId: Annotation<string>,
  repoUrl: Annotation<string>,
  repoCommitHash: Annotation<string | null>,

  // Repo context (cached per repo)
  repoContext: Annotation<{
    clonePath: string;
    embeddings: any[];
    astIndex: any;
  } | null>,

  // DAG nodes to process
  dagNodes: Annotation<Array<any>>,
  currentNodeIndex: Annotation<number>,
  currentDagNode: Annotation<any | null>,

  // Processing pipeline
  semanticDescription: Annotation<any | null>,
  retrievedCandidates: Annotation<Array<any>>,
  filteredCandidates: Annotation<Array<any>>,

  // Results
  finalMapping: Annotation<{
    file: string;
    symbol: string;
    lines: string;
  } | null>,
  confidence: Annotation<number>,
  explanation: Annotation<string>,
  alternatives: Annotation<Array<any>>,

  // State management
  status: Annotation<"pending" | "running" | "completed" | "failed">,
  error: Annotation<string | null>,
  completedMappings: Annotation<Array<any>>,
});

export type MappingState = typeof MappingStateAnnotation.State;
```

### Step 2: Create a Simple Node

```typescript
// backend/src/modules/agent/langgraph/nodes/plan-semantics.node.ts
import { MappingState } from '../state/mapping-state.schema';

export async function planSemanticsNode(state: MappingState): Promise<Partial<MappingState>> {
  const { currentDagNode } = state;

  // Extract execution semantics from DAG node
  const semantics = {
    dagNodeId: currentDagNode.id,
    operatorType: currentDagNode.operator,
    keys: currentDagNode.keys || [],
    functions: currentDagNode.aggregations || [],
    filters: currentDagNode.filters || [],
    dependencies: currentDagNode.children || [],
  };

  return {
    semanticDescription: semantics,
  };
}
```

### Step 3: Build the Graph

```typescript
// backend/src/modules/agent/langgraph/graph/mapping-graph.ts
import { StateGraph, END } from "@langchain/langgraph";
import { MappingStateAnnotation } from "../state/mapping-state.schema";
import { loadRepoContextNode } from "../nodes/load-repo-context.node";
import { planSemanticsNode } from "../nodes/plan-semantics.node";
// ... import other nodes

export function createMappingGraph() {
  const workflow = new StateGraph(MappingStateAnnotation)
    // Add nodes
    .addNode("load_repo", loadRepoContextNode)
    .addNode("plan_semantics", planSemanticsNode)
    .addNode("embedding_retrieval", embeddingRetrievalNode)
    .addNode("ast_filter", astFilterNode)
    .addNode("reasoning_agent", reasoningAgentNode)
    .addNode("confidence_gate", confidenceGateNode)
    .addNode("final_mapping", finalMappingNode)

    // Define edges
    .addEdge("__start__", "load_repo")
    .addEdge("load_repo", "plan_semantics")
    .addEdge("plan_semantics", "embedding_retrieval")
    .addEdge("embedding_retrieval", "ast_filter")
    .addEdge("ast_filter", "reasoning_agent")
    .addEdge("reasoning_agent", "confidence_gate")

    // Conditional branching from confidence gate
    .addConditionalEdges(
      "confidence_gate",
      (state) => {
        if (state.confidence >= 0.8) return "finalize";
        if (state.confidence >= 0.5) return "finalize_with_alternatives";
        return "unresolved";
      },
      {
        finalize: "final_mapping",
        finalize_with_alternatives: "final_mapping",
        unresolved: "final_mapping",
      }
    )
    .addEdge("final_mapping", END);

  return workflow.compile();
}
```

### Step 4: Run the Graph

```typescript
// Example usage in controller
import { createMappingGraph } from './graph/mapping-graph';

const graph = createMappingGraph();

const initialState = {
  jobId: "job_123",
  repoUrl: "https://github.com/user/repo",
  repoCommitHash: null,
  dagNodes: [...], // From physical plan
  currentNodeIndex: 0,
  currentDagNode: dagNodes[0],
  status: "running",
  // ... other initial values
};

// Execute graph
const result = await graph.invoke(initialState);
console.log(result.completedMappings);
```

---

## Running Locally

### Development Mode

```bash
# Start ChromaDB (Docker)
docker run -p 8000:8000 chromadb/chroma

# Run the backend
cd backend
npm run start:dev

# Trigger a mapping job
curl -X POST http://localhost:3000/api/agent/map-to-code \
  -H "Content-Type: application/json" \
  -d '{
    "analysisId": "analysis_123",
    "repoUrl": "https://github.com/user/spark-jobs",
    "commitHash": "abc123"
  }'
```

### Testing a Single Node

```typescript
// test-node.ts
import { planSemanticsNode } from './nodes/plan-semantics.node';

const mockState = {
  currentDagNode: {
    id: "stage_3",
    operator: "HashAggregate",
    keys: ["customer_id"],
    aggregations: ["count"],
  },
  // ... minimal required state
};

const result = await planSemanticsNode(mockState);
console.log(result.semanticDescription);
```

---

## Production Deployment

### 1. State Persistence

LangGraph requires a **checkpointer** for production (not in-memory):

```typescript
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

const checkpointer = new PostgresSaver({
  connectionString: process.env.DATABASE_URL,
});

const graph = workflow.compile({ checkpointer });
```

**Why:** Enables pause/resume, retries, and audit trails.

### 2. Async Job Execution

```typescript
// Don't block HTTP response
app.post('/api/agent/map-to-code', async (req, res) => {
  const jobId = generateJobId();

  // Return job ID immediately
  res.json({ jobId, status: "submitted" });

  // Execute graph asynchronously
  executeGraphAsync(jobId, req.body).catch(err => {
    logger.error(`Job ${jobId} failed`, err);
  });
});
```

### 3. Parallel DAG Node Processing

```typescript
// Process multiple DAG nodes concurrently
const promises = dagNodes.slice(0, MAX_PARALLEL).map(node =>
  graph.invoke({
    ...baseState,
    currentDagNode: node,
  })
);

const results = await Promise.allSettled(promises);
```

### 4. Health Checks

```bash
# Check if graph compiles
GET /api/agent/health

# Response
{
  "status": "healthy",
  "langgraph": "compiled",
  "chromadb": "connected",
  "openai": "authenticated"
}
```

---

## Key Concepts for This System

### State Mutations
Each node returns a **partial state update**:
```typescript
return {
  retrievedCandidates: [...],  // Only update this field
};
```

### Conditional Edges
Branch based on confidence:
```typescript
.addConditionalEdges("confidence_gate", (state) => {
  return state.confidence >= 0.8 ? "finalize" : "retry";
});
```

### Node Retries
```typescript
const graph = workflow.compile({
  checkpointer,
  retryPolicy: {
    maxRetries: 3,
    retryableNodes: ["embedding_retrieval", "reasoning_agent"],
  },
});
```

### Streaming Results
```typescript
for await (const chunk of graph.stream(initialState)) {
  console.log("Node completed:", chunk);
  // Emit to frontend via WebSocket
}
```

---

## Common Pitfalls

1. **Forgetting to return partial state**: Nodes must return objects matching `MappingState` keys
2. **Blocking on I/O**: Use async/await everywhere
3. **No checkpointer in prod**: Memory-only state won't survive restarts
4. **Over-nesting nodes**: Keep nodes focused (single responsibility)

---

## Next Steps

1. Read [LANGGRAPH_ARCHITECTURE.md](./LANGGRAPH_ARCHITECTURE.md) for system design
2. Review [STATE_SCHEMA.md](./STATE_SCHEMA.md) for full state definition
3. Implement nodes in `backend/src/modules/agent/langgraph/nodes/`
4. Test locally with sample DAG nodes
5. Deploy with PostgreSQL checkpointer

---

## Resources

- [LangGraph Docs](https://langchain-ai.github.io/langgraph/)
- [LangGraph vs LangChain](https://blog.langchain.dev/langgraph-vs-langchain/)
- [Checkpointers Guide](https://langchain-ai.github.io/langgraph/how-tos/persistence/)
