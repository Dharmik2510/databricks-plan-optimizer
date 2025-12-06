import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface AnalysisResult {
  summary: string;
  dagNodes: Array<{
    id: string;
    name: string;
    type: string;
    metric?: string;
  }>;
  dagLinks: Array<{
    source: string;
    target: string;
  }>;
  resourceMetrics: Array<{
    stageId: string;
    cpuPercentage: number;
    memoryMb: number;
  }>;
  optimizations: Array<{
    title: string;
    severity: string;
    description: string;
    codeSuggestion?: string;
    originalPattern?: string;
  }>;
  codeMappings?: Array<{
    filePath: string;
    lineNumber: number;
    code: string;
    relevanceExplanation: string;
  }>;
  estimatedDurationMin?: number;
}

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY not configured - AI features disabled');
      return;
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    this.logger.log('Gemini AI initialized');
  }

  async analyzeDAG(content: string): Promise<AnalysisResult> {
    if (!this.model) {
      throw new Error('Gemini AI not configured. Please set GEMINI_API_KEY.');
    }

    const systemPrompt = `You are a Principal Data Engineer and Databricks Performance Architect.
Analyze Spark Physical Plans to find performance issues.

Focus on:
1. Cartesian Products (BroadcastNestedLoopJoin without conditions)
2. Shuffle Storms (Exchange hashpartitioning)
3. Spill to Disk
4. Scan Inefficiency (missing filters, Z-Ordering)
5. Data Skew

Return ONLY a valid JSON object (no markdown, no code blocks):
{
  "summary": "Executive summary (2-3 sentences)",
  "dagNodes": [{ "id": "1", "name": "...", "type": "Scan|Filter|Join|Shuffle|Project|Aggregate", "metric": "..." }],
  "dagLinks": [{ "source": "1", "target": "2" }],
  "resourceMetrics": [{ "stageId": "Stage 1", "cpuPercentage": 75, "memoryMb": 2048 }],
  "optimizations": [{
    "title": "Issue Title",
    "severity": "HIGH|MEDIUM|LOW",
    "description": "Detailed description",
    "codeSuggestion": "Optimized code",
    "originalPattern": "Problematic pattern"
  }],
  "estimatedDurationMin": 15
}`;

    const prompt = `Analyze this Spark execution plan:\n\n${content}`;

    try {
      const result = await this.model.generateContent({
        contents: [
          { role: 'user', parts: [{ text: systemPrompt }] },
          { role: 'model', parts: [{ text: 'Understood. I will analyze and return JSON.' }] },
          { role: 'user', parts: [{ text: prompt }] },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 8192,
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

      const parsed = JSON.parse(cleaned) as AnalysisResult;

      if (!parsed.summary || !parsed.dagNodes || !parsed.dagLinks || !parsed.optimizations) {
        throw new Error('Invalid response structure');
      }

      this.logger.log(`Analysis: ${parsed.dagNodes.length} nodes, ${parsed.optimizations.length} optimizations`);
      return parsed;
    } catch (error) {
      this.logger.error('Gemini analysis failed:', error);
      throw error;
    }
  }

  async chat(message: string, analysisContext?: string, conversationHistory?: string): Promise<string> {
    if (!this.model) {
      throw new Error('Gemini AI not configured. Please set GEMINI_API_KEY.');
    }

    let systemPrompt = `You are a Spark Performance Consultant for Databricks.
Help users optimize their workloads with expertise in:
- Join strategies (Broadcast, Shuffle Hash, Sort Merge)
- Partition optimization and data skew
- Memory management and spill prevention
- Caching strategies
- Z-Ordering and data layout

Be concise, technical, and actionable. Use code examples when helpful.`;

    if (analysisContext) {
      systemPrompt += `\n\nContext from user's analysis:\n${analysisContext}`;
    }

    const contents: any[] = [
      { role: 'user', parts: [{ text: systemPrompt }] },
      { role: 'model', parts: [{ text: 'Ready to help optimize your Spark workloads.' }] },
    ];

    // Add conversation history if available
    if (conversationHistory) {
      const lines = conversationHistory.split('\n');
      for (const line of lines) {
        if (line.startsWith('USER:')) {
          contents.push({ role: 'user', parts: [{ text: line.slice(5).trim() }] });
        } else if (line.startsWith('ASSISTANT:')) {
          contents.push({ role: 'model', parts: [{ text: line.slice(10).trim() }] });
        }
      }
    }

    // Add current message
    contents.push({ role: 'user', parts: [{ text: message }] });

    try {
      const result = await this.model.generateContent({
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        },
      });

      const text = result.response.text();
      return text || 'I apologize, but I could not generate a response. Please try again.';
    } catch (error) {
      this.logger.error('Gemini chat failed:', error);
      throw error;
    }
  }
}
