// backend/src/modules/analysis/dto/validation.dto.ts
// DTOs for physical plan validation

import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class ValidatePlanDto {
    @IsString()
    @IsNotEmpty()
    @MinLength(20, { message: 'Plan text is too short to be a valid physical plan' })
    planText: string;
}

export interface ValidationResult {
    is_valid: boolean;
    confidence: 'high' | 'medium' | 'low';
    reason: string;
    detected_engine: 'spark' | 'unknown';
    detected_plan_type: 'physical' | 'logical' | 'unknown';
    detected_issues: string[];
    suggested_user_action: string;
    stage_count?: number;
    detected_operators?: string[];
}
