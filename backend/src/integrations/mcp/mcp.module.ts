import { Global, Module } from '@nestjs/common';
import { McpClientService } from './mcp-client.service';
import { ConfigModule } from '@nestjs/config';
import { LoggingModule } from '../../common/logging/logging.module';
import { SecurityModule } from '../../common/security/security.module';

@Global()
@Module({
  imports: [ConfigModule, LoggingModule, SecurityModule],
  providers: [McpClientService],
  exports: [McpClientService],
})
export class McpModule {}
