# Code Mapping Agent (Agentic Feature)

## Feature Overview

Intelligent, multi-strategy code mapping system that connects Spark execution plan stages to actual source code by cloning GitHub repositories, analyzing code, and using evidence-based matching algorithms to pinpoint exact file locations and line numbers.

---

## Technical Architecture

### Frontend Components

#### 1. **PlanCodeMapper (Main Interface)**
- **Location:** [frontend/components/agent/PlanCodeMapper.tsx](../frontend/components/agent/PlanCodeMapper.tsx)
- **Purpose:** 3-stage wizard for code mapping job creation and monitoring
- **Stages:**
  1. **Input Stage:** Repository configuration form
  2. **Processing Stage:** Real-time progress tracking
  3. **Results Stage:** Mapping results display

**Input Form Fields:**
```typescript
{
  planContent: string;       // Spark execution plan text
  repoUrl: string;           // GitHub repository URL
  branch?: string;           // Git branch (default: main)
  accessToken?: string;      // GitHub PAT for private repos
  targetPaths?: string[];    // Specific directories to scan
}
```

#### 2. **AgentProgressTracker**
- **Location:** [frontend/components/agent/AgentProgressTracker.tsx](../frontend/components/agent/AgentProgressTracker.tsx)
- **Purpose:** Real-time job progress visualization
- **Features:**
  - Step-by-step status display
  - Elapsed time counter
  - Progress percentage
  - Current operation description
  - Error display

**Progress Steps:**
```typescript
[
  { name: "Repository Clone", status: "completed", duration: 2.3s },
  { name: "Code Analysis", status: "in_progress", duration: 5.1s },
  { name: "Plan Parsing", status: "pending" },
  { name: "Code Mapping", status: "pending" },
  { name: "Finalization", status: "pending" }
]
```

#### 3. **MappingResultsView**
- **Location:** [frontend/components/agent/MappingResultsView.tsx](../frontend/components/agent/MappingResultsView.tsx)
- **Purpose:** Display mapped code locations with evidence
- **Layout:**
  - Stage list (execution plan stages)
  - Code matches per stage (top 5 by confidence)
  - File path + line number links
  - Code snippet preview
  - Confidence meter
  - Evidence factors breakdown

**Result Card Example:**
```
┌─────────────────────────────────────────────────┐
│ Stage 2: Join customers with orders            │
├─────────────────────────────────────────────────┤
│ 📁 src/jobs/sales_analysis.py:45-67            │
│ Confidence: 87%                                 │
│                                                 │
│ Code Preview:                                   │
│   45 | def join_customer_orders(spark):         │
│   46 |     customers = spark.read.table(...)    │
│   47 |     orders = spark.read.table(...)       │
│   48 |     return customers.join(orders, ...)   │
│                                                 │
│ Evidence:                                       │
│   ✓ Table name match: customers (90%)           │
│   ✓ Operation match: join (70%)                 │
│   ✓ Keyword match: orders (60%)                 │
└─────────────────────────────────────────────────┘
```

### Backend Modules

#### 1. **AgentController**
- **Location:** [backend/src/modules/agent/agent.controller.ts](../backend/src/modules/agent/agent.controller.ts)

