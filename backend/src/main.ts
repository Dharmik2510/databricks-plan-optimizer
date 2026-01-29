// CRITICAL: Import polyfills FIRST, before ANY other code
import './polyfills';

// CRITICAL: Import tracing SECOND, before application code
// Phase 5: OpenTelemetry Cloud Trace integration
import { initializeTracing } from './common/monitoring/tracing.config';
initializeTracing();

// Legacy tracing (Sentry-specific)
import { initTracing } from './tracing';
initTracing();

import * as Sentry from '@sentry/node';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppLoggerService } from './common/logging/app-logger.service';
import { ErrorReportingFilter } from './common/filters/error-reporting.filter';
import { MetricsInterceptor } from './common/interceptors/metrics.interceptor';
import { TracingInterceptor } from './common/interceptors/tracing.interceptor';
import { json, urlencoded, Request, Response, NextFunction } from 'express';

// Optional profiling integration - may not be available in all environments
let profilingIntegration;
try {
  const { nodeProfilingIntegration } = require('@sentry/profiling-node');
  profilingIntegration = nodeProfilingIntegration();
  console.log('✅ Sentry profiling integration loaded successfully');
} catch (error) {
  console.warn('⚠️ Sentry profiling not available (native module missing). Continuing without profiling.', {
    error: error instanceof Error ? error.message : String(error),
  });
}

