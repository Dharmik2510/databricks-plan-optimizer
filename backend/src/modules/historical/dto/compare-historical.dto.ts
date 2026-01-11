import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const APP_ID_REGEX = /^spark-[a-zA-Z0-9]+$/;

export class CompareHistoricalDto {
  @IsString()
  @Matches(APP_ID_REGEX, { message: 'appIdA must look like spark-<id>' })
  appIdA: string;

  @IsString()
  @Matches(APP_ID_REGEX, { message: 'appIdB must look like spark-<id>' })
  appIdB: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  question?: string;
}
