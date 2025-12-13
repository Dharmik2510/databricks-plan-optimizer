import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateAnalysisDto {
    @IsOptional()
    @IsString()
    @MaxLength(200)
    title?: string;
}