// Sentry must be initialized early, but skip if runtime doesn't support diagnostics_channel (Node < 18)
try {
  const diagnostics = require('node:diagnostics_channel');
  if (diagnostics?.channel) {
    console.log('🔍 Initializing Sentry monitoring...', {
      dsn: process.env.SENTRY_DSN ? '***configured***' : 'missing',
      profilingEnabled: !!profilingIntegration,
      tracesSampleRate: 1.0,
    });

    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      integrations: profilingIntegration ? [profilingIntegration] : [],
      tracesSampleRate: 1.0,
      profilesSampleRate: profilingIntegration ? 1.0 : 0,
    });

    console.log('✅ Sentry initialized successfully');
  } else {
    console.warn('⚠️ Sentry disabled: diagnostics_channel not available in this Node runtime.');
  }
} catch (error) {
  console.error('❌ Sentry initialization failed:', {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  console.warn('⚠️ Continuing without Sentry error tracking.');
}

async function bootstrap() {
  try {
    console.log('🚀 Starting BrickOptima API bootstrap process...');

    // Create app (logger will be initialized via AppModule)
    console.log('📦 Creating NestJS application...');
    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log'],
    });
    console.log('✅ NestJS application created successfully');

    // Increase payload limit for screenshots
    console.log('⚙️ Configuring payload limits (50MB for screenshots)...');
    try {
      app.use(json({ limit: '50mb' }));
      app.use(urlencoded({ limit: '50mb', extended: true }));
      console.log('✅ Payload limits configured');
    } catch (error) {
      console.error('❌ Failed to configure payload limits:', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    // Get our custom logger
    console.log('📝 Initializing application logger...');
    let logger: AppLoggerService;
    try {
      logger = app.get(AppLoggerService);
      app.useLogger(logger);
      logger.log('✅ Application logger initialized and attached');
    } catch (error) {
      console.error('❌ Failed to initialize application logger:', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    // Phase 5: Apply global error reporting filter
    try {
      logger.log('🛡️ Applying global error reporting filter...');
      app.useGlobalFilters(new ErrorReportingFilter(logger));
      logger.log('✅ Global error reporting filter applied');
    } catch (error) {
      logger.error('❌ Failed to apply global error reporting filter', error as Error);
      throw error;
    }

    let configService: ConfigService;
    try {
      configService = app.get(ConfigService);
      logger.log('✅ Configuration service retrieved');
    } catch (error) {
      logger.error('❌ Failed to retrieve configuration service', error as Error);
      throw error;
    }

    const nodeEnv = configService.get<string>('NODE_ENV') || process.env.NODE_ENV || 'development';
    logger.log(`🌍 Running in ${nodeEnv} environment`);

    // Security headers
    try {
      logger.log('🔐 Applying security headers (Helmet)...');
      app.use(helmet());
      logger.log('✅ Security headers applied');
    } catch (error) {
      logger.error('❌ Failed to apply security headers', error as Error);
      throw error;
    }

    // CORS configuration
    logger.log('🔐 Configuring CORS...');
    const corsOrigin = configService.get<string>('CORS_ORIGIN', 'http://localhost:3000');
    const allowedOrigins = corsOrigin.split(',').map(origin => origin.trim()).filter(Boolean);

    // Explicitly allow production domains
    const productionDomains = ['https://brickoptima.com', 'https://www.brickoptima.com'];
    productionDomains.forEach(domain => {
      if (!allowedOrigins.includes(domain)) {
        allowedOrigins.push(domain);
      }
    });

    logger.log(`🔐 CORS allowed origins: ${allowedOrigins.join(', ')}`);

    const allowAnyOrigin = allowedOrigins.includes('*') && nodeEnv !== 'production';

    // Set COOP header to allow OAuth popups
    try {
      logger.log('🔐 Setting COOP header for OAuth popups...');
      app.use((_req: Request, res: Response, next: NextFunction) => {
        // Use unsafe-none for development to allow Google OAuth popups
        // Use same-origin-allow-popups for production
        const coopValue = nodeEnv === 'production' ? 'same-origin-allow-popups' : 'unsafe-none';
        res.setHeader('Cross-Origin-Opener-Policy', coopValue);
        next();
      });
      logger.log('✅ COOP header middleware configured');
    } catch (error) {
      logger.error('❌ Failed to set COOP header middleware', error instanceof Error ? error.message : String(error));
      throw error;
    }

    try {
      logger.log('🔐 Enabling CORS with origin validation...');
      app.enableCors({
        origin: (origin, callback) => {
          // Allow requests with no origin (mobile apps, Postman, server-to-server)
          if (!origin) {
            return callback(null, true);
          }

          // Check if origin is in allowed list
          if (allowedOrigins.includes(origin) || allowAnyOrigin) {
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
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID', 'X-Session-ID', 'X-Request-ID', 'Cache-Control'],
        exposedHeaders: ['X-Correlation-ID', 'X-Request-ID'],
      });
      logger.log('✅ CORS configured successfully');
    } catch (error) {
      logger.error('❌ Failed to configure CORS', error instanceof Error ? error.message : String(error));
      throw error;
    }

    // Additional interceptors (metrics, tracing from Sentry)
    try {
      logger.log('📊 Applying global interceptors (metrics, tracing)...');
      app.useGlobalInterceptors(new MetricsInterceptor(), new TracingInterceptor());
      logger.log('✅ Global interceptors applied');
    } catch (error) {
      logger.error('❌ Failed to apply global interceptors', error instanceof Error ? error.message : String(error));
      throw error;
    }

    // Global validation pipe
    try {
      logger.log('✅ Configuring global validation pipe...');
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
      logger.log('✅ Global validation pipe configured');
    } catch (error) {
      logger.error('❌ Failed to configure validation pipe', error instanceof Error ? error.message : String(error));
      throw error;
    }

    // Global API prefix
    try {
      logger.log('🔗 Setting global API prefix...');
      app.setGlobalPrefix('api/v1');
      logger.log('✅ Global API prefix set to /api/v1');
    } catch (error) {
      logger.error('❌ Failed to set global API prefix', error instanceof Error ? error.message : String(error));
      throw error;
    }

    // Start server
    const port = configService.get<number>('PORT', 3001);
    logger.log(`🚀 Starting server on port ${port}...`);

    try {
      await app.listen(port, '0.0.0.0');

      logger.log('🚀 BrickOptima API started', {
        port,
        apiPrefix: '/api/v1',
        corsOrigin,
        nodeEnv,
        otelEnabled: process.env.OTEL_ENABLED === 'true',
      });
      logger.log(`🚀 BrickOptima API running on http://0.0.0.0:${port}`);
      logger.log(`📚 API Prefix: /api/v1`);
      logger.log(`🔗 CORS Origin: ${corsOrigin}`);
    } catch (error) {
      const errorMsg = `Failed to start server on port ${port}: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMsg, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  } catch (error) {
    // Catch any bootstrap errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error('❌ Fatal error during bootstrap:', {
      error: errorMessage,
      stack: errorStack,
    });

    // Re-throw to be caught by the outer catch handler
    throw error;
  }
}

bootstrap().catch((err) => {
  console.error('❌ Fatal error during application bootstrap:', err);
  process.exit(1);
});
