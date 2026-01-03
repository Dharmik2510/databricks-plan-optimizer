/**
 * Mapping Job Orchestrator
 *
 * This orchestrator:
 * - Manages async job execution
 * - Handles parallel DAG node processing
 * - Tracks job progress
 * - Aggregates results
 * - Provides streaming updates
 *
 * Entry point for "Map to Code" feature
 */

import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { compileGraphWithSupabase, invokeGraph, streamGraph } from '../graph/mapping-graph';
import { MappingState, DagNode, MappingOutput } from '../state/mapping-state.schema';
import { loadRepoContextNode } from '../nodes/load-repo-context.node';
import {
  jobEventEmitter,
  createJobStartedEvent,
  createStageStartedEvent,
  createStageProgressEvent,
  createStageCompletedEvent,
  createJobCompletedEvent,
  createErrorEvent,
  createPausedEvent,
  createResumedEvent,
} from '../events';

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  MAX_PARALLEL_NODES: parseInt(process.env.MAX_PARALLEL_NODES || '5', 10),
  JOB_TIMEOUT_MS: 600000, // 10 minutes
  MAX_COST_PER_JOB_USD: parseFloat(process.env.MAX_JOB_COST_USD || '5.0'),
};

// ============================================================================
// Types
// ============================================================================

export interface CreateMappingJobRequest {
  analysisId: string;
  userId: string; // Required for multi-tenancy
  repoUrl: string;
  commitHash?: string;
  githubToken?: string;
  dagNodes: DagNode[];
}

export interface JobStatus {
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  isPaused?: boolean;
  progress: {
    totalNodes: number;
    completedNodes: number;
    currentNode: string | null;
  };
  results: MappingOutput[];
  error: string | null;
  startTime: Date;
  endTime: Date | null;
  costTracking: {
    totalCostUSD: number;
  };
  repoContext?: any; // Repository analysis context from LangGraph
}

// ============================================================================
// Orchestrator Service
// ============================================================================

@Injectable()
export class MappingOrchestrator {
  private readonly logger = new Logger(MappingOrchestrator.name);
  private graph: any;
  private readonly jobs: Map<string, JobStatus> = new Map();
  private graphInitialized: Promise<void>;

  constructor() {
    // Compile graph once at startup with Supabase checkpointer
    // CRITICAL: Handle potential rejection to avoid UnhandledPromiseRejection causing crash
    this.graphInitialized = this.initializeGraph().catch(err => {
      this.logger.error('❌ Failed to initialize graph in constructor', err);
      // We don't rethrow here to prevent app crash. 
      // executeJob will re-check graphInitialized or we can retry.
    });
  }

