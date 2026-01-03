import { IsString, IsOptional, IsArray, IsNumber, IsObject } from 'class-validator';

export class NodeEducationInputDto {
    @IsString()
    @IsOptional()
    operatorType?: string;

    @IsString()
    nodeLabel: string;

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    upstreamLabels?: string[];

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    downstreamLabels?: string[];

    @IsObject()
    @IsOptional()
    metrics?: Record<string, string | number>;

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    evidenceSnippets?: string[];

    @IsNumber()
    @IsOptional()
    confidence?: number;
}

export interface LearnMoreLink {
    label: string;
    url: string;
}

export interface NodeEducationResponseDto {
    title: string;
    explanation: string;
    whyItShowsUpHere: string | null;
    whatToCheck: string[];
    learnMore: LearnMoreLink[];
    disclaimer: string | null;
}
