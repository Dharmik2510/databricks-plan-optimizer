import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsObject,
  ValidateIf,
  IsNumber,
  Min,
  Max,
  IsUrl,
} from 'class-validator';

export class CreateDataSourceDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(['gateway_shs', 'external_mcp'])
  @IsNotEmpty()
  connection_type: 'gateway_shs' | 'external_mcp';

  // Gateway SHS fields
  @ValidateIf((o) => o.connection_type === 'gateway_shs')
  @IsUrl()
  @IsNotEmpty()
  shs_base_url?: string;

  @ValidateIf((o) => o.connection_type === 'gateway_shs')
  @IsEnum(['none', 'bearer', 'basic', 'header'])
  @IsNotEmpty()
  shs_auth_scheme?: 'none' | 'bearer' | 'basic' | 'header';

  @ValidateIf(
    (o) =>
      o.connection_type === 'gateway_shs' && o.shs_auth_scheme !== 'none',
  )
  @IsString()
  @IsNotEmpty()
  shs_auth_token?: string;

  @ValidateIf(
    (o) =>
      o.connection_type === 'gateway_shs' && o.shs_auth_scheme === 'header',
  )
  @IsString()
  @IsNotEmpty()
  shs_auth_header_name?: string;

  @ValidateIf((o) => o.connection_type === 'gateway_shs')
  @IsObject()
  @IsOptional()
  tunnel_config?: {
    ssh_host: string;
    ssh_port: number;
    ssh_user: string;
    ssh_private_key: string;
    remote_host: string;
    remote_port: number;
  };

  // External MCP fields
  @ValidateIf((o) => o.connection_type === 'external_mcp')
  @IsUrl()
  @IsNotEmpty()
  external_mcp_url?: string;

  @ValidateIf((o) => o.connection_type === 'external_mcp')
  @IsString()
  @IsOptional()
  external_mcp_token?: string;
}
