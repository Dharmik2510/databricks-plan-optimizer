import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import * as winston from 'winston';
import { getRequestContext } from '../middleware/request-context.middleware';

/**
 * Metadata that can be logged with any log message
 */
export interface LogMetadata {
  eventName?: string;
  durationMs?: number;
  analysisId?: string;
  jobId?: string;
  workflowRunId?: string;
  dagNodeId?: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  [key: string]: any;
}

/**
 * Production-ready structured logging service
 * - Integrates with GCP Cloud Logging in production
 * - Auto-injects request context (correlation IDs, user ID, trace IDs)
 * - Auto-redacts PII (passwords, tokens, secrets)
 * - Outputs JSON in production, pretty format in development
 */
@Injectable()
export class AppLoggerService implements NestLoggerService {
  private logger: winston.Logger;
  private readonly isProduction: boolean;

  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';

    // Create Winston logger with appropriate transports
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        this.addContextFormat(),
        this.redactPIIFormat(),
        this.isProduction
          ? winston.format.json() // Structured JSON for GCP Cloud Logging
          : winston.format.printf(({ timestamp, level, message, ...meta }) => {
              // Simple format for development (no colorize to avoid issues)
              const metaStr = Object.keys(meta).length && Object.keys(meta).some(k => !['timestamp', 'level', 'message'].includes(k))
                ? '\n' + JSON.stringify(meta, null, 2)
                : '';
              return `${timestamp} [${level}] ${message}${metaStr}`;
            }),
      ),
      transports: this.createTransports(),
    });
  }

  /**
   * Create appropriate transports based on environment
   */
  private createTransports(): winston.transport[] {
    const transports: winston.transport[] = [
      new winston.transports.Console(),
    ];

    // In production, GCP Cloud Logging automatically collects console output
    // No need for special Cloud Logging transport when running on Cloud Run
    // The structured JSON logs are automatically parsed by Cloud Logging

    return transports;
  }

  /**
   * Add request context to all log entries
   */
  private addContextFormat() {
    return winston.format((info) => {
      const context = getRequestContext();

      return {
        ...info,
        // Standard fields for GCP Cloud Logging
        timestamp: new Date().toISOString(),
        service: 'brickoptima-api',
        env: process.env.NODE_ENV || 'development',
        version: process.env.APP_VERSION || 'unknown',

        // Request context (if available)
        ...(context && {
          requestId: context.requestId,
          correlationId: context.correlationId,
          traceId: context.traceId,
          spanId: context.spanId,
          userId: context.userId,
          orgId: context.orgId,
          sessionId: context.sessionId,
          feature: context.feature,

          // GCP Cloud Logging trace format
          // https://cloud.google.com/logging/docs/reference/v2/rest/v2/LogEntry
          ...(context.traceId && {
            'logging.googleapis.com/trace': `projects/${process.env.GCP_PROJECT_ID}/traces/${context.traceId}`,
            'logging.googleapis.com/spanId': context.spanId,
          }),
        }),
      };
    })();
  }

  /**
   * Redact sensitive information (PII, secrets, tokens)
   * CRITICAL for production security and compliance
   */
  private redactPIIFormat() {
    const sensitiveKeys = [
      'password',
      'passwordHash',
      'token',
      'secret',
      'apiKey',
      'api_key',
      'x-api-key',
      'authorization',
      'auth',
      'accessToken',
      'refreshToken',
      'jwt',
      'bearer',
      'cookie',
      'set-cookie',
      'header',
      'creditCard',
      'ssn',
      'privateKey',
      'private_key',
      'mcp',
      'kms',
    ];

    return winston.format((info) => {
      const redact = (obj: any): any => {
        if (typeof obj !== 'object' || obj === null) return obj;

        const result: any = Array.isArray(obj) ? [] : {};

        for (const [key, value] of Object.entries(obj)) {
          const keyLower = key.toLowerCase();
          if (sensitiveKeys.some((sensitive) => keyLower.includes(sensitive))) {
            result[key] = '[REDACTED]';
          } else if (typeof value === 'object' && value !== null) {
            result[key] = redact(value);
          } else {
            result[key] = value;
          }
        }

        return result;
      };

      return redact(info);
    })();
  }

  /**
   * Log info-level message
   */
  log(message: string, metadata?: LogMetadata): void {
    this.logger.info(message, metadata);
  }

  /**
   * Log info-level message (alias for log)
   */
  info(message: string, metadata?: LogMetadata): void {
    this.logger.info(message, metadata);
  }

  /**
   * Log warning message
   */
  warn(message: string, metadata?: LogMetadata): void {
    this.logger.warn(message, metadata);
  }

  /**
   * Log error message with optional Error object
   */
  error(message: string, error?: Error | string, metadata?: LogMetadata): void {
    let errorData: any = metadata || {};

    if (error instanceof Error) {
      errorData = {
        ...metadata,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
          code: (error as any).code,
        },
      };
    } else if (typeof error === 'string') {
      // If error is a trace string (for NestJS compatibility)
      errorData = {
        ...metadata,
        trace: error,
      };
    }

    this.logger.error(message, errorData);
  }

  /**
   * Log debug message (only in development)
   */
  debug(message: string, metadata?: LogMetadata): void {
    this.logger.debug(message, metadata);
  }

  /**
   * Log verbose message (only in development)
   */
  verbose(message: string, metadata?: LogMetadata): void {
    this.logger.verbose(message, metadata);
  }

  /**
   * Convenience method for logging HTTP requests
   */
  logRequest(
    method: string,
    path: string,
    statusCode: number,
    durationMs: number,
    metadata?: LogMetadata,
  ): void {
    this.info('HTTP Request', {
      eventName: 'http.request',
      method,
      path,
      statusCode,
      durationMs,
      ...metadata,
    });
  }

  /**
   * Convenience method for logging workflow events
   */
  logWorkflowEvent(
    workflowRunId: string,
    nodeId: string,
    eventType: string,
    metadata?: LogMetadata,
  ): void {
    this.info(`Workflow ${eventType}`, {
      eventName: `workflow.${eventType}`,
      workflowRunId,
      dagNodeId: nodeId,
      ...metadata,
    });
  }

  /**
   * Convenience method for logging database operations
   */
  logDatabaseOperation(
    operation: string,
    table: string,
    durationMs?: number,
    metadata?: LogMetadata,
  ): void {
    this.debug('Database operation', {
      eventName: 'db.operation',
      operation,
      table,
      durationMs,
      ...metadata,
    });
  }

  /**
   * Convenience method for logging external API calls
   */
  logExternalApiCall(
    service: string,
    endpoint: string,
    statusCode: number,
    durationMs: number,
    metadata?: LogMetadata,
  ): void {
    this.info('External API call', {
      eventName: 'external.api_call',
      service,
      endpoint,
      statusCode,
      durationMs,
      ...metadata,
    });
  }

  /**
   * Get the underlying Winston logger instance (for advanced use cases)
   */
  getWinstonLogger(): winston.Logger {
    return this.logger;
  }
}
