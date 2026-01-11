import { Module } from '@nestjs/common';
import { HistoricalController } from './historical.controller';
import { HistoricalService } from './historical.service';
import { HistoricalRateLimitGuard } from './historical-rate-limit.guard';
import { SupabaseModule } from '../../common/supabase/supabase.module';
import { SecurityModule } from '../../common/security/security.module';
import { McpModule } from '../../integrations/mcp/mcp.module';
import { OrgConnectionsModule } from '../org-connections/org-connections.module';
import { AuditModule } from '../../common/audit/audit.module';
import { GeminiModule } from '../../integrations/gemini/gemini.module';

@Module({
  imports: [SupabaseModule, SecurityModule, McpModule, OrgConnectionsModule, AuditModule, GeminiModule],
  controllers: [HistoricalController],
  providers: [HistoricalService, HistoricalRateLimitGuard],
})
export class HistoricalModule {}
