
import { GoogleGenAI, Type, Chat } from "@google/genai";
import { 
  AnalysisResult, 
  Severity, 
  RepoFile, 
  AnalysisOptions,
  EnhancedCodeSnippet,
  RepositoryAnalysis 
} from "../types";
import CodeAnalysisEngine from "./codeAnalysisEngine";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

let chatSession: Chat | null = null;

/**
 * Enhanced analysis with deep code mapping and dependency tracking
 */
export const analyzeDagContentEnhanced = async (
  content: string,
  repoFiles: RepoFile[] = [],
  options: AnalysisOptions = {}
): Promise<AnalysisResult> => {
  
  const {
    enableCodeMapping = true,
    enableDependencyAnalysis = true,
    confidenceThreshold = 50,
    maxMappingsPerNode = 3,
    deepAnalysis = true
  } = options;

  // Initialize code analysis engine if repo files provided
  let codeEngine: CodeAnalysisEngine | null = null;
  let repoAnalysis: RepositoryAnalysis | null = null;

  if (repoFiles.length > 0 && enableCodeMapping) {
    console.log(`🔍 Analyzing ${repoFiles.length} repository files...`);
    codeEngine = new CodeAnalysisEngine(repoFiles);
    repoAnalysis = generateRepositoryAnalysis(codeEngine);
  }

  // Build enhanced context for AI
  const codeContext = buildEnhancedCodeContext(
    repoFiles, 
    codeEngine, 
    repoAnalysis,
    enableDependencyAnalysis
  );

  const systemInstruction = `
    You are an AI-powered Spark Performance Analyzer with deep expertise in distributed systems optimization.
    
    **ANALYSIS METHODOLOGY** (Multi-Pass Pipeline):
    
    PASS 1 - STRUCTURAL PARSING:
    - Extract all operators: Scan, Filter, Join, Exchange, Aggregate, Sort
    - Build operator dependency tree with cardinality estimates
    - Identify stage boundaries (Exchange nodes)
    - Calculate operator cardinality estimates from Statistics blocks
    
    PASS 2 - ANTI-PATTERN DETECTION WITH QUANTIFICATION:
    Detect these critical issues with QUANTIFIED IMPACT:
    
    1. **Cartesian Product** (BroadcastNestedLoopJoin without condition)
       - Impact: O(n*m) complexity, typical 100-1000x slowdown
       - Cost Formula: (rows_left * rows_right / 1000000) * 0.01 seconds
       - Look for: "BroadcastNestedLoopJoin BuildRight, Inner" WITHOUT join condition
    
    2. **Shuffle Explosion** (Multiple Exchanges with high cardinality)
       - Impact: Network saturation, spill to disk
       - Cost Formula: (shuffle_bytes / 100000000) * 2 seconds per stage
       - Look for: Multiple "Exchange hashpartitioning" with large row counts
    
    3. **Missing Partition Filters** (FileScan without PartitionFilters on partitioned tables)
       - Impact: Full table scan instead of partition pruning
       - Cost Formula: (total_partitions - needed_partitions) * avg_partition_scan_time
       - Look for: "PartitionFilters: []" when table is partitioned
    
    4. **Broadcast Join Size Violation** (BroadcastExchange > 10MB)
       - Impact: Driver OOM, task serialization overhead
       - Cost Formula: If broadcast_size > 10MB, multiply cost by (size_mb / 10)
       - Look for: "BroadcastExchange" with size annotations
    
    5. **Sort Before Shuffle** (Sort followed by Exchange)
       - Impact: Wasted sorting, data re-sorted after shuffle
       - Cost Formula: rows * log(rows) * 0.000001 seconds
    
    6. **Skewed Join Keys** (Uneven partition sizes)
       - Impact: Stragglers, most tasks idle
       - Look for: Mentions of "skew" or extremely large partition counts
    
    7. **Inefficient File Formats** (CSV/JSON in FileScan)
       - Impact: No columnar pruning, no compression
       - Cost Multiplier: 3-10x slower than Parquet/Delta
       - Look for: "Format: CSV" or "Format: JSON"
    
    8. **Wide Transformations in Loops** (Repeated shuffles)
       - Impact: Repeated shuffles
       - Look for: Multiple similar Exchanges
    
    9. **Schema Inference** (Two-pass reads)
       - Cost: 2x scan time
       - Look for: "inferSchema=true" in logs or context
    
    10. **Missing Z-Order/Clustering** (Delta tables without optimization)
        - Impact: Excessive file reads
        - Look for: Delta format without mention of OPTIMIZE
    
    PASS 3 - OPTIMIZATION SYNTHESIS WITH CODE MAPPING:
    For EACH detected issue:
    - Generate 2-3 alternative solutions (Quick Fix, Best Practice, Architectural)
    - Rank by (impact * confidence_score)
    - Provide EXACT code transformation with before/after
    - Estimate % performance gain (based on quantified impact)
    - Calculate cost savings in USD (use $0.40/DBU-hour baseline)
    - Assign implementation_complexity (Low/Medium/High)
    
    ${codeContext ? `
    **CRITICAL CODE MAPPING TASK**:
    You have access to the actual source code repository. For EACH optimization:
    1. Map to specific file(s) and line number(s) where the issue originates
    2. Trace through function call chains if the issue propagates
    3. Identify dependencies (imports, libraries) that contribute to the problem
    4. Provide affected_stages array with exact stage IDs
    5. Set confidence_score based on match quality:
       - 90-100: Exact table/function name match
       - 70-89: Strong pattern match (e.g., join type matches)
       - 50-69: Inferred match (e.g., operation type suggests this code)
       - Below 50: Don't include
    
    Repository Context Available:
    ${codeContext}
    ` : ''}
    
    PASS 4 - HOLISTIC RECOMMENDATIONS:
    - Suggest Spark config tuning (spark.sql.shuffle.partitions, AQE, broadcast threshold)
    - Recommend data layout changes (partitioning strategy, Z-ordering, file format)
    - Propose architectural refactoring (denormalization, materialized views, caching)
    
    **SCORING SYSTEM**:
    - query_complexity_score: 0-100 (higher = more problematic)
      * 0-30: Simple, well-optimized
      * 31-60: Moderate complexity, some optimization needed
      * 61-100: Complex/problematic, significant optimization required
    
    - optimization_impact_score: 0-100 (potential improvement %)
      * Based on sum of all estimated_time_saved / current_duration
    
    - confidence_score per optimization: 0-100
      * 90-100: Exact match (table names, function signatures)
      * 70-89: Strong match (operation patterns, context)
      * 50-69: Inferred match (likely related)
    
    **OUTPUT REQUIREMENTS**:
    - ALL numeric fields (time_saved, cost_saved, confidence) must be provided
    - Code mappings MUST have filePath, lineNumber, and relevanceExplanation
    - Rank optimizations by (estimated_time_saved_seconds * confidence_score) DESC
    - Include risk_assessment with specific risk levels
  `;

  const prompt = `
    Analyze the following Databricks/Spark execution plan with ADVANCED MULTI-PASS ANALYSIS:
    
    --- EXECUTION PLAN ---
    ${content}
    --- END PLAN ---

    **PERFORM 4-PASS ANALYSIS**:
    
    🔍 PASS 1 - STRUCTURAL DECOMPOSITION:
    Parse the plan and extract:
    - All operator nodes with cardinality estimates (look for "rows=X" in Statistics)
    - Data flow edges (parent → child relationships via indentation)
    - Stage boundaries marked by "Exchange" operators
    - File scan statistics (partitions read, file format, pushed filters)
    - Extract row counts, data sizes, and other metrics from Statistics blocks
    
    🎯 PASS 2 - BOTTLENECK QUANTIFICATION:
    For EACH anti-pattern detected:
    - Calculate estimated_time_cost_seconds using formulas above
    - Calculate estimated_monetary_cost_usd (use $0.40/DBU-hour, typical cluster = 8 DBUs)
    - Assign confidence_score (0-100) based on evidence strength
    - List affected_stages (e.g., ["Stage 2", "Stage 3"])
    - Use Statistics to inform calculations (e.g., actual row counts)
    
    💡 PASS 3 - ADAPTIVE OPTIMIZATION:
    Generate solution strategies for each issue:
    
    **Quick Fix**: Minimal code change, immediate impact
    - Example: Add missing join condition
    - Complexity: Low
    - Impact: High
    
    **Recommended Fix**: Best practice, moderate refactoring
    - Example: Convert CSV to Parquet + add partition filters
    - Complexity: Medium
    - Impact: Very High
    
    **Architectural Fix**: Long-term, requires design changes
    - Example: Denormalize tables to eliminate join
    - Complexity: High
    - Impact: Maximum
    
    ${enableCodeMapping && codeEngine ? `
    **CODE MAPPING** (You have ${repoFiles.length} source files):
    - Map EVERY issue to specific code locations
    - Use table names from FileScan to find code
    - Match join patterns to .join() calls in code
    - Trace aggregations to groupBy()/agg() operations
    - Include file path, line number, and surrounding code
    - Set confidence based on match strength
    - Trace through nested function calls if needed
    ` : ''}
    
    📊 PASS 4 - CONFIGURATION RECOMMENDATIONS:
    Suggest Spark config optimizations based on detected patterns:
    - spark.sql.shuffle.partitions (based on data size)
    - spark.sql.autoBroadcastJoinThreshold (based on join sizes)
    - spark.sql.adaptive.enabled (enable AQE for dynamic optimization)
    - spark.databricks.delta.optimizeWrite.enabled (for Delta writes)
    
    **EXPECTED JSON OUTPUT**:
    Return complete JSON with ALL fields populated. Every optimization MUST have:
    - estimated_time_saved_seconds (calculated using formulas)
    - estimated_cost_saved_usd (based on DBU pricing)
    - confidence_score (0-100)
    - implementation_complexity (Low/Medium/High)
    - affected_stages (array of stage IDs)
    ${enableCodeMapping ? '- relatedCodeSnippets (array of mapped code locations with confidence scores)' : ''}
    
    Be surgical and specific. Use actual metrics from the plan (row counts, sizes).
  `;

  // Reset chat session for fresh context
  chatSession = ai.chats.create({
    model: "gemini-2.5-flash",
    config: { systemInstruction }
  });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: buildEnhancedResponseSchema()
      }
    });

    const text = response.text;
    if (!text) throw new Error("Received empty response from AI Service.");
    
    let result = JSON.parse(text) as AnalysisResult;

    // POST-PROCESSING: Enhance with code engine if available
    if (codeEngine && enableCodeMapping) {
      result = await enhanceWithCodeMappings(result, codeEngine, confidenceThreshold, maxMappingsPerNode);
      result.repositoryAnalysis = repoAnalysis!;
    }

    // Prime the chat with the context for follow-up questions
    await chatSession.sendMessage({ 
      message: `Analysis complete. Context loaded with ${result.optimizations.length} optimizations found. Awaiting user questions.` 
    });

    return result;

  } catch (error: any) {
    console.error("Gemini Analysis Failed:", error);
    throw new Error(`AI Analysis Failed: ${error.message || "Unknown error"}`);
  }
};

