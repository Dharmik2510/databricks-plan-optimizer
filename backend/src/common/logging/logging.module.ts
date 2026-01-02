import { Global, Module } from '@nestjs/common';
import { AppLoggerService } from './app-logger.service';

/**
 * Global logging module
 * Makes AppLoggerService available throughout the entire application
 */
@Global()
@Module({
  providers: [AppLoggerService],
  exports: [AppLoggerService],
})
export class LoggingModule {}
