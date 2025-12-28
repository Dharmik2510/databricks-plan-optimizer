import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { trace, context as otelContext } from '@opentelemetry/api';

@Injectable()
export class TracingInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const ctx = context.switchToHttp();
        const req = ctx.getRequest();
        const correlationId = req.headers['x-correlation-id'];

        const span = trace.getSpan(otelContext.active());

        if (span && correlationId) {
            span.setAttribute('correlation_id', correlationId);
        }

        return next.handle().pipe(
            tap((data) => {
                // Optional: Add response data to span if needed
            }),
        );
    }
}