/**
 * Build enhanced code context for AI prompt
 */
function buildEnhancedCodeContext(
  repoFiles: RepoFile[],
  codeEngine: CodeAnalysisEngine | null,
  repoAnalysis: RepositoryAnalysis | null,
  includeDependencies: boolean
): string {
  if (!codeEngine || repoFiles.length === 0) return '';

  let context = '\n\n=== SOURCE CODE REPOSITORY ANALYSIS ===\n\n';
  
  // Repository summary
  if (repoAnalysis) {
    context += `Repository Overview:
- Total Files Analyzed: ${repoAnalysis.analyzedFiles}
- File Types: ${Object.entries(repoAnalysis.fileTypes).map(([k, v]) => `${k}(${v})`).join(', ')}
- Total Functions: ${repoAnalysis.totalFunctions}
- Total Table References: ${repoAnalysis.totalTableReferences}\n\n`;
  }

  // Hotspot files (most critical)
  if (repoAnalysis?.hotspotFiles && repoAnalysis.hotspotFiles.length > 0) {
    context += `High-Activity Files (most likely to contain bottlenecks):\n`;
    repoAnalysis.hotspotFiles.slice(0, 5).forEach(file => {
      context += `- ${file.path} (${file.operationCount} operations, ${file.riskLevel} risk): ${file.reason}\n`;
    });
    context += '\n';
  }

  // Include top files with their code (truncated)
  const topFiles = repoFiles.slice(0, 10); // Top 10 most important files
  
  topFiles.forEach(file => {
    const truncatedContent = file.content.length > 3000 
      ? file.content.substring(0, 3000) + '\n... [truncated]'
      : file.content;
      
    context += `\n--- FILE: ${file.path} ---\n${truncatedContent}\n`;
  });

  context += '\n=== END REPOSITORY CONTEXT ===\n\n';
  context += `\nIMPORTANT: Use this code to map DAG operations to specific files and line numbers.\n`;
  context += `Look for table names, join operations, aggregations, and filters in the code that match the execution plan.\n`;

  return context;
}

