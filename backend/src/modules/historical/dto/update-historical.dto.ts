import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateHistoricalDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  tags?: string[];
}
