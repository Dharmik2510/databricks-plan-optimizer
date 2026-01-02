/**
 * Node 6: confidence_gate_node
 *
 * Purpose: Compute confidence score and branch workflow
 *
 * This node:
 * - Computes multi-factor confidence score
 * - Extracts LLM confidence from explanation
 * - Checks keyword overlap
 * - Applies alternatives penalty
 * - Routes to: high/medium/low confidence paths
 *
 * Input: finalMapping, explanation, alternatives, filteredCandidates
 * Output: confidence, confidenceFactors, routing decision
 */

import {
  MappingState,
  ConfidenceFactors,
  CodeCandidate,
} from '../state/mapping-state.schema';
import { Logger } from '@nestjs/common';
import { extractLLMConfidence } from './reasoning-agent.node';

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  THRESHOLD_HIGH: parseFloat(process.env.CONFIDENCE_THRESHOLD_HIGH || '0.8'),
  THRESHOLD_LOW: parseFloat(process.env.CONFIDENCE_THRESHOLD_LOW || '0.5'),
  WEIGHTS: {
    embeddingScore: 0.4, // Increased from 0.3 - embedding scores are now properly converted
    astScore: 0.15,      // Decreased from 0.2
    llmConfidence: 0.35, // Decreased from 0.4
    keywordMatch: 0.1,   // Unchanged
  },
  ALTERNATIVES_PENALTY: 0.1,
};

// ============================================================================
// Main Node Function
// ============================================================================

