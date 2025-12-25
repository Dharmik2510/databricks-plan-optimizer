# Spark Execution Plan Analysis

## Feature Overview

AI-powered analysis of Apache Spark physical execution plans to identify performance bottlenecks, optimization opportunities, and generate actionable recommendations with estimated time and cost savings.

---

## Technical Architecture

### Frontend Components

#### 1. **App Component - Home Tab**
- **Location:** [frontend/App.tsx](../frontend/App.tsx:142-318)
- **Purpose:** Main interface for submitting Spark plans for analysis
- **Key Elements:**

**Input Methods:**
- **Text Area:** Paste raw Spark physical plan or SQL EXPLAIN output
- **File Upload:** Upload .txt, .sql, .log files containing plans
  - Implementation: [frontend/App.tsx](../frontend/App.tsx:280-308)
  - Drag-and-drop support
  - File size limit: 5MB (client-side validation)

**Cluster Configuration:**
- Instance Type Selector (e.g., `m5.2xlarge`, `i3.4xlarge`)
- Region Selector (AWS regions: us-east-1, us-west-2, etc.)
- Databricks Runtime Version (DBR 11.3 LTS, 12.2 LTS, 13.3 LTS)
- Purpose: Used for cost estimation calculations

**Analyze Button:**
- Triggers analysis creation
- Disabled states:
  - No plan content provided
  - Analysis already in progress
  - Missing required fields

#### 2. **Analysis Creation Handler**
- **Location:** [frontend/App.tsx](../frontend/App.tsx:459-509)
- **Method:** `handleAnalyze()`
- **Process:**
  1. Validate inputs (plan content, title)
  2. Prepare payload with cluster context
  3. Call `createAnalysis()` from `useAnalysis` hook
  4. Set loading state
  5. Poll for completion
  6. Switch to Dashboard tab on success

### Backend Modules

#### 1. **AnalysisController**
- **Location:** [backend/src/modules/analysis/analysis.controller.ts](../backend/src/modules/analysis/analysis.controller.ts)

**Key Endpoints:**

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/v1/analyses` | Create new analysis | Yes |
| GET | `/api/v1/analyses/:id` | Get full analysis result | Yes |
| GET | `/api/v1/analyses/:id/status` | Poll analysis status | Yes |
| POST | `/api/v1/analyses/:id/retry` | Retry failed analysis | Yes |

**Create Analysis Request:**
```typescript
{
  textContent: string;           // Raw Spark plan text
  repoFiles?: RepoFile[];        // Optional code files for mapping
  clusterContext?: {
    instanceType: string;        // e.g., "m5.2xlarge"
    region: string;              // e.g., "us-east-1"
    dbrVersion: string;          // e.g., "12.2 LTS"
  };
  analysisTitle?: string;        // Custom title
}
```

#### 2. **AnalysisService**
- **Location:** [backend/src/modules/analysis/analysis.service.ts](../backend/src/modules/analysis/analysis.service.ts)

**Core Methods:**

**`create(userId, dto)`**
- Generates content hash (SHA-256) for caching
- Checks for existing analysis with same hash (last 30 days)
- Creates database record with `status: PROCESSING`
- Queues async processing
- Returns analysis ID immediately

**`processAnalysis(analysisId)`**
- Async processing pipeline:
  1. Fetch analysis record
  2. Call Gemini AI service
  3. Parse and validate AI response
  4. Repair DAG connectivity (orphan node detection)
  5. Map nodes to code (if repo files provided)
  6. Calculate derived metrics
  7. Update database with results
  8. Set status to `COMPLETED` or `FAILED`

**`getStatus(analysisId)`**
- Returns lightweight status object:
  ```typescript
  {
    id: string;
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    error?: string;
  }
  ```

#### 3. **GeminiService - DAG Analysis**
- **Location:** [backend/src/integrations/gemini/gemini.service.ts](../backend/src/integrations/gemini/gemini.service.ts:45-150)

**Method:** `analyzeDAG(planContent)`

**AI Model:** `gemini-2.0-flash-exp`

**Prompt Engineering:**
```typescript
System Prompt:
- Expert Spark performance analyst
- Analyze execution plans for bottlenecks
- Generate structured JSON output

