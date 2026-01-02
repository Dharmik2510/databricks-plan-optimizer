/**
 * Node 5: reasoning_agent_node
 *
 * Purpose: Use LLM to compare execution semantics vs code behavior
 *
 * This node:
 * - Loads actual code for top-3 candidates
 * - Builds LLM prompt with operator semantics + code
 * - LLM analyzes and selects best mapping
 * - Generates human-readable explanation
 * - Returns alternatives if multiple plausible
 *
 * Input: semanticDescription, filteredCandidates
 * Output: finalMapping, explanation, alternatives
 *
 * CRITICAL: This is the ONLY node that uses LLM reasoning
 */

import { MappingState, CodeMapping, Alternative } from '../state/mapping-state.schema';
import { Logger } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { readFileSync } from 'fs';

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  LLM_MODEL: 'gpt-4o',
  LLM_TEMPERATURE: 0.1,
  LLM_MAX_TOKENS: 1500,
  MAX_CANDIDATES_FOR_LLM: 3,
  CODE_SNIPPET_MAX_LINES: 50,
  MAX_RETRIES: 2,
  TIMEOUT_MS: 120000, // 2 minutes
};

// ============================================================================
// Types
// ============================================================================

interface LLMResponse {
  bestMatch: {
    file: string;
    symbol: string;
    reasoning: string;
    confidence?: number;
  };
  alternatives: Array<{
    file: string;
    symbol: string;
    reasoning: string;
  }>;
}

// ============================================================================
// Main Node Function
// ============================================================================

