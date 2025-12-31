/**
 * LangGraph State Schema for DAG → Code Mapping
 *
 * This defines the complete state object that flows through the LangGraph workflow.
 * State is versioned for future migrations and fully serializable for persistence.
 *
 * @version 1.0.0
 */

import { Annotation } from '@langchain/langgraph';

// ============================================================================
// Type Definitions
// ============================================================================

export interface DagNode {
  id: string;
  operator: string;
  keys?: string[];
  aggregations?: Array<{ func: string; col: string }>;
  filters?: Array<{ col: string; op: string; val: any }>;
  sortColumns?: string[];
  children?: string[];
  physicalPlanFragment: string;
  metadata?: Record<string, any>;
}

export interface SemanticDescription {
  dagNodeId: string;
  operatorType: string;
  executionBehavior: string;
  dataTransformation: {
    inputSchema: string[];
    outputSchema: string[];
    keyColumns: string[];
    aggregateFunctions: string[];
    filterConditions: string[];
  };
  sparkOperatorSignature: string;
}

export interface CodeCandidate {
  file: string;
  symbol: string;
  lines: string;
  embeddingScore: number;
  metadata: {
    type: 'function' | 'class' | 'method';
    complexity?: number;
    callGraph?: string[];
  };
  astScore?: number;
  astReasoning?: string;
}

export interface CodeMapping {
  file: string;
  symbol: string;
  lines: string;
}

export interface Alternative {
  file: string;
  symbol: string;
  reasoning: string;
  confidence?: number;
}

export interface MappingOutput {
  dagNodeId: string;
  mappedCode: CodeMapping;
  confidence: number;
  explanation: string;
  alternatives: Alternative[];
  metadata: {
    operatorType: string;
    embeddingScore: number;
    astScore: number;
    processedAt: string;
    processingDuration?: number;
  };
}

export interface RepoContext {
  clonePath: string;
  commitHash: string;
  cacheKey: string;
  fileCount: number;
  embeddingsGenerated: number;
  astIndexSize: number;
  timestamp: string;
}

export interface ConfidenceFactors {
  embeddingScore: number;
  astScore: number;
  llmConfidence: number;
  keywordMatch: number;
  alternativesPenalty: number;
}

export interface JobProgress {
  totalNodes: number;
  completedNodes: number;
  currentNodeId: string | null;
  startTime: Date;
  estimatedCompletion: Date | null;
}

export interface ErrorContext {
  nodeName?: string;
  dagNodeId?: string;
  errorType?: string;
  retryCount?: number;
  stackTrace?: string;
}

// ============================================================================
// LangGraph State Annotation
// ============================================================================

/**
 * Main state annotation for the mapping workflow.
 *
 * Each field is typed and can be updated independently by nodes.
 * Nodes return partial state updates that get merged into the full state.
 *
 * Usage in nodes:
 * ```typescript
 * export async function myNode(state: MappingState): Promise<Partial<MappingState>> {
 *   return {
 *     someField: newValue,
 *   };
 * }
 * ```
 */
