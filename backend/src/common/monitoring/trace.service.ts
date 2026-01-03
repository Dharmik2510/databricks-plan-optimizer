import { Injectable } from '@nestjs/common';
import { trace, context, Span, SpanStatusCode } from '@opentelemetry/api';
import { AppLoggerService } from '../logging/app-logger.service';

/**
 * Cloud Trace Service
 *
 * Provides distributed tracing capabilities using OpenTelemetry.
 * Integrates with GCP Cloud Trace for visualizing request flows.
 *
 * Features:
 * - Automatic trace context propagation
 * - Custom span creation for business logic
 * - Automatic error reporting to Cloud Trace
 * - Correlation with Cloud Logging via trace IDs
 */
@Injectable()
export class TraceService {
  private readonly tracer = trace.getTracer('brickoptima-api', '1.0.0');

  constructor(private readonly logger: AppLoggerService) {}

  /**
   * Create a new span for a business operation
   *
   * @example
   * await traceService.withSpan('workflow.execute', async (span) => {
   *   span.setAttribute('workflow.name', 'data-analysis');
   *   const result = await executeWorkflow();
   *   return result;
   * });
   */
  async withSpan<T>(
    spanName: string,
    fn: (span: Span) => Promise<T>,
    attributes?: Record<string, string | number | boolean>,
  ): Promise<T> {
    return this.tracer.startActiveSpan(spanName, async (span) => {
      try {
        // Add custom attributes
        if (attributes) {
          Object.entries(attributes).forEach(([key, value]) => {
            span.setAttribute(key, value);
          });
        }

        // Execute the function
        const result = await fn(span);

        // Mark span as successful
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        // Record error in span
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });

        if (error instanceof Error) {
          span.recordException(error);
        }

        // Re-throw to preserve error handling
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Add an event to the current span
   */
  addEvent(eventName: string, attributes?: Record<string, string | number | boolean>): void {
    const span = trace.getActiveSpan();
    if (span) {
      span.addEvent(eventName, attributes);
    }
  }

  /**
   * Add attributes to the current span
   */
  setAttributes(attributes: Record<string, string | number | boolean>): void {
    const span = trace.getActiveSpan();
    if (span) {
      Object.entries(attributes).forEach(([key, value]) => {
        span.setAttribute(key, value);
      });
    }
  }

  /**
   * Get the current trace ID (for logging correlation)
   */
  getCurrentTraceId(): string | undefined {
    const span = trace.getActiveSpan();
    if (!span) return undefined;

    const spanContext = span.spanContext();
    return spanContext.traceId;
  }

  /**
   * Get the current span ID (for logging correlation)
   */
  getCurrentSpanId(): string | undefined {
    const span = trace.getActiveSpan();
    if (!span) return undefined;

    const spanContext = span.spanContext();
    return spanContext.spanId;
  }

  /**
   * Trace a workflow execution with automatic timing and error handling
   */
  async traceWorkflow<T>(
    workflowName: string,
    workflowRunId: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    return this.withSpan(
      'workflow.execute',
      async (span) => {
        span.setAttribute('workflow.name', workflowName);
        span.setAttribute('workflow.run_id', workflowRunId);

        this.logger.debug('Starting traced workflow', {
          workflowName,
          workflowRunId,
          traceId: this.getCurrentTraceId(),
          spanId: this.getCurrentSpanId(),
        });

        const startTime = Date.now();
        const result = await fn();
        const duration = Date.now() - startTime;

        span.setAttribute('workflow.duration_ms', duration);
        span.addEvent('workflow.completed', { duration_ms: duration });

        return result;
      },
    );
  }

  /**
   * Trace a database operation
   */
  async traceDbOperation<T>(
    operation: string,
    table: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    return this.withSpan(
      `db.${operation}`,
      async (span) => {
        span.setAttribute('db.operation', operation);
        span.setAttribute('db.table', table);
        span.setAttribute('db.system', 'postgresql');

        return await fn();
      },
    );
  }

  /**
   * Trace an external API call
   */
  async traceExternalApi<T>(
    service: string,
    endpoint: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    return this.withSpan(
      'external.api_call',
      async (span) => {
        span.setAttribute('external.service', service);
        span.setAttribute('external.endpoint', endpoint);

        return await fn();
      },
    );
  }
}