Input:
- Raw Spark physical plan text
- Examples of common issues (Cartesian products, shuffles, etc.)

Output Schema (Enforced via Gemini JSON mode):
{
  summary: string,
  dagNodes: DagNode[],
  dagLinks: DagLink[],
  optimizations: Optimization[],
  resourceMetrics: ResourceMetrics,
  predictiveAnalytics: PredictiveAnalytics
}
```

**Structured Output Types:**

**DagNode:**
```typescript
{
  id: string;              // Unique node ID
  label: string;           // Node name (e.g., "Scan parquet")
  nodeType: string;        // "Scan" | "Filter" | "Join" | "Shuffle" | "Aggregate"
  stage?: number;          // Spark stage number
  partitions?: number;     // Partition count
  bytesRead?: number;      // Input size
  bytesWritten?: number;   // Output size
  duration?: number;       // Execution time (ms)
  tableName?: string;      // For scan nodes
  joinType?: string;       // For join nodes
  isProblematic?: boolean; // Flagged by AI
  problemDescription?: string;
}
```

**DagLink:**
```typescript
{
  source: string;          // Source node ID
  target: string;          // Target node ID
  label?: string;          // Edge description (e.g., "exchange")
  isProblematic?: boolean; // Expensive shuffle
}
```

**Optimization:**
```typescript
{
  id: string;
  title: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: 'SHUFFLE' | 'SKEW' | 'MEMORY' | 'IO' | 'JOIN' | 'PARTITION';
  impact: {
    timeSavedSeconds?: number;
    costSavedUSD?: number;
  };
  recommendation: string;
  affectedStages: number[];
  relatedNodeIds: string[];
  codeExample?: string;
  confidence: number;       // 0-100
}
```

**ResourceMetrics:**
```typescript
{
  totalStages: number;
  totalTasks: number;
  dataProcessedGB: number;
  shuffleDataGB: number;
  estimatedCostUSD: number;
  peakMemoryGB: number;
}
```

**PredictiveAnalytics:**
```typescript
{
  bottlenecks: {
    stage: number;
    type: string;
    impact: string;
  }[];
  scalabilityScore: number; // 0-100
  recommendedActions: string[];
}
```

---

## Data Flow

### Analysis Creation & Processing

```
┌─────────────────────────┐
│  Frontend: Home Tab     │
│  - User pastes plan     │
│  - Configures cluster   │
│  - Clicks "Analyze"     │
└───────────┬─────────────┘
            │
            │ 1. Submit analysis request
            ▼
┌─────────────────────────────────────────┐
│ POST /api/v1/analyses                   │
│ Body: {                                 │
│   textContent: "== Physical Plan ==...",│
│   clusterContext: {...},                │
│   analysisTitle: "Q3 Sales Query"      │
│ }                                       │
└───────────┬─────────────────────────────┘
            │
            │ 2. Synchronous processing
            ▼
┌─────────────────────────────────────────┐
│ AnalysisService.create()                │
│ - Generate SHA-256 hash of plan         │
│ - Check for duplicate (same hash)       │
│ - If found: return cached result        │
│ - If new: create DB record              │
└───────────┬─────────────────────────────┘
            │
            │ 3. Database insert
            ▼
┌─────────────────────────────────────────┐
│ PostgreSQL: Analysis table              │
│ INSERT {                                │
│   id: uuid(),                           │
│   userId: req.user.id,                  │
│   content: planText,                    │
│   contentHash: sha256Hash,              │
│   status: 'PROCESSING',                 │
│   clusterContext: {...}                 │
│ }                                       │
└───────────┬─────────────────────────────┘
            │
            │ 4. Return analysis ID
            ▼
┌─────────────────────────────────────────┐
│ Response: { id: "abc-123", ... }        │
└───────────┬─────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│ Frontend: Start polling                 │
│ - GET /api/v1/analyses/:id/status       │
│ - Every 2 seconds                       │
│ - Until status !== 'PROCESSING'         │
└─────────────────────────────────────────┘

            ┌─ Async Processing ─────────┐
            │                            │
            ▼                            │
