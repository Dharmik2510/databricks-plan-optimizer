import { GoogleGenAI, Type, Chat } from "@google/genai";
import { AnalysisResult, Severity } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

let chatSession: Chat | null = null;

export const analyzeDagContent = async (content: string): Promise<AnalysisResult> => {
  
  const systemInstruction = `
    You are a Principal Data Engineer and Databricks Performance Architect. 
    Your job is to analyze Spark Physical Plans (DAGs), SQL Explains, or Logs to find performance killers.

    Focus on identifying these specific anti-patterns:
    1. **Cartesian Products**: Look for 'BroadcastNestedLoopJoin' without a join condition.
    2. **Shuffle Storms**: 'Exchange hashpartitioning' causing excessive data movement.
    3. **Spill to Disk**: If memory metrics imply data not fitting in RAM.
    4. **Scan Inefficiency**: 'FileScan' reading full schemas, missing PartitionFilters, or not using Z-Ordering.
    5. **Tiny Files**: Infer from 'Number of files' vs 'Total size' if available.
    
    Your output must be structured.
  `;

  const prompt = `
    Analyze the following Databricks/Spark workflow execution plan/log:
    
    ---
    ${content}
    ---

    1. Parse the text to reconstruct the DAG.
    2. Estimate resource impact (CPU vs Memory).
    3. Provide 3-5 Critical Optimizations.
    4. Estimate the run duration based on the complexity if explicitly stated, otherwise assume a relative complexity score.
    
    Return valid JSON.
  `;

  // Reset chat session on new analysis
  chatSession = ai.chats.create({
    model: "gemini-3-pro-preview",
    config: { systemInstruction }
  });

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
          estimatedDurationMin: { type: Type.NUMBER, description: "Estimated duration in minutes based on plan complexity" }
        },
        required: ["summary", "dagNodes", "dagLinks", "resourceMetrics", "optimizations"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");
  
  // Prime the chat with the context
  await chatSession.sendMessage({ message: `Here is the analysis result I just generated: ${text}. The user will now ask questions about this specific plan.` });

  return JSON.parse(text) as AnalysisResult;
};

export const sendChatMessage = async (message: string): Promise<string> => {
  if (!chatSession) {
    throw new Error("Analysis not initialized. Please run an analysis first.");
  }
  const response = await chatSession.sendMessage({ message });
  return response.text || "I couldn't generate a response.";
};