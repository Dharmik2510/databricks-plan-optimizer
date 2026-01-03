import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorReporting } from '@google-cloud/error-reporting';
import { AppLoggerService } from '../logging/app-logger.service';
import { getRequestContext } from '../middleware/request-context.middleware';

/**
 * Global Exception Filter with Cloud Error Reporting
 *
 * This filter:
 * - Catches all unhandled exceptions
 * - Reports errors to GCP Error Reporting
 * - Logs structured error information
 * - Returns appropriate HTTP responses
 * - Groups errors intelligently in Error Reporting console
 */
@Catch()
export class ErrorReportingFilter implements ExceptionFilter {
  private errorReporting: ErrorReporting | null = null;
  private isProduction: boolean;

  constructor(private readonly logger: AppLoggerService) {
    this.isProduction = process.env.NODE_ENV === 'production';

    // Initialize Error Reporting in production
    if (this.isProduction) {
      try {
        this.errorReporting = new ErrorReporting({
          projectId: process.env.GCP_PROJECT_ID || 'gen-lang-client-0997977661',
          reportMode: 'production',
          serviceContext: {
            service: 'brickoptima-api',
            version: process.env.APP_VERSION || '1.0.0',
          },
        });
        this.logger.info('Error Reporting initialized');
      } catch (error) {
        this.logger.warn('Failed to initialize Error Reporting', { error });
      }
    }
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestContext = getRequestContext();

    // Determine HTTP status and error message
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : 'Internal server error';

    const error = exception instanceof Error ? exception : new Error(String(exception));

    // Log the error with full context
    this.logger.error(
      `Unhandled exception: ${message}`,
      error,
      {
        eventName: 'error.unhandled',
        statusCode: status,
        method: request.method,
        path: request.path,
        userId: requestContext?.userId,
        correlationId: requestContext?.correlationId,
        traceId: requestContext?.traceId,
        query: request.query,
        body: this.sanitizeBody(request.body),
      },
    );

    // Report to Cloud Error Reporting (production only)
    if (this.errorReporting && status >= 500) {
      this.errorReporting.report(error, {
        user: requestContext?.userId || 'anonymous',
        httpRequest: {
          method: request.method,
          url: request.url,
          userAgent: request.get('user-agent') || '',
          referrer: request.get('referer') || '',
          statusCode: status,
        },
      } as any);
    }

    // Send error response
    const errorResponse = {
      statusCode: status,
      message: this.isProduction && status >= 500 ? 'Internal server error' : message,
      error: this.isProduction && status >= 500 ? 'Internal Server Error' : error.name,
      timestamp: new Date().toISOString(),
      path: request.path,
      ...(requestContext?.correlationId && { correlationId: requestContext.correlationId }),
      // Include stack trace in development
      ...(!this.isProduction && { stack: error.stack }),
    };

    response.status(status).json(errorResponse);
  }

  /**
   * Remove sensitive fields from request body before logging
   */
  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') return body;

    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'creditCard'];

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}