┌─────────────────────────────────────────┤
│ AnalysisService.processAnalysis()       │
└───────────┬─────────────────────────────┘
            │
            │ 5. AI analysis
            ▼
┌─────────────────────────────────────────┐
│ GeminiService.analyzeDAG()              │
│ - Build prompt with system context      │
│ - Include plan text                     │
│ - Request structured JSON output        │
│ - Timeout: 60 seconds                   │
└───────────┬─────────────────────────────┘
            │
            │ 6. AI generates analysis
            ▼
┌─────────────────────────────────────────┐
│ Google Gemini 2.0 Flash                 │
│ - Parses Spark plan text                │
│ - Identifies stages, nodes, edges       │
│ - Detects anti-patterns                 │
│ - Calculates metrics                    │
│ - Generates recommendations             │
└───────────┬─────────────────────────────┘
            │
            │ 7. Returns structured JSON
            ▼
┌─────────────────────────────────────────┐
│ {                                       │
│   summary: "Analysis of 12-stage...",   │
│   dagNodes: [                           │
│     { id: "scan_1", type: "Scan", ... },│
│     { id: "join_2", type: "Join", ... } │
│   ],                                    │
│   dagLinks: [                           │
│     { source: "scan_1", target: "join_2"}│
│   ],                                    │
│   optimizations: [                      │
│     {                                   │
│       title: "Eliminate Cartesian...",  │
│       severity: "CRITICAL",             │
│       impact: { timeSavedSeconds: 1800 }│
│     }                                   │
│   ],                                    │
│   resourceMetrics: {...},               │
│   predictiveAnalytics: {...}            │
│ }                                       │
└───────────┬─────────────────────────────┘
            │
            │ 8. Post-processing
            ▼
┌─────────────────────────────────────────┐
│ AnalysisService (continued)             │
│ - Validate AI response structure        │
│ - Repair DAG connectivity               │
│   (connect orphan nodes)                │
│ - Map nodes to code (if repoFiles)      │
│ - Calculate derived metrics:            │
│   * dagNodeCount                        │
│   * dagLinkCount                        │
│   * optimizationCount                   │
│   * maxSeverity                         │
└───────────┬─────────────────────────────┘
            │
            │ 9. Update database
            ▼
┌─────────────────────────────────────────┐
│ PostgreSQL: UPDATE Analysis             │
│ SET                                     │
│   result = aiAnalysisJson,              │
│   status = 'COMPLETED',                 │
│   dagNodeCount = 12,                    │
│   optimizationCount = 5,                │
│   maxSeverity = 'CRITICAL',             │
│   processingMs = 4235,                  │
│   aiModel = 'gemini-2.0-flash-exp'     │
│ WHERE id = analysisId                   │
└───────────┬─────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│ Frontend: Polling detects completion    │
│ - GET /api/v1/analyses/:id              │
│ - Fetch full result                     │
│ - Switch to Dashboard tab               │
│ - Render DAG visualization              │
│ - Display optimizations                 │
└─────────────────────────────────────────┘
```

---

## AI Analysis Deep Dive

### Gemini Prompt Structure

**System Prompt:**
```
You are an expert Apache Spark performance analyst. Analyze the provided
Spark physical execution plan and identify performance bottlenecks,
inefficiencies, and optimization opportunities.

Focus on detecting:
- Cartesian products (large cross joins)
- Shuffle storms (excessive data movement)
- Memory pressure (large broadcasts, aggregations)
- Inefficient scans (full table scans, missing partitions)
- Data skew (uneven partition distribution)
- Suboptimal join strategies

Provide structured output with DAG representation and actionable recommendations.
```

**User Message:**
```
Analyze this Spark execution plan:

{planContent}

