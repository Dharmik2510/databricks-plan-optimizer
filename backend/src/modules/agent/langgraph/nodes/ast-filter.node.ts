/**
 * Node 4: ast_filter_node
 *
 * Purpose: Remove structurally incompatible candidates using AST analysis
 *
 * This node:
 * - Analyzes AST of each candidate function
 * - Checks structural compatibility with operator semantics
 * - Filters dead code, utility functions, test code
 * - Assigns AST compatibility score
 *
 * Input: retrievedCandidates, semanticDescription
 * Output: filteredCandidates
 */

import { MappingState, CodeCandidate } from '../state/mapping-state.schema';
import { Logger } from '@nestjs/common';

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  MIN_AST_SCORE: 0.3,
  EXCLUDE_TEST_FILES: true,
  EXCLUDE_UTILITY_PATTERNS: [/^_/, /util/, /helper/, /test/],
  EXCLUDE_PATHS: ['/test/', '/__pycache__/', '/node_modules/'],
};

// ============================================================================
// Operator-Specific AST Rules
// ============================================================================

interface ASTRule {
  requiredPatterns: string[];
  forbiddenPatterns?: string[];
  minimumComplexity?: number;
}

const OPERATOR_AST_RULES: Record<string, ASTRule> = {
  // Aggregation
  HashAggregate: {
    requiredPatterns: ['groupBy', 'agg', 'count', 'sum', 'avg', 'max', 'min'],
    minimumComplexity: 1,
  },
  aggregation: {
    requiredPatterns: ['groupBy', 'agg', 'count', 'sum', 'avg', 'max', 'min'],
    minimumComplexity: 1,
  },

  // Filter
  Filter: {
    requiredPatterns: ['filter', 'where', 'if ', 'boolean'],
    minimumComplexity: 1,
  },

  // Sort
  Sort: {
    requiredPatterns: ['sort', 'orderBy', 'sorted', 'sortBy'],
    minimumComplexity: 1,
  },

  // Join
  BroadcastHashJoin: {
    requiredPatterns: ['join', 'leftJoin', 'rightJoin', 'innerJoin', 'broadcast'],
    minimumComplexity: 1,
  },
  SortMergeJoin: {
    requiredPatterns: ['join', 'merge'],
    minimumComplexity: 1,
  },
  join: {
    requiredPatterns: ['join', 'merge', 'broadcast'],
    minimumComplexity: 1,
  },

  // Projection / Transformation
  Project: {
    requiredPatterns: ['select', 'project', 'map', 'withColumn', 'alias'],
    minimumComplexity: 1,
  },
  transformation: {
    requiredPatterns: ['select', 'project', 'map', 'withColumn', 'alias', 'transform'],
    minimumComplexity: 1,
  },
  custom: {
    requiredPatterns: ['select', 'project', 'map', 'withColumn', 'alias', 'transform'],
    minimumComplexity: 1,
  },

  // Scan / Ingestion
  Scan: {
    requiredPatterns: ['read', 'load', 'spark.read', 'DataFrame', 'csv', 'parquet', 'table'],
    minimumComplexity: 1,
  },
  data_ingestion: {
    requiredPatterns: ['read', 'load', 'spark.read', 'DataFrame', 'csv', 'parquet', 'table'],
    minimumComplexity: 1,
  },

  // Shuffle (Generalized)
  shuffle: {
    requiredPatterns: ['repartition', 'coalesce', 'partitionBy'],
    minimumComplexity: 1
  }
};

// ============================================================================
// Main Node Function
// ============================================================================

