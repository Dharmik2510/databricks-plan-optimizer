
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
  mappedCode?: CodeSnippet; // Link to source code
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
}

export interface AnalysisResult {
  summary: string;
  dagNodes: DagNode[];
  dagLinks: DagLink[];
  resourceMetrics: ResourceMetric[];
  optimizations: OptimizationTip[];
  estimatedDurationMin?: number;
  codeMappings?: CodeSnippet[];
  query_complexity_score?: number; // 0-100
  optimization_impact_score?: number; // 0-100  
  risk_assessment?: {
    data_skew_risk: 'Low' | 'Medium' | 'High';
    oom_risk: 'Low' | 'Medium' | 'High';
    shuffle_overhead_risk: 'Low' | 'Medium' | 'High';
  };
}

export interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
  timestamp: number;
}

export enum AppState {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

export enum ActiveTab {
  DASHBOARD = 'DASHBOARD',
  CHAT = 'CHAT',
  COST = 'COST',
  REPO = 'REPO',
  LIVE = 'LIVE',
}

export interface RepoConfig {
  url: string;
  token?: string; // Optional PAT for private repos
  branch: string;
}

export interface RepoFile {
  path: string;
  content: string;
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
