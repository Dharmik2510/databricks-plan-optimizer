import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Expanded Interface matching shared/types.ts structure
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
    estimated_time_saved_seconds?: number;
    estimated_cost_saved_usd?: number;
    confidence_score?: number;
    implementation_complexity?: 'Low' | 'Medium' | 'High';
    affected_stages?: string[];
    enabledInPlayground?: boolean;
  }>;
  codeMappings?: Array<{
    filePath: string;
    lineNumber: number;
    code: string;
    relevanceExplanation: string;
  }>;
  estimatedDurationMin?: number;

  // --- Advanced Features ---
  clusterRecommendation?: {
    current: { nodes: number; type: string; costPerHour: number };
    recommended: { nodes: number; type: string; costPerHour: number };
    reasoning: string;
    expectedImprovement: string;
  };

  whatIfScenarios?: Array<{
    scenario: string;
    timeReduction: string;
    costSavings: string;
    complexity: string;
    implementation: string;
  }>;

  performancePrediction?: {
    baselineExecutionTime: number;
    predictedExecutionTime: number;
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

  async analyzeDAG(content: string): Promise<AnalysisResult> {
    if (!this.model) {
      throw new Error('Gemini AI not configured. Please set GEMINI_API_KEY.');
    }

    const systemPrompt = `You are a Principal Data Engineer and Databricks Performance Architect.
Analyze the provided Spark Physical Plan or SQL Explain output to find performance issues and specific optimization opportunities.

Your analysis MUST be returned as a **VALID JSON OBJECT**. Do not include markdown code blocks (like \`\`\`json).

The JSON structure must match this TypeScript interface exactly:

\`\`\`typescript
interface AnalysisResult {
  summary: string; // Executive summary (2-3 sentences)
  
  // DAG Visualization Data
  dagNodes: { id: string; name: string; type: string; metric?: string }[];
  dagLinks: { source: string; target: string }[];
  
  // Resource Estimations
  resourceMetrics: { stageId: string; cpuPercentage: number; memoryMb: number }[];
  
  // Optimization Tips
  optimizations: {
    title: string;
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    description: string;
    codeSuggestion?: string;
    originalPattern?: string;
    estimated_time_saved_seconds?: number;
    estimated_cost_saved_usd?: number;
    confidence_score?: number; // 0-100
    implementation_complexity?: 'Low' | 'Medium' | 'High';
    affected_stages?: string[]; // IDs of dagNodes
    enabledInPlayground?: boolean; // Set true if this is suitable for logical "what-if" testing
  }[];
  
  estimatedDurationMin?: number;

  // Cluster Sizing Recommendations
  clusterRecommendation?: {
    current: { nodes: number; type: string; costPerHour: number }; // Infer current if possible, otherwise guess standard
    recommended: { nodes: number; type: string; costPerHour: number };
    reasoning: string;
    expectedImprovement: string;
  };

  // What-If Analysis Scenarios
  whatIfScenarios?: {
    scenario: string; // e.g., "Switch to Broadcast Join" or "Scale up Cluster"
    timeReduction: string; // e.g. "40%"
    costSavings: string; // e.g. "$15/run"
    complexity: string; // e.g. "Low"
    implementation: string; // Short description
  }[];

  // Predictive Scalability Analysis
  performancePrediction?: {
    baselineExecutionTime: number; // Seconds
    predictedExecutionTime: number; // Seconds (after optimizations)
    
    // Impact of data growing
    dataScaleImpact: {
      dataSize: "1x" | "10x" | "100x";
      currentTime: number; // Predicted seconds at this scale (unoptimized)
      optimizedTime: number; // Predicted seconds at this scale (optimized)
      breakingPoint?: string; // e.g. "OOM expected at 50x"
    }[];
    
    // Bottleneck evolution
    bottleneckProgression: {
      stage: string;
      currentImpact: number; // % of total time
      at10xScale: number; // % of total time
      at100xScale: number; // % of total time
      recommendation: string;
    }[];
  };

  // Historical Trends (SIMULATED based on typical patterns for similar workloads)
  historicalTrend?: {
    dates: string[]; // Last 5-7 executions, e.g. "2023-10-01"
    executionTimes: number[];
    costs: number[];
    optimizationsApplied: string[];
    roi: number; // %
  };
}
\`\`\`

**Focus on:**
1. Cartesian Products (BroadcastNestedLoopJoin)
2. Shuffle Storms (Exchange hashpartitioning)
3. Spill to Disk / Memory Pressure
4. Scan Inefficiency (missing filters, Z-Ordering)
5. Skew (partition data imbalance)

**IMPORTANT:**
- **Ensure the DAG is FULLY CONNECTED.** Source nodes (Scan, FileScan, etc.) MUST be linked to their subsequent operation. Do not leave any orphaned nodes.
- If you cannot determine exact numbers, provide reasonable **estimates** based on typical Spark behavior for the observed plan structure.
- For "historicalTrend", since this is a stateless analysis, **SIMULATE** a plausible history for a job with these characteristics (e.g. slowly degrading performance over time due to data growth).
- Populate "performancePrediction" by extrapolating the current bottlenecks.
`;

    const prompt = `Analyze this Spark execution plan:\n\n${content}`;

    try {
      const result = await this.model.generateContent({
        contents: [
          { role: 'user', parts: [{ text: systemPrompt }] },
          { role: 'model', parts: [{ text: 'Understood. I will analyze the plan and return the explicit JSON structure requested, including predictive and advanced metrics.' }] },
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

      return repaired;
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
}
