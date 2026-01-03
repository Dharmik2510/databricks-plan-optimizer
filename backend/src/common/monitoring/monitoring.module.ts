import { Module, Global } from '@nestjs/common';
import { CustomMetricsService } from './custom-metrics.service';
import { TraceService } from './trace.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { LoggingModule } from '../logging/logging.module';

/**
 * Monitoring Module
 *
 * Provides observability services:
 * - Custom metrics export to Cloud Monitoring
 * - Cloud Trace integration
 * - Error Reporting integration (via logging)
 */
@Global()
@Module({
  imports: [PrismaModule, LoggingModule],
  providers: [CustomMetricsService, TraceService],
  exports: [CustomMetricsService, TraceService],
})
export class MonitoringModule {}
