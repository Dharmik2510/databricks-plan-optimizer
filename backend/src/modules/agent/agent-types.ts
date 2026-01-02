/**
 * Plan-to-Code Mapping Agent Types
 * Comprehensive type definitions for the execution plan to code mapping feature
 */
// recursive import removed

// ============================================
// EXECUTION PLAN TYPES
// ============================================

export interface ExecutionPlanStage {
    id: string;
    name: string;
    type: ExecutionStageType;
    description?: string;
    estimatedDuration?: string;
    dependencies: string[]; // IDs of stages this depends on
    inputs?: string[];
    outputs?: string[];
    metrics?: StageMetrics;
}

export type ExecutionStageType =
    | 'data_ingestion'
    | 'transformation'
    | 'aggregation'
    | 'join'
    | 'filter'
    | 'shuffle'
    | 'sort'
    | 'write'
    | 'cache'
    | 'broadcast'
    | 'custom';

export type NodeClassification = 'CODE_OWNED' | 'DERIVED';

export interface StageMetrics {
    rowsEstimate?: number;
    shuffleBytes?: number;
    memoryUsage?: number;
    cpuIntensity?: 'low' | 'medium' | 'high';
}

export interface ExecutionPlan {
    id: string;
    name: string;
    rawContent: string;
    parsedStages: ExecutionPlanStage[];
    metadata?: PlanMetadata;
    createdAt: Date;
}

export interface PlanMetadata {
    engine?: 'spark' | 'databricks' | 'presto' | 'dbt' | 'airflow';
    version?: string;
    cluster?: string;
    submittedBy?: string;
}

// ============================================
// REPOSITORY ANALYSIS TYPES
// ============================================

export interface RepositoryConfig {
    url: string;
    branch: string;
    commitHash?: string;
    token?: string;
    includePatterns?: string[];
    excludePatterns?: string[];
    maxDepth?: number;
    maxFiles?: number;
}

export interface AnalyzedFile {
    path: string;
    content: string;
    language: SupportedLanguage;
    size: number;
    sha?: string;
    lastModified?: Date;
    analysis: FileAnalysis;
}

export type SupportedLanguage =
    | 'python'
    | 'scala'
    | 'sql'
    | 'java'
    | 'yaml'
    | 'json'
    | 'notebook'
    | 'unknown';

export interface FileAnalysis {
    functions: FunctionInfo[];
    classes: ClassInfo[];
    imports: ImportInfo[];
    dataOperations: DataOperation[];
    tableReferences: TableReference[];
    configReferences: ConfigReference[];
    annotations: AnnotationInfo[];
    complexity: ComplexityMetrics;
    codeChunks: CodeChunk[];
}

export interface FunctionInfo {
    name: string;
    startLine: number;
    endLine: number;
    parameters: ParameterInfo[];
    returnType?: string;
    docstring?: string;
    decorators?: string[];
    calls: string[];
    isAsync: boolean;
    complexity: number;
    sparkTransformations?: SparkTransformation[];
}

export interface CodeChunk {
    id: string; // unique identifier (file:hash or symbol:idx)
    type: ChunkType;
    content: string;
    startLine: number;
    endLine: number;
    parentSymbol?: string; // name of containing function/class
    sparkOps?: string[];
}

export type ChunkType = 'SYMBOL' | 'BLOCK' | 'STATEMENT';

export interface SparkTransformation {
    type: 'read' | 'write' | 'filter' | 'select' | 'join' | 'groupBy' | 'agg' | 'withColumn' | 'transform' | 'union' | 'repartition' | 'sort' | 'window' | 'drop' | 'distinct' | 'limit' | 'alias';
    line: number;
    code: string;
    columns?: string[];
}

export interface ParameterInfo {
    name: string;
    type?: string;
    defaultValue?: string;
}

export interface ClassInfo {
    name: string;
    startLine: number;
    endLine: number;
    baseClasses: string[];
    methods: FunctionInfo[];
    attributes: string[];
    decorators?: string[];
}

