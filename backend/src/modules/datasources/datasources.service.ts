import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { CreateDataSourceDto } from './dto/create-datasource.dto';
import { UpdateDataSourceDto } from './dto/update-datasource.dto';
import { TestConnectionDto } from './dto/test-connection.dto';
import { QuotaService } from '../../common/quota/quota.service';
import { McpProxyService } from '../../integrations/mcp-proxy/mcp-proxy.service';
import * as crypto from 'crypto';

export interface DataSource {
  id: string;
  user_id: string;
  org_id: string | null;
  name: string;
  description: string | null;
  connection_type: 'gateway_shs' | 'external_mcp';
  shs_base_url: string | null;
  shs_auth_scheme: string | null;
  shs_token_encrypted: any | null;
  tunnel_config: any | null;
  external_mcp_url: string | null;
  external_mcp_token_encrypted: any | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class DataSourcesService {
  private readonly logger = new Logger(DataSourcesService.name);
  private readonly supabase: SupabaseClient;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly config: ConfigService,
    private readonly quotaService: QuotaService,
    private readonly mcpProxyService: McpProxyService,
  ) {
    this.supabase = this.supabaseService.getClient();
  }

  async create(
    userId: string,
    dto: CreateDataSourceDto,
  ): Promise<DataSource> {
    this.logger.log(
      `Creating datasource for user ${userId}: ${dto.name} (${dto.connection_type})`,
    );

    try {
      // Check datasources limit
      this.logger.log(`Checking datasource limit for user ${userId}`);
      await this.quotaService.checkDatasourcesLimit(userId);
      this.logger.log(`✅ Datasource limit check passed for user ${userId}`);

      // Encrypt sensitive fields
      const encryptedData: any = {
        user_id: userId,
        name: dto.name,
        description: dto.description || null,
        connection_type: dto.connection_type,
        is_active: true,
      };

      if (dto.connection_type === 'gateway_shs') {
        this.logger.log(
          `Configuring gateway_shs connection: ${dto.shs_base_url} (auth: ${dto.shs_auth_scheme})`,
        );

        encryptedData.shs_base_url = dto.shs_base_url;
        encryptedData.shs_auth_scheme = dto.shs_auth_scheme;

        if (dto.shs_auth_token) {
          this.logger.log('Encrypting SHS auth token');
          try {
            encryptedData.shs_token_encrypted = await this.encryptToken(
              dto.shs_auth_token,
            );
            this.logger.log('✅ SHS auth token encrypted successfully');
          } catch (error) {
            this.logger.error('❌ Failed to encrypt SHS auth token', error.stack);
            throw new BadRequestException('Failed to encrypt SHS auth token');
          }
        }

        if (dto.tunnel_config) {
          this.logger.log(
            `Configuring SSH tunnel: ${dto.tunnel_config.ssh_user}@${dto.tunnel_config.ssh_host}:${dto.tunnel_config.ssh_port} -> ${dto.tunnel_config.remote_host}:${dto.tunnel_config.remote_port}`,
          );

          try {
            const { ssh_private_key, ...tunnelConfigWithoutKey } = dto.tunnel_config;

            this.logger.log('Encrypting SSH private key');
            const encryptedTunnelConfig = {
              ...tunnelConfigWithoutKey,
              ssh_private_key_encrypted: await this.encryptToken(ssh_private_key),
            };
            encryptedData.tunnel_config = encryptedTunnelConfig;
            this.logger.log('✅ SSH private key encrypted successfully');
          } catch (error) {
            this.logger.error('❌ Failed to encrypt SSH private key', error.stack);
            throw new BadRequestException('Failed to encrypt SSH private key');
          }
        }

        if (dto.shs_auth_scheme === 'header' && dto.shs_auth_header_name) {
          encryptedData.shs_auth_header_name = dto.shs_auth_header_name;
          this.logger.log(`Using custom auth header: ${dto.shs_auth_header_name}`);
        }
      } else if (dto.connection_type === 'external_mcp') {
        this.logger.log(`Configuring external_mcp connection: ${dto.external_mcp_url}`);

        encryptedData.external_mcp_url = dto.external_mcp_url;

        if (dto.external_mcp_token) {
          this.logger.log('Encrypting external MCP token');
          try {
            encryptedData.external_mcp_token_encrypted = await this.encryptToken(
              dto.external_mcp_token,
            );
            this.logger.log('✅ External MCP token encrypted successfully');
          } catch (error) {
            this.logger.error('❌ Failed to encrypt external MCP token', error.stack);
            throw new BadRequestException('Failed to encrypt external MCP token');
          }
        }
      }

      this.logger.log('Inserting datasource into database');
      const { data, error } = await this.supabase
        .from('data_sources')
        .insert(encryptedData)
        .select()
        .single();

      if (error) {
        this.logger.error('❌ Failed to create data source in database', error);
        throw new BadRequestException(`Failed to create data source: ${error.message}`);
      }

      this.logger.log(`✅ Datasource created successfully: ${data.id} (${dto.name})`);
      return data;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ForbiddenException) {
        throw error;
      }
      this.logger.error('❌ Unexpected error creating datasource', error.stack);
      throw new BadRequestException('Failed to create data source');
    }
  }

  async findAll(userId: string): Promise<DataSource[]> {
    this.logger.log(`Fetching all datasources for user ${userId}`);

    try {
      const { data, error } = await this.supabase
        .from('data_sources')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        this.logger.error('❌ Failed to fetch data sources from database', error);
        throw new BadRequestException(`Failed to fetch data sources: ${error.message}`);
      }

      this.logger.log(`✅ Found ${data.length} datasource(s) for user ${userId}`);

      // Remove encrypted fields from response
      return data.map(this.sanitizeDataSource);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('❌ Unexpected error fetching datasources', error.stack);
      throw new BadRequestException('Failed to fetch data sources');
    }
  }

  async findOne(userId: string, id: string): Promise<DataSource> {
    this.logger.log(`Fetching datasource ${id} for user ${userId}`);

    try {
      const { data, error } = await this.supabase
        .from('data_sources')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        this.logger.warn(`❌ Datasource ${id} not found for user ${userId}`);
        throw new NotFoundException(`Data source ${id} not found`);
      }

      this.logger.log(`✅ Found datasource ${id}: ${data.name} (${data.connection_type})`);
      return this.sanitizeDataSource(data);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('❌ Unexpected error fetching datasource', error.stack);
      throw new BadRequestException('Failed to fetch data source');
    }
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateDataSourceDto,
  ): Promise<DataSource> {
    this.logger.log(`Updating datasource ${id} for user ${userId}`);

    try {
      // Verify ownership
      await this.findOne(userId, id);

      const updateData: any = {};
      const changes: string[] = [];

      if (dto.name !== undefined) {
        updateData.name = dto.name;
        changes.push(`name: ${dto.name}`);
      }
      if (dto.description !== undefined) {
        updateData.description = dto.description;
        changes.push('description');
      }
      if (dto.is_active !== undefined) {
        updateData.is_active = dto.is_active;
        changes.push(`is_active: ${dto.is_active}`);
      }

      if (dto.connection_type === 'gateway_shs') {
        if (dto.shs_base_url !== undefined) {
          updateData.shs_base_url = dto.shs_base_url;
          changes.push(`shs_base_url: ${dto.shs_base_url}`);
        }
        if (dto.shs_auth_scheme !== undefined) {
          updateData.shs_auth_scheme = dto.shs_auth_scheme;
          changes.push(`shs_auth_scheme: ${dto.shs_auth_scheme}`);
        }

        if (dto.shs_auth_token !== undefined) {
          this.logger.log('Encrypting updated SHS auth token');
          try {
            updateData.shs_token_encrypted = await this.encryptToken(
              dto.shs_auth_token,
            );
            changes.push('shs_auth_token');
            this.logger.log('✅ SHS auth token encrypted successfully');
          } catch (error) {
            this.logger.error('❌ Failed to encrypt SHS auth token', error.stack);
            throw new BadRequestException('Failed to encrypt SHS auth token');
          }
        }

        if (dto.tunnel_config !== undefined) {
          this.logger.log(
            `Updating SSH tunnel configuration: ${dto.tunnel_config.ssh_user}@${dto.tunnel_config.ssh_host}`,
          );

          try {
            const { ssh_private_key, ...tunnelConfigWithoutKey } = dto.tunnel_config;

            this.logger.log('Encrypting updated SSH private key');
            const encryptedTunnelConfig = {
              ...tunnelConfigWithoutKey,
              ssh_private_key_encrypted: await this.encryptToken(ssh_private_key),
            };
            updateData.tunnel_config = encryptedTunnelConfig;
            changes.push('tunnel_config');
            this.logger.log('✅ SSH private key encrypted successfully');
          } catch (error) {
            this.logger.error('❌ Failed to encrypt SSH private key', error.stack);
            throw new BadRequestException('Failed to encrypt SSH private key');
          }
        }
      } else if (dto.connection_type === 'external_mcp') {
        if (dto.external_mcp_url !== undefined) {
          updateData.external_mcp_url = dto.external_mcp_url;
          changes.push(`external_mcp_url: ${dto.external_mcp_url}`);
        }

        if (dto.external_mcp_token !== undefined) {
          this.logger.log('Encrypting updated external MCP token');
          try {
            updateData.external_mcp_token_encrypted = await this.encryptToken(
              dto.external_mcp_token,
            );
            changes.push('external_mcp_token');
            this.logger.log('✅ External MCP token encrypted successfully');
          } catch (error) {
            this.logger.error('❌ Failed to encrypt external MCP token', error.stack);
            throw new BadRequestException('Failed to encrypt external MCP token');
          }
        }
      }

      updateData.updated_at = new Date().toISOString();

      this.logger.log(`Updating fields: ${changes.join(', ')}`);

      const { data, error } = await this.supabase
        .from('data_sources')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        this.logger.error('❌ Failed to update data source in database', error);
        throw new BadRequestException(`Failed to update data source: ${error.message}`);
      }

      this.logger.log(`✅ Datasource ${id} updated successfully`);
      return this.sanitizeDataSource(data);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logger.error('❌ Unexpected error updating datasource', error.stack);
      throw new BadRequestException('Failed to update data source');
    }
  }

  async remove(userId: string, id: string): Promise<void> {
    this.logger.log(`Deleting datasource ${id} for user ${userId}`);

    try {
      // Verify ownership
      const datasource = await this.findOne(userId, id);

      const { error } = await this.supabase
        .from('data_sources')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        this.logger.error('❌ Failed to delete data source from database', error);
        throw new BadRequestException(`Failed to delete data source: ${error.message}`);
      }

      this.logger.log(`✅ Datasource ${id} (${datasource.name}) deleted successfully`);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logger.error('❌ Unexpected error deleting datasource', error.stack);
      throw new BadRequestException('Failed to delete data source');
    }
  }

  async testConnection(
    userId: string,
    dto: TestConnectionDto,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(
      `Testing connection for user ${userId}: ${dto.connection_type}`,
    );

    try {
      if (dto.connection_type === 'gateway_shs') {
        this.logger.log(
          `Testing gateway_shs connection: ${dto.shs_base_url} (auth: ${dto.shs_auth_scheme})`,
        );

        try {
          // Test gateway SHS connection via MCP proxy
          const shsConfig = {
            baseUrl: dto.shs_base_url!,
            authScheme: dto.shs_auth_scheme!,
            authToken: dto.shs_auth_token,
            authHeaderName: dto.shs_auth_header_name,
          };

          const tunnelConfig = dto.tunnel_config
            ? {
              sshHost: dto.tunnel_config.ssh_host,
              sshPort: dto.tunnel_config.ssh_port,
              sshUser: dto.tunnel_config.ssh_user,
              sshPrivateKey: dto.tunnel_config.ssh_private_key,
              remoteHost: dto.tunnel_config.remote_host,
              remotePort: dto.tunnel_config.remote_port,
              localPort: 19000 + Math.floor(Math.random() * 1000), // Random test port
            }
            : null;

          if (tunnelConfig) {
            this.logger.log(
              `Using SSH tunnel: ${tunnelConfig.sshUser}@${tunnelConfig.sshHost}:${tunnelConfig.sshPort} -> ${tunnelConfig.remoteHost}:${tunnelConfig.remotePort}`,
            );
          }

          // Call list_applications to test connectivity
          this.logger.log('Calling list_applications to test connectivity');
          await this.mcpProxyService.callTool(
            shsConfig,
            tunnelConfig,
            'list_applications',
            { limit: 1 },
            userId,
            'test-connection',
          );

          this.logger.log('✅ Gateway SHS connection test succeeded');
          return {
            success: true,
            message: 'Successfully connected to Spark History Server',
          };
        } catch (error) {
          this.logger.warn(
            `❌ Gateway SHS connection test failed: ${error.message}`,
          );
          return {
            success: false,
            message: error.message || 'Failed to connect to Spark History Server',
          };
        }
      } else if (dto.connection_type === 'external_mcp') {
        this.logger.log(`Testing external_mcp connection: ${dto.external_mcp_url}`);

        try {
          // Test external MCP connection
          const response = await fetch(`${dto.external_mcp_url}/mcp/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(dto.external_mcp_token && {
                Authorization: `Bearer ${dto.external_mcp_token}`,
              }),
            },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'tools/list',
              params: {},
            }),
            signal: AbortSignal.timeout(10000),
          });

          if (!response.ok) {
            this.logger.warn(
              `❌ External MCP connection test failed: HTTP ${response.status}`,
            );
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const result = await response.json();

          if (result.error) {
            this.logger.warn(
              `❌ External MCP connection test failed: ${result.error.message}`,
            );
            throw new Error(result.error.message);
          }

          this.logger.log('✅ External MCP connection test succeeded');
          return {
            success: true,
            message: 'Successfully connected to external MCP server',
          };
        } catch (error) {
          this.logger.warn(
            `❌ External MCP connection test failed: ${error.message}`,
          );
          return {
            success: false,
            message: error.message || 'Failed to connect to external MCP server',
          };
        }
      }

      this.logger.error(`❌ Invalid connection type: ${dto.connection_type}`);
      throw new BadRequestException('Invalid connection type');
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('❌ Unexpected error testing connection', error.stack);
      return {
        success: false,
        message: error.message || 'Connection test failed',
      };
    }
  }

  // Internal method to get data source with decrypted tokens (for analysis)
  async getWithDecryptedTokens(
    userId: string,
    id: string,
  ): Promise<DataSource & { decrypted_tokens?: any }> {
    this.logger.log(`Fetching datasource ${id} with decrypted tokens for user ${userId}`);

    try {
      const { data, error } = await this.supabase
        .from('data_sources')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        this.logger.warn(`❌ Active datasource ${id} not found for user ${userId}`);
        throw new NotFoundException(`Data source ${id} not found`);
      }

      const result: any = { ...data };

      // Decrypt tokens for internal use
      if (data.shs_token_encrypted) {
        this.logger.log('Decrypting SHS auth token');
        try {
          result.decrypted_shs_token = await this.decryptToken(
            data.shs_token_encrypted,
          );
          this.logger.log('✅ SHS auth token decrypted successfully');
        } catch (error) {
          this.logger.error('❌ Failed to decrypt SHS auth token', error.stack);
          throw new BadRequestException('Failed to decrypt SHS auth token');
        }
      }

      if (data.external_mcp_token_encrypted) {
        this.logger.log('Decrypting external MCP token');
        try {
          result.decrypted_external_mcp_token = await this.decryptToken(
            data.external_mcp_token_encrypted,
          );
          this.logger.log('✅ External MCP token decrypted successfully');
        } catch (error) {
          this.logger.error('❌ Failed to decrypt external MCP token', error.stack);
          throw new BadRequestException('Failed to decrypt external MCP token');
        }
      }

      if (data.tunnel_config?.ssh_private_key_encrypted) {
        this.logger.log('Decrypting SSH private key');
        try {
          result.tunnel_config = {
            ...data.tunnel_config,
            ssh_private_key: await this.decryptToken(
              data.tunnel_config.ssh_private_key_encrypted,
            ),
          };
          delete result.tunnel_config.ssh_private_key_encrypted;
          this.logger.log('✅ SSH private key decrypted successfully');
        } catch (error) {
          this.logger.error('❌ Failed to decrypt SSH private key', error.stack);
          throw new BadRequestException('Failed to decrypt SSH private key');
        }
      }

      this.logger.log(`✅ Datasource ${id} retrieved with decrypted tokens`);
      return result;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error('❌ Unexpected error getting datasource with decrypted tokens', error.stack);
      throw new BadRequestException('Failed to retrieve data source');
    }
  }

  private sanitizeDataSource(dataSource: any): DataSource {
    const sanitized = { ...dataSource };

    // Remove encrypted fields from API responses
    delete sanitized.shs_token_encrypted;
    delete sanitized.external_mcp_token_encrypted;

    if (sanitized.tunnel_config?.ssh_private_key_encrypted) {
      sanitized.tunnel_config = {
        ...sanitized.tunnel_config,
        has_ssh_key: true,
      };
      delete sanitized.tunnel_config.ssh_private_key_encrypted;
    }

    return sanitized;
  }

  private async encryptToken(plaintext: string): Promise<any> {
    this.logger.debug('Encrypting token (AES-256-GCM)');

    try {
      // Simple envelope encryption (in production, use KMS)
      const encryptionKey = this.config.get<string>('DATASOURCE_ENCRYPTION_KEY');

      if (!encryptionKey) {
        this.logger.error('❌ DATASOURCE_ENCRYPTION_KEY not configured');
        throw new Error('DATASOURCE_ENCRYPTION_KEY not configured');
      }

      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(
        'aes-256-gcm',
        Buffer.from(encryptionKey, 'hex'),
        iv,
      );

      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      this.logger.debug('✅ Token encryption completed');

      return {
        ciphertext: encrypted,
        iv: iv.toString('hex'),
        auth_tag: authTag.toString('hex'),
      };
    } catch (error) {
      this.logger.error('❌ Token encryption failed', error.stack);
      throw error;
    }
  }

  private async decryptToken(encrypted: any): Promise<string> {
    this.logger.debug('Decrypting token (AES-256-GCM)');

    try {
      const encryptionKey = this.config.get<string>('DATASOURCE_ENCRYPTION_KEY');

      if (!encryptionKey) {
        this.logger.error('❌ DATASOURCE_ENCRYPTION_KEY not configured');
        throw new Error('DATASOURCE_ENCRYPTION_KEY not configured');
      }

      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        Buffer.from(encryptionKey, 'hex'),
        Buffer.from(encrypted.iv, 'hex'),
      );

      decipher.setAuthTag(Buffer.from(encrypted.auth_tag, 'hex'));

      let decrypted = decipher.update(encrypted.ciphertext, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      this.logger.debug('✅ Token decryption completed');

      return decrypted;
    } catch (error) {
      this.logger.error('❌ Token decryption failed', error.stack);
      throw error;
    }
  }
}
