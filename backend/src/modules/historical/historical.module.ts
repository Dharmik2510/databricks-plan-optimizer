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
import { DataSourcesModule } from '../datasources/datasources.module';
import { McpProxyModule } from '../../integrations/mcp-proxy/mcp-proxy.module';
import { QuotaModule } from '../../common/quota/quota.module';

@Module({
  imports: [
    SupabaseModule,
    SecurityModule,
    McpModule,
    OrgConnectionsModule,
    AuditModule,
    GeminiModule,
    DataSourcesModule,
    McpProxyModule,
    QuotaModule,
  ],
  controllers: [HistoricalController],
  providers: [HistoricalService, HistoricalRateLimitGuard],
})
export class HistoricalModule {}
