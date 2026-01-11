import { Global, Module } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { ConfigModule } from '@nestjs/config';
import { LoggingModule } from '../logging/logging.module';

@Global()
@Module({
  imports: [ConfigModule, LoggingModule],
  providers: [SupabaseService],
  exports: [SupabaseService],
})
export class SupabaseModule {}
