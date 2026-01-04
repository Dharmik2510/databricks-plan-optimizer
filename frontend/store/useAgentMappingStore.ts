/**
 * Agent Mapping Store (Zustand)
 * 
 * Global state management for the agentic mapping experience.
 * Handles SSE events, timeline stages, DAG nodes, and UI state.
 * 
 * @see design_summary.md Section 7: React Component Architecture
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// ============================================================================
// Types (matching backend event types)
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

export interface AgentEvent {
    type: AgentEventType;
    timestamp: string;
    data: any;
}

export type StageStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface TimelineStage {
    id: string;
    name: string;
    type: 'global' | 'per-node';
    nodeId?: string;
    nodeIndex?: number;
    status: StageStatus;
    progress?: number;
    startTime?: Date;
    endTime?: Date;
    durationMs?: number;
    artifacts: Artifact[];
    error?: ErrorDetails;
    message?: string;
}

export interface Artifact {
    type: 'semantic_description' | 'candidates' | 'filtered_candidates'
    | 'llm_reasoning' | 'confidence_result';
    data: any;
    timestamp: Date;
}

export interface ErrorDetails {
    code: string;
    message: string;
    retryable: boolean;
    retryCount?: number;
}

export type DAGNodeStatus = 'pending' | 'processing' | 'mapped' | 'unmapped' | 'failed';
export type ConfidenceStatus = 'confirmed' | 'probable' | 'uncertain';

export interface DAGNodeState {
    id: string;
    nodeIndex: number;
    name: string;
    operatorType: string;
    status: DAGNodeStatus;
    confidence?: number;
    confidenceStatus?: ConfidenceStatus;
    mapping?: CodeMapping;
    reasoning?: string;
    alternatives?: Alternative[];
    confidenceFactors?: ConfidenceFactors;
}

export interface CodeMapping {
    file: string;
    symbol: string;
    lines: string;
    codeSnippet?: string;
}

export interface Alternative {
    file: string;
    symbol: string;
    reasoning: string;
    confidence?: number;
}

export interface ConfidenceFactors {
    embeddingScore: number;
    astScore: number;
    llmConfidence: number;
    keywordMatch: number;
    alternativesPenalty: number;
}

export interface RepoConfig {
    url: string;
    branch: string;
    commitHash?: string;
}

export interface AgentSettings {
    llmModel: string;
    embeddingModel: string;
    maxFiles: number;
    minConfidence: number;
    concurrency: number;
    timeout: number;
}

// ============================================================================
// Store State Interface
// ============================================================================

interface AgentMappingState {
    // Job metadata
    jobId: string | null;
    status: 'idle' | 'initializing' | 'running' | 'paused' | 'completed' | 'failed';
    repoConfig: RepoConfig | null;

    // Timeline stages
    stages: TimelineStage[];
    currentStageId: string | null;

    // DAG nodes
    dagNodes: DAGNodeState[];
    selectedNodeId: string | null;

    // Artifacts map (stageId -> artifacts)
    artifacts: Map<string, Artifact[]>;

    // SSE connection
    eventSource: EventSource | null;
    isConnected: boolean;
    reconnectAttempts: number;

    // Controls
    isPaused: boolean;
    settings: AgentSettings;

    // Statistics
    statistics: {
        totalNodes: number;
        mappedNodes: number;
        confirmedMappings: number;
        probableMappings: number;
        unmappedNodes: number;
        filesScanned: number;
        symbolsIndexed: number;
    } | null;

    // Actions
    actions: {
        connectSSE: (jobId: string, token: string) => void;
        disconnectSSE: () => void;
        handleEvent: (event: AgentEvent) => void;
        selectNode: (nodeId: string | null) => void;
        pauseAgent: () => void;
        resumeAgent: () => void;
        updateSettings: (settings: Partial<AgentSettings>) => void;
        reset: () => void;
    };
}

// ============================================================================
// Initial State
// ============================================================================

const defaultSettings: AgentSettings = {
    llmModel: 'gpt-4o',
    embeddingModel: 'text-embedding-3-small',
    maxFiles: 50,
    minConfidence: 40,
    concurrency: 5,
    timeout: 120,
};

const initialState = {
    jobId: null,
    status: 'idle' as const,
    repoConfig: null,
    stages: [],
    currentStageId: null,
    dagNodes: [],
    selectedNodeId: null,
    artifacts: new Map(),
    eventSource: null,
    isConnected: false,
    reconnectAttempts: 0,
    isPaused: false,
    settings: defaultSettings,
    statistics: null,
};

// ============================================================================
// Store Implementation
// ============================================================================

export const useAgentMappingStore = create<AgentMappingState>()(
    devtools(
        (set, get) => ({
            ...initialState,

            actions: {
                /**
                 * Connect to SSE stream for a job
                 */
                connectSSE: (jobId: string, token: string) => {
                    const { eventSource } = get();

                    // Close existing connection
                    if (eventSource) {
                        eventSource.close();
                    }

                    // SSE endpoint - aligned with client.ts
                    const apiBase = import.meta.env.VITE_API_URL || '/api/v1';
                    const streamUrl = `${apiBase}/agent/jobs/${jobId}/stream`;

                    console.log(`[AgentStore] Connecting to SSE: ${streamUrl}`);

                    const es = new EventSource(streamUrl);

                    es.onopen = () => {
                        console.log('[AgentStore] SSE connection opened');
                        set({
                            isConnected: true,
                            reconnectAttempts: 0,
                            jobId,
                            status: 'initializing',
                        });
                    };

                    es.onmessage = (e) => {
                        try {
                            const event: AgentEvent = JSON.parse(e.data);
                            console.log('[AgentStore] Received event:', event.type, event.data);
                            get().actions.handleEvent(event);
                        } catch (error) {
                            console.error('[AgentStore] Failed to parse SSE message:', error);
                        }
                    };

                    es.onerror = (error) => {
                        console.error('[AgentStore] SSE error:', error);
                        set(state => ({
                            isConnected: false,
                            reconnectAttempts: state.reconnectAttempts + 1,
                        }));

                        // Auto-reconnect with exponential backoff (max 3 attempts)
                        const attempts = get().reconnectAttempts;
                        if (attempts < 3) {
                            const delayMs = Math.min(1000 * Math.pow(2, attempts), 10000);
                            console.log(`[AgentStore] Reconnecting in ${delayMs}ms (attempt ${attempts + 1}/3)`);
                            setTimeout(() => {
                                get().actions.connectSSE(jobId, token);
                            }, delayMs);
                        } else {
                            console.error('[AgentStore] Max reconnect attempts reached');
                            set({ status: 'failed' });
                        }
                    };

                    set({ eventSource: es });
                },

                /**
                 * Disconnect from SSE
                 */
                disconnectSSE: () => {
                    const { eventSource } = get();
                    if (eventSource) {
                        eventSource.close();
                        console.log('[AgentStore] SSE connection closed');
                    }
                    set({ eventSource: null, isConnected: false });
                },

                /**
                 * Handle incoming SSE event
                 */
                handleEvent: (event: AgentEvent) => {
                    // Guard against invalid events
                    if (!event || !event.type) {
                        console.warn('[AgentStore] Invalid event received:', event);
                        return;
                    }

                    switch (event.type) {
                        case 'job_started':
                            handleJobStarted(set, get, event);
                            break;
                        case 'stage_started':
                            handleStageStarted(set, event);
                            break;
                        case 'stage_progress':
                            handleStageProgress(set, get, event);
                            break;
                        case 'stage_completed':
                            handleStageCompleted(set, event);
                            break;
                        case 'artifact_produced':
                            handleArtifactProduced(set, event);
                            break;
                        case 'mapping_finalized':
                            handleMappingFinalized(set, event);
                            break;
                        case 'job_completed':
                            handleJobCompleted(set, get, event);
                            break;
                        case 'error':
                            handleError(set, event);
                            break;
                        default:
                            console.log('[AgentStore] Unknown event type:', event.type);
                    }
                },

                /**
                 * Select a DAG node
                 */
                selectNode: (nodeId: string | null) => {
                    set({ selectedNodeId: nodeId });
                },

                /**
                 * Pause agent execution
                 */
                pauseAgent: async () => {
                    const { jobId } = get();
                    if (!jobId) return;

                    try {
                        await fetch(`/api/v1/agent/jobs/${jobId}/pause`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
                                'Content-Type': 'application/json',
                            },
                        });
                        set({ isPaused: true });
                        console.log('[AgentStore] Agent paused');
                    } catch (error) {
                        console.error('[AgentStore] Failed to pause agent:', error);
                    }
                },

                /**
                 * Resume agent execution
                 */
                resumeAgent: async () => {
                    const { jobId } = get();
                    if (!jobId) return;

                    try {
                        await fetch(`/api/v1/agent/jobs/${jobId}/resume`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
                                'Content-Type': 'application/json',
                            },
                        });
                        set({ isPaused: false });
                        console.log('[AgentStore] Agent resumed');
                    } catch (error) {
                        console.error('[AgentStore] Failed to resume agent:', error);
                    }
                },

                /**
                 * Update agent settings
                 */
                updateSettings: (newSettings: Partial<AgentSettings>) => {
                    set(state => ({
                        settings: { ...state.settings, ...newSettings },
                    }));
                },

                /**
                 * Reset store to initial state
                 */
                reset: () => {
                    get().actions.disconnectSSE();
                    set(initialState);
                },
            },
        }),
        { name: 'AgentMappingStore' }
    )
);

