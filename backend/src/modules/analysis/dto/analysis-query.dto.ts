import { IsOptional, IsInt, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { AnalysisStatus, Severity } from '@prisma/client';

export class AnalysisQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsEnum(AnalysisStatus)
  status?: AnalysisStatus;

  @IsOptional()
  @IsEnum(Severity)
  severity?: Severity;
}
