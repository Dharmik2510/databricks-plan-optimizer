
import { GoogleGenAI, Type, Chat } from "@google/genai";
import { AnalysisResult, Severity, RepoFile } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

let chatSession: Chat | null = null;

export const analyzeDagContent = async (content: string, repoFiles: RepoFile[] = []): Promise<AnalysisResult> => {
  
  const systemInstruction = `
  You are an AI-powered Spark Performance Analyzer with deep expertise in distributed systems optimization.
    
    **ANALYSIS METHODOLOGY** (Multi-Pass Pipeline):
    
    PASS 1 - STRUCTURAL PARSING:
    - Extract all operators: Scan, Filter, Join, Exchange, Aggregate, Sort
    - Build operator dependency tree
    - Identify stage boundaries (Exchange nodes)
    - Calculate operator cardinality estimates
    
    PASS 2 - ANTI-PATTERN DETECTION:
    Detect these critical issues with QUANTIFIED IMPACT:
    
    1. **Cartesian Product** (BroadcastNestedLoopJoin without condition)
       - Impact: O(n*m) complexity, typical 100-1000x slowdown
       - Cost: Estimate rows_left * rows_right * 0.001 seconds
    
    2. **Shuffle Explosion** (Multiple Exchanges with high cardinality)
       - Impact: Network saturation, spill to disk
       - Cost: (shuffle_bytes / 100MB) * 2 seconds per stage
    
    3. **Missing Partition Filters** (FileScan without PartitionFilters on partitioned tables)
       - Impact: Full table scan instead of partition pruning
       - Cost: (total_partitions - needed_partitions) * avg_partition_scan_time
    
    4. **Broadcast Join Size Violation** (BroadcastExchange > 10MB default)
       - Impact: Driver OOM, task serialization overhead
       - Cost: If broadcast_size > threshold, penalize 5-50x
    
    5. **Sort Before Shuffle** (Sort followed by Exchange)
       - Impact: Wasted sorting, data re-sorted after shuffle
       - Cost: Redundant_sort_time = rows * log(rows) * 0.000001
    
    6. **Skewed Join Keys** (Mentions "skew" or uneven partition sizes)
       - Impact: Stragglers, most tasks idle
       - Cost: (max_partition_time - avg_partition_time) * num_tasks
    
    7. **Inefficient File Formats** (CSV/JSON in FileScan)
       - Impact: No columnar pruning, no compression
       - Cost: 3-10x slower than Parquet/Delta
    
    8. **Wide Transformations in Loops** (Joins/Aggregates in iterative patterns)
       - Impact: Repeated shuffles
       - Cost: iterations * shuffle_cost
    
    9. **Schema Inference on Read** (inferSchema=true in logs/code)
       - Impact: Two-pass read
       - Cost: 2x scan time
    
    10. **Missing Z-Order/Data Clustering** (Delta tables without OPTIMIZE)
        - Impact: Excessive file reads
        - Cost: file_count * seek_time
    
    PASS 3 - OPTIMIZATION SYNTHESIS:
    For EACH detected issue:
    - Generate 2-3 alternative solutions
    - Rank by (impact * probability_of_success)
    - Provide code transformation with before/after
    - Estimate % performance gain and cost savings
    
    PASS 4 - HOLISTIC RECOMMENDATIONS:
    - Suggest configuration tuning (spark.sql.shuffle.partitions, etc)
    - Recommend data layout changes (partitioning strategy, Z-ordering)
    - Propose architectural refactoring (denormalization, materialized views)
    
    **CODE MAPPING**:
    If source code provided:
    - Use table/view names to map Scan nodes
    - Match join predicates to .join() calls
    - Trace column references through transformations
    - Identify the EXACT line causing each bottleneck
    
    **COMPARATIVE ANALYSIS** (if multiple plans detected):
    If the input contains "BEFORE:" and "AFTER:" sections, or multiple explain outputs:
    - Identify what changed between versions
    - Quantify the improvement (or regression)
    - Highlight which optimizations were successfully applied
    - Calculate ROI of the changes
    
    **OUTPUT REQUIREMENTS**:
    - Rank optimizations by estimated_time_saved_seconds DESC
    - Include confidence_score (0-100) for each recommendation
    - Provide estimated_cost_impact_usd based on DBU pricing
    - Generate executable code fixes, not just descriptions
  `;

  let codeContext = "";
  if (repoFiles.length > 0) {
    codeContext = "\n\n=== ASSOCIATED SOURCE CODE ===\n";
    repoFiles.forEach(f => {
      codeContext += `\n--- FILE: ${f.path} ---\n${f.content.substring(0, 5000)}\n`; 
    });
    codeContext += "\n==============================\n";
  }

  const prompt = `
    Analyze the following Databricks/Spark workflow execution plan/log:
    
    --- PLAN START ---
    ${content}
    --- PLAN END ---

    ${codeContext}

    1. Parse the text to reconstruct the DAG.
    2. Estimate resource impact.
    3. Provide optimizations.
    4. **CRITICAL**: If source code is provided, populate the 'codeMappings' array.
    
    Return valid JSON.
  `;

  // Reset chat session for fresh context
  chatSession = ai.chats.create({
    model: "gemini-3-pro-preview",
    config: { systemInstruction }
  });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
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
                  severity: { type: Type.STRING },
                  description: { type: Type.STRING },
                  codeSuggestion: { type: Type.STRING },
                  originalPattern: { type: Type.STRING },
                  estimated_time_saved_seconds: { 
                    type: Type.NUMBER, 
                    description: "Quantified time impact" 
                  },
                  estimated_cost_saved_usd: { 
                    type: Type.NUMBER, 
                    description: "Dollar cost savings per run" 
                  },
                  confidence_score: { 
                    type: Type.NUMBER, 
                    description: "Certainty 0-100" 
                  },
                  implementation_complexity: { 
                    type: Type.STRING, 
                    enum: ["Low", "Medium", "High"] 
                  },
                  affected_stages: { 
                    type: Type.ARRAY, 
                    items: { type: Type.STRING },
                    description: "Stage IDs impacted"
                  }
                },
                required: ["title", "severity", "description"]
              }
            },
            estimatedDurationMin: { type: Type.NUMBER },
            codeMappings: {
              type: Type.ARRAY,
              description: "Map DAG findings to source code",
              items: {
                type: Type.OBJECT,
                properties: {
                  filePath: { type: Type.STRING },
                  lineNumber: { type: Type.NUMBER },
                  code: { type: Type.STRING },
                  relevanceExplanation: { type: Type.STRING }
                }
              }
            },
            query_complexity_score: { 
                type: Type.NUMBER, 
                description: "0-100 complexity rating"
              },
              optimization_impact_score: { 
                type: Type.NUMBER, 
                description: "0-100 potential improvement"
              },
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
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Received empty response from AI Service.");
    
    // Prime the chat with the context for follow-up questions
    await chatSession.sendMessage({ message: `Context loaded: ${text}. Awaiting user questions.` });

    return JSON.parse(text) as AnalysisResult;

  } catch (error: any) {
    console.error("Gemini Analysis Failed:", error);
    throw new Error(`AI Analysis Failed: ${error.message || "Unknown error"}`);
  }
};

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
