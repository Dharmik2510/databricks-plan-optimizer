import { Global, Module } from '@nestjs/common';
import { AppLoggerService } from './app-logger.service';
import { WorkflowLoggerService } from './workflow-logger.service';
import { WorkflowMetricsService } from './workflow-metrics.service';

/**
 * Global logging module
 * Makes AppLoggerService, WorkflowLoggerService, and WorkflowMetricsService available throughout the entire application
 */
@Global()
@Module({
  providers: [AppLoggerService, WorkflowLoggerService, WorkflowMetricsService],
  exports: [AppLoggerService, WorkflowLoggerService, WorkflowMetricsService],
})
export class LoggingModule { }
