/**
 * Node 3: embedding_retrieval_node
 *
 * Purpose: Find code candidates using semantic similarity
 *
 * This node:
 * - Embeds semantic description using OpenAI
 * - Queries ChromaDB for similar code embeddings
 * - Returns top-K candidates
 * - Re-ranks by metadata (complexity, utility detection)
 *
 * Input: semanticDescription, repoContext
 * Output: retrievedCandidates
 */

import { MappingState, CodeCandidate } from '../state/mapping-state.schema';
import { Logger } from '@nestjs/common';
import { OpenAIEmbeddings } from '@langchain/openai';
import { ChromaDBCloudService } from '../../services/chromadb-cloud.service';

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  RETRIEVAL_TOP_K: parseInt(process.env.RETRIEVAL_TOP_K || '10', 10),
  EMBEDDING_MODEL: 'text-embedding-3-small',
  EMBEDDING_DIMENSIONS: 1536,
  MIN_SIMILARITY_THRESHOLD: 0.3,
  UTILITY_FUNCTION_PENALTY: 0.2,
  COMPLEXITY_BOOST_FACTOR: 0.1,
};

const UTILITY_PATTERNS = [
  /^_/,
  /util/i,
  /helper/i,
  /^log/i,
  /^print/i,
  /^get_logger/i,
  /^setup/i,
  /^init/i,
];

// ============================================================================
// Main Node Function
// ============================================================================

