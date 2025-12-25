# Advanced Insights

## Feature Overview

AI-generated predictive analytics, bottleneck identification, cluster right-sizing recommendations, Spark configuration tuning, query rewrite suggestions, and what-if scenario analysis for data scale projections (1x, 10x, 100x growth).

---

## Technical Architecture

### Frontend Components

#### 1. **Insights Tab (in App.tsx)**
- **Location:** [frontend/App.tsx](../frontend/App.tsx:550-650)
- **Purpose:** Display comprehensive insights and recommendations
- **Sections:**
  - **Bottleneck Analysis:** Critical performance bottlenecks
  - **Scalability Score:** 0-100 score with breakdown
  - **Cluster Recommendations:** Instance type and size suggestions
  - **Spark Configuration:** Tuning parameters
  - **Query Rewrites:** Alternative query structures
  - **Predictive Analytics:** What-if scenarios

**UI Layout:**
```
┌───────────────────────────────────────────────┐
│ Advanced Insights                             │
├───────────────────────────────────────────────┤
│                                               │
│ ┌─────────────────────────────────────────┐   │
│ │ Scalability Score: 67/100               │   │
│ │ ████████████████████░░░░░░░░░░           │   │
│ │                                         │   │
│ │ Your query is moderately scalable.      │   │
│ │ Critical bottlenecks will become more   │   │
│ │ severe as data volume increases.        │   │
│ └─────────────────────────────────────────┘   │
│                                               │
│ ┌─────────────────────────────────────────┐   │
│ │ Critical Bottlenecks (3)                │   │
│ ├─────────────────────────────────────────┤   │
│ │ 🔴 Stage 3: Shuffle Storm               │   │
│ │    Impact: 120GB shuffle at 1x scale    │   │
│ │    At 10x: 1.2TB shuffle (45min delay)  │   │
│ │                                         │   │
│ │ 🔴 Stage 5: Cartesian Product           │   │
│ │    Impact: 10M rows → 100M at 10x       │   │
│ │    Exponential growth                   │   │
│ │                                         │   │
│ │ 🟡 Stage 8: Data Skew                   │   │
│ │    Impact: 80% data in 1 partition      │   │
│ │    Becomes critical at 10x scale        │   │
│ └─────────────────────────────────────────┘   │
│                                               │
│ ┌─────────────────────────────────────────┐   │
│ │ Cluster Recommendations                 │   │
│ ├─────────────────────────────────────────┤   │
│ │ Current: 4x m5.2xlarge (8 cores each)  │   │
│ │ Utilization: 45% CPU, 60% Memory        │   │
│ │                                         │   │
│ │ ✅ Recommended: 3x m5.4xlarge           │   │
│ │    - Better core:memory ratio           │   │
│ │    - 25% cost savings ($180/month)      │   │
│ │    - Improved shuffle performance       │   │
│ └─────────────────────────────────────────┘   │
│                                               │
│ ┌─────────────────────────────────────────┐   │
│ │ Spark Configuration Tuning              │   │
│ ├─────────────────────────────────────────┤   │
│ │ spark.sql.shuffle.partitions: 200 → 400 │   │
│ │ spark.sql.adaptive.enabled: true        │   │
│ │ spark.sql.adaptive.coalescePartitions.  │   │
│ │   enabled: true                         │   │
│ │ spark.executor.memory: 16g → 24g        │   │
│ └─────────────────────────────────────────┘   │
│                                               │
│ ┌─────────────────────────────────────────┐   │
│ │ Query Rewrite Suggestions               │   │
│ ├─────────────────────────────────────────┤   │
│ │ 1. Denormalize customer dimensions      │   │
│ │    Impact: Eliminate 2 joins            │   │
│ │    Savings: ~1200s, $15/run             │   │
│ │                                         │   │
│ │ 2. Add materialized view for daily agg  │   │
│ │    Impact: Pre-compute aggregations     │   │
│ │    Savings: ~900s, $12/run              │   │
│ └─────────────────────────────────────────┘   │
│                                               │
│ ┌─────────────────────────────────────────┐   │
│ │ What-If Analysis: Data Scale Impact     │   │
│ ├─────────────────────────────────────────┤   │
│ │          1x      10x       100x         │   │
│ │ Runtime  15min   2.5hr     25hr         │   │
│ │ Cost     $10     $100      $1,000       │   │
│ │ Shuffle  120GB   1.2TB     12TB         │   │
│ │                                         │   │
│ │ ⚠ Critical: Bottlenecks become          │   │
│ │   unmanageable at 100x scale            │   │
│ └─────────────────────────────────────────┘   │
└───────────────────────────────────────────────┘
```