Generate a complete analysis including:
1. DAG structure (nodes and edges)
2. Optimizations with severity levels
3. Resource metrics
4. Predictive analytics for scalability
```

**Response Schema Enforcement:**
```typescript
generationConfig: {
  responseMimeType: "application/json",
  responseSchema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      dagNodes: { type: "array", items: { ... } },
      dagLinks: { type: "array", items: { ... } },
      optimizations: { type: "array", items: { ... } },
      resourceMetrics: { type: "object", properties: { ... } },
      predictiveAnalytics: { type: "object", properties: { ... } }
    },
    required: ["summary", "dagNodes", "dagLinks", "optimizations"]
  }
}
```

### Common Detected Issues

**1. Cartesian Product (CRITICAL)**
```
Title: "Eliminate Cartesian Product in Join"
Description: "Stage 3 performs a cross join without join conditions,
             resulting in exponential row expansion."
Severity: CRITICAL
Impact: { timeSavedSeconds: 3600, costSavedUSD: 50 }
Recommendation: "Add explicit join condition or use broadcast join
                for small dimension table."
Code Example:
  # Before
  df1.crossJoin(df2)

  # After
  df1.join(df2, df1.id == df2.user_id, "inner")
```

**2. Shuffle Storm (HIGH)**
```
Title: "Reduce Shuffle Volume in Wide Transformation"
Description: "Stage 5 shuffles 120GB across 200 partitions due to
             groupBy operation."
Severity: HIGH
Impact: { timeSavedSeconds: 1200, costSavedUSD: 15 }
Recommendation: "Pre-aggregate data before shuffle or increase partition count."
Code Example:
  df.repartition(400, "key").groupBy("key").agg(...)
```

**3. Data Skew (HIGH)**
```
Title: "Handle Data Skew in Partition Distribution"
Description: "Partition 42 processes 80% of data while others idle."
Severity: HIGH
Impact: { timeSavedSeconds: 900 }
Recommendation: "Use salting technique to distribute skewed keys."
Code Example:
  df.withColumn("salt", (rand() * 10).cast("int"))
    .groupBy("skewed_key", "salt")
    .agg(...)
```

**4. Inefficient Scan (MEDIUM)**
```
Title: "Add Partition Pruning to Table Scan"
Description: "Full table scan on 500GB table without partition filters."
Severity: MEDIUM
Impact: { timeSavedSeconds: 600, costSavedUSD: 8 }
Recommendation: "Add partition filter on date column."
Code Example:
  df.filter(col("date") >= "2024-01-01")
```

### DAG Connectivity Repair

**Problem:** AI sometimes generates disconnected DAG components

**Solution:** `GeminiService.repairDagConnectivity()`
- **Location:** [backend/src/integrations/gemini/gemini.service.ts](../backend/src/integrations/gemini/gemini.service.ts:200-250)

**Algorithm:**
1. Build adjacency map from links
2. Identify orphan scan nodes (no incoming/outgoing edges)
3. Identify potential target nodes (roots of other sub-graphs)
4. Connect orphans to targets with synthetic edges
5. Label edges as `"inferred connection"`

---

## Database Schema

### Analysis Table
```prisma
model Analysis {
  id                  String           @id @default(uuid())
  userId              String
  user                User             @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Input
  content             String           @db.Text
  contentHash         String           // SHA-256 for deduplication
  clusterContext      Json?            // { instanceType, region, dbrVersion }
  analysisTitle       String?

  // Processing
  status              AnalysisStatus   @default(PENDING)
  error               String?

  // Output
  result              Json?            // Full AI analysis result

  // Denormalized metrics (for quick filtering)
  dagNodeCount        Int?
  dagLinkCount        Int?
  optimizationCount   Int?
  maxSeverity         String?          // CRITICAL, HIGH, MEDIUM, LOW

  // Metadata
  processingMs        Int?             // Processing duration
  aiModel             String?          // e.g., "gemini-2.0-flash-exp"

  createdAt           DateTime         @default(now())
  updatedAt           DateTime         @updatedAt

  // Relations
  chatSessions        ChatSession[]

  @@index([userId, createdAt])
  @@index([contentHash])
  @@index([status])
}

