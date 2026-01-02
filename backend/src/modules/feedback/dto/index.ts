import { IsString, IsNotEmpty, IsEnum, IsOptional, MaxLength, MinLength, IsObject, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum FeedbackSeverity {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical',
}

export enum FeedbackCategory {
    BUG = 'bug',
    FEATURE = 'feature',
    QUESTION = 'question',
    OTHER = 'other',
}

export class CreateFeedbackDto {
    @IsString()
    @IsNotEmpty()
    @MinLength(3)
    @MaxLength(200)
    title: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(10)
    @MaxLength(5000)
    description: string;

    @IsEnum(FeedbackSeverity)
    severity: FeedbackSeverity;

    @IsEnum(FeedbackCategory)
    category: FeedbackCategory;

    @IsString()
    @IsOptional()
    feature?: string;

    // Context auto-captured from request
    @IsString()
    @IsOptional()
    pageUrl?: string;

    @IsString()
    @IsOptional()
    userAgent?: string;

    @IsOptional()
    @IsObject()
    browserInfo?: Record<string, any>;

    @IsString()
    @IsOptional()
    appVersion?: string;

    @IsString()
    @IsOptional()
    lastAction?: string;

    // Screenshot as base64 (optional)
    @IsString()
    @IsOptional()
    screenshot?: string;
}

export class CreateReplyDto {
    @IsString()
    @IsNotEmpty()
    @MinLength(1)
    @MaxLength(5000)
    content: string;
}

export class FeedbackQueryDto {
    @IsOptional()
    @IsString()
    status?: string;

    @IsOptional()
    @IsString()
    category?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    limit?: number;
}