#### 2. **InsightCard Component**
- **Location:** [frontend/components/insights/InsightCard.tsx](../frontend/components/insights/InsightCard.tsx)
- **Purpose:** Reusable card for displaying individual insights
- **Variants:**
  - Info (blue)
  - Warning (yellow)
  - Critical (red)
  - Success (green)

#### 3. **ScalabilityGauge Component**
- **Location:** [frontend/components/insights/ScalabilityGauge.tsx](../frontend/components/insights/ScalabilityGauge.tsx)
- **Purpose:** Visual representation of scalability score
- **Implementation:** SVG-based gauge (0-100 scale)

### Backend Generation (AI-Powered)

#### 1. **GeminiService - Analysis Method**
- **Location:** [backend/src/integrations/gemini/gemini.service.ts](../backend/src/integrations/gemini/gemini.service.ts:45-150)

**Insights are generated as part of the main analysis flow:**

**Structured Output Schema:**
```typescript
{
  // ... dagNodes, dagLinks, optimizations ...

  resourceMetrics: {
    totalStages: number;
    totalTasks: number;
    dataProcessedGB: number;
    shuffleDataGB: number;
    estimatedCostUSD: number;
    peakMemoryGB: number;
  },

  predictiveAnalytics: {
    bottlenecks: [
      {
        stage: number;
        type: string;          // 'shuffle', 'skew', 'memory', 'io'
        impact: string;
        currentScale: string;  // "120GB shuffle"
        scale10x: string;      // "1.2TB shuffle"
        scale100x: string;     // "12TB shuffle"
      }
    ],
    scalabilityScore: number;  // 0-100
    recommendedActions: string[];
  }
}
```

**AI Prompt Engineering for Insights:**
```
Analyze the execution plan and provide:

1. **Bottleneck Identification:**
   - Identify stages that will become bottlenecks as data scales
   - Classify by type (shuffle, skew, memory, I/O)
   - Project impact at 1x, 10x, 100x data volume
   - Rank by criticality

2. **Scalability Scoring:**
   - Score from 0-100 based on:
     * Presence of Cartesian products (-30)
     * Shuffle volume relative to data size (-20)
     * Data skew severity (-15)
     * Broadcast join size (-10)
     * Partition count optimization (+10)
     * Adaptive query execution usage (+10)
   - Provide breakdown of score factors

3. **Recommended Actions:**
   - Prioritized list of optimizations
   - Focus on actions with highest ROI
   - Consider both immediate and long-term fixes

4. **Predictive Impact:**
   - Estimate runtime at 1x, 10x, 100x scale
   - Estimate cost at each scale
   - Identify which bottlenecks worsen non-linearly
```

---

## Insight Types & Generation Logic

### 1. Bottleneck Analysis

**Detection Criteria:**

**Shuffle Bottleneck:**
```typescript
// Detected when shuffle volume > 50GB or shuffle:data ratio > 0.5
if (stage.shuffleDataGB > 50 || stage.shuffleDataGB / stage.inputDataGB > 0.5) {
  bottlenecks.push({
    stage: stage.stageNumber,
    type: 'shuffle',
    impact: `${stage.shuffleDataGB}GB shuffle across ${stage.partitions} partitions`,
    currentScale: `${stage.shuffleDataGB}GB`,
    scale10x: `${stage.shuffleDataGB * 10}GB`,
    scale100x: `${stage.shuffleDataGB * 100}GB`,
    severity: stage.shuffleDataGB > 200 ? 'CRITICAL' : 'HIGH'
  });
}
```