export const MappingStateAnnotation = Annotation.Root({
  // ============================================================================
  // Job Metadata
  // ============================================================================

  jobId: Annotation<string>({
    reducer: (prev, next) => next ?? prev,
    default: () => '',
  }),

  analysisId: Annotation<string>({
    reducer: (prev, next) => next ?? prev,
    default: () => '',
  }),

  repoUrl: Annotation<string>({
    reducer: (prev, next) => next ?? prev,
    default: () => '',
  }),

  repoCommitHash: Annotation<string | null>({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),

  githubToken: Annotation<string | null>({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),

  // ============================================================================
  // Repository Context (Cached per repo hash)
  // ============================================================================

  repoContext: Annotation<RepoContext | null>({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),

  // ============================================================================
  // DAG Processing State
  // ============================================================================

  dagNodes: Annotation<DagNode[]>({
    reducer: (prev, next) => next ?? prev,
    default: () => [],
  }),

  currentNodeIndex: Annotation<number>({
    reducer: (prev, next) => next ?? prev,
    default: () => 0,
  }),

  currentDagNode: Annotation<DagNode | null>({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),

  // ============================================================================
  // Processing Pipeline State
  // ============================================================================

  semanticDescription: Annotation<SemanticDescription | null>({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),

  retrievedCandidates: Annotation<CodeCandidate[]>({
    reducer: (prev, next) => next ?? prev,
    default: () => [],
  }),

  filteredCandidates: Annotation<CodeCandidate[]>({
    reducer: (prev, next) => next ?? prev,
    default: () => [],
  }),

  // ============================================================================
  // Results State
  // ============================================================================

  finalMapping: Annotation<CodeMapping | null>({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),

  confidence: Annotation<number>({
    reducer: (prev, next) => next ?? prev,
    default: () => 0,
  }),

  confidenceFactors: Annotation<ConfidenceFactors | null>({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),

  explanation: Annotation<string>({
    reducer: (prev, next) => next ?? prev,
    default: () => '',
  }),

  alternatives: Annotation<Alternative[]>({
    reducer: (prev, next) => next ?? prev,
    default: () => [],
  }),

  // ============================================================================
  // Aggregated Results (Accumulates across all DAG nodes)
  // ============================================================================

  completedMappings: Annotation<MappingOutput[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  // ============================================================================
  // Job State Management
  // ============================================================================

  status: Annotation<'pending' | 'running' | 'completed' | 'failed'>({
    reducer: (prev, next) => next ?? prev,
    default: () => 'pending',
  }),

  error: Annotation<ErrorContext | null>({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),

  retryCount: Annotation<number>({
    reducer: (prev, next) => next ?? prev,
    default: () => 0,
  }),

  // ============================================================================
  // Progress Tracking
  // ============================================================================

  progress: Annotation<JobProgress | null>({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),

  // ============================================================================
  // Cost Tracking
  // ============================================================================

  costTracking: Annotation<{
    embeddingCalls: number;
    llmCalls: number;
    totalTokens: number;
    estimatedCostUSD: number;
  }>({
    reducer: (prev, next) => ({
      embeddingCalls: prev.embeddingCalls + (next.embeddingCalls || 0),
      llmCalls: prev.llmCalls + (next.llmCalls || 0),
      totalTokens: prev.totalTokens + (next.totalTokens || 0),
      estimatedCostUSD: prev.estimatedCostUSD + (next.estimatedCostUSD || 0),
    }),
    default: () => ({
      embeddingCalls: 0,
      llmCalls: 0,
      totalTokens: 0,
      estimatedCostUSD: 0,
    }),
  }),

  // ============================================================================
  // Timestamps
  // ============================================================================

  startTime: Annotation<Date | null>({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),

  endTime: Annotation<Date | null>({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),

  // ============================================================================
  // Metadata
  // ============================================================================

  stateVersion: Annotation<string>({
    reducer: (prev, next) => next ?? prev,
    default: () => 'v1',
  }),

  metadata: Annotation<Record<string, any>>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({}),
  }),
});

// ============================================================================
// Exported State Type
// ============================================================================

/**
 * Type-safe state object extracted from the annotation.
 * Use this type for function signatures.
 */
export type MappingState = typeof MappingStateAnnotation.State;

// ============================================================================
// State Validators
// ============================================================================

/**
 * Validates required fields for job initialization
 */
export function validateInitialState(state: Partial<MappingState>): boolean {
  return !!(
    state.jobId &&
    state.repoUrl &&
    state.dagNodes &&
    state.dagNodes.length > 0
  );
}

/**
 * Validates state before node execution
 */
export function validateNodeState(
  nodeName: string,
  state: MappingState,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  switch (nodeName) {
    case 'load_repo':
      if (!state.repoUrl) errors.push('Missing repoUrl');
      break;

    case 'plan_semantics':
      if (!state.currentDagNode) errors.push('Missing currentDagNode');
      break;

    case 'embedding_retrieval':
      if (!state.semanticDescription) errors.push('Missing semanticDescription');
      if (!state.repoContext) errors.push('Missing repoContext');
      break;

    case 'ast_filter':
      if (!state.retrievedCandidates || state.retrievedCandidates.length === 0) {
        errors.push('No retrievedCandidates to filter');
      }
      break;

    case 'reasoning_agent':
      if (!state.filteredCandidates || state.filteredCandidates.length === 0) {
        errors.push('No filteredCandidates for reasoning');
      }
      break;

    case 'confidence_gate':
      if (!state.finalMapping) errors.push('Missing finalMapping');
      break;

    case 'final_mapping':
      if (!state.finalMapping) errors.push('Missing finalMapping');
      if (!state.currentDagNode) errors.push('Missing currentDagNode');
      break;
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Serializes state for persistence
 */
export function serializeState(state: MappingState): string {
  return JSON.stringify(
    state,
    (key, value) => {
      // Convert dates to ISO strings
      if (value instanceof Date) {
        return value.toISOString();
      }
      return value;
    },
    2,
  );
}

/**
 * Deserializes persisted state
 */
export function deserializeState(serialized: string): MappingState {
  const parsed = JSON.parse(serialized);

  // Convert ISO strings back to dates
  if (parsed.startTime) parsed.startTime = new Date(parsed.startTime);
  if (parsed.endTime) parsed.endTime = new Date(parsed.endTime);
  if (parsed.progress?.startTime) {
    parsed.progress.startTime = new Date(parsed.progress.startTime);
  }
  if (parsed.progress?.estimatedCompletion) {
    parsed.progress.estimatedCompletion = new Date(parsed.progress.estimatedCompletion);
  }

  return parsed as MappingState;
}