**Endpoints:**

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/v1/agent/jobs` | Create mapping job | Yes |
| GET | `/api/v1/agent/jobs/:id` | Get job status & results | Yes |
| POST | `/api/v1/agent/jobs/:id/cancel` | Cancel running job | Yes |

**Create Job Request:**
```typescript
{
  planContent: string;
  repoUrl: string;
  branch?: string;
  accessToken?: string;
  targetPaths?: string[];
}
```

**Job Response:**
```typescript
{
  id: string;
  status: 'PENDING' | 'CLONING' | 'ANALYZING' | 'MAPPING' | 'COMPLETED' | 'FAILED';
  progress: {
    currentStep: string;
    totalSteps: number;
    completedSteps: number;
    percentage: number;
  };
  result?: {
    stages: PlanStage[];
    mappings: StageCodeMapping[];
    summary: {
      totalStages: number;
      mappedStages: number;
      avgConfidence: number;
    };
  };
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}
```

#### 2. **PlanCodeAgentOrchestrator**
- **Location:** [backend/src/modules/agent/plan-code-agent.orchestrator.ts](../backend/src/modules/agent/plan-code-agent.orchestrator.ts)
- **Purpose:** Coordinates the entire mapping pipeline
- **Architecture:** Multi-service orchestration with progress tracking

**Pipeline Stages:**
```typescript
async executeJob(jobId: string) {
  try {
    // 1. Repository Cloning
    this.updateProgress(jobId, 'CLONING', 'Cloning repository...');
    const repoPath = await this.repositoryService.clone(repoUrl, branch);

    // 2. Code Analysis
    this.updateProgress(jobId, 'ANALYZING', 'Analyzing code...');
    const codeAnalysis = await this.repositoryCrawler.analyze(repoPath);

    // 3. Plan Parsing
    this.updateProgress(jobId, 'PARSING', 'Parsing execution plan...');
    const stages = await this.planParser.parse(planContent);

    // 4. Code Mapping
    this.updateProgress(jobId, 'MAPPING', 'Mapping stages to code...');
    const mappings = await this.mappingEngine.map(stages, codeAnalysis);

    // 5. Finalization
    this.updateProgress(jobId, 'COMPLETED', 'Mapping complete');
    await this.saveResults(jobId, { stages, mappings });

  } catch (error) {
    this.updateProgress(jobId, 'FAILED', error.message);
  }
}
```

#### 3. **RepositoryCrawler**
- **Location:** [backend/src/modules/agent/repository-crawler.service.ts](../backend/src/modules/agent/repository-crawler.service.ts)
- **Purpose:** Deep code analysis of cloned repository

**Analysis Output:**
```typescript
{
  files: [{
    path: string;
    type: 'python' | 'scala' | 'sql' | 'notebook';
    content: string;
    functions: FunctionInfo[];
    classes: ClassInfo[];
    tableReferences: TableReference[];
    sparkOperations: SparkOperation[];
  }],
  summary: {
    totalFiles: number;
    totalFunctions: number;
    totalTables: number;
  }
}
```

**Supported File Types:**
- `.py` - Python (PySpark)
- `.scala` - Scala (Spark)
- `.sql` - SQL queries
- `.ipynb` - Jupyter notebooks

**Extraction Techniques:**

**Python (PySpark) Analysis:**
```typescript
// Function extraction
const functionRegex = /def\s+(\w+)\s*\([^)]*\):/g;