**Data Skew Bottleneck:**
```typescript
// Detected when max partition size > 3x median partition size
const skewRatio = maxPartitionSize / medianPartitionSize;

if (skewRatio > 3) {
  bottlenecks.push({
    stage: stage.stageNumber,
    type: 'skew',
    impact: `${Math.round((1 - 1/skewRatio) * 100)}% of data in single partition`,
    currentScale: `${skewRatio.toFixed(1)}x skew`,
    scale10x: `Likely ${(skewRatio * 1.2).toFixed(1)}x skew (worsens)`,
    scale100x: `Critical skew expected`,
    severity: skewRatio > 10 ? 'CRITICAL' : 'HIGH'
  });
}
```

**Memory Pressure Bottleneck:**
```typescript
// Detected when broadcast size > executor memory * 0.3
if (broadcastSizeGB > executorMemoryGB * 0.3) {
  bottlenecks.push({
    stage: stage.stageNumber,
    type: 'memory',
    impact: `${broadcastSizeGB}GB broadcast exceeds ${executorMemoryGB * 0.3}GB threshold`,
    currentScale: `${broadcastSizeGB}GB broadcast`,
    scale10x: `${broadcastSizeGB * 10}GB (likely fails)`,
    scale100x: `Infeasible`,
    severity: 'CRITICAL'
  });
}
```

**I/O Bottleneck:**
```typescript
// Detected when full table scan without partition pruning
if (stage.operation === 'Scan' && !stage.hasPartitionFilter && stage.tableSizeGB > 100) {
  bottlenecks.push({
    stage: stage.stageNumber,
    type: 'io',
    impact: `Full scan of ${stage.tableSizeGB}GB table`,
    currentScale: `${stage.tableSizeGB}GB read`,
    scale10x: `${stage.tableSizeGB * 10}GB read (linear growth)`,
    scale100x: `${stage.tableSizeGB * 100}GB read`,
    severity: 'MEDIUM'
  });
}
```

### 2. Scalability Score Calculation

**Scoring Algorithm:**
```typescript
function calculateScalabilityScore(analysis: AnalysisResult): number {
  let score = 100; // Start with perfect score

  // Deductions
  const cartesianProducts = analysis.optimizations.filter(
    opt => opt.category === 'JOIN' && opt.title.includes('Cartesian')
  );
  score -= cartesianProducts.length * 30; // -30 per Cartesian product

  const shuffleIssues = analysis.optimizations.filter(
    opt => opt.category === 'SHUFFLE' && opt.severity === 'CRITICAL'
  );
  score -= shuffleIssues.length * 20; // -20 per critical shuffle

  const skewIssues = analysis.optimizations.filter(
    opt => opt.category === 'SKEW'
  );
  score -= skewIssues.length * 15; // -15 per skew issue

  const memoryIssues = analysis.optimizations.filter(
    opt => opt.category === 'MEMORY' && opt.severity === 'HIGH'
  );
  score -= memoryIssues.length * 10; // -10 per memory issue

  // Bonuses
  const hasAdaptive = analysis.dagNodes.some(
    node => node.label.includes('Adaptive')
  );
  if (hasAdaptive) score += 10; // +10 for adaptive query execution

  const avgPartitionSize = analysis.resourceMetrics.dataProcessedGB /
                          (analysis.resourceMetrics.totalTasks || 1);
  if (avgPartitionSize >= 128 && avgPartitionSize <= 256) {
    score += 10; // +10 for optimal partition sizing
  }

  // Clamp to 0-100
  return Math.max(0, Math.min(100, score));
}
```

**Score Interpretation:**
- **90-100:** Excellent scalability
- **70-89:** Good scalability, minor optimizations needed
- **50-69:** Moderate scalability, several bottlenecks
- **30-49:** Poor scalability, critical issues present
- **0-29:** Very poor scalability, major refactoring needed

### 3. Cluster Right-Sizing Recommendations

**Analysis Inputs:**
- Current cluster configuration (instance type, node count)
- Resource utilization (CPU, memory, disk)
- Job characteristics (compute-bound vs. memory-bound)

