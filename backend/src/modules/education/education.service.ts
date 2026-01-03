import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { NodeEducationInputDto, NodeEducationResponseDto } from './education.dto';

const MODEL_VERSION = 'gemini-2.0-flash-exp';

@Injectable()
export class EducationService {
    private readonly logger = new Logger(EducationService.name);
    private genAI: GoogleGenerativeAI | null = null;
    private model: any = null;

    constructor(private configService: ConfigService) {
        const apiKey = this.configService.get<string>('GEMINI_API_KEY');

        if (!apiKey) {
            this.logger.warn('GEMINI_API_KEY not configured - Education features disabled');
            return;
        }

        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({ model: MODEL_VERSION });
        this.logger.log('EducationService initialized with Gemini AI');
    }

    /**
     * Generate AI-powered educational insights for a DAG node.
     * Uses the exact prompt structure specified in requirements.
     */
    async generateNodeInsights(input: NodeEducationInputDto): Promise<NodeEducationResponseDto> {
        if (!this.model) {
            throw new Error('Gemini AI not configured. Please set GEMINI_API_KEY.');
        }

        const startTime = Date.now();

        const systemPrompt = `You are a Spark SQL physical-plan educator embedded in a DAG UI. You must be accurate and grounded. Do not fabricate node-specific facts.`;

        const userPrompt = `You are generating an "AI Insights" education panel for a Spark physical plan node shown in a DAG UI.

Input:
- operatorType: ${input.operatorType || 'unknown'}
- nodeLabel: ${input.nodeLabel}
- upstreamLabels: ${JSON.stringify(input.upstreamLabels || [])}
- downstreamLabels: ${JSON.stringify(input.downstreamLabels || [])}
- metrics: ${JSON.stringify(input.metrics || {})}
- evidenceSnippets: ${JSON.stringify(input.evidenceSnippets || [])}
- confidence: ${input.confidence ?? 'not provided'}

Rules:
1) Do NOT fabricate any node-specific facts. If information is missing, explicitly say "Not enough information".
2) You MAY state general Spark knowledge about well-known operators.
3) If operatorType is unknown, infer a best-guess category ONLY if strongly implied by nodeLabel; otherwise provide a generic physical-plan explanation.
4) Keep it UI-ready and concise.
5) Provide 1–2 reputable "Learn more" links (prefer Spark official docs).
6) "Why it shows up here" must be based only on provided inputs; if insufficient, set to null and add a disclaimer.

Output JSON exactly:
{
  "title": string,
  "explanation": string,
  "whyItShowsUpHere": string|null,
  "whatToCheck": string[],
  "learnMore": [
    { "label": string, "url": string }
  ],
  "disclaimer": string|null
}
Return only valid JSON. No markdown. No extra keys.`;

        try {
            const result = await this.model.generateContent({
                contents: [
                    { role: 'user', parts: [{ text: systemPrompt }] },
                    { role: 'model', parts: [{ text: 'Understood. I will provide accurate, grounded educational content for Spark operators.' }] },
                    { role: 'user', parts: [{ text: userPrompt }] },
                ],
                generationConfig: {
                    temperature: 0.2,
                    maxOutputTokens: 1024,
                },
            });

            const text = result.response.text();
            const latencyMs = Date.now() - startTime;

            // Log for observability
            this.logger.log({
                message: 'Node education generated',
                operatorType: input.operatorType,
                nodeLabel: input.nodeLabel,
                latencyMs,
                modelVersion: MODEL_VERSION,
            });

            if (!text) throw new Error('Empty response from Gemini');

            // Clean markdown formatting if present
            let cleaned = text.trim();
            if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
            if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
            if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
            cleaned = cleaned.trim();

            const parsed = JSON.parse(cleaned) as NodeEducationResponseDto;

            // Validate required fields
            if (!parsed.title || !parsed.explanation) {
                throw new Error('Invalid response structure: Missing title or explanation');
            }

            // Ensure arrays exist
            parsed.whatToCheck = parsed.whatToCheck || [];
            parsed.learnMore = parsed.learnMore || [];

            return parsed;
        } catch (error) {
            this.logger.error('Node education generation failed:', error);

            // Return a graceful fallback response
            return {
                title: input.operatorType || 'Spark Operator',
                explanation: 'We encountered an issue generating AI insights for this node. Please try again or refer to the static documentation below.',
                whyItShowsUpHere: null,
                whatToCheck: [],
                learnMore: [
                    { label: 'Spark SQL Documentation', url: 'https://spark.apache.org/docs/latest/sql-ref.html' }
                ],
                disclaimer: 'AI insights temporarily unavailable. Showing fallback content.'
            };
        }
    }
}