// ============================================================================
// Event Handlers
// ============================================================================

function handleJobStarted(set: any, get: any, event: AgentEvent) {
    const { totalNodes, repoUrl, commitHash, jobId } = event.data;

    // AVOID FLASH: If we are already tracking this job, don't reset the state!
    // The backend sends 'job_started' on every reconnection, which causes the UI to
    // flash back to "Load Repo" for 1 second before fast-forwarding.
    const currentJobId = get().jobId;
    if (currentJobId === jobId && get().stages.length > 0) {
        console.log('[AgentStore] Ignoring job_started for existing job to prevent state reset');
        return;
    }

    // Create initial stages matching the wireframe design
    const initialStages: TimelineStage[] = [
        {
            id: 'load_repo',
            name: 'Load Repo',
            type: 'global',
            status: 'running' as StageStatus,
            startTime: new Date(),
            artifacts: [],
            message: 'Cloning repository...',
        },
        {
            id: 'parse_ast',
            name: 'Parse AST',
            type: 'global',
            status: 'queued' as StageStatus,
            artifacts: [],
            message: 'Analyzing code structure',
        },
        {
            id: 'langgraph_execution',
            name: 'Extract Semantics',
            type: 'global',
            status: 'queued' as StageStatus,
            artifacts: [],
            message: `Node 0/${totalNodes}`,
        },
        {
            id: 'retrieve_candidates',
            name: 'Retrieve Candidates',
            type: 'global',
            status: 'queued' as StageStatus,
            artifacts: [],
            message: 'Searching code embeddings',
        },
        {
            id: 'cross_reference',
            name: 'Cross-Reference',
            type: 'global',
            status: 'queued' as StageStatus,
            artifacts: [],
            message: 'Validating mappings',
        },
        {
            id: 'finalize_analysis',
            name: 'Finalize Analysis',
            type: 'global',
            status: 'queued' as StageStatus,
            artifacts: [],
            message: 'Generating results',
        },
    ];

    set({
        status: 'running',
        stages: initialStages,
        currentStageId: 'load_repo',
        dagNodes: Array.from({ length: totalNodes }, (_, i) => ({
            id: `node_${i}`,
            nodeIndex: i,
            name: `Node ${i + 1}`,
            operatorType: 'Unknown',
            status: 'pending' as DAGNodeStatus,
        })),
        repoConfig: {
            url: repoUrl,
            branch: 'main',
            commitHash,
        },
    });
}