/**
 * Enhance AI result with code engine mappings
 */
async function enhanceWithCodeMappings(
  result: AnalysisResult,
  codeEngine: CodeAnalysisEngine,
  confidenceThreshold: number,
  maxMappingsPerNode: number
): Promise<AnalysisResult> {
  
  console.log('🔗 Enhancing with code mappings...');

  // Map DAG nodes to code
  const allMappings = codeEngine.mapDagNodesToCode(result.dagNodes);
  
  // Filter by confidence threshold
  const filteredMappings = allMappings.filter(m => m.confidence >= confidenceThreshold);
  
  // Store global mappings
  result.codeMappings = filteredMappings.slice(0, 50); // Top 50 mappings

  // Enhance each optimization with relevant code snippets
  for (const opt of result.optimizations) {
    // Find mappings related to this optimization
    const relevantMappings = filteredMappings.filter(m => {
      // Match by affected stages or optimization title keywords
      const titleKeywords = opt.title.toLowerCase().split(' ');
      const fileContext = m.relevanceExplanation.toLowerCase();
      
      return titleKeywords.some(keyword => fileContext.includes(keyword));
    }).slice(0, maxMappingsPerNode);

    if (relevantMappings.length > 0) {
      opt.relatedCodeSnippets = relevantMappings;
      opt.rootCauseFile = relevantMappings[0].filePath;
    }
  }

  console.log(`✅ Added ${filteredMappings.length} code mappings`);
  
  return result;
}

