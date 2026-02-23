import { IsOptional, IsUUID } from 'class-validator';

export class AccessStatusQueryDto {
  @IsOptional()
  @IsUUID()
  datasourceId?: string;
}
