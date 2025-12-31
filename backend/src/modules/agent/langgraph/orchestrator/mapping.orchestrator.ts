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
  repoUrl: string;
  commitHash?: string;
  githubToken?: string;
  dagNodes: DagNode[];
}

export interface JobStatus {
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
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
    this.graphInitialized = this.initializeGraph();
  }

  private async initializeGraph() {
    this.logger.log('Initializing LangGraph with Supabase checkpointer...');
    this.graph = await compileGraphWithSupabase();
    this.logger.log('MappingOrchestrator initialized with Supabase checkpointer');
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

    // Execute job asynchronously
    this.executeJob(jobId, request).catch((error) => {
      this.logger.error(`Job ${jobId} failed`, error);
      this.updateJobStatus(jobId, {
        status: 'failed',
        error: error.message,
        endTime: new Date(),
      });
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
      this.updateJobStatus(jobId, {
        status: 'completed',
        results,
        endTime: new Date(),
      });

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

    const initialState: Partial<MappingState> = {
      jobId,
      analysisId: request.analysisId,
      repoUrl: request.repoUrl,
      repoCommitHash: request.commitHash || null,
      githubToken: request.githubToken || null,
      dagNodes: request.dagNodes,
      status: 'running',
      startTime: new Date(),
    };

    // Invoke only load_repo node
    // TODO: Implement single-node invocation
    // For now, this is a placeholder

    return {
      ...initialState,
      repoContext: null, // Populated by load_repo node
    };
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

    // Process in batches
    for (let i = 0; i < dagNodes.length; i += CONFIG.MAX_PARALLEL_NODES) {
      const batch = dagNodes.slice(i, i + CONFIG.MAX_PARALLEL_NODES);

      this.logger.log(
        `Processing batch ${Math.floor(i / CONFIG.MAX_PARALLEL_NODES) + 1}: ${batch.length} nodes`,
      );

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
          });

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

    return allResults;
  }

  /**
   * Process a single DAG node through the graph
   */
  private async processSingleDAGNode(
    jobId: string,
    dagNode: DagNode,
    baseState: Partial<MappingState>,
  ): Promise<{ mappings: MappingOutput[]; cost: number }> {
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

    // TODO: Emit event for WebSocket streaming
    // eventEmitter.emit('job_updated', updatedStatus);
  }

  /**
   * Stream job execution with real-time updates
   */
  async *streamJobExecution(
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
