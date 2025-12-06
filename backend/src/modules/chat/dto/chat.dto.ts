import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class CreateChatSessionDto {
  @IsOptional()
  @IsString()
  analysisId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;
}

export class SendMessageDto {
  @IsString()
  @MinLength(1, { message: 'Message cannot be empty' })
  @MaxLength(10000, { message: 'Message is too long' })
  content: string;
}
