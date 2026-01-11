import { IsDateString, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class RunsQueryDto {
  @IsString()
  @MaxLength(200)
  appName: string;

  @IsOptional()
  @IsDateString()
  start?: string;

  @IsOptional()
  @IsDateString()
  end?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}