enum AnalysisStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}
```

---

## Performance Optimizations

### 1. **Content Deduplication**
- Hash-based caching prevents re-analyzing identical plans
- SHA-256 hash of plan content
- Cache window: 30 days
- Instant results for duplicate submissions

### 2. **Async Processing**
- Non-blocking analysis creation
- Immediate response with analysis ID
- Client-side polling for status updates
- Prevents timeout on long-running AI calls

### 3. **Polling Strategy**
- Interval: 2 seconds
- Exponential backoff: 2s → 3s → 5s (planned)
- Timeout: 120 seconds
- Prevents excessive server load

### 4. **Database Indexing**
```sql
-- Fast user analysis lookups
CREATE INDEX idx_analysis_user_created ON Analysis(userId, createdAt);

-- Deduplication lookups
CREATE INDEX idx_analysis_content_hash ON Analysis(contentHash);

-- Status filtering
CREATE INDEX idx_analysis_status ON Analysis(status);
```

### 5. **Partial Response**
- Status endpoint returns minimal data (id, status, error)
- Full result fetched only on completion
- Reduces network payload during polling

---

## Error Handling

### Frontend Errors
- **No plan content:** Client-side validation prevents submission
- **Upload too large:** 5MB limit with user notification
- **Analysis timeout:** After 120s, show retry option
- **Processing failed:** Display error message from backend

### Backend Errors
- **AI timeout:** 60s limit on Gemini call, returns 500 error
- **Invalid plan format:** AI may still attempt analysis (flexible parsing)
- **Rate limiting:** Gemini API quotas (handled with exponential backoff)
- **Database errors:** Transaction rollback, status set to FAILED

### Retry Mechanism
- **Endpoint:** `POST /api/v1/analyses/:id/retry`
- **Behavior:**
  1. Reset status to PROCESSING
  2. Clear previous error
  3. Re-run analysis pipeline
  4. Preserve original input data

---

## Usage Examples

### Frontend: Submit Analysis
```typescript
const handleAnalyze = async () => {
  const result = await createAnalysis({
    textContent: planContent,
    clusterContext: {
      instanceType: selectedInstance,
      region: selectedRegion,
      dbrVersion: selectedDBR
    },
    analysisTitle: customTitle || 'Untitled Analysis'
  });

  setCurrentAnalysisId(result.id);
  pollAnalysisStatus(result.id);
};
```

### Frontend: Poll Status
```typescript
const pollAnalysisStatus = async (id: string) => {
  const interval = setInterval(async () => {
    const status = await getAnalysisStatus(id);

    if (status.status === 'COMPLETED') {
      clearInterval(interval);
      const fullResult = await getAnalysisById(id);
      displayResults(fullResult);
    } else if (status.status === 'FAILED') {
      clearInterval(interval);
      showError(status.error);
    }
  }, 2000);
};
```

### Backend: Custom Analysis Logic
```typescript
// Add custom validation before AI call
const validatedPlan = validateSparkPlan(planContent);
if (!validatedPlan.isValid) {
  throw new BadRequestException('Invalid Spark plan format');
}

// Call Gemini with retry
const analysis = await this.geminiService.analyzeDAG(
  planContent,
  { retries: 3, timeout: 60000 }
);
```

---

## Integration Points

### With Other Features

**1. DAG Visualization**
- Consumes `dagNodes` and `dagLinks` from analysis result
- Renders using D3.js force-directed graph
- Highlights problematic nodes

**2. Optimization Panel**
- Displays `optimizations` array
- Groups by severity
- Shows impact metrics

**3. Code Mapping**
- Uses `dagNodes` to map to source code
- Matches `tableName` and `nodeType` properties

**4. Chat Consultant**
- Analysis result provides context for AI chat
- Optimizations feed into conversation

**5. Cost Estimation**
- `resourceMetrics.estimatedCostUSD` used as baseline
- Optimization impacts calculate savings

---

## Future Enhancements

- [ ] Real-time streaming analysis (WebSocket updates)
- [ ] Support for Spark SQL query plans (in addition to physical plans)
- [ ] Historical comparison (track optimization impact over time)
- [ ] Automated plan generation from SQL queries
- [ ] Multi-plan comparison (A/B testing different optimizations)
- [ ] Custom optimization rule engine (user-defined patterns)
- [ ] Export analysis report as PDF
- [ ] Spark UI log integration (parse event logs)
