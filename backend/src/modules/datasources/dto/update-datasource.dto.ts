import { PartialType } from '@nestjs/mapped-types';
import { CreateDataSourceDto } from './create-datasource.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateDataSourceDto extends PartialType(CreateDataSourceDto) {
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
