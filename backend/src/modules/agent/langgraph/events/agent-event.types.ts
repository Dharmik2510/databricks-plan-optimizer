/**
 * Agent Event Types for Server-Sent Events (SSE)
 * 
 * These events are emitted by the LangGraph pipeline and streamed to the frontend
 * via SSE to provide real-time updates on job progress.
 * 
 * @see design_summary.md Section 6: Backend Event Model
 */

// ============================================================================
// Event Types
// ============================================================================

export type AgentEventType =
    | 'job_started'
    | 'stage_started'
    | 'stage_progress'
    | 'stage_completed'
    | 'artifact_produced'
    | 'candidate_retrieved'
    | 'mapping_finalized'
    | 'error'
    | 'job_completed';

// ============================================================================
// Event Data Interfaces
// ============================================================================

export interface JobStartedData {
    jobId: string;
    userId: string;
    repoUrl: string;
    commitHash: string | null;
    totalNodes: number;
}

export interface StageStartedData {
    jobId: string;
    stage: StageName;
    nodeId: string | null;
    nodeIndex?: number;
    totalNodes?: number;
    nodeName?: string;
    message: string;
}

export interface StageProgressData {
    jobId: string;
    stage: StageName;
    nodeId: string | null;
    progress: number; // 0-100
    message: string;
    elapsedMs: number;
}

export interface StageCompletedData {
    jobId: string;
    stage: StageName;
    nodeId: string | null;
    durationMs: number;
    status: 'success' | 'failed';
    result?: any;
}

export interface ArtifactProducedData {
    jobId: string;
    stage: StageName;
    nodeId: string | null;
    artifactType: ArtifactType;
    artifact: any;
}

export interface CandidateRetrievedData {
    jobId: string;
    nodeId: string;
    candidate: {
        file: string;
        symbol: string;
        score: number;
    };
    rank: number;
}

export interface MappingFinalizedData {
    jobId: string;
    nodeId: string;
    mapping: {
        dagNodeId: string;
        file: string;
        symbol: string;
        lines: string;
        confidence: number;
        status: string;
        explanation: string;
    };
}

export interface ErrorData {
    jobId: string;
    stage?: StageName;
    nodeId?: string | null;
    error: {
        code: string;
        message: string;
        retryable: boolean;
        retryCount?: number;
    };
}

export interface JobCompletedData {
    jobId: string;
    status: 'completed' | 'failed';
    durationMs: number;
    statistics: {
        totalNodes: number;
        mappedNodes: number;
        confirmedMappings: number;
        probableMappings: number;
        unmappedNodes: number;
        filesScanned: number;
        symbolsIndexed: number;
    };
    costTracking: {
        llmCalls: number;
        totalTokens: number;
        estimatedCostUSD: number;
    };
}

// ============================================================================
// Event Union Type
// ============================================================================

export interface AgentEvent {
    type: AgentEventType;
    timestamp: string;
    data:
    | JobStartedData
    | StageStartedData
    | StageProgressData
    | StageCompletedData
    | ArtifactProducedData
    | CandidateRetrievedData
    | MappingFinalizedData
    | ErrorData
    | JobCompletedData;
}

// ============================================================================
// Helper Types
// ============================================================================

export type StageName =
    | 'load_repo_context'
    | 'plan_semantics'
    | 'embedding_retrieval'
    | 'ast_filter'
    | 'reasoning_agent'
    | 'confidence_gate'
    | 'final_mapping';

export type ArtifactType =
    | 'semantic_description'
    | 'candidates'
    | 'filtered_candidates'
    | 'llm_reasoning'
    | 'confidence_result';

// ============================================================================
// Typed Event Creators (for type safety)
// ============================================================================

export function createJobStartedEvent(data: JobStartedData): AgentEvent {
    return {
        type: 'job_started',
        timestamp: new Date().toISOString(),
        data,
    };
}

export function createStageStartedEvent(data: StageStartedData): AgentEvent {
    return {
        type: 'stage_started',
        timestamp: new Date().toISOString(),
        data,
    };
}

export function createStageProgressEvent(data: StageProgressData): AgentEvent {
    return {
        type: 'stage_progress',
        timestamp: new Date().toISOString(),
        data,
    };
}

export function createStageCompletedEvent(data: StageCompletedData): AgentEvent {
    return {
        type: 'stage_completed',
        timestamp: new Date().toISOString(),
        data,
    };
}

export function createArtifactProducedEvent(data: ArtifactProducedData): AgentEvent {
    return {
        type: 'artifact_produced',
        timestamp: new Date().toISOString(),
        data,
    };
}

export function createCandidateRetrievedEvent(data: CandidateRetrievedData): AgentEvent {
    return {
        type: 'candidate_retrieved',
        timestamp: new Date().toISOString(),
        data,
    };
}

export function createMappingFinalizedEvent(data: MappingFinalizedData): AgentEvent {
    return {
        type: 'mapping_finalized',
        timestamp: new Date().toISOString(),
        data,
    };
}

export function createErrorEvent(data: ErrorData): AgentEvent {
    return {
        type: 'error',
        timestamp: new Date().toISOString(),
        data,
    };
}

export function createJobCompletedEvent(data: JobCompletedData): AgentEvent {
    return {
        type: 'job_completed',
        timestamp: new Date().toISOString(),
        data,
    };
}
