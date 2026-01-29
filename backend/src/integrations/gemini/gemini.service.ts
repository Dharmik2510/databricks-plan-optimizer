import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Expanded Interface matching shared/types.ts structure
// Tier 0: Qualitative impact only - no fabricated numeric estimates
export type ImpactLevel = 'Very High' | 'High' | 'Medium' | 'Low';

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

    // Qualitative Impact (Tier 0)
    impactLevel?: ImpactLevel;
    impactReasoning?: string;
    evidenceBasis?: string[];

    confidence_score?: number;
    implementation_complexity?: 'Low' | 'Medium' | 'High';
    affected_stages?: string[];
    enabledInPlayground?: boolean;

    // DEPRECATED: No longer populated in Tier 0
    estimated_time_saved_seconds?: number;
    estimated_cost_saved_usd?: number;
  }>;
  codeMappings?: Array<{
    filePath: string;
    lineNumber: number;
    code: string;
    relevanceExplanation: string;
  }>;

  // DEPRECATED: No longer populated in Tier 0
  estimatedDurationMin?: number;

  // Cluster Recommendations (qualitative reasoning, no cost numbers)
  clusterRecommendation?: {
    current: { nodes: number; type: string; costPerHour?: number };
    recommended: { nodes: number; type: string; costPerHour?: number };
    reasoning: string;
    expectedImprovement: string;
  };

  // DEPRECATED: These rely on fabricated predictions
  whatIfScenarios?: Array<{
    scenario: string;
    timeReduction: string;
    costSavings: string;
    complexity: string;
    implementation: string;
  }>;

  performancePrediction?: {
    baselineExecutionTime: number; // Measured from event log (Tier 1)
    predictedExecutionTime: number; // Modeled
    dataScaleImpact: Array<{
      dataSize: string;
      currentTime: number;
      optimizedTime: number;
      breakingPoint?: string;
    }>;
    bottleneckProgression: Array<{
      stage: string;
      currentImpact: number;
      at10xScale: number;
      at100xScale: number;
      recommendation: string;
    }>;
  };

  historicalTrend?: {
    dates: string[];
    executionTimes: number[];
    costs: number[];
    optimizationsApplied: string[];
    roi: number;
  };
}

