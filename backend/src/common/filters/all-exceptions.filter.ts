import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppLoggerService } from '../logging/app-logger.service';
import { getRequestContext } from '../middleware/request-context.middleware';

/**
 * Global exception filter for production-ready error handling
 * - Structured error logging
 * - Client-safe error responses
 * - Request context correlation
 * - Integrates with GCP Error Reporting via structured logs
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestContext = getRequestContext();

    // Determine status code
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Extract error message
    let message: string | object = 'Internal server error';
    let validationErrors: any = null;

    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'object') {
        message = (exceptionResponse as any).message || message;
        // Capture validation errors if present
        if ((exceptionResponse as any).message && Array.isArray((exceptionResponse as any).message)) {
          validationErrors = (exceptionResponse as any).message;
        }
      } else {
        message = exceptionResponse;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // Build error response for client
    const errorResponse: any = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      requestId: requestContext?.requestId,
      correlationId: requestContext?.correlationId,
    };

    // Include validation errors if present
    if (validationErrors) {
      errorResponse.errors = validationErrors;
    }

    // Only include stack trace in development
    if (process.env.NODE_ENV !== 'production' && exception instanceof Error) {
      errorResponse.stack = exception.stack;
    }

    // Log structured error
    this.logger.error('Unhandled exception', exception as Error, {
      statusCode: status,
      path: request.url,
      method: request.method,
      userAgent: request.headers['user-agent'],
      ...(validationErrors && { validationErrors }),
    });

    // Send error response
    response.status(status).json(errorResponse);
  }
}
