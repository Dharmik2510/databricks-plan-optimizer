
import { GoogleGenAI, Type, Chat } from "@google/genai";
import { AnalysisResult, Severity, RepoFile } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

let chatSession: Chat | null = null;

export const analyzeDagContent = async (content: string, repoFiles: RepoFile[] = []): Promise<AnalysisResult> => {
  
  const systemInstruction = `
    You are a Principal Data Engineer and Databricks Performance Architect. 
    Your job is to analyze Spark Physical Plans (DAGs), SQL Explains, or Logs to find performance killers.

    Focus on identifying these specific anti-patterns:
    1. **Cartesian Products**: Look for 'BroadcastNestedLoopJoin' without a join condition.
    2. **Shuffle Storms**: 'Exchange hashpartitioning' causing excessive data movement.
    3. **Spill to Disk**: If memory metrics imply data not fitting in RAM.
    4. **Scan Inefficiency**: 'FileScan' reading full schemas, missing PartitionFilters, or not using Z-Ordering.
    
    **CODE MAPPING TASK**:
    If source code is provided, you MUST attempt to map specific DAG nodes back to the source code file and line number.
    Look for:
    - Table/View names in Scan nodes matching code.
    - Column transformations matching 'withColumn' or SQL expressions.
    - Join conditions matching 'join' operations.
    
    Return valid JSON conforming to the schema.
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
                  severity: { type: Type.STRING, enum: [Severity.HIGH, Severity.MEDIUM, Severity.LOW] },
                  description: { type: Type.STRING },
                  codeSuggestion: { type: Type.STRING, description: "The improved code" },
                  originalPattern: { type: Type.STRING, description: "The inefficient code pattern found" }
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
