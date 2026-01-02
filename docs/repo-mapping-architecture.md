# Repository Mapping Architecture

## Overview
The Repository Mapping module is designed to bridge the gap between Spark Physical Execution Plans (DAGs) and the actual source code that generated them. It uses a sophisticated Agentic Workflow powered by **LangGraph**, **OpenAI Embeddings**, **ChromaDB**, and **LLM Reasoning**.

The system is fully **multi-tenant** and supports **reproducible snapshots** (Time Travel).

## Architecture Flow Diagram

```mermaid
graph TD
    subgraph "Orchestration Layer"
        JOB[Mapping Orchestrator] -->|Spawns| GRAPH[LangGraph Workflow]
        JOB -->|Manages| STATE[Job State]
    end

    subgraph "Ingestion Phase"
        START((Start)) --> LOAD_REPO[Load Repo Context]
        LOAD_REPO -->|1. Clone Repo/Checkout Commit| GIT[Git Clone]
        LOAD_REPO -->|2. Register Snapshot| POSTGRES[(Postgres DB)]
        LOAD_REPO -->|3. Parse AST| AST[AST Parser]
        LOAD_REPO -->|4. Generate Embeddings| OAI_EMBED[OpenAI Embeddings]
        LOAD_REPO -->|5. Store Vectors + Metadata| CHROMA[(ChromaDB)]
    end

    subgraph "Mapping Phase (Per DAG Node)"
        PLAN_SEM[Plan Semantics] -->|Analyze DAG Node| SEMANTIC_DESC[Semantic Description]
        SEMANTIC_DESC --> RETRIEVAL[Embedding Retrieval]
        
        RETRIEVAL -->|1. Embed Query| OAI_EMBED
        RETRIEVAL -->|2. Query Vectors (Strict Tenant Isolation)| CHROMA
        
        RETRIEVAL -->|Raw Candidates| AST_FILTER[AST Filter]
        AST_FILTER -->|Filter Incompatible| FILTERED[Filtered Candidates]
        
        FILTERED --> REASONING[Reasoning Agent]
        REASONING -->|LLM Analysis| CONFIDENCE[Confidence Gate]
        
        CONFIDENCE -->|High/Medium| FINAL[Final Mapping]
        CONFIDENCE -->|Low| UNRESOLVED[Unresolved]
    end

    GRAPH --> START
    LOAD_REPO --> PLAN_SEM
    
    style CHROMA fill:#f9f,stroke:#333,stroke-width:2px
    style OAI_EMBED fill:#9cf,stroke:#333,stroke-width:2px
    style REASONING fill:#fc9,stroke:#333,stroke-width:2px
    style POSTGRES fill:#69b,stroke:#333,stroke-width:2px
```

## Multi-Tenancy & Versioning Strategy

### 1. The "Versioned Monolith" Collection Strategy
We use a **Single Monolithic Collection** per embedding model version to maximize resource efficiency (fewer connection handles) while maintaining strict logical isolation.

*   **Naming Convention**: `{prefix}_{schema_version}_{model_id_sanitized}`
    *   Example: `code_v1_openai_text_3_small`
*   **Isolation**: All queries **MUST** includes a `where` clause for:
    *   `tenant_id`: The organization owning the data.
    *   `snapshot_id`: The specific immutable commit being analyzed.

### 2. Data Model (Postgres)
Postgres acts as the Source of Truth for lifecycle management.

*   **Repository**: Stores the Git URL and default branch. Linked to a `Tenant`.
*   **RepoSnapshot**: Represents an immutable point in time (Commit Hash).
    *   `id`: `snapshot_id` used in Chroma.
    *   `commitHash`: Exact SHA.
    *   `status`: `PENDING` -> `INDEXING` -> `ACTIVE` -> `ARCHIVED`.
    *   `lastUsedAt`: Used for retention policy (auto-pruning old snapshots).

### 3. Chroma Metadata Schema
Every vector stored in ChromaDB is tagged with mandatory isolation fields:

| Field | Description | Required Filter? |
| :--- | :--- | :--- |
| `tenant_id` | Partition key for multi-tenancy. | **ALWAYS** |
| `snapshot_id` | The specific immutable commit build. | **ALWAYS** |
| `repo_id` | Useful for "all snapshots" admin queries. | No |
| `file_path` | Relative path for retrieval. | No |
| `symbol` | Name of the function/class. | No |
| `spark_ops` | Array of detected Spark operations (e.g., `["groupby", "join"]`). | No (Query time) |

---

## Detailed Workflow

### 1. Ingestion Phase (`load-repo-context.node.ts`)
Before any mapping occurs, the system understands the target repository at a **specific commit**.

1.  **Repo Resolution**:
    *   Input: `Result<RepoContext>` updated with `commitHash`.
    *   Logic: Check Postgres if a `RepoSnapshot` already exists for this `commitHash`.
    *   **Cache Hit**: If status is `ACTIVE`, reuse existing `snapshot_id`. Skip indexing.
    *   **Cache Miss**: Create new `RepoSnapshot` (status `INDEXING`). Proceed to index.

2.  **Cloning & Indexing**:
    *   Clone the repository at the specific `commitHash`.
    *   Parse AST to find Functions/Classes.
    *   Generate Embeddings (`openai-text-3-small`).
    *   **Upsert to Chroma**: Add vectors with `metadata: { tenant_id, snapshot_id, ... }`.
    *   Update Postgres: Set status to `ACTIVE`.

### 2. Semantic Analysis (`plan-semantics.node.ts`)
(No changes: Extracts operator type, input schemas, and transformation logic from the DAG node).

### 3. Retrieval (`embedding-retrieval.node.ts`)
We search the codebase for code that likely implements the logic.

*   **Strict Isolation**: The internal query wrapper `queryChromaDB` **ENFORCES** the following filter:
    ```javascript
    where: {
      $and: [
        { tenant_id: { $eq: currentTenantId } },
        { snapshot_id: { $eq: currentSnapshotId } }, // Scopes search to EXACT version
        { spark_ops: { $contains: operatorType } }   // Optional semantic filter
      ]
    }
    ```
*   **Effect**: A user analyzing `Commit B` will NEVER see code from `Commit A`, ensuring perfect reproducibility.

### 4. AST Filtering (`ast-filter.node.ts`)
(No changes: Filters candidates based on structural heuristics like presence of specific method calls).

### 5. Reasoning Agent (`reasoning-agent.node.ts`)
(No changes: LLM compares plan logic vs. code implementation).

---

## Key Technologies

### OpenAI Embeddings
*   **Model**: `text-embedding-3-small`
*   **Usage**: Converts code and plans into 1536-dim vectors.

### ChromaDB (Cloud)
*   **Role**: Vector Database.
*   **Strategy**: Cloud-native, scaled deployment.
*   **Tenancy**: Logical separation via metadata.

### LangGraph
*   **Role**: Orchestration Framework.
*   **State**: Manages the `MappingState` which now includes `tenantId`, `repoId`, and `snapshotId`.

## Future Improvements

### A. Retention Policy (Cron Job)
A background job will run daily to prune old snapshots:
*   **Rule**: Keep snapshot IF (`isLatest` OR `lastUsed < 30 days` OR `hasAnalysis`).
*   **Action**:
    1.  Delete vectors from Chroma (`delete where snapshot_id = X`).
    2.  Mark Postgres record as `ARCHIVED`.

### B. Commit Hash Input
*   **Status**: Implemented.
*   **Flow**: User can optionally provide a specific `commitHash` in the UI. If provided, the agent clones/indexes that exact version. If not, it defaults to `HEAD` of the specified branch.
