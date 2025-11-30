
export enum Severity {
  HIGH = 'High',
  MEDIUM = 'Medium',
  LOW = 'Low',
}

export interface DagNode {
  id: string;
  name: string;
  type: string; // e.g., 'Scan', 'Filter', 'Shuffle', 'Join'
  metric?: string; // e.g., '10M rows'
  mappedCode?: EnhancedCodeSnippet; // Enhanced mapping
}

export interface DagLink {
  source: string;
  target: string;
}

export interface ResourceMetric {
  stageId: string;
  cpuPercentage: number; // 0-100 estimated relative usage
  memoryMb: number; // Estimated peak memory
}

export interface CodeSnippet {
  filePath: string;
  lineNumber: number;
  code: string;
  relevanceExplanation: string;
}

export interface EnhancedCodeSnippet extends CodeSnippet {
  confidence: number; // 0-100: How confident we are about this mapping
  matchType: 'exact' | 'partial' | 'inferred'; // Type of match
  callStack?: string[]; // Function call hierarchy
  dependencies?: DependencyInfo[]; // Library and internal dependencies
  affectedByStages?: string[]; // DAG stages that affect this code
  fileType?: 'python' | 'scala' | 'sql' | 'notebook'; // Source file type
  functionContext?: string; // Name of the function containing this code
}

export interface DependencyInfo {
  type: 'internal' | 'external'; // Internal file or external library
  source: string; // Module/file name
  importedAs?: string; // Alias used in import
  usedFunctions?: string[]; // Specific functions used
  version?: string; // Library version (if available)
  nestedDependencies?: string[]; // Dependencies of dependencies
}

export interface OptimizationTip {
  title: string;
  severity: Severity;
  description: string;
  codeSuggestion?: string;
  originalPattern?: string;
  estimated_time_saved_seconds?: number;
  estimated_cost_saved_usd?: number;
  confidence_score?: number; // 0-100
  implementation_complexity?: 'Low' | 'Medium' | 'High';
  affected_stages?: string[];
  
  // Enhanced Code Mapping
  relatedCodeSnippets?: EnhancedCodeSnippet[]; // Multiple code locations
  rootCauseFile?: string; // Primary file causing the issue
  propagationPath?: string[]; // How the issue propagates through files
  
  // Playground Support
  enabledInPlayground?: boolean; // UI state for sandbox
}

export interface RepositoryAnalysis {
  totalFiles: number;
  analyzedFiles: number;
  fileTypes: Record<string, number>; // { 'python': 15, 'scala': 3 }
  totalFunctions: number;
  totalTableReferences: number;
  dependencyGraph: DependencyGraph;
  hotspotFiles: HotspotFile[]; // Files with most operations
  complexityMetrics: CodeComplexityMetrics;
}

export interface DependencyGraph {
  nodes: { id: string; type: 'file' | 'function' | 'table' }[];
  edges: { from: string; to: string; type: 'imports' | 'calls' | 'reads' }[];
}

export interface HotspotFile {
  path: string;
  operationCount: number;
  complexityScore: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  reason: string;
}

export interface CodeComplexityMetrics {
  averageFunctionLength: number;
  deepestNestingLevel: number;
  cyclomaticComplexity: number;
  codeSmells: CodeSmell[];
}

export interface CodeSmell {
  type: 'long_function' | 'deep_nesting' | 'duplicate_code' | 'complex_condition';
  file: string;
  line: number;
  severity: Severity;
  description: string;
}

// --- New Advanced Features Types ---

export interface RegressionAlert {
  previousRunTime: number;
  currentRunTime: number;
  regressionPercent: number;
  suspectedCause: string;
  autoFix?: string;
}

export interface ClusterRecommendation {
  current: { nodes: number; type: string; costPerHour: number };
  recommended: { nodes: number; type: string; costPerHour: number };
  reasoning: string;
  expectedImprovement: string;
}

export interface HistoricalTrend {
  dates: string[];
  executionTimes: number[];
  costs: number[];
  optimizationsApplied: string[]; // Markers for graph
  roi: number; // Return on investment %
}

export interface QueryRewrite {
  original: string;
  rewritten: string;
  strategy: 'denormalize' | 'materialized_view' | 'aggregation_pushdown' | 'join_reorder' | 'syntax_modernization';
  expectedSpeedup: string;
  tradeoffs: string;
}

export interface SparkConfigRecommendation {
  configs: Record<string, string | number | boolean>;
  reasoning: Record<string, string>;
  estimatedImpact: string;
}

export interface AIAgentStatus {
  mode: 'suggest' | 'auto-apply';
  confidence_threshold: number;
  actions_taken: string[];
  prevented_issues: string[];
  total_savings_session: number;
}

export interface AnalysisResult {
  summary: string;
  dagNodes: DagNode[];
  dagLinks: DagLink[];
  resourceMetrics: ResourceMetric[];
  optimizations: OptimizationTip[];
  estimatedDurationMin?: number;
  
  // Enhanced Code Mappings
  codeMappings?: EnhancedCodeSnippet[]; // All code mappings
  repositoryAnalysis?: RepositoryAnalysis; // Repo structure analysis
  
  query_complexity_score?: number; // 0-100
  optimization_impact_score?: number; // 0-100  
  risk_assessment?: {
    data_skew_risk: 'Low' | 'Medium' | 'High';
    oom_risk: 'Low' | 'Medium' | 'High';
    shuffle_overhead_risk: 'Low' | 'Medium' | 'High';
  };