// Table references
const tableReadRegex = /spark\.read\.table\(['"]([\w.]+)['"]\)/g;
const tableWriteRegex = /\.write(?:To)?\.(?:saveAsTable|insertInto)\(['"]([\w.]+)['"]\)/g;

// Spark operations
const operationRegex = /\.(join|filter|groupBy|agg|select|withColumn|distinct)\(/g;

// DataFrame transformations
const dfRegex = /(\w+)\s*=\s*(?:spark\.read|.*\.select|.*\.filter)/g;
```

**Scala Analysis:**
```typescript
// Object/class extraction
const objectRegex = /object\s+(\w+)/g;
const classRegex = /class\s+(\w+)/g;

// Table operations
const tableRegex = /spark\.table\(['"]([\w.]+)['"]\)/g;
```

**SQL Analysis:**
```typescript
// Table extraction from queries
const fromRegex = /FROM\s+([\w.]+)/gi;
const joinRegex = /JOIN\s+([\w.]+)/gi;

// Operation detection
const aggregateRegex = /GROUP\s+BY/gi;
const windowRegex = /OVER\s*\(/gi;
```

#### 4. **PlanParser**
- **Location:** [backend/src/modules/agent/plan-parser.service.ts](../backend/src/modules/agent/plan-parser.service.ts)
- **Purpose:** Extract structured stages from Spark plan text

**Input:** Raw Spark physical plan
```
== Physical Plan ==
AdaptiveSparkPlan isFinalPlan=false
+- Project [id#0, name#1, value#2]
   +- BroadcastHashJoin [id#0], [customer_id#5], Inner, BuildRight
      :- FileScan parquet default.customers[id#0, name#1]
      +- BroadcastExchange HashedRelationBroadcastMode
         +- FileScan parquet default.orders[customer_id#5, value#2]
```

**Output:** Structured stages
```typescript
[
  {
    stageId: "stage_1",
    stageNumber: 1,
    operation: "Scan",
    tableName: "default.customers",
    details: "FileScan parquet",
    keywords: ["customers", "FileScan", "parquet"]
  },
  {
    stageId: "stage_2",
    stageNumber: 2,
    operation: "Join",
    joinType: "BroadcastHashJoin",
    details: "Inner join on id=customer_id",
    keywords: ["join", "broadcast", "customers", "orders"]
  }
]
```

**Parsing Techniques:**
- Line-by-line traversal
- Indentation-based hierarchy detection
- Regex patterns for operation types
- Table name extraction from FileScan/TableScan operators
- Join condition parsing

#### 5. **PlanCodeMappingEngine**
- **Location:** [backend/src/modules/agent/plan-code-mapping.engine.ts](../backend/src/modules/agent/plan-code-mapping.engine.ts)
- **Purpose:** Core intelligent matching algorithm
- **Approach:** Evidence-based multi-strategy matching with confidence scoring

---

## Mapping Strategies & Algorithms

### Strategy 1: Table Name Matching

**Confidence:** 90% (highest)

**Logic:**
```typescript
function matchByTableName(stage: PlanStage, codeFile: CodeFile): Match[] {
  const matches = [];
  const stageTable = normalizeTableName(stage.tableName); // "default.customers" → "customers"

  codeFile.tableReferences.forEach(ref => {
    const codeTable = normalizeTableName(ref.table);

    if (stageTable === codeTable) {
      matches.push({
        filePath: codeFile.path,
        lineStart: ref.lineNumber,
        lineEnd: ref.lineNumber + 5,
        confidence: 90,
        evidence: [{
          type: 'TABLE_NAME_MATCH',
          description: `Exact table match: ${stageTable}`,
          weight: 90
        }]
      });
    }
  });

  return matches;
}
```

**Table Name Normalization:**
```typescript
function normalizeTableName(table: string): string {
  // "catalog.schema.table" → "table"
  // "default.customers" → "customers"
  // "`delta`.`customers`" → "customers"
  return table.split('.').pop()
              .replace(/[`'"]/g, '')
              .toLowerCase();
}
```

### Strategy 2: Operation Type Matching

**Confidence:** 70%

**Logic:**
```typescript
function matchByOperation(stage: PlanStage, codeFile: CodeFile): Match[] {
  const operationMap = {
    'Join': ['join', 'merge'],
    'Aggregate': ['groupBy', 'agg', 'aggregate'],
    'Filter': ['filter', 'where'],
    'Scan': ['read', 'table', 'load'],
    'Shuffle': ['repartition', 'coalesce']
  };

  const relevantOps = operationMap[stage.operation] || [];
  const matches = [];

  codeFile.sparkOperations.forEach(op => {
    if (relevantOps.includes(op.type)) {
      matches.push({
        filePath: codeFile.path,
        lineStart: op.lineNumber,
        lineEnd: op.lineNumber + 10,
        confidence: 70,
        evidence: [{
          type: 'OPERATION_MATCH',
          description: `Operation type: ${op.type}`,
          weight: 70
        }]
      });
    }
  });

  return matches;
}
```

### Strategy 3: Keyword/Semantic Matching

**Confidence:** 40-70% (varies by match count)

**Logic:**
```typescript
function matchByKeywords(stage: PlanStage, codeFile: CodeFile): Match[] {
  const stageKeywords = extractKeywords(stage.details);
  const codeLines = codeFile.content.split('\n');
  const matches = [];

  codeLines.forEach((line, index) => {
    const lineKeywords = extractKeywords(line);
    const matchedKeywords = stageKeywords.filter(kw =>
      lineKeywords.includes(kw)
    );

    if (matchedKeywords.length >= 2) {
      const confidence = Math.min(70, 40 + matchedKeywords.length * 10);

      matches.push({
        filePath: codeFile.path,
        lineStart: index + 1,
        lineEnd: index + 15,
        confidence,
        evidence: [{
          type: 'KEYWORD_MATCH',
          description: `Matched keywords: ${matchedKeywords.join(', ')}`,
          weight: confidence
        }]
      });
    }
  });

  return matches;
}
```

### Strategy 4: Function Name Pattern Matching

**Confidence:** 60%

**Logic:**
```typescript
function matchByFunctionName(stage: PlanStage, codeFile: CodeFile): Match[] {
  // Example: "Join customers" → look for functions like "join_customers", "customer_join"
  const stageTokens = tokenize(stage.operation + ' ' + stage.tableName);
  const matches = [];

  codeFile.functions.forEach(func => {
    const funcTokens = tokenize(func.name);
    const overlap = stageTokens.filter(t => funcTokens.includes(t));

    if (overlap.length >= 2) {
      matches.push({
        filePath: codeFile.path,
        lineStart: func.lineStart,
        lineEnd: func.lineEnd,
        confidence: 60,
        evidence: [{
          type: 'FUNCTION_NAME_MATCH',
          description: `Function name pattern: ${func.name}`,
          weight: 60
        }]
      });
    }
  });

  return matches;
}
```

### Strategy 5: Comment Reference Detection

**Confidence:** 90%

**Logic:**
```typescript
function matchByComments(stage: PlanStage, codeFile: CodeFile): Match[] {
  const stageId = stage.stageId; // "stage_2"
  const codeLines = codeFile.content.split('\n');
  const matches = [];

  codeLines.forEach((line, index) => {
    // Look for comments like: "# Stage 2: Join operation"
    const commentMatch = line.match(/#+\s*Stage\s+(\d+)/i);

    if (commentMatch && commentMatch[1] === String(stage.stageNumber)) {
      matches.push({
        filePath: codeFile.path,
        lineStart: index + 2, // Skip comment line
        lineEnd: index + 20,
        confidence: 90,
        evidence: [{
          type: 'COMMENT_REFERENCE',
          description: `Comment reference to Stage ${stage.stageNumber}`,
          weight: 90
        }]
      });
    }
  });

  return matches;
}
```

---

## Confidence Scoring & Ranking

### Evidence Aggregation

**Multiple Strategies per Stage:**
```typescript
function mapStageToCode(stage: PlanStage, codeAnalysis: CodeAnalysis): StageCodeMapping {
  const allCandidates = [];

  // Run all strategies
  codeAnalysis.files.forEach(file => {
    allCandidates.push(...matchByTableName(stage, file));
    allCandidates.push(...matchByOperation(stage, file));
    allCandidates.push(...matchByKeywords(stage, file));
    allCandidates.push(...matchByFunctionName(stage, file));
    allCandidates.push(...matchByComments(stage, file));
  });

  // Merge overlapping candidates
  const mergedCandidates = mergeOverlappingMatches(allCandidates);

  // Rank by confidence
  mergedCandidates.sort((a, b) => b.confidence - a.confidence);

  // Return top 5
  return {
    stageId: stage.stageId,
    matches: mergedCandidates.slice(0, 5)
  };
}
```

### Candidate Merging

**Problem:** Multiple strategies may identify overlapping code ranges

**Solution:**
```typescript
function mergeOverlappingMatches(candidates: Match[]): Match[] {
  const merged = [];

  candidates.forEach(candidate => {
    // Find existing match for same file with overlapping lines
    const existing = merged.find(m =>
      m.filePath === candidate.filePath &&
      rangesOverlap(m.lineStart, m.lineEnd, candidate.lineStart, candidate.lineEnd)
    );

    if (existing) {
      // Merge evidence
      existing.evidence.push(...candidate.evidence);

      // Recalculate confidence (weighted sum)
      const totalWeight = existing.evidence.reduce((sum, e) => sum + e.weight, 0);
      existing.confidence = Math.min(95, totalWeight / existing.evidence.length);

      // Expand line range
      existing.lineStart = Math.min(existing.lineStart, candidate.lineStart);
      existing.lineEnd = Math.max(existing.lineEnd, candidate.lineEnd);
    } else {
      merged.push(candidate);
    }
  });

  return merged;
}
```

### Confidence Thresholds

| Confidence | Interpretation |
|------------|----------------|
| 90-100% | Very high confidence (exact table name or comment reference) |
| 70-89% | High confidence (operation + keyword match) |
| 50-69% | Medium confidence (multiple weak signals) |
| 30-49% | Low confidence (single weak signal) |
| < 30% | Very low confidence (not shown to user) |

---

## Data Flow

### End-to-End Mapping Pipeline

```
┌──────────────────────────────────┐
│ Frontend: PlanCodeMapper         │
│ - User enters repo URL + plan    │
│ - Clicks "Start Mapping"         │
└────────────┬─────────────────────┘
             │
             │ 1. Create job
             ▼
┌──────────────────────────────────┐
│ POST /api/v1/agent/jobs          │
│ Body: {                          │
│   planContent: "==Physical...",  │
│   repoUrl: "github.com/...",     │
│   branch: "main"                 │
│ }                                │
└────────────┬─────────────────────┘
             │
             │ 2. Job created
             ▼
┌──────────────────────────────────┐
│ AgentController.createJob()      │
│ - Generate job ID                │
│ - Store in memory cache          │
│ - Queue async processing         │
│ - Return job ID                  │
└────────────┬─────────────────────┘
             │
             │ 3. Async processing starts
             ▼
┌──────────────────────────────────┐
│ PlanCodeAgentOrchestrator        │
│ .executeJob(jobId)               │
└────────────┬─────────────────────┘
             │
             │ STEP 1: Clone
             ▼
┌──────────────────────────────────┐
│ RepositoryService.clone()        │
│ - Uses simple-git library        │
│ - Clones to /tmp/{jobId}         │
│ - Checks out specified branch    │
│ - Duration: ~2-5 seconds         │
└────────────┬─────────────────────┘
             │
             │ STEP 2: Analyze
             ▼
┌──────────────────────────────────┐
│ RepositoryCrawler.analyze()      │
│ - Recursively scan /tmp/{jobId}  │
│ - Find .py, .scala, .sql files   │
│ - Extract for each file:         │
│   * Functions/classes            │
│   * Table references             │
│   * Spark operations             │
│ - Duration: ~3-10 seconds        │
└────────────┬─────────────────────┘
             │
             │ Output: CodeAnalysis
             ▼
┌──────────────────────────────────┐
│ {                                │
│   files: [                       │
│     {                            │
│       path: "src/etl.py",        │
│       functions: [...],          │
│       tableReferences: [         │
│         { table: "customers",    │
│           lineNumber: 42 }       │
│       ],                         │
│       sparkOperations: [         │
│         { type: "join",          │
│           lineNumber: 56 }       │
│       ]                          │
│     }                            │
│   ]                              │
│ }                                │
└────────────┬─────────────────────┘
             │
             │ STEP 3: Parse Plan
             ▼
┌──────────────────────────────────┐
│ PlanParser.parse()               │
│ - Split plan text by lines       │
│ - Detect stages by indentation   │
│ - Extract operations & tables    │
│ - Duration: ~1 second            │
└────────────┬─────────────────────┘
             │
             │ Output: PlanStages
             ▼
┌──────────────────────────────────┐
│ [                                │
│   {                              │
│     stageId: "stage_1",          │
│     operation: "Scan",           │
│     tableName: "customers"       │
│   },                             │
│   {                              │
│     stageId: "stage_2",          │
│     operation: "Join",           │
│     keywords: ["customers",      │
│                 "orders"]        │
│   }                              │
│ ]                                │
└────────────┬─────────────────────┘
             │
             │ STEP 4: Map Code
             ▼
┌──────────────────────────────────┐
│ PlanCodeMappingEngine.map()      │
│                                  │
│ For each stage:                  │
│   For each file:                 │
│     - Run 5 matching strategies  │
│     - Collect candidates         │
│   - Merge overlapping matches    │
│   - Rank by confidence           │
│   - Return top 5                 │
│                                  │
│ Duration: ~5-15 seconds          │
└────────────┬─────────────────────┘
             │
             │ Output: Mappings
             ▼
┌──────────────────────────────────┐
│ [                                │
│   {                              │
│     stageId: "stage_1",          │
│     matches: [                   │
│       {                          │
│         filePath: "src/etl.py",  │
│         lineStart: 42,           │
│         lineEnd: 58,             │
│         confidence: 90,          │
│         evidence: [              │
│           {                      │
│             type: "TABLE_MATCH", │
│             weight: 90           │
│           }                      │
│         ]                        │
│       }                          │
│     ]                            │
│   }                              │
│ ]                                │
└────────────┬─────────────────────┘
             │
             │ STEP 5: Finalize
             ▼
┌──────────────────────────────────┐
│ AgentOrchestrator (continued)    │
│ - Save results to job cache      │
│ - Update status to COMPLETED     │
│ - Record completion time         │
│ - Cleanup temp files             │
└────────────┬─────────────────────┘
             │
             │ 6. Frontend polls
             ▼
┌──────────────────────────────────┐
│ GET /api/v1/agent/jobs/:id       │
│ - Every 2 seconds                │
│ - Returns job status + progress  │
└────────────┬─────────────────────┘
             │
             │ 7. Job complete
             ▼
┌──────────────────────────────────┐
│ Frontend: MappingResultsView     │
│ - Display stages with mappings   │
│ - Show confidence scores         │
│ - Render code snippets           │
│ - Evidence breakdown             │
└──────────────────────────────────┘
```

---

## Performance Considerations

### 1. Repository Cloning
- **Shallow clone:** `--depth 1` to reduce clone time
- **Single branch:** `--single-branch` for faster cloning
- **Timeout:** 60 seconds for large repos
- **Cleanup:** Delete `/tmp/{jobId}` after processing

### 2. Code Analysis Caching
- Hash of repo URL + branch + commit SHA
- Cache analysis results for 24 hours
- Avoid re-analyzing unchanged repos

### 3. Parallel Processing
```typescript
// Analyze files in parallel
const fileAnalyses = await Promise.all(
  files.map(file => this.analyzeFile(file))
);
```

### 4. Memory Management
- Stream large files (> 1MB) instead of loading fully
- Limit code snippet size to 500 characters
- Use WeakMap for caching within job lifecycle

---

## Error Handling

### Frontend Errors
- **Invalid repo URL:** Client-side validation
- **Clone timeout:** Display retry option
- **Job failed:** Show error message with details

### Backend Errors
- **Clone failure:** Private repo without access token
- **Parse failure:** Invalid plan format (still attempt best-effort)
- **No matches found:** Return empty mappings with message

---

## Future Enhancements

- [ ] **Multi-repo support:** Analyze multiple repos simultaneously
- [ ] **Machine learning:** Train model on labeled stage-code pairs
- [ ] **Incremental analysis:** Only analyze changed files
- [ ] **Confidence explanation:** Detailed breakdown of why confidence is X%
- [ ] **User feedback loop:** Let users confirm/reject mappings to improve algorithm
- [ ] **Workspace integration:** Direct integration with Databricks workspaces
- [ ] **Git diff support:** Analyze only changed code in PR
- [ ] **Custom extraction rules:** User-defined patterns for proprietary frameworks
