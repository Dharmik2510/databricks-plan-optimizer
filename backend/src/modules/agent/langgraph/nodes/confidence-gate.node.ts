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
    embeddingScore: 0.3,
    astScore: 0.2,
    llmConfidence: 0.4,
    keywordMatch: 0.1,
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
    const keywordMatch = computeKeywordMatch(
      semanticDescription?.sparkOperatorSignature || '',
      finalMapping.symbol,
    );
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
        `llm:${llmConfidence.toFixed(2)} kw:${keywordMatch.toFixed(2)}`,
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
 * Extracts keywords from semantic signature and checks presence in symbol name
 */
function computeKeywordMatch(
  semanticSignature: string,
  symbolName: string,
): number {
  // Extract keywords from semantic signature
  const keywords = extractKeywords(semanticSignature);

  if (keywords.length === 0) {
    return 0.5; // Neutral if no keywords
  }

  // Check how many keywords appear in symbol name
  const lowerSymbol = symbolName.toLowerCase();
  const matchCount = keywords.filter((kw) => lowerSymbol.includes(kw)).length;

  return matchCount / keywords.length;
}

/**
 * Extract meaningful keywords from semantic signature
 *
 * Filters out common words and Spark operator names
 */
function extractKeywords(text: string): string[] {
  const STOPWORDS = new Set([
    'the',
    'a',
    'an',
    'and',
    'or',
    'but',
    'in',
    'on',
    'at',
    'to',
    'for',
    'of',
    'with',
    'by',
    'from',
    'as',
    'is',
    'was',
    'are',
    'were',
    'been',
    'be',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'should',
    'could',
    'may',
    'might',
    'must',
    'can',
    // Spark operators (too generic)
    'hashaggregate',
    'filter',
    'sort',
    'exchange',
    'project',
    'scan',
  ]);

  const words = text
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));

  // Deduplicate
  return Array.from(new Set(words));
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