export async function confidenceGateNode(
  state: MappingState,
): Promise<Partial<MappingState>> {
  const logger = new Logger('ConfidenceGateNode');

  try {
    const {
      finalMapping,
      explanation,
      alternatives,
      filteredCandidates,
      semanticDescription,
    } = state;

    if (!finalMapping) {
      logger.warn('No final mapping - defaulting to low confidence');
      return {
        confidence: 0.0,
        confidenceFactors: null,
      };
    }

    logger.log(`Computing confidence for mapping: ${finalMapping.symbol}`);

    // Step 1: Find the mapped candidate to get scores
    const mappedCandidate = findMappedCandidate(finalMapping, filteredCandidates);

    // Step 2: Extract individual confidence factors
    const embeddingScore = mappedCandidate?.embeddingScore || 0.5;
    const astScore = mappedCandidate?.astScore || 0.5;
    const llmConfidence = extractLLMConfidence(explanation);

    // Existing semantic signature match
    const semanticMatch = computeKeywordMatch(
      semanticDescription?.sparkOperatorSignature || '',
      mappedCandidate || ({ symbol: finalMapping.symbol, file: finalMapping.file } as CodeCandidate),
    );

    // New Operator-specific keyword match
    const operatorMatch = calculateOperatorKeywordScore(
      state.currentDagNode,
      mappedCandidate?.codeSnippet || ''
    );

    // Use the maximum of the two keyword scores to give benefit of doubt
    const keywordMatch = Math.max(semanticMatch, operatorMatch);

    const alternativesPenalty =
      alternatives && alternatives.length > 0 ? CONFIG.ALTERNATIVES_PENALTY : 0.0;

    // Step 3: Compute weighted confidence score
    const confidence = Math.min(
      1.0,
      Math.max(
        0.0,
        embeddingScore * CONFIG.WEIGHTS.embeddingScore +
        astScore * CONFIG.WEIGHTS.astScore +
        llmConfidence * CONFIG.WEIGHTS.llmConfidence +
        keywordMatch * CONFIG.WEIGHTS.keywordMatch -
        alternativesPenalty,
      ),
    );

    const confidenceFactors: ConfidenceFactors = {
      embeddingScore,
      astScore,
      llmConfidence,
      keywordMatch,
      alternativesPenalty,
    };

    // Step 4: Determine routing
    let routing: 'high' | 'medium' | 'low';
    if (confidence >= CONFIG.THRESHOLD_HIGH) {
      routing = 'high';
    } else if (confidence >= CONFIG.THRESHOLD_LOW) {
      routing = 'medium';
    } else {
      routing = 'low';
    }

    logger.log(
      `Confidence: ${confidence.toFixed(3)} (${routing}) - ` +
      `emb:${embeddingScore.toFixed(2)} ast:${astScore.toFixed(2)} ` +
      `llm:${llmConfidence.toFixed(2)} kw:${keywordMatch.toFixed(2)} (sem:${semanticMatch.toFixed(2)} op:${operatorMatch.toFixed(2)})`,
    );

    return {
      confidence,
      confidenceFactors,
      metadata: {
        ...state.metadata,
        confidenceRouting: routing,
      },
    };
  } catch (error) {
    logger.error('Failed to compute confidence', error);
    throw error;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

const OPERATOR_KEYWORDS: Record<string, string[]> = {
  'Sort': ['orderBy', 'sort', 'sortWithinPartitions', 'ASC', 'DESC'],
  'Filter': ['filter', 'where', 'isNotNull', 'isNull'],
  'HashAggregate': ['groupBy', 'agg', 'sum', 'count', 'avg', 'max', 'min'],
  'SortAggregate': ['groupBy', 'agg', 'sum', 'count', 'avg', 'max', 'min'],
  'Project': ['select', 'withColumn', 'alias', 'drop'],
  'Join': ['join', 'inner', 'left', 'right', 'outer', 'cross'],
  'BroadcastHashJoin': ['join', 'broadcast'],
  'SortMergeJoin': ['join'],
  'BroadcastExchange': ['broadcast'],
  'Exchange': ['repartition', 'coalesce'],
  'Union': ['union'],
  'Limit': ['limit', 'take']
};

/**
 * Calculate keyword score specific to the Spark Operator
 */
function calculateOperatorKeywordScore(dagNode: any, codeSnippet: string): number {
  if (!dagNode || !dagNode.operator || !codeSnippet) return 0.5;

  // Case-insensitive lookup
  const opKey = Object.keys(OPERATOR_KEYWORDS).find(
    k => k.toLowerCase() === dagNode.operator.toLowerCase()
  );

  const keywords = opKey ? OPERATOR_KEYWORDS[opKey] : [];
  if (keywords.length === 0) return 0.5; // No specific keywords known

  const codeLower = codeSnippet.toLowerCase();

  // Count how many of the expected keywords are present
  const matchedKeywords = keywords.filter(kw =>
    codeLower.includes(kw.toLowerCase())
  );

  if (matchedKeywords.length === 0) return 0.0;

  // Score logic: 
  // 1 match is good (0.8), 2+ matches is perfect (1.0)
  // We don't need ALL keywords, just strong evidence
  return matchedKeywords.length >= 2 ? 1.0 : 0.8;
}

/**
 * Find the candidate that matches the final mapping
 */
function findMappedCandidate(
  finalMapping: any,
  candidates: CodeCandidate[] | undefined,
): CodeCandidate | null {
  if (!candidates || candidates.length === 0) {
    return null;
  }

  return (
    candidates.find(
      (c) => c.file === finalMapping.file && c.symbol === finalMapping.symbol,
    ) || candidates[0]
  );
}


/**
 * Compute keyword overlap between semantic description and code symbol
 *
 * Improved Logic:
 * 1. Extract "Required" keywords (columns, keys) from semantic signature
 * 2. Tokenize code snippet
 * 3. Calculate Jaccard similarity or Overlap Ratio
 */
function computeKeywordMatch(
  semanticSignature: string,
  candidate: CodeCandidate,
): number {
  // 1. Parse keys/cols from semantic signature "KEYS: a, b AGG: ... COLS: x, y"
  const planTokens = extractPlanTokens(semanticSignature);

  if (planTokens.size === 0) {
    return 0.5; // Neutral if no plan tokens found
  }

  // 2. Tokenize code
  const codeText = (candidate.symbol + ' ' + (candidate.codeSnippet || '')).toLowerCase();
  // Split by non-alphanumeric chars to get clean tokens
  const codeTokens = new Set(codeText.split(/[^a-z0-9_]+/));

  // 3. Calculate overlap
  let matchCount = 0;
  for (const token of planTokens) {
    if (codeTokens.has(token)) {
      matchCount++;
    }
  }

  // Score = ratio of plan tokens found in code
  // We use a "saturation" curve so 3-4 matches is already very good
  const ratio = matchCount / Math.max(1, planTokens.size);

  // Boost logic: 
  // - Even a single match (e.g. 1 unique column name) is a strong signal if the set is small
  // - If ratio > 0.25 (finding > 1/4 of columns), strictly reward it

  let score = ratio;
  if (ratio > 0.25) score = Math.min(1.0, ratio * 2.0); // Boost: 0.25 -> 0.5, 0.5 -> 1.0

  return score;
}

function extractPlanTokens(signature: string): Set<string> {
  const tokens = new Set<string>();

  // Extract content after "KEYS:", "COLS:", "AGG:", "FILTERS:"
  const regex = /(?:KEYS|COLS|AGG|FILTERS|INPUT_COLS|SORT): ([^:\n]+)/g;
  let match;
  while ((match = regex.exec(signature)) !== null) {
    const rawValues = match[1];
    rawValues.split(/,| /).forEach(v => {
      const clean = v.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (clean.length > 2 && !['sum', 'avg', 'count', 'min', 'max'].includes(clean)) {
        tokens.add(clean); // Add columns/keys
      }
    });
  }

  return tokens;
}


/**
 * Confidence routing function for LangGraph conditional edges
 *
 * This function is used in the graph definition to branch based on confidence
 */
export function routeByConfidence(
  state: MappingState,
): 'finalize' | 'finalize_with_alternatives' | 'unresolved' {
  const confidence = state.confidence;

  if (confidence >= CONFIG.THRESHOLD_HIGH) {
    return 'finalize';
  }

  if (confidence >= CONFIG.THRESHOLD_LOW) {
    return 'finalize_with_alternatives';
  }

  return 'unresolved';
}

/**
 * Detailed confidence analysis for debugging
 */
export function analyzeConfidence(state: MappingState): {
  confidence: number;
  breakdown: Record<string, number>;
  recommendation: string;
} {
  const { confidenceFactors, alternatives } = state;

  if (!confidenceFactors) {
    return {
      confidence: 0,
      breakdown: {},
      recommendation: 'No confidence factors available',
    };
  }

  const breakdown = {
    'Embedding Score': confidenceFactors.embeddingScore * CONFIG.WEIGHTS.embeddingScore,
    'AST Score': confidenceFactors.astScore * CONFIG.WEIGHTS.astScore,
    'LLM Confidence': confidenceFactors.llmConfidence * CONFIG.WEIGHTS.llmConfidence,
    'Keyword Match': confidenceFactors.keywordMatch * CONFIG.WEIGHTS.keywordMatch,
    'Alternatives Penalty': -confidenceFactors.alternativesPenalty,
  };

  const confidence = state.confidence;

  let recommendation: string;
  if (confidence >= CONFIG.THRESHOLD_HIGH) {
    recommendation = 'HIGH confidence - Safe to use this mapping';
  } else if (confidence >= CONFIG.THRESHOLD_LOW) {
    recommendation = 'MEDIUM confidence - Review alternatives before use';
  } else {
    recommendation = 'LOW confidence - Manual review required';
  }

  return {
    confidence,
    breakdown,
    recommendation,
  };
}
