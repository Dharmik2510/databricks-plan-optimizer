import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import * as client from 'prom-client';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
    private readonly histogram: client.Histogram<string>;
    private readonly counter: client.Counter<string>;

    constructor() {
        // Initialize default metrics collection (CPU, Memory, etc.)
        client.collectDefaultMetrics();

        this.histogram = new client.Histogram({
            name: 'http_request_duration_seconds',
            help: 'Duration of HTTP requests in seconds',
            labelNames: ['method', 'route', 'status_code'],
            buckets: [0.1, 0.5, 1, 2, 5],
        });

        this.counter = new client.Counter({
            name: 'http_requests_total',
            help: 'Total number of HTTP requests',
            labelNames: ['method', 'route', 'status_code'],
        });
    }

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const start = Date.now();
        const ctx = context.switchToHttp();
        const req = ctx.getRequest();
        const method = req.method;
        const route = req.route ? req.route.path : req.url;

        return next.handle().pipe(
            tap({
                next: () => {
                    const res = ctx.getResponse();
                    const duration = (Date.now() - start) / 1000;
                    this.histogram.observe(
                        { method, route, status_code: res.statusCode },
                        duration,
                    );
                    this.counter.inc({
                        method,
                        route,
                        status_code: res.statusCode,
                    });
                },
                error: (err) => {
                    const duration = (Date.now() - start) / 1000;
                    const status = err.status || 500;
                    this.histogram.observe(
                        { method, route, status_code: status },
                        duration,
                    );
                    this.counter.inc({ method, route, status_code: status });
                },
            }),
        );
    }
}