function handleStageStarted(set: any, event: AgentEvent) {
    const { stage, nodeId, message, nodeIndex } = event.data;

    // The incoming 'stage' is the stage ID (e.g., 'load_repo', 'parse_ast')
    const stageId = nodeId ? `${stage}_${nodeId}` : stage;

    // Define stage order for completing previous stages
    const stageOrder = ['load_repo', 'parse_ast', 'langgraph_execution', 'retrieve_candidates', 'cross_reference', 'finalize_analysis'];
    const currentStageIndex = stageOrder.indexOf(stageId);

    set((state: AgentMappingState) => {
        const now = new Date();

        // Update stages: mark previous as completed, set current as running
        const updatedStages = state.stages.map(s => {
            const sIndex = stageOrder.indexOf(s.id);

            // If this is a previous stage that's still running, complete it
            if (sIndex !== -1 && sIndex < currentStageIndex && s.status === 'running') {
                const duration = s.startTime ? now.getTime() - new Date(s.startTime).getTime() : 0;
                return {
                    ...s,
                    status: 'completed' as StageStatus,
                    endTime: now,
                    durationMs: duration,
                    progress: 100,
                };
            }

            // Update the target stage to running
            if (s.id === stageId) {
                return {
                    ...s,
                    status: 'running' as StageStatus,
                    startTime: now,
                    message: message || s.message,
                };
            }

            return s;
        });

        return {
            stages: updatedStages,
            currentStageId: stageId,
        };
    });

    // Update node status if per-node stage
    if (event.data.nodeId) {
        set((state: AgentMappingState) => ({
            dagNodes: state.dagNodes.map(node =>
                node.id === event.data.nodeId
                    ? { ...node, status: 'processing' as DAGNodeStatus }
                    : node
            ),
        }));
    }
}

