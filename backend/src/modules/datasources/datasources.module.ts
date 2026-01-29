import { Module } from '@nestjs/common';
import { DataSourcesController } from './datasources.controller';
import { DataSourcesService } from './datasources.service';
import { QuotaModule } from '../../common/quota/quota.module';
import { McpProxyModule } from '../../integrations/mcp-proxy/mcp-proxy.module';
import { SupabaseModule } from '../../common/supabase/supabase.module';

@Module({
  imports: [SupabaseModule, QuotaModule, McpProxyModule],
  controllers: [DataSourcesController],
  providers: [DataSourcesService],
  exports: [DataSourcesService],
})
export class DataSourcesModule {}