export async function embeddingRetrievalNode(
  state: MappingState,
): Promise<Partial<MappingState>> {
  const logger = new Logger('EmbeddingRetrievalNode');
  const startTime = Date.now();

  try {
    const { semanticDescription, repoContext } = state;

    if (!semanticDescription) {
      throw new Error('semanticDescription is required');
    }

    if (!repoContext) {
      throw new Error('repoContext is required');
    }

    logger.log(
      `Retrieving candidates for: ${semanticDescription.sparkOperatorSignature}`,
    );

    // Step 1: Embed semantic description
    const queryEmbedding = await embedSemanticDescription(
      semanticDescription.sparkOperatorSignature,
    );

    // Step 2: Query ChromaDB (use fixed collection name, not cache key)
    const collectionName = process.env.CHROMA_COLLECTION || 'codebase_functions';
    const candidates = await queryChromaDB(
      queryEmbedding,
      collectionName,
      CONFIG.RETRIEVAL_TOP_K,
    );

    // Step 3: Re-rank candidates
    const rerankedCandidates = rerankCandidates(candidates);

    // Step 4: Filter by similarity threshold
    const filteredCandidates = rerankedCandidates.filter(
      (c) => c.embeddingScore >= CONFIG.MIN_SIMILARITY_THRESHOLD,
    );

    const duration = Date.now() - startTime;
    logger.log(
      `Retrieved ${filteredCandidates.length}/${CONFIG.RETRIEVAL_TOP_K} candidates in ${duration}ms`,
    );

    return {
      retrievedCandidates: filteredCandidates,
      costTracking: {
        embeddingCalls: 1,
        llmCalls: 0,
        totalTokens: estimateTokenCount(semanticDescription.sparkOperatorSignature),
        estimatedCostUSD: 0.00002, // $0.02 per 1M tokens
      },
      metadata: {
        ...state.metadata,
        retrievalDuration: duration,
        retrievalCount: filteredCandidates.length,
      },
    };
  } catch (error) {
    logger.error('Failed to retrieve candidates', error);
    throw error;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Embed semantic description using OpenAI
 */
async function embedSemanticDescription(text: string): Promise<number[]> {
  const logger = new Logger('EmbedSemanticDescription');

  try {
    const embeddings = new OpenAIEmbeddings({
      modelName: CONFIG.EMBEDDING_MODEL,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    const result = await embeddings.embedQuery(text);
    logger.log(`Generated embedding vector (dim: ${result.length})`);

    return result;
  } catch (error) {
    logger.error('Embedding generation failed', error);
    throw new Error(`Failed to embed query: ${error.message}`);
  }
}

/**
 * Query ChromaDB Cloud for similar code embeddings
 */
async function queryChromaDB(
  queryEmbedding: number[],
  collectionName: string,
  topK: number,
): Promise<CodeCandidate[]> {
  const logger = new Logger('QueryChromaDB');

  try {
    const chromaService = new ChromaDBCloudService();
    logger.log(`Querying ChromaDB Cloud collection: ${collectionName} (top-${topK})`);

    const results = await chromaService.query(collectionName, queryEmbedding, topK);

    if (results.length > 0) {
      logger.log(`Raw score for top candidate: ${results[0].score}`);
    }

    const candidates: CodeCandidate[] = results.map((result) => {
      // ChromaDB defaults to Squared L2 distance
      // For normalized embeddings, range is [0, 4]
      // 0 = identical, 4 = opposite
      // We convert this to a similarity score [0, 1]
      // Formula: 1 - (l2_distance / 2)
      const rawScore = result.score;
      const similarity = Math.max(0, Math.min(1, 1 - (rawScore / 2)));

      return {
        file: String(result.metadata?.file || 'unknown'),
        symbol: String(result.metadata?.symbol || 'unknown'),
        lines: String(result.metadata?.lines || '0-0'),
        embeddingScore: similarity,
        metadata: {
          type: (result.metadata?.type as 'function' | 'class' | 'method') || 'function',
          complexity: Number(result.metadata?.complexity || 0),
          callGraph: Array.isArray(result.metadata?.callGraph) ? result.metadata.callGraph.map(String) : [],
        },
      };
    });

    logger.log(`Retrieved ${candidates.length} candidates from ChromaDB Cloud`);

    return candidates;
  } catch (error) {
    logger.error('ChromaDB query failed', error);
    if (error instanceof Error) {
      logger.error(`ChromaDB Error message: ${error.message}`);
      logger.error(`ChromaDB Error name: ${error.name}`);
      logger.error(`ChromaDB Error stack: ${error.stack}`);
    }
    throw new Error(`Failed to query ChromaDB collection '${collectionName}': ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Re-rank candidates by metadata
 *
 * Scoring formula:
 * finalScore = embeddingScore * (1 + complexityBoost - utilityPenalty)
 */
function rerankCandidates(candidates: CodeCandidate[]): CodeCandidate[] {
  const logger = new Logger('RerankCandidates');

  const reranked = candidates.map((candidate) => {
    let adjustedScore = candidate.embeddingScore;

    // Boost for higher complexity (likely business logic)
    if (candidate.metadata.complexity) {
      const complexityBoost =
        Math.min(candidate.metadata.complexity / 20, 1) *
        CONFIG.COMPLEXITY_BOOST_FACTOR;
      adjustedScore *= 1 + complexityBoost;
    }

    // Penalty for utility functions
    if (isUtilityFunction(candidate.symbol)) {
      adjustedScore *= 1 - CONFIG.UTILITY_FUNCTION_PENALTY;
      logger.debug(`Utility penalty applied to: ${candidate.symbol}`);
    }

    return {
      ...candidate,
      embeddingScore: adjustedScore,
    };
  });

  // Sort by adjusted score (descending)
  reranked.sort((a, b) => b.embeddingScore - a.embeddingScore);

  return reranked;
}

/**
 * Check if function name matches utility patterns
 */
function isUtilityFunction(symbolName: string): boolean {
  return UTILITY_PATTERNS.some((pattern) => pattern.test(symbolName));
}

/**
 * Estimate token count for cost tracking
 */
function estimateTokenCount(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}

/**
 * Batch embed multiple semantic descriptions (for parallel DAG processing)
 */
export async function batchEmbedDescriptions(
  descriptions: string[],
): Promise<number[][]> {
  const logger = new Logger('BatchEmbedDescriptions');

  try {
    const embeddings = new OpenAIEmbeddings({
      modelName: CONFIG.EMBEDDING_MODEL,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    const results = await embeddings.embedDocuments(descriptions);
    logger.log(`Batch embedded ${descriptions.length} descriptions`);

    return results;
  } catch (error) {
    logger.error('Batch embedding failed', error);
    throw new Error(`Failed to batch embed: ${error.message}`);
  }
}