function handleStageProgress(set: any, get: any, event: AgentEvent) {
    const { stage, nodeId, progress, message } = event.data || {};

    // Map backend stage IDs to our stages
    const stageMapping: Record<string, string> = {
        'initialization': 'load_repo',
        'prepare_nodes': 'parse_ast',
        'langgraph_execution': 'langgraph_execution',
        'generate_results': 'langgraph_execution',
        'processing': 'langgraph_execution',
    };

    const targetStageId = stageMapping[stage] || stage || 'langgraph_execution';

    set((state: AgentMappingState) => {
        const updatedStages = state.stages.map(s => {
            // Mark previous stages as completed if we've moved past them
            if (targetStageId === 'parse_ast' && s.id === 'load_repo' && s.status === 'running') {
                return { ...s, status: 'completed' as StageStatus, endTime: new Date(), progress: 100, durationMs: Date.now() - (s.startTime?.getTime() || Date.now()) };
            }
            if (targetStageId === 'langgraph_execution' && (s.id === 'load_repo' || s.id === 'parse_ast') && s.status !== 'completed') {
                return { ...s, status: 'completed' as StageStatus, endTime: new Date(), progress: 100, durationMs: s.startTime ? Date.now() - s.startTime.getTime() : 0 };
            }

            // Update the target stage
            if (s.id === targetStageId) {
                return {
                    ...s,
                    status: 'running' as StageStatus,
                    startTime: s.startTime || new Date(),
                    progress: progress?.percentage || s.progress,
                    message: message || s.message,
                };
            }

            return s;
        });

        return {
            stages: updatedStages,
            currentStageId: targetStageId,
        };
    });
}

