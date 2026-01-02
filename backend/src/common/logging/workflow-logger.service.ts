import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppLoggerService, LogMetadata } from './app-logger.service';
import { getRequestContext } from '../middleware/request-context.middleware';
import { Prisma } from '@prisma/client';

/**
 * Workflow execution metadata
 */
export interface WorkflowMetadata {
  workflowName: string;
  workflowVersion?: string;
  input?: any;
  output?: any;
  config?: any;
  tags?: string[];
  analysisId?: string;
  jobId?: string;
  [key: string]: any;
}

/**
 * Workflow node metadata
 */
export interface WorkflowNodeMetadata {
  nodeId: string;
  nodeName: string;
  nodeType?: string;
  input?: any;
  output?: any;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  durationMs?: number;
  retryCount?: number;
  [key: string]: any;
}

/**
 * Production-ready workflow observability service for LangGraph
 *
 * Features:
 * - Automatic workflow run tracking (start, complete, error)
 * - Per-node event logging with timing
 * - Integration with request context (correlation IDs)
 * - Database persistence for workflow_runs and workflow_events
 * - Non-blocking error handling (never fails the workflow)
 * - Auto-inject analysisId, jobId from request context
 */
@Injectable()
export class WorkflowLoggerService {
  constructor(
    private readonly logger: AppLoggerService,
    private readonly prisma: PrismaService,
  ) { }

