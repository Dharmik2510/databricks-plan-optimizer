import { Module } from '@nestjs/common';
import { OrgConnectionsController } from './org-connections.controller';
import { OrgConnectionsService } from './org-connections.service';
import { SupabaseModule } from '../../common/supabase/supabase.module';
import { SecurityModule } from '../../common/security/security.module';
import { AuditModule } from '../../common/audit/audit.module';
import { McpModule } from '../../integrations/mcp/mcp.module';

@Module({
  imports: [SupabaseModule, SecurityModule, AuditModule, McpModule],
  controllers: [OrgConnectionsController],
  providers: [OrgConnectionsService],
  exports: [OrgConnectionsService],
})
export class OrgConnectionsModule {}