/**
 * Generate repository analysis from code engine
 */
function generateRepositoryAnalysis(codeEngine: CodeAnalysisEngine): RepositoryAnalysis {
  const contexts = Array.from((codeEngine as any).contexts.values());
  
  const fileTypes: Record<string, number> = {};
  let totalFunctions = 0;
  let totalTableReferences = 0;
  const hotspotFiles: any[] = [];

  contexts.forEach((ctx: any) => {
    const ext = ctx.file.path.split('.').pop() || 'unknown';
    fileTypes[ext] = (fileTypes[ext] || 0) + 1;
    
    totalFunctions += ctx.functions.length;
    totalTableReferences += ctx.tableReferences.length;

    // Calculate hotspot score
    const operationCount = ctx.sparkOperations.length;
    if (operationCount > 5) {
      hotspotFiles.push({
        path: ctx.file.path,
        operationCount,
        complexityScore: operationCount * 10,
        riskLevel: operationCount > 15 ? 'High' : operationCount > 10 ? 'Medium' : 'Low',
        reason: `Contains ${operationCount} Spark operations including ${ctx.sparkOperations.map((o: any) => o.type).join(', ')}`
      });
    }
  });

  return {
    totalFiles: contexts.length,
    analyzedFiles: contexts.length,
    fileTypes,
    totalFunctions,
    totalTableReferences,
    dependencyGraph: { nodes: [], edges: [] }, // TODO: Build graph
    hotspotFiles: hotspotFiles.sort((a, b) => b.operationCount - a.operationCount),
    complexityMetrics: {
      averageFunctionLength: 0,
      deepestNestingLevel: 0,
      cyclomaticComplexity: 0,
      codeSmells: []
    }
  };
}