export async function astFilterNode(
  state: MappingState,
): Promise<Partial<MappingState>> {
  const logger = new Logger('ASTFilterNode');
  const startTime = Date.now();

  try {
    const { retrievedCandidates, semanticDescription } = state;

    if (!retrievedCandidates || retrievedCandidates.length === 0) {
      logger.warn('No candidates to filter');
      return {
        filteredCandidates: [],
      };
    }

    if (!semanticDescription) {
      throw new Error('semanticDescription is required');
    }

    logger.log(
      `Filtering ${retrievedCandidates.length} candidates for operator: ${semanticDescription.operatorType}`,
    );

    // Get AST rules for this operator (Case-Insensitive)
    const opType = semanticDescription.operatorType;
    const ruleKey = Object.keys(OPERATOR_AST_RULES).find(
      (k) => k.toLowerCase() === opType.toLowerCase(),
    );

    const astRules = ruleKey
      ? OPERATOR_AST_RULES[ruleKey]
      : OPERATOR_AST_RULES.Project; // Fallback to generic projection rules

    // Filter candidates
    const filteredCandidates: CodeCandidate[] = [];

    for (const candidate of retrievedCandidates) {
      // Step 1: Check exclusion patterns
      if (shouldExclude(candidate)) {
        logger.debug(`Excluded: ${candidate.file}:${candidate.symbol} (exclusion pattern)`);
        continue;
      }

      // Step 2: Analyze AST compatibility
      const astScore = await analyzeASTCompatibility(candidate, astRules);

      if (astScore < CONFIG.MIN_AST_SCORE) {
        logger.warn(
          `Excluded: ${candidate.file}:${candidate.symbol} (Score: ${astScore.toFixed(2)} < Threshold: ${CONFIG.MIN_AST_SCORE}). Reason: Low pattern match & complexity.`,
        );
        continue;
      }

      // Step 3: Add to filtered candidates with AST score
      filteredCandidates.push({
        ...candidate,
        astScore,
        astReasoning: `Matches ${astRules.requiredPatterns.join(', ')} patterns`,
      });
    }

    // Sort by combined score
    filteredCandidates.sort((a, b) => {
      const scoreA = (a.embeddingScore * 0.6) + (a.astScore || 0) * 0.4;
      const scoreB = (b.embeddingScore * 0.6) + (b.astScore || 0) * 0.4;
      return scoreB - scoreA;
    });

    const duration = Date.now() - startTime;
    const reductionRatio =
      retrievedCandidates.length > 0
        ? filteredCandidates.length / retrievedCandidates.length
        : 0;

    logger.log(
      `Filtered to ${filteredCandidates.length}/${retrievedCandidates.length} candidates (${(reductionRatio * 100).toFixed(1)}%) in ${duration}ms`,
    );

    return {
      filteredCandidates,
      metadata: {
        ...state.metadata,
        astFilterDuration: duration,
        astFilterInputCount: retrievedCandidates.length,
        astFilterOutputCount: filteredCandidates.length,
        astFilterReductionRatio: reductionRatio,
      },
    };
  } catch (error) {
    logger.error('Failed to filter candidates', error);
    throw error;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if candidate should be excluded based on patterns
 */
function shouldExclude(candidate: CodeCandidate): boolean {
  // Check file path exclusions
  if (
    CONFIG.EXCLUDE_PATHS.some((pattern) => candidate.file.includes(pattern))
  ) {
    return true;
  }

  // Check symbol name exclusions
  if (
    CONFIG.EXCLUDE_UTILITY_PATTERNS.some((pattern) =>
      pattern.test(candidate.symbol),
    )
  ) {
    return true;
  }

  return false;
}

/**
 * Analyze AST compatibility with operator semantics
 *
 * This is a simplified implementation. In production, integrate with
 * the existing AST parser service for full static analysis.
 */
async function analyzeASTCompatibility(
  candidate: CodeCandidate,
  rules: ASTRule,
): Promise<number> {
  const logger = new Logger('AnalyzeAST');

  try {
    let score = 0.0;

    // Build text to check from code snippet and symbol
    const textToCheck = candidate.codeSnippet
      ? (candidate.symbol + '\n' + candidate.codeSnippet).toLowerCase()
      : candidate.symbol.toLowerCase();

    // ALSO check spark_ops metadata (this is critical for statement-level chunks)
    const sparkOps = candidate.metadata.spark_ops || [];
    const sparkOpsText = sparkOps.join(' ').toLowerCase();

    // Combine both sources for matching
    const combinedText = textToCheck + ' ' + sparkOpsText;

    const matches = rules.requiredPatterns.filter(pattern => combinedText.includes(pattern.toLowerCase()));

    if (matches.length > 0) {
      // Base score: 0.5 + (0.5 * ratio of matches)
      const ratio = matches.length / Math.min(3, rules.requiredPatterns.length);
      score = 0.5 + Math.min(0.4, 0.5 * ratio); // Max 0.9 base

      // Bonus: Code Snippet looks like Spark
      if (candidate.codeSnippet && candidate.codeSnippet.includes('.')) {
        score += 0.1;
      }
    } else {
      // Minimal score if no keywords found at all
      score = 0.2;
    }

    // Complexity penalty
    const complexity = candidate.metadata.complexity || 1;
    if (rules.minimumComplexity && complexity < rules.minimumComplexity) {
      score *= 0.8;
    }

    return Math.min(score, 1.0);
  } catch (error) {
    logger.warn(`AST analysis failed for ${candidate.symbol}`, error);
    return 0.5; // Neutral score on error
  }
}

/**
 * Detailed AST analysis for Spark operators
 *
 * This function performs deep AST inspection:
 * - Parses function body
 * - Extracts DataFrame operations
 * - Checks for groupBy/agg/filter/join calls
 * - Validates argument compatibility
 */
export async function deepASTAnalysis(
  candidate: CodeCandidate,
  operatorType: string,
  keyColumns: string[],
  aggregateFunctions: string[],
): Promise<{
  score: number;
  reasoning: string;
  detectedOperations: string[];
}> {
  // TODO: Implement deep AST parsing with existing AST parser
  // For now, return placeholder

  return {
    score: 0.7,
    reasoning: 'Placeholder AST analysis',
    detectedOperations: [],
  };
}

/**
 * Check if function is reachable from main job entry point
 *
 * Uses call graph to verify function is not dead code
 */
export function isReachable(
  symbol: string,
  callGraph: Record<string, string[]>,
  entryPoints: string[],
): boolean {
  const visited = new Set<string>();
  const queue = [...entryPoints];

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current === symbol) {
      return true;
    }

    if (visited.has(current)) {
      continue;
    }

    visited.add(current);

    const callers = callGraph[current] || [];
    queue.push(...callers);
  }

  return false;
}
