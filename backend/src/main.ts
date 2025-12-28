import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';
import * as fetch from 'node-fetch';
import { SentryExceptionFilter } from './common/filters/sentry-exception.filter';
import { MetricsInterceptor } from './common/interceptors/metrics.interceptor';
import { TracingInterceptor } from './common/interceptors/tracing.interceptor';
import { WinstonModule } from 'nest-winston';
import { loggerConfig } from './config/logger.config';

if (!globalThis.fetch) {
  globalThis.fetch = fetch as any;
  globalThis.Headers = (fetch as any).Headers;
  globalThis.Request = (fetch as any).Request;
  globalThis.Response = (fetch as any).Response;
}

// Sentry must be initialized early
Sentry.init({
  dsn: process.env.SENTRY_DSN, // Access env directly for early init, or use config service later if needed but best here
  integrations: [
    nodeProfilingIntegration(),
  ],
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger(loggerConfig),
  });
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Security headers
  app.use(helmet());

  // CORS configuration
  const corsOrigin = configService.get<string>('CORS_ORIGIN', 'http://localhost:3000');
  const allowedOrigins = corsOrigin.split(',').map(origin => origin.trim()).filter(Boolean);

  logger.log(`🔐 CORS allowed origins: ${allowedOrigins.join(', ')}`);

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, server-to-server)
      if (!origin) {
        return callback(null, true);
      }

      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return callback(null, true);
      }

      // Allow generated Cloud Run frontend URLs securely
      // Matches https://brickoptima-frontend-[hash].[region].run.app
      if (origin.match(/^https:\/\/brickoptima-frontend-.*\.run\.app$/)) {
        return callback(null, true);
      }

      // Log rejected origins for debugging
      logger.warn(`🚫 CORS rejected origin: ${origin}`);
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID'],
    exposedHeaders: ['X-Correlation-ID'],
  });

  // Global Observability Interceptors & Filters
  const httpAdapter = app.get(HttpAdapterHost);
  app.useGlobalFilters(new SentryExceptionFilter(httpAdapter.httpAdapter));
  app.useGlobalInterceptors(new MetricsInterceptor(), new TracingInterceptor());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global API prefix
  app.setGlobalPrefix('api/v1');

  const port = configService.get<number>('PORT', 3001);
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 BrickOptima API running on http://0.0.0.0:${port}`);
  logger.log(`📚 API Prefix: /api/v1`);
  logger.log(`🔗 CORS Origin: ${corsOrigin}`);
}

bootstrap();
