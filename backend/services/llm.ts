
import { GoogleGenAI, Type, Chat } from "@google/genai";
import { AnalysisResult, Severity, RepoFile, AnalysisOptions, RepositoryAnalysis, ClusterContext } from "../../shared/types";
import { CodeAnalysisEngine } from "./codeAnalysis";
import { predictiveEngine } from "./analytics";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
let chatSession: Chat | null = null;

export const analyzeDagContentEnhanced = async (
  content: string,
  repoFiles: RepoFile[] = [],
  options: AnalysisOptions = {},
  clusterContext?: ClusterContext
): Promise<AnalysisResult> => {
  const { enableCodeMapping = true, enableDependencyAnalysis = true, confidenceThreshold = 50, maxMappingsPerNode = 3 } = options;
  let codeEngine: CodeAnalysisEngine | null = null;
  let repoAnalysis: RepositoryAnalysis | null = null;

  if (repoFiles.length > 0 && enableCodeMapping) {
    codeEngine = new CodeAnalysisEngine(repoFiles);
    repoAnalysis = generateRepositoryAnalysis(codeEngine);
  }

  const systemInstruction = `
    You are an AI-powered Spark Performance Analyzer with deep expertise in distributed systems optimization.
    Identify performance bottlenecks in Databricks/Spark DAGs.
    
    **NEW: ADVANCED INSIGHTS GENERATION**:
    In addition to optimizations, generate:
    1. **Query Rewrites**: If you detect SQL anti-patterns (e.g. correlated subqueries, cross joins), provide the REWRITTEN SQL query.
    2. **Architectural Advice**: Focus on long-term stability.
  `;

  // Incorporate Cluster Context if available
  const contextBlock = clusterContext ? `
    --- RUNTIME CONTEXT ---
    Cluster Type: ${clusterContext.clusterType}
    DBR Version: ${clusterContext.dbrVersion}
    Extra Configs: 
    ${clusterContext.sparkConf || "None provided"}
    -----------------------
    NOTE: Tailor your recommendations (especially regarding Spark configs and DBR-specific features like Photon or Liquid Clustering) based on the above context.
  ` : '';

  const prompt = `
    Analyze the following Databricks/Spark execution plan:
    ${contextBlock}

    --- EXECUTION PLAN ---
    ${content}
    --- END PLAN ---
    Return JSON format matching the schema.
  `;

  chatSession = ai.chats.create({ model: "gemini-2.5-flash", config: { systemInstruction, temperature: 0 } });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: buildEnhancedResponseSchema()
      }
    });

    const text = response.text;
    if (!text) throw new Error("Received empty response from AI Service.");
    
    let result = JSON.parse(text) as AnalysisResult;

    if (codeEngine && enableCodeMapping) {
      result = await enhanceWithCodeMappings(result, codeEngine, confidenceThreshold, maxMappingsPerNode);
      result.repositoryAnalysis = repoAnalysis!;
    }

    if (!result.clusterRecommendation) {
        result.clusterRecommendation = predictiveEngine.generateClusterRecommendation(result.resourceMetrics);
    }
    if (!result.sparkConfigRecommendation) {
        result.sparkConfigRecommendation = predictiveEngine.generateSparkConfigs(result.dagNodes);
    }

    await chatSession.sendMessage({ message: `Analysis complete. Context loaded. Found ${result.optimizations.length} issues.` });
    return result;

  } catch (error: any) {
    console.error("Gemini Analysis Failed:", error);
    throw new Error(`AI Analysis Failed: ${error.message || "Unknown error"}`);
  }
};