**Recommendation Logic:**
```typescript
function generateClusterRecommendation(
  currentConfig: ClusterConfig,
  resourceMetrics: ResourceMetrics
): ClusterRecommendation {
  const cpuUtil = resourceMetrics.avgCPUUtilization;
  const memUtil = resourceMetrics.avgMemoryUtilization;
  const shuffleVolume = resourceMetrics.shuffleDataGB;

  // Determine workload profile
  let profile: 'compute-bound' | 'memory-bound' | 'io-bound' | 'balanced';

  if (cpuUtil > 80 && memUtil < 60) {
    profile = 'compute-bound';
  } else if (memUtil > 80 && cpuUtil < 60) {
    profile = 'memory-bound';
  } else if (shuffleVolume > 500) {
    profile = 'io-bound';
  } else {
    profile = 'balanced';
  }

  // Select instance family
  const instanceFamily = {
    'compute-bound': 'c5',     // Compute-optimized
    'memory-bound': 'r5',      // Memory-optimized
    'io-bound': 'i3',          // Storage-optimized
    'balanced': 'm5'           // General-purpose
  }[profile];

  // Calculate optimal node count
  const requiredMemory = resourceMetrics.peakMemoryGB;
  const requiredCores = Math.ceil(resourceMetrics.totalTasks / 4);

  const instanceSpecs = getInstanceSpecs(instanceFamily);
  const nodesNeeded = Math.ceil(
    Math.max(
      requiredMemory / instanceSpecs.memoryGB,
      requiredCores / instanceSpecs.vCPUs
    )
  );

  // Calculate cost savings
  const currentCost = calculateClusterCost(currentConfig);
  const recommendedCost = calculateClusterCost({
    instanceType: `${instanceFamily}.4xlarge`,
    nodeCount: nodesNeeded
  });

  return {
    recommendedInstanceType: `${instanceFamily}.4xlarge`,
    recommendedNodeCount: nodesNeeded,
    reasoning: `Workload is ${profile}, requiring ${requiredMemory}GB memory and ${requiredCores} cores`,
    costSavings: currentCost - recommendedCost,
    savingsPercentage: ((currentCost - recommendedCost) / currentCost) * 100
  };
}
```

### 4. Spark Configuration Tuning

**Configuration Categories:**

**Shuffle Configuration:**
```typescript
const shuffleRecommendations = [];

// Partition count
const optimalPartitions = Math.ceil(
  resourceMetrics.shuffleDataGB / 0.128 // 128MB per partition
);

if (currentConfig.shufflePartitions < optimalPartitions) {
  shuffleRecommendations.push({
    param: 'spark.sql.shuffle.partitions',
    currentValue: currentConfig.shufflePartitions,
    recommendedValue: optimalPartitions,
    reasoning: 'Increase partition count to reduce shuffle partition size to ~128MB'
  });
}

// Adaptive query execution
if (!currentConfig.adaptiveEnabled) {
  shuffleRecommendations.push({
    param: 'spark.sql.adaptive.enabled',
    currentValue: false,
    recommendedValue: true,
    reasoning: 'Enable AQE for dynamic partition coalescing and join strategy optimization'
  });
}
```

**Memory Configuration:**
```typescript
const memoryRecommendations = [];

// Executor memory
const recommendedExecutorMemory = Math.ceil(
  resourceMetrics.peakMemoryGB / nodeCount * 1.2 // 20% buffer
);

if (currentConfig.executorMemory < recommendedExecutorMemory) {
  memoryRecommendations.push({
    param: 'spark.executor.memory',
    currentValue: currentConfig.executorMemory,
    recommendedValue: recommendedExecutorMemory,
    reasoning: 'Increase executor memory to prevent spilling and OOM errors'
  });
}

// Broadcast threshold
if (resourceMetrics.broadcastSizeGB > 0.01) { // 10MB
  memoryRecommendations.push({
    param: 'spark.sql.autoBroadcastJoinThreshold',
    currentValue: '10MB',
    recommendedValue: '50MB',
    reasoning: 'Increase broadcast threshold to leverage broadcast joins for larger dimensions'
  });
}
```

**Performance Configuration:**
```typescript
const performanceRecommendations = [];

// Dynamic allocation
if (!currentConfig.dynamicAllocationEnabled && jobType === 'batch') {
  performanceRecommendations.push({
    param: 'spark.dynamicAllocation.enabled',
    currentValue: false,
    recommendedValue: true,
    reasoning: 'Enable dynamic allocation to scale executors based on workload'
  });
}

// Speculation
if (resourceMetrics.taskSkew > 2) {
  performanceRecommendations.push({
    param: 'spark.speculation',
    currentValue: false,
    recommendedValue: true,
    reasoning: 'Enable speculation to mitigate stragglers from skewed tasks'
  });
}
```

