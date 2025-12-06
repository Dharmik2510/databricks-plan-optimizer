import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  IsUrl,
  IsObject,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @IsUrl({}, { message: 'Avatar must be a valid URL' })
  avatar?: string;

  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}