export async function reasoningAgentNode(
  state: MappingState,
): Promise<Partial<MappingState>> {
  const logger = new Logger('ReasoningAgentNode');
  const startTime = Date.now();

  try {
    const { semanticDescription, filteredCandidates, currentDagNode } = state;

    if (!semanticDescription) {
      throw new Error('semanticDescription is required');
    }

    if (!filteredCandidates || filteredCandidates.length === 0) {
      logger.warn('No candidates for reasoning - using fallback');
      return createFallbackMapping();
    }

    logger.log(
      `Reasoning over ${Math.min(filteredCandidates.length, CONFIG.MAX_CANDIDATES_FOR_LLM)} candidates`,
    );

    // Step 1: Select top candidates for LLM analysis
    const topCandidates = filteredCandidates.slice(
      0,
      CONFIG.MAX_CANDIDATES_FOR_LLM,
    );

    // Step 2: Load code snippets
    const candidatesWithCode = await loadCodeSnippets(topCandidates);

    // Step 3: Build LLM prompt
    const prompt = buildReasoningPrompt(
      semanticDescription,
      currentDagNode?.physicalPlanFragment || '',
      candidatesWithCode,
    );

    // Step 4: Call LLM
    const llmResponse = await callLLM(prompt);

    // Step 5: Validate and extract results
    const { finalMapping, explanation, alternatives } = validateLLMResponse(
      llmResponse,
      topCandidates,
    );

    const duration = Date.now() - startTime;
    const tokenCount = estimateTokenCount(prompt);

    logger.log(
      `LLM reasoning completed in ${duration}ms (${tokenCount} tokens)`,
    );

    return {
      finalMapping,
      explanation,
      alternatives,
      costTracking: {
        embeddingCalls: 0,
        llmCalls: 1,
        totalTokens: tokenCount,
        estimatedCostUSD: (tokenCount / 1000) * 0.015, // $0.015 per 1K tokens
      },
      metadata: {
        ...state.metadata,
        reasoningDuration: duration,
        reasoningTokenCount: tokenCount,
      },
    };
  } catch (error) {
    logger.error('Failed to complete reasoning', error);
    throw error;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Load code snippets for candidates
 */
async function loadCodeSnippets(
  candidates: any[],
): Promise<Array<{ candidate: any; code: string }>> {
  const logger = new Logger('LoadCodeSnippets');

  const results = [];

  for (const candidate of candidates) {
    try {
      // Use the codeSnippet that was already loaded from ChromaDB
      const code = candidate.codeSnippet || candidate.metadata?.codeSnippet || '// Code unavailable';

      results.push({ candidate, code });
    } catch (error) {
      logger.warn(`Failed to load code for ${candidate.file}`, error);
      results.push({
        candidate,
        code: '// Code unavailable',
      });
    }
  }

  return results;
}

/**
 * Build LLM reasoning prompt
 */
function buildReasoningPrompt(
  semanticDescription: any,
  physicalPlanFragment: string,
  candidatesWithCode: Array<{ candidate: any; code: string }>,
): string {
  const prompt = `You are a Spark physical plan analyzer. Your task is to map a Spark operator to the source code that implements it.

## OPERATOR SEMANTICS

**Operator Type:** ${semanticDescription.operatorType}

**Execution Behavior:**
${semanticDescription.executionBehavior}

**Data Transformation:**
- Input Columns: ${semanticDescription.dataTransformation.inputSchema.join(', ') || 'N/A'}
- Output Columns: ${semanticDescription.dataTransformation.outputSchema.join(', ') || 'N/A'}
- Key Columns: ${semanticDescription.dataTransformation.keyColumns.join(', ') || 'N/A'}
- Aggregate Functions: ${semanticDescription.dataTransformation.aggregateFunctions.join(', ') || 'N/A'}
- Filter Conditions: ${semanticDescription.dataTransformation.filterConditions.join(', ') || 'N/A'}

**Physical Plan Fragment:**
\`\`\`
${physicalPlanFragment}
\`\`\`

---

## CANDIDATE CODE

${candidatesWithCode
      .map(
        ({ candidate, code }, idx) => `
### Candidate ${idx + 1}: ${candidate.symbol}
**File:** ${candidate.file}
**Lines:** ${candidate.lines}
**Embedding Score:** ${candidate.embeddingScore.toFixed(2)}
**AST Score:** ${candidate.astScore?.toFixed(2) || 'N/A'}
**Detected Keywords:** ${detectKeywordsForPrompt(code, semanticDescription.operatorType).join(', ') || 'None'}

\`\`\`python
${code}
\`\`\`
`,
      )
      .join('\n---\n')}

---

## YOUR TASK

1. Compare the **OPERATOR SEMANTICS** to each **CANDIDATE CODE**
2. Identify which code MOST LIKELY implements this operator's behavior
3. Consider:
   - Does the code perform the same data transformation?
   - Do the column names match?
   - Do the operations (groupBy, agg, filter, etc.) align?
4. Select the best match and explain WHY
5. If multiple candidates are plausible, list them as alternatives

## OUTPUT FORMAT (JSON)

Respond with ONLY valid JSON (no markdown, no extra text):

{
  "bestMatch": {
    "file": "exact file path from candidates",
    "symbol": "exact symbol name from candidates",
    "reasoning": "detailed explanation of why this code matches the operator (2-3 sentences)",
    "confidence": 0.0-1.0
  },
  "alternatives": [
    {
      "file": "alternative file path",
      "symbol": "alternative symbol",
      "reasoning": "why this is also plausible"
    }
  ]
}

If NO candidate matches well, set bestMatch to the top embedding candidate and explain why confidence is low.
If NO candidate matches well, set bestMatch to the top embedding candidate and explain why confidence is low.
`;

  return prompt;
}

// Add helper to detect keywords for prompt context
function detectKeywordsForPrompt(code: string, operatorType: string): string[] {
  const keywords: Record<string, string[]> = {
    'Sort': ['orderBy', 'sort', 'sortWithinPartitions'],
    'Filter': ['filter', 'where'],
    'HashAggregate': ['groupBy', 'agg'],
    'SortAggregate': ['groupBy', 'agg'],
    'Join': ['join'],
    'BroadcastHashJoin': ['join', 'broadcast'],
    'SortMergeJoin': ['join'],
    'Project': ['select', 'withColumn', 'alias']
  };

  const opKey = Object.keys(keywords).find(
    k => k.toLowerCase() === operatorType.toLowerCase()
  );

  const lookup = opKey ? keywords[opKey] : [];
  return lookup.filter(k => code.includes(k));
}

/**
 * Call LLM with retry logic
 */
async function callLLM(prompt: string): Promise<LLMResponse> {
  const logger = new Logger('CallLLM');

  const llm = new ChatOpenAI({
    modelName: CONFIG.LLM_MODEL,
    temperature: CONFIG.LLM_TEMPERATURE,
    maxTokens: CONFIG.LLM_MAX_TOKENS,
    timeout: CONFIG.TIMEOUT_MS,
    openAIApiKey: process.env.OPENAI_API_KEY,
  });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= CONFIG.MAX_RETRIES; attempt++) {
    try {
      logger.log(`LLM call attempt ${attempt + 1}/${CONFIG.MAX_RETRIES + 1}`);

      const messages = [
        new SystemMessage(
          'You are a Spark physical plan analyzer. Respond ONLY with valid JSON.',
        ),
        new HumanMessage(prompt),
      ];

      const response = await llm.invoke(messages);

      // Parse JSON response
      const content = response.content.toString().trim();

      // Remove markdown code fences if present
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonString = jsonMatch ? jsonMatch[1] : content;

      const parsed = JSON.parse(jsonString);

      logger.log('LLM response parsed successfully');
      return parsed as LLMResponse;
    } catch (error) {
      logger.warn(`LLM call attempt ${attempt + 1} failed`, error);
      lastError = error;

      if (attempt < CONFIG.MAX_RETRIES) {
        // Exponential backoff
        const delayMs = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw new Error(`LLM call failed after ${CONFIG.MAX_RETRIES + 1} attempts: ${lastError?.message}`);
}

/**
 * Validate LLM response and extract results
 */
function validateLLMResponse(
  llmResponse: LLMResponse,
  candidates: any[],
): {
  finalMapping: CodeMapping;
  explanation: string;
  alternatives: Alternative[];
} {
  const logger = new Logger('ValidateLLMResponse');

  // Ensure bestMatch is one of the input candidates
  const bestMatch = llmResponse.bestMatch;

  if (!bestMatch || !bestMatch.file || !bestMatch.symbol) {
    logger.warn('Invalid LLM response - using fallback');
    return {
      finalMapping: {
        file: candidates[0].file,
        symbol: candidates[0].symbol,
        lines: candidates[0].lines,
      },
      explanation: 'LLM response invalid - defaulted to top embedding candidate',
      alternatives: [],
    };
  }

  // Find matching candidate to get line numbers
  const matchingCandidate = candidates.find(
    (c) => c.file === bestMatch.file && c.symbol === bestMatch.symbol,
  );

  if (!matchingCandidate) {
    logger.warn('LLM selected non-existent candidate - using top candidate');
    return {
      finalMapping: {
        file: candidates[0].file,
        symbol: candidates[0].symbol,
        lines: candidates[0].lines,
      },
      explanation: bestMatch.reasoning || 'LLM hallucination detected',
      alternatives: [],
    };
  }

  return {
    finalMapping: {
      file: matchingCandidate.file,
      symbol: matchingCandidate.symbol,
      lines: matchingCandidate.lines,
      codeSnippet: matchingCandidate.codeSnippet || matchingCandidate.metadata?.codeSnippet,
    },
    explanation: bestMatch.reasoning || 'No explanation provided',
    alternatives: llmResponse.alternatives || [],
  };
}

/**
 * Create fallback mapping when no candidates available
 */
function createFallbackMapping(): Partial<MappingState> {
  return {
    finalMapping: null,
    explanation: 'No suitable code mapping found',
    alternatives: [],
    confidence: 0.0,
  };
}

/**
 * Estimate token count for cost tracking
 */
function estimateTokenCount(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}

/**
 * Extract confidence from LLM reasoning text
 *
 * Looks for confidence indicators in the explanation
 */
export function extractLLMConfidence(reasoning: string): number {
  const lowerReasoning = reasoning.toLowerCase();

  if (
    lowerReasoning.includes('definitely') ||
    lowerReasoning.includes('clearly') ||
    lowerReasoning.includes('exact match')
  ) {
    return 0.9;
  }

  if (
    lowerReasoning.includes('likely') ||
    lowerReasoning.includes('probably') ||
    lowerReasoning.includes('matches well')
  ) {
    return 0.7;
  }

  if (
    lowerReasoning.includes('possibly') ||
    lowerReasoning.includes('might') ||
    lowerReasoning.includes('could be')
  ) {
    return 0.5;
  }

  if (
    lowerReasoning.includes('unsure') ||
    lowerReasoning.includes('unclear') ||
    lowerReasoning.includes('uncertain')
  ) {
    return 0.3;
  }

  return 0.6; // Default moderate confidence
}
