/**
 * OpenTelemetry Tracing Setup for GCP Cloud Trace
 * MUST be imported BEFORE any other application code
 *
 * This file initializes distributed tracing with:
 * - Automatic instrumentation for HTTP, Express, NestJS, Prisma
 * - GCP Cloud Trace export
 * - W3C Trace Context propagation
 * - Production-ready sampling and configuration
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { TraceExporter } from '@google-cloud/opentelemetry-cloud-trace-exporter';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';

let sdk: NodeSDK | null = null;

/**
 * Initialize OpenTelemetry tracing
 * Call this BEFORE creating the NestJS application
 */
export function initTracing(): void {
  // Only enable in production or when explicitly enabled
  const isEnabled = process.env.OTEL_ENABLED === 'true';

  if (!isEnabled) {
    console.log('📊 OpenTelemetry tracing is DISABLED');
    return;
  }

  console.log('📊 Initializing OpenTelemetry tracing...');

  try {
    // Create Cloud Trace exporter
    const traceExporter = new TraceExporter({
      projectId: process.env.GCP_PROJECT_ID,
      // In Cloud Run, credentials are automatic via service account
      // For local development, set GOOGLE_APPLICATION_CREDENTIALS
      ...(process.env.GOOGLE_APPLICATION_CREDENTIALS && {
        keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      }),
    });

    // Initialize SDK with simplified configuration
    sdk = new NodeSDK({
      serviceName: process.env.SERVICE_NAME || 'brickoptima-api',

      // Span processor with batching for performance
      spanProcessor: new BatchSpanProcessor(traceExporter, {
        // Send spans every 5 seconds or when 512 spans are collected
        scheduledDelayMillis: 5000,
        maxQueueSize: 2048,
        maxExportBatchSize: 512,
      }),

      // Auto-instrumentation for common libraries
      instrumentations: [
        getNodeAutoInstrumentations({
          // Disable filesystem instrumentation (too noisy)
          '@opentelemetry/instrumentation-fs': {
            enabled: false,
          },
          // Enable HTTP instrumentation
          '@opentelemetry/instrumentation-http': {
            enabled: true,
          },
          // Enable Express instrumentation
          '@opentelemetry/instrumentation-express': {
            enabled: true,
          },
        }),
      ],
    });

    // Start the SDK
    sdk.start();

    console.log('✅ OpenTelemetry tracing initialized');
    console.log(`   Service: ${process.env.SERVICE_NAME || 'brickoptima-api'}`);
    console.log(`   Project: ${process.env.GCP_PROJECT_ID || 'not-set'}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('🛑 Shutting down OpenTelemetry tracing...');
      try {
        await sdk?.shutdown();
        console.log('✅ OpenTelemetry tracing shut down');
      } catch (err) {
        console.error('❌ Error shutting down OpenTelemetry:', err);
      }
    });
  } catch (error) {
    console.error('❌ Failed to initialize OpenTelemetry tracing:', error);
    // Don't throw - allow app to start even if tracing fails
  }
}

/**
 * Shutdown OpenTelemetry (for testing)
 */
export async function shutdownTracing(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    sdk = null;
  }
}
