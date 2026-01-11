import { IsDateString, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const APP_ID_REGEX = /^spark-[a-zA-Z0-9]+$/;

export class AnalyzeHistoricalDto {
  @IsOptional()
  @IsString()
  @Matches(APP_ID_REGEX, { message: 'appId must look like spark-<id>' })
  appId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  appName?: string;

  @IsOptional()
  @IsDateString()
  startTime?: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  question?: string;
}
