import { Module } from '@nestjs/common';
import { McpProxyService } from './mcp-proxy.service';
import { SshTunnelService } from './ssh-tunnel.service';

@Module({
  providers: [McpProxyService, SshTunnelService],
  exports: [McpProxyService, SshTunnelService],
})
export class McpProxyModule {}