function handleStageCompleted(set: any, event: AgentEvent) {
    const { stage, nodeId, durationMs, result } = event.data;
    const stageId = nodeId ? `${stage}_${nodeId}` : stage;

    set((state: AgentMappingState) => {
        const now = new Date();

        return {
            stages: state.stages.map(s => {
                if (s.id === stageId) {
                    // Calculate duration from startTime if not provided
                    const calculatedDuration = durationMs ||
                        (s.startTime ? now.getTime() - new Date(s.startTime).getTime() : 0);

                    return {
                        ...s,
                        status: 'completed' as StageStatus,
                        endTime: now,
                        durationMs: calculatedDuration,
                        progress: 100,
                    };
                }
                return s;
            }),
        };
    });
}

function handleArtifactProduced(set: any, event: AgentEvent) {
    const { stage, nodeId, artifactType, artifact } = event.data;
    const stageId = nodeId ? `${stage}_${nodeId}` : stage;

    const newArtifact: Artifact = {
        type: artifactType,
        data: artifact,
        timestamp: new Date(),
    };

    set((state: AgentMappingState) => ({
        stages: state.stages.map(s =>
            s.id === stageId
                ? { ...s, artifacts: [...s.artifacts, newArtifact] }
                : s
        ),
    }));
}

function handleMappingFinalized(set: any, event: AgentEvent) {
    const { nodeId, mapping } = event.data;

    set((state: AgentMappingState) => ({
        dagNodes: state.dagNodes.map(node =>
            node.id === nodeId
                ? {
                    ...node,
                    status: 'mapped' as DAGNodeStatus,
                    confidence: mapping.confidence * 100,
                    confidenceStatus: getConfidenceStatus(mapping.confidence),
                    mapping: {
                        file: mapping.file,
                        symbol: mapping.symbol,
                        lines: mapping.lines,
                    },
                    reasoning: mapping.explanation,
                }
                : node
        ),
    }));
}