async function enhanceWithCodeMappings(result: AnalysisResult, codeEngine: CodeAnalysisEngine, confidenceThreshold: number, maxMappingsPerNode: number): Promise<AnalysisResult> {
  const allMappings = codeEngine.mapDagNodesToCode(result.dagNodes);
  const filteredMappings = allMappings.filter(m => m.confidence >= confidenceThreshold);
  result.codeMappings = filteredMappings.slice(0, 50);

  for (const opt of result.optimizations) {
    const relevantMappings = filteredMappings.filter(m => {
      const titleKeywords = opt.title.toLowerCase().split(' ');
      const fileContext = m.relevanceExplanation.toLowerCase();
      return titleKeywords.some(keyword => fileContext.includes(keyword));
    }).slice(0, maxMappingsPerNode);

    if (relevantMappings.length > 0) {
      opt.relatedCodeSnippets = relevantMappings;
      opt.rootCauseFile = relevantMappings[0].filePath;
    }
  }
  return result;
}

function generateRepositoryAnalysis(codeEngine: CodeAnalysisEngine): RepositoryAnalysis {
    return {
        totalFiles: 0, analyzedFiles: 0, fileTypes: {}, totalFunctions: 0, totalTableReferences: 0,
        dependencyGraph: { nodes: [], edges: [] }, hotspotFiles: [],
        complexityMetrics: { averageFunctionLength: 0, deepestNestingLevel: 0, cyclomaticComplexity: 0, codeSmells: [] }
    };
}

function buildEnhancedResponseSchema() {
  return {
    type: Type.OBJECT,
    properties: {
      summary: { type: Type.STRING },
      dagNodes: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, name: { type: Type.STRING }, type: { type: Type.STRING }, metric: { type: Type.STRING } }, required: ["id", "name", "type"] } },
      dagLinks: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { source: { type: Type.STRING }, target: { type: Type.STRING } }, required: ["source", "target"] } },
      resourceMetrics: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { stageId: { type: Type.STRING }, cpuPercentage: { type: Type.NUMBER }, memoryMb: { type: Type.NUMBER } }, required: ["stageId", "cpuPercentage", "memoryMb"] } },
      optimizations: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, severity: { type: Type.STRING, enum: [Severity.HIGH, Severity.MEDIUM, Severity.LOW] }, description: { type: Type.STRING }, codeSuggestion: { type: Type.STRING }, originalPattern: { type: Type.STRING }, estimated_time_saved_seconds: { type: Type.NUMBER }, estimated_cost_saved_usd: { type: Type.NUMBER }, confidence_score: { type: Type.NUMBER }, implementation_complexity: { type: Type.STRING, enum: ["Low", "Medium", "High"] }, affected_stages: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["title", "severity", "description"] } },
      estimatedDurationMin: { type: Type.NUMBER },
      codeMappings: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { filePath: { type: Type.STRING }, lineNumber: { type: Type.NUMBER }, code: { type: Type.STRING }, relevanceExplanation: { type: Type.STRING }, confidence: { type: Type.NUMBER }, matchType: { type: Type.STRING, enum: ["exact", "partial", "inferred"] } } } },
      query_complexity_score: { type: Type.NUMBER },
      optimization_impact_score: { type: Type.NUMBER },
      risk_assessment: { type: Type.OBJECT, properties: { data_skew_risk: { type: Type.STRING, enum: ["Low", "Medium", "High"] }, oom_risk: { type: Type.STRING, enum: ["Low", "Medium", "High"] }, shuffle_overhead_risk: { type: Type.STRING, enum: ["Low", "Medium", "High"] } } },
      queryRewrites: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { original: { type: Type.STRING }, rewritten: { type: Type.STRING }, strategy: { type: Type.STRING }, expectedSpeedup: { type: Type.STRING }, tradeoffs: { type: Type.STRING } } } }
    },
    required: ["summary", "dagNodes", "dagLinks", "resourceMetrics", "optimizations"]
  };
}

export const sendChatMessage = async (message: string): Promise<string> => {
  if (!chatSession) throw new Error("Analysis context not found. Please run an analysis first.");
  try {
    const response = await chatSession.sendMessage({ message });
    return response.text || "No response generated.";
  } catch (error: any) {
    return "Error connecting to consultant agent: " + error.message;
  }
};
