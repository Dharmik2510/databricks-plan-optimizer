import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { LoggingModule } from '../logging/logging.module';

@Global()
@Module({
  imports: [SupabaseModule, LoggingModule],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