function handleJobCompleted(set: any, get: any, event: AgentEvent) {
    const { statistics, result } = event.data || {};

    // Extract DAG nodes from result.mappings
    const dagNodes: DAGNodeState[] = (result?.mappings || []).map((mapping: any, idx: number) => {
        const confidence = mapping.confidence || 0;
        let confidenceStatus: ConfidenceStatus = 'uncertain';
        if (confidence >= 75) confidenceStatus = 'confirmed';
        else if (confidence >= 50) confidenceStatus = 'probable';

        // Extract confidence factors if available
        const confidenceFactors: ConfidenceFactors | undefined = mapping.confidenceFactors ? {
            embeddingScore: mapping.confidenceFactors.embeddingScore || 0,
            astScore: mapping.confidenceFactors.astScore || 0,
            llmConfidence: mapping.confidenceFactors.llmConfidence || 0,
            keywordMatch: mapping.confidenceFactors.keywordMatch || 0,
            alternativesPenalty: mapping.confidenceFactors.alternativesPenalty || 0,
        } : undefined;

        // Extract alternatives if available
        const alternatives: Alternative[] = (mapping.alternatives || []).slice(0, 3).map((alt: any) => ({
            file: alt.filePath || alt.file || '',
            symbol: alt.symbol || alt.functionContext || '',
            score: alt.confidence || alt.score || 0,
            reasoning: alt.reasoning || alt.rejectionReason || '',
        }));

        return {
            id: mapping.id || `node_${idx}`,
            nodeIndex: idx,
            name: mapping.stageName || `Stage ${idx + 1}`,
            operatorType: mapping.stageType || 'Unknown',
            status: confidence > 0 ? 'mapped' as DAGNodeStatus : 'unmapped' as DAGNodeStatus,
            confidence,
            confidenceStatus,
            confidenceFactors,
            alternatives: alternatives.length > 0 ? alternatives : undefined,
            mapping: mapping.mappings?.[0] ? {
                file: mapping.mappings[0].filePath,
                symbol: mapping.mappings[0].functionContext || mapping.mappings[0].classContext || '',
                lines: `${mapping.mappings[0].startLine}-${mapping.mappings[0].endLine}`,
                codeSnippet: mapping.mappings[0].codeSnippet,
            } : undefined,
            reasoning: mapping.reasoning,
        };
    });

    set({
        status: 'completed',
        dagNodes,
        statistics: statistics ? {
            totalNodes: statistics.totalNodes || dagNodes.length,
            mappedNodes: statistics.mappedNodes || dagNodes.filter(n => n.status === 'mapped').length,
            confirmedMappings: statistics.confirmedMappings || dagNodes.filter(n => n.confidenceStatus === 'confirmed').length,
            probableMappings: statistics.probableMappings || dagNodes.filter(n => n.confidenceStatus === 'probable').length,
            unmappedNodes: statistics.unmappedNodes || dagNodes.filter(n => n.status === 'unmapped').length,
            filesScanned: statistics.filesScanned || 0,
            symbolsIndexed: statistics.symbolsIndexed || 0,
        } : {
            totalNodes: dagNodes.length,
            mappedNodes: dagNodes.filter(n => n.status === 'mapped').length,
            confirmedMappings: dagNodes.filter(n => n.confidenceStatus === 'confirmed').length,
            probableMappings: dagNodes.filter(n => n.confidenceStatus === 'probable').length,
            unmappedNodes: dagNodes.filter(n => n.status === 'unmapped').length,
            filesScanned: 0,
            symbolsIndexed: 0,
        },
        // Mark all stages as completed (including finalize_analysis)
        stages: get().stages.map(stage => {
            const now = new Date();
            if (stage.status !== 'completed') {
                return {
                    ...stage,
                    status: 'completed' as StageStatus,
                    endTime: now,
                    progress: 100,
                    durationMs: stage.startTime ? now.getTime() - new Date(stage.startTime).getTime() : 0,
                    message: stage.id === 'finalize_analysis' ? `Mapped ${dagNodes.length} DAG nodes` : stage.message,
                };
            }
            return stage;
        }),
        currentStageId: 'finalize_analysis',
    });

    // Auto-disconnect SSE after completion
    get().actions.disconnectSSE();
}

function handleError(set: any, event: AgentEvent) {
    const { stage, nodeId, error } = event.data || {};
    const stageId = nodeId ? `${stage}_${nodeId}` : (stage || 'global_error');

    // Handle case where error object might be missing
    const errorDetails: ErrorDetails = {
        code: error?.code || 'UNKNOWN_ERROR',
        message: error?.message || 'An unknown error occurred',
        retryable: error?.retryable ?? false,
        retryCount: error?.retryCount,
    };

    set((state: AgentMappingState) => ({
        status: 'failed',
        stages: state.stages.map(s =>
            s.id === stageId
                ? { ...s, status: 'failed' as StageStatus, error: errorDetails }
                : s
        ),
    }));

    // Update node status if per-node error
    if (nodeId) {
        set((state: AgentMappingState) => ({
            dagNodes: state.dagNodes.map(node =>
                node.id === nodeId
                    ? { ...node, status: 'failed' as DAGNodeStatus }
                    : node
            ),
        }));
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatStageName(stage: string): string {
    const names: Record<string, string> = {
        'load_repo_context': 'Load Repository',
        'plan_semantics': 'Extract Semantics',
        'embedding_retrieval': 'Retrieve Candidates',
        'ast_filter': 'Filter by AST',
        'reasoning_agent': 'LLM Reasoning',
        'confidence_gate': 'Confidence Check',
        'final_mapping': 'Persist Mapping',
    };
    return names[stage] || stage;
}

function getConfidenceStatus(confidence: number): ConfidenceStatus {
    if (confidence >= 0.75) return 'confirmed';
    if (confidence >= 0.50) return 'probable';
    return 'uncertain';
}