  private async initializeGraph() {
    const maxRetries = 5;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        this.logger.log('Initializing LangGraph with Supabase checkpointer...');
        this.graph = await compileGraphWithSupabase();
        this.logger.log('✅ MappingOrchestrator initialized with Supabase checkpointer');
        return;
      } catch (error) {
        retryCount++;
        this.logger.error(`❌ Graph initialization failed (Attempt ${retryCount}/${maxRetries}): ${error.message}`);

        if (retryCount >= maxRetries) {
          this.logger.error('CRITICAL: Graph initialization failed after retries. Mapping jobs will fail.');
          throw error; // Re-throw to be caught by the constructor .catch()
        }

        // Exponential backoff
        const delay = Math.pow(2, retryCount - 1) * 1000;
        this.logger.log(`Retrying graph init in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Create and start a new mapping job
   *
   * Returns job ID immediately (async execution)
   */
  async createJob(request: CreateMappingJobRequest): Promise<{ jobId: string }> {
    const jobId = uuidv4();

    this.logger.log(`Creating mapping job: ${jobId}`);

    // Initialize job status
    const jobStatus: JobStatus = {
      jobId,
      status: 'pending',
      progress: {
        totalNodes: request.dagNodes.length,
        completedNodes: 0,
        currentNode: null,
      },
      results: [],
      error: null,
      startTime: new Date(),
      endTime: null,
      costTracking: {
        totalCostUSD: 0,
      },
    };

    this.jobs.set(jobId, jobStatus);

    // Emit job_started event
    jobEventEmitter.emitJobEvent(jobId, createJobStartedEvent({
      jobId,
      userId: request.userId,
      repoUrl: request.repoUrl,
      commitHash: request.commitHash || null,
      totalNodes: request.dagNodes.length,
    }));

    // Execute job asynchronously
    this.executeJob(jobId, request).catch((error) => {
      this.logger.error(`Job ${jobId} failed`, error);
      this.updateJobStatus(jobId, {
        status: 'failed',
        error: error.message,
        endTime: new Date(),
      });

      // Emit error event
      jobEventEmitter.emitJobEvent(jobId, createErrorEvent({
        jobId,
        error: {
          code: 'JOB_FAILED',
          message: error.message,
          retryable: true,
        },
      }));
    });

    return { jobId };
  }

  /**
   * Get job status and results
   */
  async getJobStatus(jobId: string): Promise<JobStatus | null> {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Cancel running job
   */
  async cancelJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);

    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (job.status === 'completed' || job.status === 'failed') {
      throw new Error(`Job ${jobId} already ${job.status}`);
    }

    this.logger.log(`Cancelling job: ${jobId}`);

    // TODO: Implement graph cancellation
    this.updateJobStatus(jobId, {
      status: 'failed',
      error: 'Job cancelled by user',
      endTime: new Date(),
    });
  }

  /**
   * Pause running job
   */
  async pauseJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'running') {
      return false;
    }

    this.logger.log(`Pausing job: ${jobId}`);
    this.updateJobStatus(jobId, { isPaused: true });

    // Emit paused event
    jobEventEmitter.emitJobEvent(jobId, createPausedEvent(jobId));

    return true;
  }

  /**
   * Resume paused job
   */
  async resumeJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job || !job.isPaused) {
      return false;
    }

    this.logger.log(`Resuming job: ${jobId}`);
    this.updateJobStatus(jobId, { isPaused: false });

    // Emit resumed event
    jobEventEmitter.emitJobEvent(jobId, createResumedEvent(jobId));

    return true;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Execute mapping job (async)
   */
  private async executeJob(
    jobId: string,
    request: CreateMappingJobRequest,
  ): Promise<void> {
    // Wait for graph initialization
    await this.graphInitialized;

    this.logger.log(`Starting job execution: ${jobId}`);

    this.updateJobStatus(jobId, { status: 'running' });

    try {
      // Step 1: Load repo context (shared across all DAG nodes)
      const repoState = await this.loadRepoContext(jobId, request);

      // Step 2: Process DAG nodes in parallel batches
      const results = await this.processDAGNodesInParallel(
        jobId,
        request.dagNodes,
        repoState,
      );

      // Step 3: Finalize job
      const endTime = new Date();
      const jobStatus = this.jobs.get(jobId)!;
      const durationMs = endTime.getTime() - jobStatus.startTime.getTime();

      this.updateJobStatus(jobId, {
        status: 'completed',
        results,
        endTime,
      });

      // Emit job_completed event
      const finalStatus = this.jobs.get(jobId)!;
      jobEventEmitter.emitJobEvent(jobId, createJobCompletedEvent({
        jobId,
        status: 'completed',
        durationMs,
        statistics: {
          totalNodes: request.dagNodes.length,
          mappedNodes: results.length,
          confirmedMappings: results.filter(r => r.confidence >= 0.8).length,
          probableMappings: results.filter(r => r.confidence >= 0.5 && r.confidence < 0.8).length,
          unmappedNodes: request.dagNodes.length - results.length,
          filesScanned: repoState.repoContext?.fileCount || 0,
          symbolsIndexed: repoState.repoContext?.astIndexSize || 0,
        },
        costTracking: {
          llmCalls: 0, // TODO: Extract from results
          totalTokens: 0,
          estimatedCostUSD: finalStatus.costTracking.totalCostUSD,
        },
      }));

      this.logger.log(`Job ${jobId} completed successfully`);
    } catch (error) {
      this.logger.error(`Job ${jobId} failed during execution`, error);
      throw error;
    }
  }

  /**
   * Load repository context (once per job)
   */
  private async loadRepoContext(
    jobId: string,
    request: CreateMappingJobRequest,
  ): Promise<Partial<MappingState>> {
    this.logger.log(`Loading repo context for job: ${jobId}`);

    // Emit stage_started event
    jobEventEmitter.emitJobEvent(jobId, createStageStartedEvent({
      jobId,
      stage: 'load_repo_context',
      nodeId: null,
      message: 'Cloning repository and building context...',
    }));

    const startTime = Date.now();
    const initialState: Partial<MappingState> = {
      jobId,
      userId: request.userId, // Pass userId to state
      analysisId: request.analysisId,
      repoUrl: request.repoUrl,
      repoCommitHash: request.commitHash || null,
      githubToken: request.githubToken || null,
      dagNodes: request.dagNodes,
      status: 'running',
      startTime: new Date(),
    };

    // Invoke load_repo node directly to preload context
    try {
      this.logger.log('Pre-loading repository context (cloning & embedding)...');
      const loadedState = await loadRepoContextNode(initialState as MappingState);

      this.logger.log('Repository context loaded successfully');

      const durationMs = Date.now() - startTime;

      // Emit stage_completed event
      jobEventEmitter.emitJobEvent(jobId, createStageCompletedEvent({
        jobId,
        stage: 'load_repo_context',
        nodeId: null,
        durationMs,
        status: 'success',
        result: {
          fileCount: loadedState.repoContext?.fileCount,
          embeddingsGenerated: loadedState.repoContext?.embeddingsGenerated,
          commitHash: loadedState.repoContext?.commitHash,
        },
      }));

      return {
        ...initialState,
        repoContext: loadedState.repoContext,
        metadata: {
          ...loadedState.metadata,
        }
      };
    } catch (error) {
      this.logger.error('Failed to load repo context', error);

      // Emit error event
      jobEventEmitter.emitJobEvent(jobId, createErrorEvent({
        jobId,
        stage: 'load_repo_context',
        nodeId: null,
        error: {
          code: 'REPO_LOAD_FAILED',
          message: error.message,
          retryable: true,
        },
      }));

      throw error;
    }
  }

  /**
   * Process DAG nodes in parallel with concurrency limit
   */
  private async processDAGNodesInParallel(
    jobId: string,
    dagNodes: DagNode[],
    baseState: Partial<MappingState>,
  ): Promise<MappingOutput[]> {
    this.logger.log(
      `Processing ${dagNodes.length} DAG nodes (max ${CONFIG.MAX_PARALLEL_NODES} parallel)`,
    );

    const allResults: MappingOutput[] = [];
    let totalCost = 0;
    let capturedRepoContext: any = null;

    // Process in batches
    for (let i = 0; i < dagNodes.length; i += CONFIG.MAX_PARALLEL_NODES) {
      const batch = dagNodes.slice(i, i + CONFIG.MAX_PARALLEL_NODES);

      this.logger.log(
        `Processing batch ${Math.floor(i / CONFIG.MAX_PARALLEL_NODES) + 1}: ${batch.length} nodes`,
      );

      // Check for pause
      while (this.jobs.get(jobId)?.isPaused) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        // Check if job was cancelled while paused
        if (this.jobs.get(jobId)?.status === 'failed') break;
      }

      // Check for cancellation
      if (this.jobs.get(jobId)?.status === 'failed') break;

      // Process batch in parallel
      const batchPromises = batch.map((dagNode) =>
        this.processSingleDAGNode(jobId, dagNode, baseState),
      );

      const batchResults = await Promise.allSettled(batchPromises);

      // Aggregate results
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          allResults.push(...result.value.mappings);
          totalCost += result.value.cost;

          // Update progress
          this.updateJobStatus(jobId, {
            progress: {
              totalNodes: dagNodes.length,
              completedNodes: allResults.length,
              currentNode: null,
            },
            results: allResults,
            costTracking: {
              totalCostUSD: totalCost,
            },
            // Persist repo context if we found it (and haven't saved it yet)
            ...(result.value.repoContext && !capturedRepoContext
              ? { repoContext: result.value.repoContext }
              : {}),
          });

          // Update local capture variable
          if (result.value.repoContext && !capturedRepoContext) {
            capturedRepoContext = result.value.repoContext;
          }

          // Check cost limit
          if (totalCost > CONFIG.MAX_COST_PER_JOB_USD) {
            throw new Error(
              `Job cost exceeded limit: $${totalCost.toFixed(2)} > $${CONFIG.MAX_COST_PER_JOB_USD}`,
            );
          }
        } else {
          this.logger.error('Batch node failed', result.reason);
        }
      }
    }


    // One final update to ensure repoContext is saved if it was found in the last batch
    if (capturedRepoContext) {
      this.updateJobStatus(jobId, {
        repoContext: capturedRepoContext,
      });
    }

    return allResults;
  }

  /**
   * Process a single DAG node through the graph
   */
  private async processSingleDAGNode(
    jobId: string,
    dagNode: DagNode,
    baseState: Partial<MappingState>,
  ): Promise<{ mappings: MappingOutput[]; cost: number; repoContext?: any }> {
    this.logger.log(`Processing DAG node: ${dagNode.id}`);

    this.updateJobStatus(jobId, {
      progress: {
        ...this.jobs.get(jobId)!.progress,
        currentNode: dagNode.id,
      },
    });

    // Build state for this DAG node
    const nodeState: Partial<MappingState> = {
      ...baseState,
      currentDagNode: dagNode,
      currentNodeIndex: 0,
    };

    // Invoke graph
    const result = await invokeGraph(this.graph, nodeState);

    return {
      mappings: result.completedMappings,
      cost: result.costTracking?.estimatedCostUSD || 0,
      repoContext: result.repoContext,
    };
  }

  /**
   * Update job status (partial update)
   */
  private updateJobStatus(jobId: string, updates: Partial<JobStatus>): void {
    const currentStatus = this.jobs.get(jobId);

    if (!currentStatus) {
      this.logger.warn(`Attempted to update non-existent job: ${jobId}`);
      return;
    }

    const updatedStatus = {
      ...currentStatus,
      ...updates,
      progress: {
        ...currentStatus.progress,
        ...(updates.progress || {}),
      },
      costTracking: {
        ...currentStatus.costTracking,
        ...(updates.costTracking || {}),
      },
    };

    this.jobs.set(jobId, updatedStatus);

    // Emit progress event if progress fields changed
    if (updates.progress) {
      const percentage = updatedStatus.progress.totalNodes > 0
        ? Math.round((updatedStatus.progress.completedNodes / updatedStatus.progress.totalNodes) * 100)
        : 0;

      jobEventEmitter.emitJobEvent(jobId, createStageProgressEvent({
        jobId,
        stage: 'reasoning_agent', // Generic stage for mapping progress
        nodeId: updatedStatus.progress.currentNode,
        progress: percentage,
        message: `Processed ${updatedStatus.progress.completedNodes}/${updatedStatus.progress.totalNodes} nodes`,
        elapsedMs: Date.now() - updatedStatus.startTime.getTime(),
      }));
    }
  }

  /**
   * Stream job execution with real-time updates
   */
  async * streamJobExecution(
    jobId: string,
    request: CreateMappingJobRequest,
  ): AsyncGenerator<JobStatus> {
    // Wait for graph initialization
    await this.graphInitialized;

    this.logger.log(`Streaming job execution: ${jobId}`);

    // Initialize job
    const initialState: Partial<MappingState> = {
      jobId,
      analysisId: request.analysisId,
      repoUrl: request.repoUrl,
      repoCommitHash: request.commitHash || null,
      githubToken: request.githubToken || null,
      dagNodes: request.dagNodes,
      currentNodeIndex: 0,
      currentDagNode: request.dagNodes[0],
      status: 'running',
      startTime: new Date(),
    };

    // Stream graph execution
    for await (const chunk of streamGraph(this.graph, initialState)) {
      // Update job status
      this.updateJobStatus(jobId, {
        progress: {
          totalNodes: request.dagNodes.length,
          completedNodes: chunk.state.completedMappings?.length || 0,
          currentNode: chunk.state.currentDagNode?.id || null,
        },
      });

      // Yield current status
      const currentStatus = this.jobs.get(jobId);
      if (currentStatus) {
        yield currentStatus;
      }
    }

    // Final status
    this.updateJobStatus(jobId, {
      status: 'completed',
      endTime: new Date(),
    });

    const finalStatus = this.jobs.get(jobId);
    if (finalStatus) {
      yield finalStatus;
    }
  }
}
