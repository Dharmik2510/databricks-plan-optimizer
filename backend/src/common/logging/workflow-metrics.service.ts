import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppLoggerService } from './app-logger.service';

/**
 * Workflow metrics aggregation and monitoring service
 *
 * Provides:
 * - Real-time workflow execution metrics
 * - Historical trend analysis
 * - Performance monitoring
 * - Error rate tracking
 */
@Injectable()
export class WorkflowMetricsService {
  constructor(
    private readonly logger: AppLoggerService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Get workflow execution metrics for a time period
   */
  async getWorkflowMetrics(options: {
    workflowName?: string;
    userId?: string;
    analysisId?: string;
    hours?: number;
    since?: Date;
    until?: Date;
  }): Promise<{
    totalRuns: number;
    completedRuns: number;
    failedRuns: number;
    runningRuns: number;
    avgDurationMs: number | null;
    p50DurationMs: number | null;
    p95DurationMs: number | null;
    p99DurationMs: number | null;
    errorRate: number;
    successRate: number;
  }> {
    // Determine time range
    const since = options.since || new Date(Date.now() - (options.hours || 24) * 60 * 60 * 1000);
    const until = options.until || new Date();

    // Build where clause
    const where: any = {
      startedAt: {
        gte: since,
        lte: until,
      },
    };

    if (options.workflowName) {
      where.workflowType = options.workflowName;
    }

    if (options.userId) {
      where.userId = options.userId;
    }

    if (options.analysisId) {
      where.analysisId = options.analysisId;
    }

    // Get workflow runs
    const runs = await this.prisma.workflowRun.findMany({
      where,
      select: {
        status: true,
        durationMs: true,
      },
    });

    const totalRuns = runs.length;
    const completedRuns = runs.filter(r => r.status === 'completed').length;
    const failedRuns = runs.filter(r => r.status === 'failed').length;
    const runningRuns = runs.filter(r => r.status === 'running').length;

    // Calculate duration percentiles
    const completedDurations = runs
      .filter(r => r.status === 'completed' && r.durationMs !== null)
      .map(r => r.durationMs as number)
      .sort((a, b) => a - b);

    const avgDurationMs = completedDurations.length > 0
      ? completedDurations.reduce((a, b) => a + b, 0) / completedDurations.length
      : null;

    const p50DurationMs = completedDurations.length > 0
      ? completedDurations[Math.floor(completedDurations.length * 0.5)]
      : null;

    const p95DurationMs = completedDurations.length > 0
      ? completedDurations[Math.floor(completedDurations.length * 0.95)]
      : null;

    const p99DurationMs = completedDurations.length > 0
      ? completedDurations[Math.floor(completedDurations.length * 0.99)]
      : null;

    const errorRate = totalRuns > 0 ? (failedRuns / totalRuns) * 100 : 0;
    const successRate = totalRuns > 0 ? (completedRuns / totalRuns) * 100 : 0;

    return {
      totalRuns,
      completedRuns,
      failedRuns,
      runningRuns,
      avgDurationMs,
      p50DurationMs,
      p95DurationMs,
      p99DurationMs,
      errorRate,
      successRate,
    };
  }

  /**
   * Get workflow health status
   */
  async getWorkflowHealth(workflowName?: string): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    errorRate: number;
    successRate: number;
    avgDurationMs: number | null;
    runningCount: number;
    recommendation: string;
  }> {
    const metrics = await this.getWorkflowMetrics({
      workflowName,
      hours: 1, // Last hour
    });

    // Determine health status
    let status: 'healthy' | 'degraded' | 'unhealthy';
    let recommendation: string;

    if (metrics.errorRate >= 50) {
      status = 'unhealthy';
      recommendation = 'High error rate detected. Investigate recent failures immediately.';
    } else if (metrics.errorRate >= 20 || metrics.runningRuns >= 10) {
      status = 'degraded';
      recommendation = 'Elevated error rate or high number of running workflows. Monitor closely.';
    } else {
      status = 'healthy';
      recommendation = 'Workflow is operating normally.';
    }

    return {
      status,
      errorRate: metrics.errorRate,
      successRate: metrics.successRate,
      avgDurationMs: metrics.avgDurationMs,
      runningCount: metrics.runningRuns,
      recommendation,
    };
  }
}
