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

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');

    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY not configured - AI features disabled');
      return;
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    // Use the experimental flash model for speed and larger context window if needed, 
    // or fallback to 'gemini-pro' if stability is preferred.
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    this.logger.log('Gemini AI initialized');
  }

  async analyzeDAG(content: string, runtimeMetrics?: RuntimeMetrics): Promise<AnalysisResult> {
    if (!this.model) {
      throw new Error('Gemini AI not configured. Please set GEMINI_API_KEY.');
    }

    const isTier1 = !!runtimeMetrics;

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

    try {
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

      const text = result.response.text();
      if (!text) throw new Error('Empty response from Gemini');

      // Clean markdown formatting if present
      let cleaned = text.trim();
      if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
      if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
      if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
      cleaned = cleaned.trim();

      const parsed = JSON.parse(cleaned) as AnalysisResult;

      // Basic validation
      if (!parsed.summary || !parsed.dagNodes || !parsed.optimizations) {
        throw new Error('Invalid response structure: Missing core fields');
      }

      this.logger.log(`Analysis completed: ${parsed.dagNodes.length} nodes, ${parsed.optimizations.length} optimizations`);

      // EXPERIMENTAL: Deterministic Repair for Orphan Scans
      // Sometimes the LLM fails to link the source scan to the next stage. We fix this locally.
      const repaired = this.repairDagConnectivity(parsed);

      // Sanitize fields based on Tier
      const sanitized = this.sanitizeNumericFields(repaired, isTier1);

      return sanitized;
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

  /**
   * Post-processing heuristic to connect orphan nodes.
   * Specifically targets "Scan" nodes that have no outgoing links and connects them
   * to the most likely next node (a root node of another component).
   */
  private repairDagConnectivity(result: AnalysisResult): AnalysisResult {
    try {
      const { dagNodes, dagLinks } = result;
      if (!dagNodes || !dagLinks) return result;

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

      if (orphanScans.length === 0) return result;

      this.logger.log(`Found ${orphanScans.length} orphan scan nodes. Attempting repair...`);

      // 2. Identify "Potential Targets" - Nodes that have NO incoming links (Roots of other trees)
      // Exclude the orphans themselves
      const potentialTargets = dagNodes.filter(n =>
        !targets.has(n.id) &&
        !orphanScans.find(o => o.id === n.id)
      );

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
          this.logger.log(`Repairing DAG: Forcing link ${scan.id} -> ${target.id}`);
          dagLinks.push({ source: scan.id, target: target.id });

          // Add to targets set to avoid multi-linking if we want 1-to-1 (optional, but safer)
          targets.add(target.id);
        }
      });

      return {
        ...result,
        dagLinks
      };
    } catch (e) {
      this.logger.error('Error in DAG repair:', e);
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
    return {
      ...result,
      // Remove deprecated / hallucination-prone top-level fields
      estimatedDurationMin: undefined,
      whatIfScenarios: undefined,
      historicalTrend: undefined,

      // Performance Prediction only allowed in Tier 1
      performancePrediction: isTier1 ? result.performancePrediction : undefined,

      // Sanitize optimizations
      optimizations: result.optimizations.map(opt => ({
        ...opt,
        // Tier 1 allows time savings. Tier 0 does not.
        estimated_time_saved_seconds: isTier1 ? opt.estimated_time_saved_seconds : undefined,

        // Cost is ALWAYS forbidden (Tier 2)
        estimated_cost_saved_usd: undefined,

        // Ensure qualitative fields have fallbacks
        impactLevel: opt.impactLevel || this.inferImpactLevel(opt.severity),
        impactReasoning: opt.impactReasoning || opt.description,
        evidenceBasis: opt.evidenceBasis || [],
      })),

      // Sanitize cluster recommendation (remove cost fields)
      clusterRecommendation: result.clusterRecommendation ? {
        ...result.clusterRecommendation,
        current: {
          nodes: result.clusterRecommendation.current.nodes,
          type: result.clusterRecommendation.current.type,
          costPerHour: undefined,
        },
        recommended: {
          nodes: result.clusterRecommendation.recommended.nodes,
          type: result.clusterRecommendation.recommended.type,
          costPerHour: undefined,
        },
      } : undefined,
    };
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
}
