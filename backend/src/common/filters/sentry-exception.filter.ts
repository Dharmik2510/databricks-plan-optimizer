import {
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import * as Sentry from '@sentry/node';

@Catch()
export class SentryExceptionFilter extends BaseExceptionFilter {
    private readonly logger = new Logger(SentryExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const req = ctx.getRequest();
        const res = ctx.getResponse();

        const status =
            exception instanceof HttpException
                ? exception.getStatus()
                : HttpStatus.INTERNAL_SERVER_ERROR;

        const message =
            exception instanceof HttpException
                ? exception.getResponse()
                : (exception as Error).message;

        // Log to Sentry only for 500 errors or specific critical errors
        if (status >= 500) {
            Sentry.withScope((scope) => {
                scope.setExtra('url', req.url);
                scope.setExtra('method', req.method);
                scope.setExtra('body', req.body);
                scope.setExtra('params', req.params);
                scope.setExtra('query', req.query);
                const correlationId = req.headers['x-correlation-id'];
                if (correlationId) {
                    scope.setTag('correlation_id', correlationId as string);
                }

                // Add user info if available
                if (req.user) {
                    scope.setUser({ id: req.user.id, email: req.user.email });
                }

                Sentry.captureException(exception);
            });

            this.logger.error(
                `[${status}] ${req.method} ${req.url}: ${JSON.stringify(message)}`,
                (exception as Error).stack,
            );
        } else {
            this.logger.warn(
                `[${status}] ${req.method} ${req.url}: ${JSON.stringify(message)}`,
            );
        }

        super.catch(exception, host);
    }
}
