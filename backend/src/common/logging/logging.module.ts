import { Global, Module } from '@nestjs/common';
import { AppLoggerService } from './app-logger.service';
import { WorkflowLoggerService } from './workflow-logger.service';
import { WorkflowMetricsService } from './workflow-metrics.service';
import { PrismaModule } from '../../prisma/prisma.module';

/**
 * Global logging module
 * Makes AppLoggerService, WorkflowLoggerService, and WorkflowMetricsService available throughout the entire application
 */
@Global()
@Module({
  imports: [PrismaModule],
  providers: [AppLoggerService, WorkflowLoggerService, WorkflowMetricsService],
  exports: [AppLoggerService, WorkflowLoggerService, WorkflowMetricsService],
})
export class LoggingModule {}
