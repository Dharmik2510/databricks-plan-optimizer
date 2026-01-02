import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request } from 'express';
import { AppLoggerService } from '../logging/app-logger.service';
import { getRequestContext } from '../middleware/request-context.middleware';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Production-ready logging interceptor
 * - Logs all HTTP requests with structured format
 * - Persists request audits to database with sampling
 * - Handles errors gracefully
 * - Integrates with OpenTelemetry traces
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(
    private readonly logger: AppLoggerService,
    private readonly prisma: PrismaService,
  ) { }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse();
    const ctx = getRequestContext();

    const { method, url: path } = request;
    const startTime = Date.now();

    return next.handle().pipe(
      tap(async () => {
        const durationMs = Date.now() - startTime;
        const statusCode = response.statusCode;

        // Log to Winston/Cloud Logging
        this.logger.logRequest(method, path, statusCode, durationMs);

        // Persist to database with sampling strategy
        await this.persistRequestAudit({
          ctx,
          method,
          path,
          statusCode,
          durationMs,
        });
      }),
      catchError(async (error) => {
        const durationMs = Date.now() - startTime;
        const statusCode = error.status || 500;

        // Log error
        this.logger.error('Request failed', error, {
          method,
          path,
          statusCode,
          durationMs,
        });

        // Always persist errors to database
        await this.persistRequestAudit({
          ctx,
          method,
          path,
          statusCode,
          durationMs,
          error,
        });

        // Re-throw error to be handled by exception filters
        throw error;
      }),
    );
  }

  /**
   * Persist request audit to database with intelligent sampling
   * - Always persist errors (5xx, 4xx)
   * - Sample successful requests based on configuration
   * - Gracefully handle database failures
   */
  private async persistRequestAudit(params: {
    ctx: any;
    method: string;
    path: string;
    statusCode: number;
    durationMs: number;
    error?: Error;
  }): Promise<void> {
    const { ctx, method, path, statusCode, durationMs, error } = params;

    if (!ctx) {
      // No context available (shouldn't happen, but be defensive)
      return;
    }

    // Sampling strategy
    const isError = statusCode >= 400;
    const samplingRate = this.getSamplingRate(statusCode);
    const shouldPersist = isError || Math.random() < samplingRate;

    if (!shouldPersist) {
      return;
    }

    try {
      await this.prisma.requestAudit.upsert({
        where: { requestId: ctx.requestId },
        update: {}, // Ignore duplicates (idempotent)
        create: {
          requestId: ctx.requestId,
          correlationId: ctx.correlationId,
          traceId: ctx.traceId,
          spanId: ctx.spanId,
          method,
          path,
          statusCode,
          durationMs,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          feature: ctx.feature || this.inferFeature(path),
          ...(error && {
            errorName: error.name,
            errorMessage: error.message,
            errorCode: (error as any).code,
          }),
        },
      });
    } catch (err) {
      // CRITICAL: Never fail the request if audit logging fails
      // Log the failure but continue
      this.logger.error('Failed to create request audit', err as Error, {
        requestId: ctx.requestId,
        correlationId: ctx.correlationId,
      });
    }
  }

  /**
   * Get sampling rate based on status code
   * - 5xx errors: 100% (always log)
   * - 4xx errors: 100% (always log)
   * - 2xx/3xx success: configurable (default 10%)
   */
  private getSamplingRate(statusCode: number): number {
    if (statusCode >= 500) return 1.0; // 100% for server errors
    if (statusCode >= 400) return 1.0; // 100% for client errors

    // Configurable sampling for successful requests
    const configuredRate = process.env.REQUEST_AUDIT_SAMPLING_RATE;
    if (configuredRate === 'all') return 1.0;
    if (configuredRate === 'none') return 0.0;
    if (configuredRate) {
      const rate = parseFloat(configuredRate);
      if (!isNaN(rate) && rate >= 0 && rate <= 1) {
        return rate;
      }
    }

    // Default: 10% sampling for successful requests
    return 0.1;
  }

  /**
   * Infer feature area from request path
   * Used for categorizing requests in observability dashboards
   */
  private inferFeature(path: string): string {
    if (path.includes('/auth')) return 'auth';
    if (path.includes('/analysis') || path.includes('/analyses')) return 'analysis';
    if (path.includes('/mapping')) return 'mapping';
    if (path.includes('/repo') || path.includes('/repository')) return 'repo';
    if (path.includes('/chat')) return 'chat';
    if (path.includes('/admin')) return 'admin';
    if (path.includes('/user')) return 'user';
    if (path.includes('/health') || path.includes('/metrics')) return 'health';
    return 'other';
  }
}
