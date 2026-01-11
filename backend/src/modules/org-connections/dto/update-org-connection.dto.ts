import { IsBoolean, IsEnum, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateOrgConnectionDto {
  @IsOptional()
  @IsUrl({ require_tld: false })
  mcpServerUrl?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  shsBaseUrl?: string;

  @IsOptional()
  @IsEnum(['none', 'bearer', 'basic', 'header'])
  authScheme?: 'none' | 'bearer' | 'basic' | 'header';

  @IsOptional()
  @IsString()
  @MaxLength(4096)
  authToken?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  authHeaderName?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
