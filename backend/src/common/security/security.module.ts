import { Global, Module } from '@nestjs/common';
import { EncryptionService } from './encryption.service';
import { UrlSafetyService } from './url-safety.service';
import { ConfigModule } from '@nestjs/config';
import { LoggingModule } from '../logging/logging.module';

@Global()
@Module({
  imports: [ConfigModule, LoggingModule],
  providers: [EncryptionService, UrlSafetyService],
  exports: [EncryptionService, UrlSafetyService],
})
export class SecurityModule {}
