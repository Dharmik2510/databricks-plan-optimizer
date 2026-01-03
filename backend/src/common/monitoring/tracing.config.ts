import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { TraceExporter } from '@google-cloud/opentelemetry-cloud-trace-exporter';
import { Resource, resourceFromAttributes } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { PrismaInstrumentation } from '@prisma/instrumentation';

/**
 * OpenTelemetry Configuration for Cloud Trace
 *
 * This configuration:
 * - Exports traces to GCP Cloud Trace
 * - Auto-instruments HTTP requests, Express routes, and Prisma queries
 * - Correlates traces with Cloud Logging
 * - Enables distributed tracing across services
 *
 * Initialize this BEFORE any other imports in main.ts
 */

let sdk: NodeSDK | null = null;

export function initializeTracing(): NodeSDK | null {
  // Only enable in production
  if (process.env.NODE_ENV !== 'production') {
    console.log('[Tracing] Disabled in non-production environment');
    return null;
  }

  const projectId = process.env.GCP_PROJECT_ID || 'gen-lang-client-0997977661';

  try {
    // Create Cloud Trace exporter
    const traceExporter = new TraceExporter({
      projectId,
    });

    // Create resource with service information
    const resource = resourceFromAttributes({
      [SemanticResourceAttributes.SERVICE_NAME]: 'brickoptima-api',
      [SemanticResourceAttributes.SERVICE_VERSION]: process.env.APP_VERSION || '1.0.0',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'production',
    });

    // Initialize OpenTelemetry SDK
    sdk = new NodeSDK({
      resource: resource as any, // Cast to avoid potential type mismatch if SDK expects class

      spanProcessor: new BatchSpanProcessor(traceExporter, {
        // Batch span export for better performance
        maxQueueSize: 1000,
        maxExportBatchSize: 100,
        scheduledDelayMillis: 5000, // Export every 5 seconds
      }),
      instrumentations: [
        // Auto-instrument common libraries
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-fs': {
            enabled: false, // Disable file system instrumentation (too noisy)
          },
          '@opentelemetry/instrumentation-dns': {
            enabled: false, // Disable DNS instrumentation
          },
        }),
        // Specific instrumentations for better control
        new HttpInstrumentation({
          ignoreIncomingRequestHook: (req) => {
            // Ignore health check endpoints
            const path = req.url || '';
            return path.includes('/health') || path.includes('/metrics');
          },
        }),
        new ExpressInstrumentation(),
        new PrismaInstrumentation(), // Trace database queries
      ],
    });

    sdk.start();

    console.log('[Tracing] OpenTelemetry initialized successfully');
    console.log(`[Tracing] Exporting traces to project: ${projectId}`);

    // Graceful shutdown on process termination
    process.on('SIGTERM', async () => {
      try {
        await sdk?.shutdown();
        console.log('[Tracing] SDK shut down successfully');
      } catch (error) {
        console.error('[Tracing] Error shutting down SDK', error);
      }
    });

    return sdk;
  } catch (error) {
    console.error('[Tracing] Failed to initialize OpenTelemetry', error);
    return null;
  }
}

/**
 * Shutdown tracing (call on application shutdown)
 */
export async function shutdownTracing(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    console.log('[Tracing] SDK shut down');
  }
}