export interface RuntimeMetrics {
  totalRuntimeSeconds: number;
  stages: {
    stageId: number;
    name: string;
    durationSeconds: number;
  }[];
  bottlenecks: string[];
}

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;
  private readonly modelName = 'gemini-2.0-flash-exp';

  constructor(private configService: ConfigService) {
    this.initializeGeminiClient();
  }

  /**
   * Initialize Gemini AI client with API key validation
   */
  private initializeGeminiClient(): void {
    try {
      const apiKey = this.configService.get<string>('GEMINI_API_KEY');

      if (!apiKey) {
        this.logger.warn('❌ GEMINI_API_KEY not configured - AI features disabled');
        return;
      }

      this.logger.log(`🔧 Initializing Gemini AI with model: ${this.modelName}`);

      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: this.modelName });

      this.logger.log(`✅ Gemini AI initialized successfully | Model: ${this.modelName}`);
    } catch (error) {
      this.logger.error('❌ Failed to initialize Gemini AI client', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Don't throw - allow service to start without AI
      this.model = null;
      this.genAI = null;
    }
  }

  /**
   * Analyze DAG with comprehensive error handling and logging
   */
  async analyzeDAG(content: string, runtimeMetrics?: RuntimeMetrics): Promise<AnalysisResult> {
    const operationType = 'DAG_ANALYSIS';
    const tier = runtimeMetrics ? 'TIER_1' : 'TIER_0';

    this.logger.log(`🚀 Starting ${operationType} | Tier: ${tier} | ContentLength: ${content.length} chars | HasMetrics: ${!!runtimeMetrics}`);

    if (!this.model) {
      const error = new Error('Gemini AI not configured. Please set GEMINI_API_KEY.');
      this.logger.error(`❌ ${operationType} failed - Model not initialized`, {
        error: error.message,
        tier,
      });
      throw error;
    }

    const isTier1 = !!runtimeMetrics;
    let retryCount = 0;
    const maxRetries = 3;

    if (isTier1 && runtimeMetrics) {
      this.logger.log(`📊 Runtime metrics provided | TotalRuntime: ${runtimeMetrics.totalRuntimeSeconds}s | Stages: ${runtimeMetrics.stages.length} | Bottlenecks: ${runtimeMetrics.bottlenecks.length}`);
    }

    const basePrompt = `You are a Principal Data Engineer and Databricks Performance Architect.
Analyze the provided Spark Physical Plan or SQL Explain output to find performance issues and optimization opportunities.

**CONTEXT:**
Tier: ${isTier1 ? 'TIER 1 (Quantitative)' : 'TIER 0 (Qualitative)'}
${isTier1 ? `
RUNTIME METRICS (MEASURED FROM EVENT LOG):
- Total Runtime: ${runtimeMetrics.totalRuntimeSeconds} seconds
- Bottlenecks: ${JSON.stringify(runtimeMetrics.bottlenecks)}
- Stage Durations: ${JSON.stringify(runtimeMetrics.stages.slice(0, 10))}...
` : ''}

**CRITICAL CONSTRAINTS:**
${isTier1 ? `
- You MUST use the provided runtime metrics as the baseline.
- You MAY estimate time savings (in minutes/seconds) by modeling the impact of optimizations against the baseline.
- You MUST labeling all time values as "(modeled)".
- You MUST NOT estimate COST ($). Cost is strictly forbidden in Tier 1.
` : `
- You MUST NOT generate any numeric time or cost estimates.
- You MUST NOT estimate seconds, minutes, hours, dollars, or specific percentages of improvement.
- Focus ONLY on qualitative impact based on observable plan structure.
`}

Your analysis MUST be returned as a **VALID JSON OBJECT**. Do not include markdown code blocks.
The JSON structure must match this TypeScript interface exactly:

\`\`\`typescript
interface AnalysisResult {
  summary: string;

  // DAG Visualization Data
  dagNodes: { id: string; name: string; type: string; metric?: string }[];
  dagLinks: { source: string; target: string }[];

  // Resource Impact
  resourceMetrics: { stageId: string; cpuPercentage: number; memoryMb: number }[];

  // Optimization Tips
  optimizations: {
    title: string;
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    description: string;
    codeSuggestion?: string;
    originalPattern?: string;

    // Impact Assessment
    impactLevel: "Very High" | "High" | "Medium" | "Low";
    impactReasoning: string;
    evidenceBasis: string[];

    confidence_score: number;
    implementation_complexity: "Low" | "Medium" | "High";
    affected_stages?: string[];

    // TIER 1 ONLY - Leave null for Tier 0
    estimated_time_saved_seconds?: number; // Modeled savings
  }[];

  // Cluster Recommendations
  clusterRecommendation?: {
    current: { nodes: number; type: string };
    recommended: { nodes: number; type: string };
    reasoning: string;
    expectedImprovement: string;
  };

  // TIER 1 ONLY
  performancePrediction?: {
    baselineExecutionTime: number; // Set to ${isTier1 ? runtimeMetrics.totalRuntimeSeconds : '0'}
    predictedExecutionTime: number; // Modeled result after optimizations
  };
}
\`\`\`

**Focus on detecting:**
1. Cartesian Products
2. Shuffle Storms
3. Spill to Disk
4. Scan Inefficiency
5. Data Skew

**IMPORTANT:**
- Ensure the DAG is FULLY CONNECTED.
- ${isTier1 ? 'Use the measured stage durations to prioritize bottlenecks.' : 'Do not invent metrics.'}
`;

    const prompt = `Analyze this Spark execution plan:\n\n${content}`;

    while (retryCount <= maxRetries) {
      try {
        if (retryCount > 0) {
          this.logger.log(`🔄 Retry attempt ${retryCount}/${maxRetries} for ${operationType}`);
        }

        this.logger.log(`📤 Sending API request | Operation: ${operationType} | Attempt: ${retryCount + 1} | MaxTokens: 8192 | Temperature: 0.2`);

        const startTime = Date.now();
        const result = await this.model.generateContent({
          contents: [
            { role: 'user', parts: [{ text: basePrompt }] },
            { role: 'model', parts: [{ text: 'Understood. I will analyze the plan and provide results according to the specified Tier constraints.' }] },
            { role: 'user', parts: [{ text: prompt }] },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 8192,
          },
        });

        const responseTime = Date.now() - startTime;
        this.logger.log(`✅ API request successful | Operation: ${operationType} | ResponseTime: ${responseTime}ms`);

        const text = result.response.text();

        if (!text || text.trim().length === 0) {
          throw new Error('Empty response from Gemini API');
        }

        this.logger.log(`📥 Received response | Operation: ${operationType} | ResponseLength: ${text.length} chars`);

        // Clean markdown formatting if present
        this.logger.log(`🧹 Cleaning response format | Operation: ${operationType}`);
        let cleaned = text.trim();
        const hadMarkdown = cleaned.startsWith('```');

        if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
        if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
        if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
        cleaned = cleaned.trim();

        if (hadMarkdown) {
          this.logger.log(`🔧 Removed markdown code blocks from response`);
        }

        // Parse JSON response
        this.logger.log(`🔍 Parsing JSON response | Operation: ${operationType}`);
        let parsed: AnalysisResult;

        try {
          parsed = JSON.parse(cleaned) as AnalysisResult;
        } catch (parseError) {
          this.logger.error(`❌ JSON parsing failed | Operation: ${operationType}`, {
            error: parseError instanceof Error ? parseError.message : 'Unknown parse error',
            responsePreview: cleaned.substring(0, 500),
            responseLength: cleaned.length,
          });
          throw new Error(`Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
        }

        // Validate response structure
        this.logger.log(`✅ Validating response structure | Operation: ${operationType}`);

        if (!parsed.summary || !parsed.dagNodes || !parsed.optimizations) {
          this.logger.error(`❌ Invalid response structure | Operation: ${operationType}`, {
            hasSummary: !!parsed.summary,
            hasDagNodes: !!parsed.dagNodes,
            hasOptimizations: !!parsed.optimizations,
            keys: Object.keys(parsed),
          });
          throw new Error('Invalid response structure: Missing core fields (summary, dagNodes, or optimizations)');
        }

        this.logger.log(`✅ Response validation passed | DagNodes: ${parsed.dagNodes.length} | DagLinks: ${parsed.dagLinks?.length || 0} | Optimizations: ${parsed.optimizations.length}`);

        // Log optimization details
        if (parsed.optimizations.length > 0) {
          const severityCounts = parsed.optimizations.reduce((acc, opt) => {
            acc[opt.severity] = (acc[opt.severity] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

          this.logger.log(`📊 Optimization breakdown | ${Object.entries(severityCounts).map(([sev, count]) => `${sev}: ${count}`).join(' | ')}`);
        }

        // Repair DAG connectivity
        this.logger.log(`🔧 Repairing DAG connectivity | Operation: ${operationType}`);
        const repaired = this.repairDagConnectivity(parsed);

        // Sanitize fields based on Tier
        this.logger.log(`🧹 Sanitizing numeric fields | Tier: ${tier} | Operation: ${operationType}`);
        const sanitized = this.sanitizeNumericFields(repaired, isTier1);

        this.logger.log(`✅ ${operationType} completed successfully | Tier: ${tier} | TotalTime: ${responseTime}ms | Nodes: ${sanitized.dagNodes.length} | Optimizations: ${sanitized.optimizations.length}`);

        return sanitized;

      } catch (error) {
        retryCount++;

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : undefined;

        // Check for specific error types
        if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('rate limit')) {
          this.logger.error(`❌ Rate limit error | Operation: ${operationType} | Attempt: ${retryCount}/${maxRetries}`, {
            error: errorMessage,
            retryCount,
            nextRetryIn: retryCount <= maxRetries ? `${retryCount * 2}s` : 'N/A',
          });

          if (retryCount <= maxRetries) {
            const waitTime = retryCount * 2000; // Exponential backoff: 2s, 4s, 6s
            this.logger.log(`⏳ Waiting ${waitTime}ms before retry due to rate limiting`);
            await this.sleep(waitTime);
            continue;
          }
        } else if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT') || errorMessage.includes('ECONNRESET')) {
          this.logger.error(`❌ Timeout error | Operation: ${operationType} | Attempt: ${retryCount}/${maxRetries}`, {
            error: errorMessage,
            retryCount,
          });

          if (retryCount <= maxRetries) {
            const waitTime = 1000;
            this.logger.log(`⏳ Waiting ${waitTime}ms before retry due to timeout`);
            await this.sleep(waitTime);
            continue;
          }
        } else if (errorMessage.includes('quota') || errorMessage.includes('limit exceeded')) {
          this.logger.error(`❌ Token/Quota limit error | Operation: ${operationType}`, {
            error: errorMessage,
            tier,
            contentLength: content.length,
            maxOutputTokens: 8192,
          });
          // Don't retry quota errors
        } else if (errorMessage.includes('Empty response')) {
          this.logger.error(`❌ Empty response from API | Operation: ${operationType} | Attempt: ${retryCount}/${maxRetries}`, {
            error: errorMessage,
            retryCount,
          });

          if (retryCount <= maxRetries) {
            await this.sleep(1000);
            continue;
          }
        } else {
          this.logger.error(`❌ ${operationType} failed | Attempt: ${retryCount}/${maxRetries}`, {
            error: errorMessage,
            stack: errorStack,
            tier,
            contentLength: content.length,
            hasRuntimeMetrics: !!runtimeMetrics,
          });
        }

        // If this was the last retry, throw the error
        if (retryCount > maxRetries) {
          this.logger.error(`❌ ${operationType} failed after ${maxRetries} retries | Tier: ${tier}`, {
            finalError: errorMessage,
            totalAttempts: retryCount,
          });
          throw error;
        }
      }
    }

    // Should never reach here, but TypeScript requires it
    throw new Error(`${operationType} failed after maximum retries`);
  }

  /**
   * Chat interface with comprehensive error handling
   */
  async chat(message: string, analysisContext?: string, conversationHistory?: string): Promise<string> {
    const operationType = 'CHAT';

    this.logger.log(`🚀 Starting ${operationType} | MessageLength: ${message.length} chars | HasContext: ${!!analysisContext} | HasHistory: ${!!conversationHistory}`);

    if (!this.model) {
      const error = new Error('Gemini AI not configured. Please set GEMINI_API_KEY.');
      this.logger.error(`❌ ${operationType} failed - Model not initialized`, {
        error: error.message,
      });
      throw error;
    }

    let retryCount = 0;
    const maxRetries = 2;

    try {
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
        this.logger.log(`📎 Analysis context attached | Length: ${analysisContext.length} chars`);
      }

      const contents: any[] = [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: 'Ready to help optimize your Spark workloads.' }] },
      ];

      // Add conversation history if available
      if (conversationHistory) {
        const lines = conversationHistory.split('\n');
        let historyMessageCount = 0;

        for (const line of lines) {
          if (line.startsWith('USER:')) {
            contents.push({ role: 'user', parts: [{ text: line.slice(5).trim() }] });
            historyMessageCount++;
          } else if (line.startsWith('ASSISTANT:')) {
            contents.push({ role: 'model', parts: [{ text: line.slice(10).trim() }] });
            historyMessageCount++;
          }
        }

        this.logger.log(`📜 Conversation history loaded | Messages: ${historyMessageCount}`);
      }

      // Add current message
      contents.push({ role: 'user', parts: [{ text: message }] });

      while (retryCount <= maxRetries) {
        try {
          if (retryCount > 0) {
            this.logger.log(`🔄 Retry attempt ${retryCount}/${maxRetries} for ${operationType}`);
          }

          this.logger.log(`📤 Sending chat request | Attempt: ${retryCount + 1} | MaxTokens: 2048 | Temperature: 0.7 | ConversationParts: ${contents.length}`);

          const startTime = Date.now();
          const result = await this.model.generateContent({
            contents,
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 2048,
            },
          });

          const responseTime = Date.now() - startTime;
          this.logger.log(`✅ Chat request successful | ResponseTime: ${responseTime}ms`);

          const text = result.response.text();

          if (!text || text.trim().length === 0) {
            throw new Error('Empty response from Gemini API');
          }

          this.logger.log(`✅ ${operationType} completed successfully | ResponseLength: ${text.length} chars | TotalTime: ${responseTime}ms`);

          return text;

        } catch (error) {
          retryCount++;

          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const errorStack = error instanceof Error ? error.stack : undefined;

          if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('rate limit')) {
            this.logger.error(`❌ Rate limit error | Operation: ${operationType} | Attempt: ${retryCount}/${maxRetries}`, {
              error: errorMessage,
              retryCount,
            });

            if (retryCount <= maxRetries) {
              const waitTime = retryCount * 2000;
              this.logger.log(`⏳ Waiting ${waitTime}ms before retry due to rate limiting`);
              await this.sleep(waitTime);
              continue;
            }
          } else if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
            this.logger.error(`❌ Timeout error | Operation: ${operationType} | Attempt: ${retryCount}/${maxRetries}`, {
              error: errorMessage,
              retryCount,
            });

            if (retryCount <= maxRetries) {
              await this.sleep(1000);
              continue;
            }
          } else {
            this.logger.error(`❌ ${operationType} failed | Attempt: ${retryCount}/${maxRetries}`, {
              error: errorMessage,
              stack: errorStack,
              messageLength: message.length,
            });
          }

          if (retryCount > maxRetries) {
            this.logger.error(`❌ ${operationType} failed after ${maxRetries} retries`, {
              finalError: errorMessage,
            });
            throw error;
          }
        }
      }

      return 'I apologize, but I could not generate a response. Please try again.';

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(`❌ ${operationType} failed with unhandled error`, {
        error: errorMessage,
        stack: errorStack,
        messageLength: message.length,
        hasContext: !!analysisContext,
        hasHistory: !!conversationHistory,
      });

      throw error;
    }
  }

  /**
   * Generate historical narrative with comprehensive error handling
   */
  async generateHistoricalNarrative(prompt: string): Promise<string> {
    const operationType = 'HISTORICAL_NARRATIVE';

    this.logger.log(`🚀 Starting ${operationType} | PromptLength: ${prompt.length} chars`);

    if (!this.model) {
      const error = new Error('Gemini AI not configured. Please set GEMINI_API_KEY.');
      this.logger.error(`❌ ${operationType} failed - Model not initialized`, {
        error: error.message,
      });
      throw error;
    }

    let retryCount = 0;
    const maxRetries = 2;

    while (retryCount <= maxRetries) {
      try {
        if (retryCount > 0) {
          this.logger.log(`🔄 Retry attempt ${retryCount}/${maxRetries} for ${operationType}`);
        }

        this.logger.log(`📤 Sending narrative generation request | Attempt: ${retryCount + 1} | MaxTokens: 2048 | Temperature: 0.2`);

        const startTime = Date.now();
        const result = await this.model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2048,
          },
        });

        const responseTime = Date.now() - startTime;
        this.logger.log(`✅ Narrative generation request successful | ResponseTime: ${responseTime}ms`);

        const text = result.response.text();

        if (!text || text.trim().length === 0) {
          throw new Error('Empty response from Gemini API');
        }

        this.logger.log(`✅ ${operationType} completed successfully | ResponseLength: ${text.length} chars | TotalTime: ${responseTime}ms`);

        return text;

      } catch (error) {
        retryCount++;

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : undefined;

        if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('rate limit')) {
          this.logger.error(`❌ Rate limit error | Operation: ${operationType} | Attempt: ${retryCount}/${maxRetries}`, {
            error: errorMessage,
            retryCount,
          });

          if (retryCount <= maxRetries) {
            const waitTime = retryCount * 2000;
            this.logger.log(`⏳ Waiting ${waitTime}ms before retry due to rate limiting`);
            await this.sleep(waitTime);
            continue;
          }
        } else if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
          this.logger.error(`❌ Timeout error | Operation: ${operationType} | Attempt: ${retryCount}/${maxRetries}`, {
            error: errorMessage,
            retryCount,
          });

          if (retryCount <= maxRetries) {
            await this.sleep(1000);
            continue;
          }
        } else if (errorMessage.includes('quota') || errorMessage.includes('limit exceeded')) {
          this.logger.error(`❌ Token/Quota limit error | Operation: ${operationType}`, {
            error: errorMessage,
            promptLength: prompt.length,
            maxOutputTokens: 2048,
          });
        } else {
          this.logger.error(`❌ ${operationType} failed | Attempt: ${retryCount}/${maxRetries}`, {
            error: errorMessage,
            stack: errorStack,
            promptLength: prompt.length,
          });
        }

        if (retryCount > maxRetries) {
          this.logger.error(`❌ ${operationType} failed after ${maxRetries} retries`, {
            finalError: errorMessage,
          });
          throw error;
        }
      }
    }

    return 'I apologize, but I could not generate a response. Please try again.';
  }

  /**
   * Post-processing heuristic to connect orphan nodes.
   * Specifically targets "Scan" nodes that have no outgoing links and connects them
   * to the most likely next node (a root node of another component).
   */
  private repairDagConnectivity(result: AnalysisResult): AnalysisResult {
    const operationType = 'DAG_REPAIR';

    try {
      const { dagNodes, dagLinks } = result;

      if (!dagNodes || !dagLinks) {
        this.logger.log(`⏭️ Skipping ${operationType} - Missing dagNodes or dagLinks`);
        return result;
      }

      const sources = new Set(dagLinks.map(l => l.source));
      const targets = new Set(dagLinks.map(l => l.target));

      // 1. Identify "Orphan Scans" - Nodes that should be sources but go nowhere
      // Look for type "Scan", "Source", "Read", or "HiveTableRelation"
      const orphanScans = dagNodes.filter(n => {
        const type = n.type ? n.type.toLowerCase() : '';
        const name = n.name ? n.name.toLowerCase() : '';
        const isScan = type.includes('scan') || type.includes('read') || type.includes('source') || name.includes('scan');
        const hasNoOutgoing = !sources.has(n.id);
        return isScan && hasNoOutgoing;
      });

      if (orphanScans.length === 0) {
        this.logger.log(`✅ ${operationType} - No orphan scan nodes found | TotalNodes: ${dagNodes.length} | TotalLinks: ${dagLinks.length}`);
        return result;
      }

      this.logger.log(`🔧 ${operationType} - Found ${orphanScans.length} orphan scan nodes | Attempting repair...`);

      // 2. Identify "Potential Targets" - Nodes that have NO incoming links (Roots of other trees)
      // Exclude the orphans themselves
      const potentialTargets = dagNodes.filter(n =>
        !targets.has(n.id) &&
        !orphanScans.find(o => o.id === n.id)
      );

      this.logger.log(`🎯 Potential repair targets found: ${potentialTargets.length}`);

      let repairedCount = 0;

      orphanScans.forEach(scan => {
        // Heuristic: Connect to the first available potential target that isn't itself a scan
        // (Assuming a Scan feeds into a Filter, Project, or Exchange)
        let target = potentialTargets.find(t => {
          const tType = t.type.toLowerCase();
          return !tType.includes('scan') && !tType.includes('read');
        });

        // Fallback: If no non-scan targets (weird), just take the first other root
        if (!target && potentialTargets.length > 0) {
          target = potentialTargets[0];
        }

        // Deep Fallback: If no roots found (maybe a cycle?), try the immediate next node in the array
        if (!target) {
          const idx = dagNodes.findIndex(n => n.id === scan.id);
          if (idx !== -1 && idx + 1 < dagNodes.length) {
            target = dagNodes[idx + 1];
          }
        }

        if (target && target.id !== scan.id) {
          this.logger.log(`🔗 Creating repair link | Source: ${scan.id} (${scan.name}) -> Target: ${target.id} (${target.name})`);
          dagLinks.push({ source: scan.id, target: target.id });

          // Add to targets set to avoid multi-linking if we want 1-to-1 (optional, but safer)
          targets.add(target.id);
          repairedCount++;
        } else {
          this.logger.warn(`⚠️ Could not find repair target for orphan scan | NodeId: ${scan.id} | NodeName: ${scan.name}`);
        }
      });

      this.logger.log(`✅ ${operationType} completed | OrphansFound: ${orphanScans.length} | Repaired: ${repairedCount} | TotalLinks: ${dagLinks.length}`);

      return {
        ...result,
        dagLinks
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(`❌ Error in ${operationType} - Returning original result`, {
        error: errorMessage,
        stack: errorStack,
        dagNodesCount: result.dagNodes?.length,
        dagLinksCount: result.dagLinks?.length,
      });

      return result; // Fail safe, return original
    }
  }

  /**
   * TIER 0 vs TIER 1 Validation.
   * Ensures no fabricated estimates are returned for Tier 0.
   * Allows modeled time savings for Tier 1.
   * Cost is ALWAYS removed (Tier 2 scope).
   */
  private sanitizeNumericFields(result: AnalysisResult, isTier1: boolean): AnalysisResult {
    const operationType = 'FIELD_SANITIZATION';

    try {
      this.logger.log(`🧹 ${operationType} | Tier: ${isTier1 ? 'TIER_1' : 'TIER_0'} | Optimizations: ${result.optimizations?.length || 0}`);

      let removedTimeFields = 0;
      let removedCostFields = 0;
      let addedFallbackFields = 0;

      const sanitizedOptimizations = result.optimizations.map(opt => {
        const sanitized: any = { ...opt };

        // Tier 1 allows time savings. Tier 0 does not.
        if (!isTier1 && opt.estimated_time_saved_seconds !== undefined) {
          sanitized.estimated_time_saved_seconds = undefined;
          removedTimeFields++;
        }

        // Cost is ALWAYS forbidden (Tier 2)
        if (opt.estimated_cost_saved_usd !== undefined) {
          sanitized.estimated_cost_saved_usd = undefined;
          removedCostFields++;
        }

        // Ensure qualitative fields have fallbacks
        if (!opt.impactLevel) {
          sanitized.impactLevel = this.inferImpactLevel(opt.severity);
          addedFallbackFields++;
        }

        if (!opt.impactReasoning) {
          sanitized.impactReasoning = opt.description;
          addedFallbackFields++;
        }

        if (!opt.evidenceBasis) {
          sanitized.evidenceBasis = [];
          addedFallbackFields++;
        }

        return sanitized;
      });

      // Sanitize cluster recommendation (remove cost fields)
      let sanitizedClusterRec = result.clusterRecommendation;
      if (sanitizedClusterRec) {
        if (sanitizedClusterRec.current.costPerHour !== undefined) {
          removedCostFields++;
        }
        if (sanitizedClusterRec.recommended.costPerHour !== undefined) {
          removedCostFields++;
        }

        sanitizedClusterRec = {
          ...sanitizedClusterRec,
          current: {
            nodes: sanitizedClusterRec.current.nodes,
            type: sanitizedClusterRec.current.type,
            costPerHour: undefined,
          },
          recommended: {
            nodes: sanitizedClusterRec.recommended.nodes,
            type: sanitizedClusterRec.recommended.type,
            costPerHour: undefined,
          },
        };
      }

      const sanitizedResult = {
        ...result,
        // Remove deprecated / hallucination-prone top-level fields
        estimatedDurationMin: undefined,
        whatIfScenarios: undefined,
        historicalTrend: undefined,

        // Performance Prediction only allowed in Tier 1
        performancePrediction: isTier1 ? result.performancePrediction : undefined,

        optimizations: sanitizedOptimizations,
        clusterRecommendation: sanitizedClusterRec,
      };

      this.logger.log(`✅ ${operationType} completed | RemovedTimeFields: ${removedTimeFields} | RemovedCostFields: ${removedCostFields} | AddedFallbacks: ${addedFallbackFields}`);

      return sanitizedResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(`❌ Error in ${operationType} - Returning original result`, {
        error: errorMessage,
        stack: errorStack,
        tier: isTier1 ? 'TIER_1' : 'TIER_0',
      });

      return result;
    }
  }

  /**
   * Infer impact level from severity as a fallback
   */
  private inferImpactLevel(severity: string): ImpactLevel {
    const s = severity?.toUpperCase();
    if (s === 'CRITICAL') return 'Very High';
    if (s === 'HIGH') return 'High';
    if (s === 'MEDIUM') return 'Medium';
    return 'Low';
  }

  /**
   * Helper function to sleep for a specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
