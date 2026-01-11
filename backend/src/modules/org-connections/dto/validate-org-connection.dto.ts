import { IsUUID } from 'class-validator';

export class ValidateOrgConnectionDto {
  @IsUUID()
  connectionId: string;
}