### 5. Query Rewrite Suggestions

**Denormalization Suggestion:**
```typescript
// Detect multiple joins on dimension tables
const dimensionJoins = dagLinks.filter(link =>
  link.label.includes('BroadcastHashJoin') &&
  link.source.includes('dimension')
);

if (dimensionJoins.length >= 2) {
  queryRewrites.push({
    type: 'denormalization',
    title: 'Denormalize dimension tables',
    description: `Detected ${dimensionJoins.length} joins with dimension tables. Consider pre-joining and materializing.`,
    impact: {
      joinsEliminated: dimensionJoins.length,
      estimatedTimeSaved: dimensionJoins.length * 300, // 5min per join
      estimatedCostSaved: dimensionJoins.length * 5
    },
    example: `
-- Create materialized view
CREATE OR REPLACE VIEW customer_facts AS
SELECT
  c.customer_id,
  c.customer_name,
  r.region_name,
  s.segment_name
FROM customers c
JOIN regions r ON c.region_id = r.region_id
JOIN segments s ON c.segment_id = s.segment_id;

-- Use in queries
SELECT * FROM customer_facts
JOIN orders ON customer_facts.customer_id = orders.customer_id;
    `
  });
}
```

**Materialized View Suggestion:**
```typescript
// Detect repeated aggregations
const aggregations = dagNodes.filter(node =>
  node.nodeType === 'Aggregate' &&
  node.label.includes('groupBy')
);

const repeatedAggs = findRepeatedPatterns(aggregations);

if (repeatedAggs.length > 0) {
  queryRewrites.push({
    type: 'materialized_view',
    title: 'Create materialized view for common aggregation',
    description: `Detected repeated aggregation pattern on ${repeatedAggs[0].groupByColumns.join(', ')}`,
    impact: {
      queriesOptimized: repeatedAggs.length,
      estimatedTimeSaved: repeatedAggs.length * 600,
      estimatedCostSaved: repeatedAggs.length * 10
    },
    example: `
-- Create and refresh nightly
CREATE OR REPLACE TABLE daily_sales_summary AS
SELECT
  date,
  product_id,
  SUM(quantity) AS total_quantity,
  SUM(revenue) AS total_revenue
FROM sales
GROUP BY date, product_id;

-- Use in queries
SELECT * FROM daily_sales_summary WHERE date >= '2024-01-01';
    `
  });
}
```

**Join Reordering Suggestion:**
```typescript
// Detect sub-optimal join order
const joins = dagNodes.filter(n => n.nodeType === 'Join');
const firstJoin = joins[0];

if (firstJoin && firstJoin.joinType === 'SortMergeJoin' &&
    firstJoin.inputSizeGB > 100) {
  queryRewrites.push({
    type: 'join_reordering',
    title: 'Reorder joins to start with smaller tables',
    description: 'First join processes 100GB+. Consider joining smaller tables first to reduce intermediate data.',
    impact: {
      intermediateDataReduction: '60%',
      estimatedTimeSaved: 900,
      estimatedCostSaved: 12
    },
    example: `
-- Current (sub-optimal)
large_fact
  .join(dimension1, ...)  -- 100GB + 1GB
  .join(dimension2, ...)  -- Result + 2GB

-- Optimized
dimension1.join(dimension2, ...)  -- 1GB + 2GB
  .join(large_fact, ...)          -- 3GB + 100GB (filtered)
    `
  });
}
```

### 6. Predictive Analytics (What-If Scenarios)

