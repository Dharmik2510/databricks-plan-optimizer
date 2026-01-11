import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { EncryptionService, EncryptedTokenPayload } from '../../common/security/encryption.service';
import { UrlSafetyService } from '../../common/security/url-safety.service';
import { AppLoggerService } from '../../common/logging/app-logger.service';
import { AuditService } from '../../common/audit/audit.service';
import { deriveOrgId, deriveUserUuid } from '../../common/tenancy/tenancy.utils';
import { CreateOrgConnectionDto, UpdateOrgConnectionDto } from './dto';
import { McpClientService } from '../../integrations/mcp/mcp-client.service';
import { McpConnectionConfig } from '../../integrations/mcp/mcp.types';

interface OrgConnectionRow {
  id: string;
  org_id: string;
  created_at: string;
  created_by: string;
  type: 'mcp_shs';
  mcp_server_url: string;
  shs_base_url: string | null;
  auth_scheme: 'none' | 'bearer' | 'basic' | 'header';
  auth_header_name: string | null;
  token_encrypted: EncryptedTokenPayload;
  token_kid: string;
  is_active: boolean;
  last_validated_at: string | null;
  validation_error: string | null;
}

@Injectable()
export class OrgConnectionsService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly encryption: EncryptionService,
    private readonly urlSafety: UrlSafetyService,
    private readonly logger: AppLoggerService,
    private readonly audit: AuditService,
    private readonly mcpClient: McpClientService,
  ) {}

  async createConnection(userId: string, orgId: string | undefined, dto: CreateOrgConnectionDto) {
    const resolvedOrgId = deriveOrgId(userId, orgId);
    const userUuid = deriveUserUuid(userId);
    await this.urlSafety.assertSafeUrl(dto.mcpServerUrl);

    const authScheme = dto.authScheme || 'bearer';
    const tokenValue = authScheme === 'none' ? '' : (dto.authToken || '');

    if (authScheme !== 'none' && !dto.authToken) {
      throw new BadRequestException('authToken is required for this authScheme');
    }

    const encrypted = await this.encryption.encryptToken(tokenValue);

    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('org_connections')
      .insert({
        org_id: resolvedOrgId,
        created_by: userUuid,
        type: 'mcp_shs',
        mcp_server_url: dto.mcpServerUrl,
        shs_base_url: dto.shsBaseUrl || null,
        auth_scheme: authScheme,
        auth_header_name: dto.authHeaderName || null,
        token_encrypted: encrypted.payload,
        token_kid: encrypted.kid,
        is_active: true,
      })
      .select('*')
      .single();

    if (error) {
      this.logger.error('Failed to create org connection', error as any);
      throw new BadRequestException('Failed to create connection');
    }

    await this.audit.recordEvent({
      userId,
      orgId: resolvedOrgId,
      action: 'org_connection_created',
      target: data.id,
      metadata: {
        authScheme,
      },
    });

    return this.sanitizeConnection(data);
  }

  async updateConnection(userId: string, orgId: string | undefined, id: string, dto: UpdateOrgConnectionDto) {
    const resolvedOrgId = deriveOrgId(userId, orgId);
    const supabase = this.supabaseService.getClient();

    const updates: Record<string, any> = {};
    if (dto.mcpServerUrl) {
      await this.urlSafety.assertSafeUrl(dto.mcpServerUrl);
      updates.mcp_server_url = dto.mcpServerUrl;
    }
    if (dto.shsBaseUrl !== undefined) updates.shs_base_url = dto.shsBaseUrl || null;
    if (dto.authScheme) updates.auth_scheme = dto.authScheme;
    if (dto.authHeaderName !== undefined) updates.auth_header_name = dto.authHeaderName || null;
    if (dto.isActive !== undefined) updates.is_active = dto.isActive;

    if (dto.authToken !== undefined || dto.authScheme === 'none') {
      const authScheme = dto.authScheme || 'bearer';
      const tokenValue = authScheme === 'none' ? '' : (dto.authToken || '');
      if (authScheme !== 'none' && !dto.authToken) {
        throw new BadRequestException('authToken is required for this authScheme');
      }
      const encrypted = await this.encryption.encryptToken(tokenValue);
      updates.token_encrypted = encrypted.payload;
      updates.token_kid = encrypted.kid;
    }

    const { data, error } = await supabase
      .from('org_connections')
      .update(updates)
      .eq('id', id)
      .eq('org_id', resolvedOrgId)
      .select('*')
      .single();

    if (error || !data) {
      this.logger.error('Failed to update org connection', error as any);
      throw new NotFoundException('Connection not found');
    }

    await this.audit.recordEvent({
      userId,
      orgId: resolvedOrgId,
      action: 'org_connection_updated',
      target: data.id,
      metadata: {
        updatedFields: Object.keys(updates),
      },
    });

    return this.sanitizeConnection(data);
  }

  async listConnections(userId: string, orgId: string | undefined) {
    const resolvedOrgId = deriveOrgId(userId, orgId);
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('org_connections')
      .select('*')
      .eq('org_id', resolvedOrgId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException('Failed to load connections');
    }

    return (data || []).map(row => this.sanitizeConnection(row as OrgConnectionRow));
  }

  async validateConnection(userId: string, orgId: string | undefined, connectionId: string) {
    const resolvedOrgId = deriveOrgId(userId, orgId);
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('org_connections')
      .select('*')
      .eq('id', connectionId)
      .eq('org_id', resolvedOrgId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Connection not found');
    }

    const connection = data as OrgConnectionRow;
    let validationError: string | null = null;

    try {
      const token = connection.auth_scheme === 'none'
        ? ''
        : await this.encryption.decryptToken(connection.token_encrypted, connection.token_kid);
      const mcpConfig: McpConnectionConfig = {
        id: connection.id,
        mcpServerUrl: connection.mcp_server_url,
        authScheme: connection.auth_scheme,
        authToken: token,
        authHeaderName: connection.auth_header_name,
      };

      await this.mcpClient.callTool(mcpConfig, 'list_applications', { limit: 1 });
    } catch (err) {
      validationError = (err as Error).message || 'Validation failed';
    }

    const { data: updated, error: updateError } = await supabase
      .from('org_connections')
      .update({
        last_validated_at: new Date().toISOString(),
        validation_error: validationError,
      })
      .eq('id', connectionId)
      .eq('org_id', resolvedOrgId)
      .select('*')
      .single();

    if (updateError || !updated) {
      throw new BadRequestException('Failed to update validation status');
    }

    await this.audit.recordEvent({
      userId,
      orgId: resolvedOrgId,
      action: 'org_connection_validated',
      target: connectionId,
      metadata: {
        success: !validationError,
        error: validationError,
      },
    });

    if (validationError) {
      throw new BadRequestException(validationError);
    }

    return this.sanitizeConnection(updated as OrgConnectionRow);
  }

  async getActiveConnection(userId: string, orgId: string | undefined): Promise<OrgConnectionRow> {
    const resolvedOrgId = deriveOrgId(userId, orgId);
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('org_connections')
      .select('*')
      .eq('org_id', resolvedOrgId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      throw new NotFoundException('No active MCP connection configured for this organization');
    }

    return data as OrgConnectionRow;
  }

  private sanitizeConnection(connection: OrgConnectionRow) {
    return {
      id: connection.id,
      orgId: connection.org_id,
      createdAt: connection.created_at,
      createdBy: connection.created_by,
      type: connection.type,
      mcpServerUrl: connection.mcp_server_url,
      shsBaseUrl: connection.shs_base_url,
      authScheme: connection.auth_scheme,
      authHeaderName: connection.auth_header_name,
      isActive: connection.is_active,
      lastValidatedAt: connection.last_validated_at,
      validationError: connection.validation_error,
    };
  }
}
