// backend/src/modules/analysis/validation.service.ts
// Service for validating Apache Spark physical plans using AI

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ValidationResult } from './dto/validation.dto';
import { createHash } from 'crypto';

@Injectable()
export class ValidationService {
    private readonly logger = new Logger(ValidationService.name);
    private genAI: GoogleGenerativeAI | null = null;
    private model: any = null;

    constructor(private configService: ConfigService) {
        const apiKey = this.configService.get<string>('GEMINI_API_KEY');

        if (!apiKey) {
            this.logger.warn('GEMINI_API_KEY not configured - Validation features disabled');
            return;
        }

        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
        this.logger.log('ValidationService initialized with Gemini AI');
    }

    /**
     * Generate a short hash for logging (first 8 chars of SHA256)
     */
    private generatePlanHash(planText: string): string {
        return createHash('sha256').update(planText).digest('hex').substring(0, 8);
    }

    async validatePhysicalPlan(planText: string, userId?: string): Promise<ValidationResult> {
        const startTime = Date.now();
        const planHash = this.generatePlanHash(planText);
        const planSize = planText.length;

        // Log validation start with context
        this.logger.log({
            message: 'Validation started',
            planHash,
            planSize,
            userId: userId || 'anonymous',
        });

        if (!this.model) {
            this.logger.error({
                message: 'Validation failed - AI not configured',
                planHash,
                userId: userId || 'anonymous',
            });
            throw new Error('Gemini AI not configured. Please set GEMINI_API_KEY.');
        }

        const systemPrompt = `Act as a strict compiler and query execution expert.

You are validating whether the provided input is a valid and complete
Apache Spark **PHYSICAL PLAN** suitable for performance analysis.

Your job is ONLY to validate and classify the input.
DO NOT generate optimization advice at this stage.

Validation Rules (Non-negotiable):
1. The input must be a Spark PHYSICAL PLAN, not:
   - SQL text
   - Logical plan only
   - Execution explanation in prose
   - Pseudocode or documentation
2. The plan must be structurally complete and not truncated.
3. The plan must contain at least ONE physical operator
   (e.g., Exchange, HashAggregate, Sort, FileScan, BroadcastHashJoin, Project, Filter, SortMergeJoin, ShuffleExchange).
4. Mixed content (SQL + plan, logs + plan, comments + plan) is INVALID.
5. If there is ANY ambiguity, mark the plan as INVALID.

You MUST return a strict JSON object.
No markdown. No extra text.

Response Schema:

{
  "is_valid": boolean,
  "confidence": "high" | "medium" | "low",
  "reason": string,
  "detected_engine": "spark" | "unknown",
  "detected_plan_type": "physical" | "logical" | "unknown",
  "detected_issues": string[],
  "suggested_user_action": string,
  "stage_count": number | null,
  "detected_operators": string[]
}

Guidance:
- If valid: explain briefly why it is valid.
- If invalid: explain clearly what is wrong and how the user can fix it.
- Be precise, not verbose.
- Count the number of stages/operators for stage_count.
- List the physical operators found in detected_operators.`;

        const prompt = `Validate this input:\n\n${planText}`;

        try {
            const result = await this.model.generateContent({
                contents: [
                    { role: 'user', parts: [{ text: systemPrompt }] },
                    { role: 'model', parts: [{ text: 'Understood. I will validate the input and return the explicit JSON structure requested.' }] },
                    { role: 'user', parts: [{ text: prompt }] },
                ],
                generationConfig: {
                    temperature: 0.1, // Low temperature for deterministic validation
                    maxOutputTokens: 1024,
                },
            });

            const text = result.response.text();
            if (!text) throw new Error('Empty response from Gemini');

            // Clean markdown formatting if present
            let cleaned = text.trim();
            if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
            if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
            if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
            cleaned = cleaned.trim();

            const parsed = JSON.parse(cleaned) as ValidationResult;

            // Basic validation of response structure
            if (typeof parsed.is_valid !== 'boolean') {
                throw new Error('Invalid response structure: Missing is_valid field');
            }

            const durationMs = Date.now() - startTime;

            // Log successful validation with full context
            this.logger.log({
                message: 'Validation completed',
                planHash,
                planSize,
                userId: userId || 'anonymous',
                durationMs,
                result: {
                    is_valid: parsed.is_valid,
                    confidence: parsed.confidence,
                    detected_engine: parsed.detected_engine,
                    detected_plan_type: parsed.detected_plan_type,
                    operator_count: parsed.detected_operators?.length || 0,
                    stage_count: parsed.stage_count,
                },
            });

            return parsed;
        } catch (error) {
            const durationMs = Date.now() - startTime;

            // Log error with context
            this.logger.error({
                message: 'Validation failed',
                planHash,
                planSize,
                userId: userId || 'anonymous',
                durationMs,
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
            });

            // Return a structured error response instead of throwing
            return {
                is_valid: false,
                confidence: 'low',
                reason: 'Validation service encountered an error while processing the input.',
                detected_engine: 'unknown',
                detected_plan_type: 'unknown',
                detected_issues: ['Internal validation error'],
                suggested_user_action: 'Please ensure your input is a valid Spark physical plan and try again.',
                stage_count: undefined,
                detected_operators: [],
            };
        }
    }

    /**
     * Quick heuristic validation without AI (for immediate feedback)
     */
    quickValidate(planText: string): { likely_valid: boolean; hints: string[] } {
        const startTime = Date.now();
        const planHash = this.generatePlanHash(planText);
        const hints: string[] = [];
        const text = planText.toLowerCase();

        // Check for physical plan indicators
        const physicalIndicators = [
            '== physical plan ==',
            'filescan',
            'exchange',
            'hashaggregate',
            'broadcasthashjoin',
            'sortmergejoin',
            'project',
            'filter',
            'sort',
            'parquet',
            'adaptivesparkplan',
        ];

        const foundIndicators = physicalIndicators.filter(ind => text.includes(ind));

        if (foundIndicators.length === 0) {
            hints.push('No physical plan operators detected');
        }

        // Check for logical plan only indicators
        if (text.includes('== optimized logical plan ==') && !text.includes('== physical plan ==')) {
            hints.push('This appears to be a logical plan, not a physical plan');
        }

        // Check for SQL text
        if (text.match(/^\s*(select|insert|update|delete|create|drop|alter)\s+/i)) {
            hints.push('This appears to be SQL text, not an execution plan');
        }

        // Check for truncation
        if (text.includes('...') && text.split('...').length > 3) {
            hints.push('Plan may be truncated');
        }

        // Check minimum length
        if (planText.trim().length < 100) {
            hints.push('Input is too short to be a complete physical plan');
        }

        const likely_valid = foundIndicators.length >= 2 && hints.length === 0;
        const durationMs = Date.now() - startTime;

        // Log quick validation
        this.logger.debug({
            message: 'Quick validation completed',
            planHash,
            planSize: planText.length,
            durationMs,
            likely_valid,
            foundIndicators: foundIndicators.length,
            hints,
        });

        return {
            likely_valid,
            hints,
        };
    }
}