export interface ImportInfo {
    module: string;
    items: string[];
    alias?: string;
    line: number;
    isRelative: boolean;
}

export interface DataOperation {
    type: DataOperationType;
    line: number;
    code: string;
    tables?: string[];
    columns?: string[];
    joinType?: string;
    aggregations?: string[];
    filters?: string[];
    confidence: number;
}

export type DataOperationType =
    | 'read'
    | 'write'
    | 'join'
    | 'filter'
    | 'aggregate'
    | 'groupBy'
    | 'agg'
    | 'transform'
    | 'select'
    | 'withColumn'
    | 'window'
    | 'union'
    | 'cache'
    | 'broadcast'
    | 'repartition'
    | 'sort'
    | 'drop'
    | 'distinct'
    | 'limit'
    | 'alias';

export interface TableReference {
    name: string;
    schema?: string;
    database?: string;
    operation: 'read' | 'write' | 'join';
    line: number;
    format?: 'parquet' | 'delta' | 'csv' | 'json' | 'avro' | 'orc';
}

export interface ConfigReference {
    key: string;
    value?: string;
    line: number;
    type: 'spark_conf' | 'env_var' | 'secret' | 'parameter';
}

export interface AnnotationInfo {
    name: string;
    line: number;
    parameters?: Record<string, any>;
}

export interface ComplexityMetrics {
    cyclomaticComplexity: number;
    linesOfCode: number;
    cognitiveComplexity: number;
    halsteadDifficulty?: number;
}

// ============================================
// MAPPING RESULTS TYPES
// ============================================

export interface PlanCodeMapping {
    id: string;
    planId: string;
    stageId: string;
    stageName: string;
    stageType: ExecutionStageType;
    mappings: CodeMapping[];
    confidence: number;
    status: MappingStatus;
    reasoning: string;
    suggestions?: OptimizationSuggestion[];
}

export interface CodeMapping {
    id: string;
    filePath: string;
    language: SupportedLanguage;
    startLine: number;
    endLine: number;
    codeSnippet: string;
    matchType: MatchType;
    confidence: number;
    evidenceFactors: EvidenceFactor[];
    functionContext?: string;
    classContext?: string;
    relatedMappings?: string[]; // IDs of related code mappings
}

export type MatchType =
    | 'exact_table'      // Exact table name match
    | 'exact_operation'  // Exact operation type match
    | 'semantic'         // AI-inferred semantic similarity
    | 'structural'       // Code structure matches plan structure
    | 'naming_convention'// Naming convention suggests relationship
    | 'comment_reference'// Comment explicitly references stage/plan
    | 'config_reference' // Configuration references this stage
    | 'call_graph'       // Call graph analysis shows relationship
    | 'inferred';        // Best-effort inference

export interface EvidenceFactor {
    type: string;
    description: string;
    weight: number; // 0-1 contribution to confidence
    details?: Record<string, any>;
}

export type MappingStatus =
    | 'confirmed'    // High confidence mapping
    | 'probable'     // Likely correct but needs review
    | 'uncertain'    // Low confidence, multiple possibilities
    | 'unmapped'     // No mapping found
    | 'manual';      // User manually assigned

export interface OptimizationSuggestion {
    type: SuggestionType;
    title: string;
    description: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    affectedLines: number[];
    suggestedCode?: string;
    estimatedImpact?: string;
}

export type SuggestionType =
    | 'performance'
    | 'memory'
    | 'shuffle'
    | 'skew'
    | 'caching'
    | 'partitioning'
    | 'join_order'
    | 'predicate_pushdown'
    | 'broadcast'
    | 'code_quality';

// ============================================
// AGENT EXECUTION TYPES
// ============================================

export interface AgentConfig {
    maxConcurrentFiles: number;
    confidenceThreshold: number;
    enableSemanticAnalysis: boolean;
    enableCallGraphAnalysis: boolean;
    enableAIInference: boolean;
    aiModel?: string;
    timeout: number; // ms
    retryCount: number;
}

