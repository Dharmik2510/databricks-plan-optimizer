import {
  IsString,
  IsOptional,
  IsEnum,
  MinLength,
  MaxLength,
} from 'class-validator';
import { InputType } from '@prisma/client';

export class CreateAnalysisDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsEnum(InputType)
  inputType: InputType;

  @IsString()
  @MinLength(10, { message: 'Content must be at least 10 characters' })
  content: string;

  @IsOptional()
  repoFiles?: Array<{ path: string; content: string; language: string; size: number }>;
}