  // Advanced Dynamic Insights
  clusterRecommendation?: ClusterRecommendation;
  sparkConfigRecommendation?: SparkConfigRecommendation;
  queryRewrites?: QueryRewrite[];
}

export interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
  timestamp: number;
  codeReferences?: EnhancedCodeSnippet[];
}

export enum AppState {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

export enum ActiveTab {
  HOME = 'HOME',
  DASHBOARD = 'DASHBOARD',
  INSIGHTS = 'INSIGHTS', // New Tab
  CHAT = 'CHAT',
  COST = 'COST',
  REPO = 'REPO',
  LIVE = 'LIVE',
}

export interface RepoConfig {
  url: string;
  token?: string; // Optional PAT for private repos
  branch: string;
  // Enhanced options
  maxFiles?: number; // Max files to analyze (default: 50)
  includeTests?: boolean; // Include test files (default: false)
  fileExtensions?: string[]; // File types to analyze (default: ['.py', '.scala', '.sql'])
  analyzeNotebooks?: boolean; // Include Jupyter notebooks (default: true)
}

export interface RepoFile {
  path: string;
  content: string;
  size?: number; // File size in bytes
  sha?: string; // Git SHA
  language?: string; // Detected language
}

export interface CodeContext {
  file: RepoFile;
  functions: FunctionDefinition[];
  imports: ImportStatement[];
  tableReferences: TableReference[];
  sparkOperations: SparkOperation[];
}

export interface FunctionDefinition {
  name: string;
  startLine: number;
  endLine: number;
  parameters: string[];
  calls: string[]; // Functions this function calls
  usesDataframes: string[]; // Dataframes used
  complexity?: number; // Cyclomatic complexity
}

export interface ImportStatement {
  module: string;
  items: string[];
  alias?: string;
  line: number;
}

export interface TableReference {
  name: string;
  operation: 'read' | 'write' | 'join' | 'aggregate';
  line: number;
  context: string; // Surrounding code
  format?: 'parquet' | 'csv' | 'delta' | 'json'; // File format
}

export interface SparkOperation {
  type: 'read' | 'write' | 'join' | 'filter' | 'aggregate' | 'transform';
  line: number;
  code: string;
  dataframes: string[];
  estimatedCost?: 'low' | 'medium' | 'high'; // Operation cost
}

export interface ClusterContext {
  clusterType: string;
  dbrVersion: string;
  sparkConf?: string;
  region?: string;
}

export interface CloudInstance {
  id: string;
  name: string; // e.g. m5.xlarge
  displayName: string; // e.g. General Purpose (m5.xlarge)
  category: 'General' | 'Memory' | 'Compute' | 'Storage' | 'GPU';
  vCPUs: number;
  memoryGB: number;
  pricePerHour: number;
  region: string;
}

export interface AnalysisOptions {
  enableCodeMapping?: boolean; // Enable code traceability (default: true)
  enableDependencyAnalysis?: boolean; // Analyze dependencies (default: true)
  confidenceThreshold?: number; // Min confidence for mappings (default: 50)
  maxMappingsPerNode?: number; // Max code mappings per DAG node (default: 3)
  deepAnalysis?: boolean; // Enable deep multi-pass analysis (default: true)
  clusterContext?: ClusterContext; // Optional runtime context
}

// --- Streaming Types ---

export interface StreamMetric {
  timestamp: string;
  inputRate: number;
  processRate: number;
  batchDuration: number;
  driverMemory: number; // %
  executorMemory: number; // %
  swapUsed?: number; // %
  cpuLoad?: number; // %
  
  // Extended Metrics
  shuffleReadBytes: number;
  shuffleWriteBytes: number;
  gcTimeMs: number;
  activeTasks: number;
  taskFailures: number;
}

export interface StreamLog {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
}

export enum StreamStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  HEALTHY = 'HEALTHY',
  DEGRADING = 'DEGRADING',
  CRITICAL = 'CRITICAL'
}

export interface DatabricksConfig {
  host: string; // e.g. https://adb-xxxx.azuredatabricks.net
  clusterId: string;
  token: string;
}

// --- Predictive Analytics Types ---

export interface WhatIfScenario {
  scenario: string;
  timeReduction: string;
  costSavings: string;
  complexity: string;
  implementation: string;
}

export interface ScaleImpact {
  dataSize: string; // "1x", "10x", "100x"
  currentTime: number;
  optimizedTime: number;
  breakingPoint?: string; // When it becomes critical
}

export interface BottleneckTimeline {
  stage: string;
  currentImpact: number; // % of total time
  at10xScale: number;
  at100xScale: number;
  recommendation: string;
}

export interface PerformancePrediction {
  baselineExecutionTime: number; // seconds
  predictedExecutionTime: number; // after optimizations
  dataScaleImpact: ScaleImpact[];
  regressionModel: {
    inputSize: number[];
    executionTime: number[];
    r2Score: number;
  };
  bottleneckProgression: BottleneckTimeline[];
  whatIfScenarios: WhatIfScenario[];
  
  // New
  historicalTrend: HistoricalTrend;
  regressionAlert?: RegressionAlert;
  aiAgentStatus: AIAgentStatus;
}