export interface AgentJob {
    id: string;
    userId: string; // Added for multi-tenancy
    planId: string;
    repoConfig: RepositoryConfig;
    agentConfig: AgentConfig;
    status: AgentJobStatus;
    progress: AgentProgress;
    result?: AgentResult;
    error?: AgentError;
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
}

export type AgentJobStatus =
    | 'queued'
    | 'fetching_repo'
    | 'analyzing_files'
    | 'mapping_stages'
    | 'ai_inference'
    | 'finalizing'
    | 'completed'
    | 'failed'
    | 'cancelled';

export interface AgentProgress {
    currentPhase: string;
    currentFile?: string;
    filesProcessed: number;
    totalFiles: number;
    stagesMapped: number;
    totalStages: number;
    percentage: number;
    estimatedTimeRemaining?: number; // seconds
    logs: AgentLog[];
}

export interface AgentLog {
    timestamp: Date;
    level: 'debug' | 'info' | 'warn' | 'error';
    message: string;
    details?: Record<string, any>;
}

export interface AgentResult {
    planId: string;
    repositoryUrl: string;
    branch: string;
    mappings: PlanCodeMapping[];
    repositoryAnalysis: RepositorySummary;
    statistics: MappingStatistics;
    executionTime: number; // ms
}

export interface RepositorySummary {
    totalFiles: number;
    analyzedFiles: number;
    languages: Record<SupportedLanguage, number>;
    totalFunctions: number;
    totalClasses: number;
    totalDataOperations: number;
    entryPoints: string[]; // Main files/entry points detected
    dependencies: DependencyInfo[];
}

export interface DependencyInfo {
    name: string;
    version?: string;
    type: 'pip' | 'maven' | 'sbt' | 'npm' | 'internal';
    usedIn: string[];
}

export interface MappingStatistics {
    totalStages: number;
    mappedStages: number;
    confirmedMappings: number;
    probableMappings: number;
    uncertainMappings: number;
    unmappedStages: number;
    averageConfidence: number;
    suggestionsGenerated: number;
    coveragePercentage: number;
}

export interface AgentError {
    code: string;
    message: string;
    details?: Record<string, any>;
    recoverable: boolean;
    suggestion?: string;
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

export interface CreateAgentJobRequest {
    planContent: string;
    planName?: string;
    repositoryUrl: string;
    branch?: string;
    commitHash?: string;
    token?: string;
    dagStages?: any[];
    options?: Partial<AgentConfig>;
}

export interface CreateAgentJobResponse {
    jobId: string;
    status: AgentJobStatus;
    estimatedDuration: number; // seconds
    websocketUrl?: string; // For real-time updates
}

export interface AgentJobStatusResponse {
    jobId: string;
    status: AgentJobStatus;
    progress: AgentProgress;
    result?: AgentResult;
    error?: AgentError;
}

export interface GetMappingsRequest {
    jobId: string;
    stageId?: string;
    minConfidence?: number;
    includeCode?: boolean;
}

export interface UpdateMappingRequest {
    mappingId: string;
    status?: MappingStatus;
    notes?: string;
    manualFilePath?: string;
    manualLines?: [number, number];
}

// ============================================
// WEBSOCKET EVENT TYPES
// ============================================

export type AgentWebSocketEvent =
    | { type: 'progress'; data: AgentProgress }
    | { type: 'log'; data: AgentLog }
    | { type: 'stage_started'; data: { stage: string; message?: string; nodeId?: string } }
    | { type: 'stage_completed'; data: { stage: string; durationMs?: number; nodeId?: string } }
    | { type: 'stage_progress'; data: { stage: string; progress?: { percentage: number }; message?: string; nodeId?: string } }
    | { type: 'stage_mapped'; data: { stageId: string; mapping: PlanCodeMapping } }
    | { type: 'file_analyzed'; data: { filePath: string; operationsFound: number } }
    | { type: 'completed'; data: AgentResult }
    | { type: 'error'; data: AgentError };
