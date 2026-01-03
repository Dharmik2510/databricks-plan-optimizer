// CRITICAL: Import tracing FIRST, before any other code
// Phase 5: OpenTelemetry Cloud Trace integration
import { initializeTracing } from './common/monitoring/tracing.config';
initializeTracing();

// Legacy tracing (Sentry-specific)
import { initTracing } from './tracing';
initTracing();

import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';
import * as fetch from 'node-fetch';
import { AppLoggerService } from './common/logging/app-logger.service';
import { ErrorReportingFilter } from './common/filters/error-reporting.filter';
import { MetricsInterceptor } from './common/interceptors/metrics.interceptor';
import { TracingInterceptor } from './common/interceptors/tracing.interceptor';
import { json, urlencoded } from 'express';

if (!globalThis.fetch) {
  globalThis.fetch = fetch as any;
  globalThis.Headers = (fetch as any).Headers;
  globalThis.Request = (fetch as any).Request;
  globalThis.Response = (fetch as any).Response;
}

// Sentry must be initialized early
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [
    nodeProfilingIntegration(),
  ],
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
});

async function bootstrap() {
  // Create app (logger will be initialized via AppModule)
  const app = await NestFactory.create(AppModule, {
    logger: false,
  });

  // Increase payload limit for screenshots
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ limit: '50mb', extended: true }));

  // Get our custom logger
  const logger = app.get(AppLoggerService);
  app.useLogger(logger);

  // Phase 5: Apply global error reporting filter
  app.useGlobalFilters(new ErrorReportingFilter(logger));

  const configService = app.get(ConfigService);

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
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID', 'X-Session-ID', 'X-Request-ID'],
    exposedHeaders: ['X-Correlation-ID', 'X-Request-ID'],
  });

  // Additional interceptors (metrics, tracing from Sentry)
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

  logger.log('🚀 BrickOptima API started', {
    port,
    apiPrefix: '/api/v1',
    corsOrigin,
    nodeEnv: process.env.NODE_ENV,
    otelEnabled: process.env.OTEL_ENABLED === 'true',
  });
  logger.log(`🚀 BrickOptima API running on http://0.0.0.0:${port}`);
  logger.log(`📚 API Prefix: /api/v1`);
  logger.log(`🔗 CORS Origin: ${corsOrigin}`);
}

bootstrap().catch((err) => {
  console.error('❌ Fatal error during application bootstrap:', err);
  process.exit(1);
});