**Linear Extrapolation:**
```typescript
function generateScaleProjections(
  currentMetrics: ResourceMetrics,
  bottlenecks: Bottleneck[]
): ScaleProjection {
  const baseRuntime = currentMetrics.totalRuntimeSeconds || 900; // 15min
  const baseCost = currentMetrics.estimatedCostUSD || 10;
  const baseShuffle = currentMetrics.shuffleDataGB;

  // Identify growth factors
  const hasCartesian = bottlenecks.some(b => b.type === 'cartesian');
  const hasShuffle = bottlenecks.some(b => b.type === 'shuffle');
  const hasSkew = bottlenecks.some(b => b.type === 'skew');

  // Calculate growth multipliers
  const runtimeGrowth = hasCartesian ? 2.0 : (hasShuffle ? 1.3 : 1.1);
  const costGrowth = runtimeGrowth;
  const shuffleGrowth = 1.0; // Linear with data

  return {
    scale1x: {
      runtime: baseRuntime,
      cost: baseCost,
      shuffle: baseShuffle,
      feasible: true
    },
    scale10x: {
      runtime: baseRuntime * Math.pow(10, runtimeGrowth),
      cost: baseCost * Math.pow(10, costGrowth),
      shuffle: baseShuffle * 10,
      feasible: baseRuntime * Math.pow(10, runtimeGrowth) < 14400 // < 4hrs
    },
    scale100x: {
      runtime: baseRuntime * Math.pow(100, runtimeGrowth),
      cost: baseCost * Math.pow(100, costGrowth),
      shuffle: baseShuffle * 100,
      feasible: false // Likely infeasible without optimization
    }
  };
}
```

**Example Output:**
```json
{
  "scale1x": {
    "runtime": 900,      // 15 minutes
    "cost": 10,
    "shuffle": 120,      // GB
    "feasible": true
  },
  "scale10x": {
    "runtime": 9000,     // 2.5 hours (10^1.3 growth due to shuffle bottleneck)
    "cost": 100,
    "shuffle": 1200,
    "feasible": true
  },
  "scale100x": {
    "runtime": 90000,    // 25 hours
    "cost": 1000,
    "shuffle": 12000,
    "feasible": false    // Requires optimization
  }
}
```

---

## Data Flow

### Insights Generation Flow

```
┌─────────────────────────────────┐
│ Backend: Analysis Processing    │
│ - Gemini AI analyzes plan       │
│ - Generates structured result   │
└───────────┬─────────────────────┘
            │
            │ Includes predictiveAnalytics
            ▼
┌─────────────────────────────────┐
│ {                               │
│   predictiveAnalytics: {        │
│     bottlenecks: [...],         │
│     scalabilityScore: 67,       │
│     recommendedActions: [...]   │
│   },                            │
│   resourceMetrics: {...}        │
│ }                               │
└───────────┬─────────────────────┘
            │
            │ Stored in Analysis.result
            ▼
┌─────────────────────────────────┐
│ PostgreSQL: Analysis table      │
│ result = {                      │
│   ...dagNodes, optimizations,   │
│   predictiveAnalytics,          │
│   resourceMetrics               │
│ }                               │
└───────────┬─────────────────────┘
            │
            │ Frontend fetches
            ▼
┌─────────────────────────────────┐
│ GET /api/v1/analyses/:id        │
└───────────┬─────────────────────┘
            │
            │ Response
            ▼
┌─────────────────────────────────┐
│ Frontend: Insights Tab          │
│ - Parse predictiveAnalytics     │
│ - Render bottleneck cards       │
│ - Display scalability gauge     │
│ - Show recommendations          │
└─────────────────────────────────┘
```

---

## Performance Considerations

### 1. AI Generation Time
- Insights generated in same AI call as main analysis
- No additional latency
- Structured output enforces format

### 2. Frontend Rendering
- Insights tab lazy-loaded
- Heavy computations (projections) done on backend
- Frontend only renders pre-computed data

---

## Error Handling

### Missing Insights
- If AI fails to generate insights, show partial results
- Gracefully degrade to showing only optimizations

### Invalid Projections
- Validate scale projections for sanity (e.g., runtime > 0)
- Show "N/A" for infeasible scenarios

---

## Future Enhancements

- [ ] **Custom scale factors:** User-defined data growth (e.g., 5x, 50x)
- [ ] **Interactive what-if:** Adjust cluster config and see impact
- [ ] **Historical trend analysis:** Track scalability score over time
- [ ] **Automated tuning:** Apply recommended Spark configs automatically
- [ ] **Cost optimization mode:** Minimize cost vs. minimize runtime
- [ ] **ML-based predictions:** Train model on actual execution times
- [ ] **Benchmark comparison:** Compare against industry benchmarks
- [ ] **Risk assessment:** Probability of OOM, timeout, etc.
- [ ] **Capacity planning:** Recommend infrastructure for future needs
- [ ] **Multi-query optimization:** Insights across multiple analyses
