import { Injectable, OnModuleInit } from '@nestjs/common';
import { MetricServiceClient } from '@google-cloud/monitoring';
import { AppLoggerService } from '../logging/app-logger.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Custom Metrics Service for GCP Cloud Monitoring
 *
 * Exports custom application metrics to Google Cloud Monitoring:
 * - workflow_failures: Count of failed workflows
 * - critical_tickets_unassigned: Count of unassigned critical feedback tickets
 * - db_connection_count: Current database connection pool usage
 * - workflow_duration: Workflow execution duration distribution
 */
@Injectable()
export class CustomMetricsService implements OnModuleInit {
  private metricsClient: MetricServiceClient | null = null;
  private projectId: string;
  private isProduction: boolean;
  private metricsInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly logger: AppLoggerService,
    private readonly prisma: PrismaService,
  ) {
    this.projectId = process.env.GCP_PROJECT_ID || 'gen-lang-client-0997977661';
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  async onModuleInit() {
    if (this.isProduction) {
      try {
        this.metricsClient = new MetricServiceClient();
        this.logger.info('Custom metrics service initialized');

        // Start background metrics collection (every 60 seconds)
        this.metricsInterval = setInterval(() => {
          this.collectAndExportMetrics().catch(error => {
            this.logger.error('Failed to collect custom metrics', error);
          });
        }, 60000); // 1 minute
      } catch (error) {
        this.logger.warn('Failed to initialize custom metrics client', { error });
      }
    } else {
      this.logger.debug('Custom metrics disabled in non-production environment');
    }
  }

  /**
   * Collect and export all custom metrics
   */
  private async collectAndExportMetrics(): Promise<void> {
    await Promise.all([
      this.exportWorkflowFailureRate(),
      this.exportCriticalTicketsUnassigned(),
      this.exportDatabaseConnectionCount(),
    ]);
  }

  /**
   * Export workflow failure rate metric
   */
  private async exportWorkflowFailureRate(): Promise<void> {
    try {
      // Get workflow failure count in last 5 minutes
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      const failedWorkflows = await this.prisma.workflowRun.count({
        where: {
          status: 'failed',
          startedAt: { gte: fiveMinutesAgo },
        },
      });

      const totalWorkflows = await this.prisma.workflowRun.count({
        where: {
          startedAt: { gte: fiveMinutesAgo },
        },
      });

      const failureRate = totalWorkflows > 0 ? failedWorkflows / totalWorkflows : 0;

      await this.writeMetric('workflow_failures', failureRate, 'DOUBLE');

      this.logger.debug('Exported workflow failure rate metric', {
        failedWorkflows,
        totalWorkflows,
        failureRate,
      });
    } catch (error) {
      this.logger.error('Failed to export workflow failure rate', error as Error);
    }
  }

  /**
   * Export critical tickets unassigned metric
   */
  private async exportCriticalTicketsUnassigned(): Promise<void> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const unassignedCriticalTickets = await this.prisma.userFeedback.count({
        where: {
          severity: 'critical',
          status: 'open',
          assignedToId: null,
          createdAt: { lte: oneHourAgo },
        },
      });

      await this.writeMetric('critical_tickets_unassigned', unassignedCriticalTickets, 'INT64');

      this.logger.debug('Exported critical tickets metric', {
        unassignedCriticalTickets,
      });
    } catch (error) {
      this.logger.error('Failed to export critical tickets metric', error as Error);
    }
  }

  /**
   * Export database connection count metric
   * Note: This is a simplified version. In production, you'd integrate with Prisma's metrics.
   */
  private async exportDatabaseConnectionCount(): Promise<void> {
    try {
      // Prisma doesn't directly expose connection pool metrics
      // This is a placeholder - in production you'd use Prisma metrics or pg-pool stats
      const connectionCount = 0; // TODO: Get actual connection count from Prisma pool

      await this.writeMetric('db_connection_count', connectionCount, 'INT64');

      this.logger.debug('Exported DB connection count metric', {
        connectionCount,
      });
    } catch (error) {
      this.logger.error('Failed to export DB connection metric', error as Error);
    }
  }

  /**
   * Write a custom metric to Cloud Monitoring
   */
  private async writeMetric(
    metricType: string,
    value: number,
    valueType: 'INT64' | 'DOUBLE' = 'INT64',
  ): Promise<void> {
    if (!this.metricsClient) return;

    try {
      const projectName = this.metricsClient.projectPath(this.projectId);
      const fullMetricType = `custom.googleapis.com/brickoptima/${metricType}`;

      const dataPoint = {
        interval: {
          endTime: {
            seconds: Math.floor(Date.now() / 1000),
          },
        },
        value: valueType === 'INT64' ? { int64Value: Math.floor(value) } : { doubleValue: value },
      };

      const timeSeries = {
        metric: {
          type: fullMetricType,
        },
        resource: {
          type: 'global',
          labels: {
            project_id: this.projectId,
          },
        },
        points: [dataPoint],
      };

      await this.metricsClient.createTimeSeries({
        name: projectName,
        timeSeries: [timeSeries],
      });
    } catch (error) {
      this.logger.error(`Failed to write metric ${metricType}`, error as Error);
    }
  }

  /**
   * Cleanup on module destroy
   */
  onModuleDestroy() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    if (this.metricsClient) {
      this.metricsClient.close();
    }
  }

  /**
   * Manual metric recording for important events
   */
  async recordWorkflowDuration(workflowName: string, durationMs: number): Promise<void> {
    if (!this.isProduction || !this.metricsClient) return;

    try {
      const projectName = this.metricsClient.projectPath(this.projectId);
      const fullMetricType = 'custom.googleapis.com/brickoptima/workflow_duration';

      const dataPoint = {
        interval: {
          endTime: {
            seconds: Math.floor(Date.now() / 1000),
          },
        },
        value: { int64Value: Math.floor(durationMs) },
      };

      const timeSeries = {
        metric: {
          type: fullMetricType,
          labels: {
            workflow_name: workflowName,
          },
        },
        resource: {
          type: 'global',
          labels: {
            project_id: this.projectId,
          },
        },
        points: [dataPoint],
      };

      await this.metricsClient.createTimeSeries({
        name: projectName,
        timeSeries: [timeSeries],
      });
    } catch (error) {
      // Don't fail the workflow if metrics fail
      this.logger.debug('Failed to record workflow duration metric', { error, workflowName });
    }
  }
}