  /**
   * Start a new workflow run
   * Creates workflow_runs record and returns workflowRunId
   */
  async startWorkflow(
    metadata: WorkflowMetadata,
  ): Promise<string> {
    const context = getRequestContext();
    const workflowRunId = `wfrun_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    try {
      // Log workflow start
      this.logger.info(`Workflow started: ${metadata.workflowName}`, {
        eventName: 'workflow.started',
        workflowRunId,
        workflowName: metadata.workflowName,
        workflowVersion: metadata.workflowVersion,
        input: metadata.input,
        tags: metadata.tags,
      });

      // Persist to database (match existing schema fields)

      // Validate analysisId existence to avoid foreign key errors (and noisy logs)
      let validAnalysisId = metadata.analysisId || null;
      if (validAnalysisId) {
        const analysisExists = await this.prisma.analysis.findUnique({
          where: { id: validAnalysisId },
          select: { id: true },
        });

        if (!analysisExists) {
          this.logger.warn(`Invalid analysisId provided for workflow run: ${validAnalysisId}. Falling back to null.`, {
            workflowRunId,
            invalidAnalysisId: validAnalysisId
          });
          validAnalysisId = null;
        }
      }

      await this.prisma.workflowRun.create({
        data: {
          id: workflowRunId,
          workflowRunId: workflowRunId,
          workflowType: metadata.workflowName,
          status: 'running',
          startedAt: new Date(),
          input: metadata.input as Prisma.InputJsonValue,
          output: undefined,
          error: undefined,
          correlationId: context?.correlationId || workflowRunId,
          traceId: context?.traceId || null,
          userId: context?.userId || 'system',
          analysisId: validAnalysisId,
          jobId: metadata.jobId || null,
        },
      });

      return workflowRunId;
    } catch (error) {
      // Non-blocking: Log error but return a fallback ID
      this.logger.error('Failed to start workflow tracking', error as Error, {
        workflowName: metadata.workflowName,
      });
      return workflowRunId; // Return ID anyway so workflow can continue
    }
  }

  /**
   * Complete a workflow run successfully
   */
  async completeWorkflow(
    workflowRunId: string,
    output?: any,
    metadata?: Record<string, any>,
  ): Promise<void> {
    try {
      const completedAt = new Date();

      // Get workflow run to calculate duration
      const workflowRun = await this.prisma.workflowRun.findUnique({
        where: { workflowRunId },
        select: { startedAt: true, workflowType: true },
      });

      const durationMs = workflowRun
        ? completedAt.getTime() - workflowRun.startedAt.getTime()
        : 0;

      // Log workflow completion
      this.logger.info(`Workflow completed: ${workflowRun?.workflowType}`, {
        eventName: 'workflow.completed',
        workflowRunId,
        durationMs,
        output,
        ...metadata,
      });

      // Update database
      await this.prisma.workflowRun.update({
        where: { workflowRunId },
        data: {
          status: 'completed',
          completedAt, // Use completedAt instead of endedAt
          durationMs,
          output: output ? (output as Prisma.InputJsonValue) : undefined,
        },
      });
    } catch (error) {
      this.logger.error('Failed to complete workflow tracking', error as Error, {
        workflowRunId,
      });
    }
  }

  /**
   * Mark workflow as failed
   */
  async failWorkflow(
    workflowRunId: string,
    error: Error | string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    try {
      const completedAt = new Date();

      // Get workflow run to calculate duration
      const workflowRun = await this.prisma.workflowRun.findUnique({
        where: { workflowRunId },
        select: { startedAt: true, workflowType: true },
      });

      const durationMs = workflowRun
        ? completedAt.getTime() - workflowRun.startedAt.getTime()
        : 0;

      // Extract error details
      const errorDetails = error instanceof Error
        ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
          code: (error as any).code,
        }
        : { message: String(error) };

      // Log workflow failure
      this.logger.error(`Workflow failed: ${workflowRun?.workflowType}`, error instanceof Error ? error : new Error(String(error)), {
        eventName: 'workflow.failed',
        workflowRunId,
        durationMs,
        ...metadata,
      });

      // Update database
      await this.prisma.workflowRun.update({
        where: { workflowRunId },
        data: {
          status: 'failed',
          completedAt, // Use completedAt instead of endedAt
          durationMs,
          error: errorDetails as Prisma.InputJsonValue,
        },
      });
    } catch (dbError) {
      this.logger.error('Failed to record workflow failure', dbError as Error, {
        workflowRunId,
      });
    }
  }

  /**
   * Log a workflow node event (start, complete, error)
   * Creates workflow_events record
   */
  async logNodeEvent(
    workflowRunId: string,
    eventType: 'node_started' | 'node_completed' | 'node_failed' | 'node_skipped',
    nodeMetadata: WorkflowNodeMetadata,
  ): Promise<void> {
    try {
      const { nodeId, nodeName, nodeType, input, output, error, durationMs, retryCount, ...rest } = nodeMetadata;

      // Log to structured logs
      this.logger.info(`Node ${eventType}: ${nodeName}`, {
        eventName: `workflow.${eventType}`,
        workflowRunId,
        dagNodeId: nodeId,
        nodeName,
        nodeType,
        durationMs,
        retryCount,
        ...(error && { error }),
        ...rest,
      });

      // Persist to database
      await this.prisma.workflowEvent.create({
        data: {
          workflowRunId,
          eventType,
          nodeId,
          nodeName,
          input: input ? (input as Prisma.InputJsonValue) : undefined,
          output: output ? (output as Prisma.InputJsonValue) : undefined,
          error: error ? (error as Prisma.InputJsonValue) : undefined,
          durationMs: durationMs || null,
          metadata: Object.keys(rest).length > 0 ? (rest as Prisma.InputJsonValue) : undefined,
          timestamp: new Date(),
          traceId: getRequestContext()?.traceId || null,
          spanId: getRequestContext()?.spanId || null,
        },
      });
    } catch (dbError) {
      this.logger.error('Failed to log workflow node event', dbError as Error, {
        workflowRunId,
        nodeId: nodeMetadata.nodeId,
        eventType,
      });
    }
  }

  /**
   * Log node start
   */
  async logNodeStart(
    workflowRunId: string,
    nodeId: string,
    nodeName: string,
    nodeType: string,
    input?: any,
  ): Promise<number> {
    await this.logNodeEvent(workflowRunId, 'node_started', {
      nodeId,
      nodeName,
      nodeType,
      input,
    });

    return Date.now(); // Return start time for duration calculation
  }

  /**
   * Log node completion
   */
  async logNodeComplete(
    workflowRunId: string,
    nodeId: string,
    nodeName: string,
    nodeType: string,
    output?: any,
    startTime?: number,
  ): Promise<void> {
    const durationMs = startTime ? Date.now() - startTime : undefined;

    await this.logNodeEvent(workflowRunId, 'node_completed', {
      nodeId,
      nodeName,
      nodeType,
      output,
      durationMs,
    });
  }

  /**
   * Log node failure
   */
  async logNodeError(
    workflowRunId: string,
    nodeId: string,
    nodeName: string,
    nodeType: string,
    error: Error | string,
    startTime?: number,
    retryCount?: number,
  ): Promise<void> {
    const durationMs = startTime ? Date.now() - startTime : undefined;

    const errorDetails = error instanceof Error
      ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
      }
      : { name: 'Error', message: String(error) };

    await this.logNodeEvent(workflowRunId, 'node_failed', {
      nodeId,
      nodeName,
      nodeType,
      error: errorDetails,
      durationMs,
      retryCount,
    });
  }

  /**
   * Convenience method for logging entire node execution with automatic timing
   */
  async withNodeTracking<T>(
    workflowRunId: string,
    nodeId: string,
    nodeName: string,
    nodeType: string,
    fn: () => Promise<T>,
    input?: any,
  ): Promise<T> {
    const startTime = await this.logNodeStart(workflowRunId, nodeId, nodeName, nodeType, input);

    try {
      const output = await fn();
      await this.logNodeComplete(workflowRunId, nodeId, nodeName, nodeType, output, startTime);
      return output;
    } catch (error) {
      await this.logNodeError(workflowRunId, nodeId, nodeName, nodeType, error as Error, startTime);
      throw error; // Re-throw to preserve workflow error handling
    }
  }

  /**
   * Get workflow run metrics (for monitoring/dashboards)
   */
  async getWorkflowMetrics(workflowName?: string, hours = 24): Promise<{
    totalRuns: number;
    completedRuns: number;
    failedRuns: number;
    runningRuns: number;
    avgDurationMs: number | null;
    errorRate: number;
  }> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const runs = await this.prisma.workflowRun.findMany({
      where: {
        ...(workflowName && { workflowType: workflowName }),
        startedAt: { gte: since },
      },
      select: {
        status: true,
        durationMs: true,
      },
    });

    const totalRuns = runs.length;
    const completedRuns = runs.filter(r => r.status === 'completed').length;
    const failedRuns = runs.filter(r => r.status === 'failed').length;
    const runningRuns = runs.filter(r => r.status === 'running').length;

    const completedDurations = runs
      .filter(r => r.status === 'completed' && r.durationMs !== null)
      .map(r => r.durationMs as number);

    const avgDurationMs = completedDurations.length > 0
      ? completedDurations.reduce((a, b) => a + b, 0) / completedDurations.length
      : null;

    const errorRate = totalRuns > 0 ? (failedRuns / totalRuns) * 100 : 0;

    return {
      totalRuns,
      completedRuns,
      failedRuns,
      runningRuns,
      avgDurationMs,
      errorRate,
    };
  }
}