/**
 * Build enhanced response schema for Gemini
 */
function buildEnhancedResponseSchema() {
  return {
    type: Type.OBJECT,
    properties: {
      summary: { type: Type.STRING, description: "Executive summary." },
      dagNodes: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            name: { type: Type.STRING },
            type: { type: Type.STRING },
            metric: { type: Type.STRING }
          },
          required: ["id", "name", "type"]
        }
      },
      dagLinks: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            source: { type: Type.STRING },
            target: { type: Type.STRING }
          },
          required: ["source", "target"]
        }
      },
      resourceMetrics: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            stageId: { type: Type.STRING },
            cpuPercentage: { type: Type.NUMBER },
            memoryMb: { type: Type.NUMBER }
          },
          required: ["stageId", "cpuPercentage", "memoryMb"]
        }
      },
      optimizations: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            severity: { type: Type.STRING, enum: [Severity.HIGH, Severity.MEDIUM, Severity.LOW] },
            description: { type: Type.STRING },
            codeSuggestion: { type: Type.STRING },
            originalPattern: { type: Type.STRING },
            estimated_time_saved_seconds: { type: Type.NUMBER },
            estimated_cost_saved_usd: { type: Type.NUMBER },
            confidence_score: { type: Type.NUMBER },
            implementation_complexity: { type: Type.STRING, enum: ["Low", "Medium", "High"] },
            affected_stages: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING }
            }
          },
          required: ["title", "severity", "description"]
        }
      },
      estimatedDurationMin: { type: Type.NUMBER },
      codeMappings: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            filePath: { type: Type.STRING },
            lineNumber: { type: Type.NUMBER },
            code: { type: Type.STRING },
            relevanceExplanation: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
            matchType: { type: Type.STRING, enum: ["exact", "partial", "inferred"] }
          }
        }
      },
      query_complexity_score: { type: Type.NUMBER },
      optimization_impact_score: { type: Type.NUMBER },
      risk_assessment: {
        type: Type.OBJECT,
        properties: {
          data_skew_risk: { type: Type.STRING, enum: ["Low", "Medium", "High"] },
          oom_risk: { type: Type.STRING, enum: ["Low", "Medium", "High"] },
          shuffle_overhead_risk: { type: Type.STRING, enum: ["Low", "Medium", "High"] }
        }
      }
    },
    required: ["summary", "dagNodes", "dagLinks", "resourceMetrics", "optimizations"]
  };
}

/**
 * Send chat message with context
 */
export const sendChatMessage = async (message: string): Promise<string> => {
  if (!chatSession) {
    throw new Error("Analysis context not found. Please run an analysis first.");
  }
  try {
    const response = await chatSession.sendMessage({ message });
    return response.text || "No response generated.";
  } catch (error: any) {
    return "Error connecting to consultant agent: " + error.message;
  }
};

// Re-export for backwards compatibility
export const analyzeDagContent = analyzeDagContentEnhanced;
