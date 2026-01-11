import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class HistoryQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsEnum(['single', 'compare'])
  mode?: 'single' | 'compare';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  appId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  appName?: string;
}
