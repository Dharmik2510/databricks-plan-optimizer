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
  MIN_SIMILARITY_THRESHOLD: 0.25, // Lowered to 0.25 to capture valid candidates (observed ~0.3)
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

    // Step 0: Check for Causal Attachment (Derived Nodes)
    if (semanticDescription.nodeClassification === 'DERIVED') {
      logger.log(`Node ${semanticDescription.dagNodeId} is DERIVED. Attempting causal attachment...`);
      const causalCandidate = attemptCausalAttachment(state, semanticDescription.dagNodeId);

      if (causalCandidate) {
        logger.log(`Causal attachment successful: ${causalCandidate.symbol}`);
        return {
          retrievedCandidates: [causalCandidate],
          metadata: {
            ...state.metadata,
            retrievalMethod: 'causal_attachment',
          },
        };
      }
      logger.warn('Causal attachment failed (no parent mapping found). Falling back to retrieval.');
    }

    // Step 1: Embed rich query text (not just signature)
    const richQuery = [
      `OPERATOR: ${semanticDescription.operatorType}`,
      semanticDescription.sparkOperatorSignature,
      semanticDescription.dataTransformation.keyColumns?.length ? `KEYS: ${semanticDescription.dataTransformation.keyColumns.join(",")}` : "",
      semanticDescription.dataTransformation.aggregateFunctions?.length ? `AGG: ${semanticDescription.dataTransformation.aggregateFunctions.join(",")}` : "",
    ].filter(Boolean).join("\n");

    const queryEmbedding = await embedSemanticDescription(richQuery);

    // Step 2: Build Filter
    const whereFilter = buildWhereFilter(semanticDescription);

    // Step 3: Query ChromaDB
    // Collection Name is now dynamic per snapshot
    const collectionName = repoContext.collectionName || process.env.CHROMA_COLLECTION_NAME || 'code_v2_text_embedding_3_small';

    // Ensure we have authentication and isolation context
    const tenantId = state.userId;
    const snapshotId = repoContext.snapshotId;

    if (!tenantId || !snapshotId) {
      // For legacy support or testing, warn but proceed if possible, OR fail strict.
      // Strict architecture: Fail.
      // throw new Error("Missing tenantId or snapshotId for retrieval");
      logger.warn(`Missing strict isolation context: tenantId=${tenantId}, snapshotId=${snapshotId}. Falling back to potentially unsafe query (legacy mode).`);
    }

    const candidates = await queryChromaDB(
      queryEmbedding,
      collectionName,
      CONFIG.RETRIEVAL_TOP_K,
      whereFilter,
      tenantId,
      snapshotId
    );

    // Step 4: Re-rank candidates
    const rerankedCandidates = rerankCandidates(candidates);

    // DEBUG: Log *all* retrieved candidates before filtering to diagnose scoring
    if (rerankedCandidates.length > 0) {
      logger.log('--- RETRIEVAL DEBUG ---');
      logger.log(
        rerankedCandidates.slice(0, 5).map(c => ({
          symbol: c.symbol,
          sim: c.embeddingScore.toFixed(3),
          dist: (c.metadata as any).distance,
          ops: (c.metadata as any).spark_ops
        }))
      );
      logger.log('-----------------------');
    }

    // Step 5: Filter by similarity threshold
    const filteredCandidates = rerankedCandidates.filter(
      (c) => c.embeddingScore >= CONFIG.MIN_SIMILARITY_THRESHOLD,
    );

    // Log top results for debugging
    logger.log(
      filteredCandidates.slice(0, 5).map(c => ({
        symbol: c.symbol,
        file: c.file,
        similarity: c.embeddingScore.toFixed(3),
        distance: (c.metadata as any).distance,
        spark_ops: (c.metadata as any).spark_ops
      }))
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
        totalTokens: estimateTokenCount(richQuery),
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

function buildWhereFilter(semanticDescription: any) {
  const op = (semanticDescription.operatorType || semanticDescription.sparkOperatorSignature || "").toLowerCase();

  // Map semantic operation types to spark_ops metadata filters
  if (op.includes("data_ingestion") || op.includes("scan")) {
    return { spark_ops: { $contains: "read" } }; // Match AST parser's 'read' operation type
  }
  if (op.includes("aggregation") || op.includes("hashaggregate") || op.includes("aggregate")) {
    return { spark_ops: { $contains: "agg" } }; // Match actual .agg() operations in DB
  }
  if (op.includes("join")) {
    return { spark_ops: { $contains: "join" } };
  }
  if (op.includes("filter")) {
    return { spark_ops: { $contains: "filter" } };
  }
  if (op.includes("sort")) {
    return { spark_ops: { $contains: "sort" } };
  }
  if (op.includes("transformation") || op.includes("project") || op.includes("select") || op.includes("custom")) {
    return { spark_ops: { $contains: "select" } };
  }

  return undefined;
}

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
  where?: Record<string, any>,
  tenantId?: string,
  snapshotId?: string
): Promise<CodeCandidate[]> {
  const logger = new Logger('QueryChromaDB');

  try {
    const chromaService = new ChromaDBCloudService();

    // Construct Strict Filter
    const isolationFilter: any[] = [];
    if (tenantId) isolationFilter.push({ tenant_id: { $eq: tenantId } });
    if (snapshotId) isolationFilter.push({ snapshot_id: { $eq: snapshotId } });

    // Merge with semantic `where` filter
    let finalWhere: Record<string, any> | undefined = undefined;

    if (isolationFilter.length > 0) {
      if (where) {
        // Chroma $and is top level list
        finalWhere = {
          $and: [
            ...isolationFilter,
            where
          ]
        };
      } else {
        finalWhere = { $and: isolationFilter };
      }
    } else {
      finalWhere = where;
    }

    const filterDesc = finalWhere ? JSON.stringify(finalWhere) : "none";
    logger.log(`Querying ChromaDB Cloud collection: ${collectionName} (top-${topK}, filter: ${filterDesc})`);

    const results = await chromaService.query(collectionName, queryEmbedding, topK, finalWhere);

    const candidates: CodeCandidate[] = results.map((result) => {
      // IMPORTANT:
      // - With hnsw:space="cosine", Chroma returns cosine distance.
      // - distance = 1 - cosine_similarity
      // - lower distance is better
      const distance = Number(result.distance ?? 1);

      // similarity in [0,1]
      const similarity = Math.max(0, 1 - distance);

      return {
        file: String(result.metadata?.file || 'unknown'),
        symbol: String(result.metadata?.symbol || 'unknown'),
        lines: String(result.metadata?.lines || '0-0'),
        embeddingScore: similarity,
        codeSnippet: String(result.metadata?.codeSnippet || result.document || ''),
        metadata: {
          type: (result.metadata?.type as 'function' | 'class' | 'method') || 'function',
          complexity: Number(result.metadata?.complexity || 0),
          callGraph: Array.isArray(result.metadata?.callGraph) ? result.metadata.callGraph.map(String) : [],
          codeSnippet: String(result.metadata?.codeSnippet || result.document || ''),
          // Keep distance and spark_ops for debugging
          distance,
          spark_ops: (String(result.metadata?.spark_ops || "")).split(",").filter(Boolean),
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

/**
 * Attempt to find a causal ancestor (parent node) that has a valid mapping.
 * Used for Derived nodes (Exchange, etc.) to inherit code context.
 */
function attemptCausalAttachment(state: MappingState, nodeId: string): CodeCandidate | null {
  // Find parents: nodes that have this node as a child
  const parents = state.dagNodes.filter(n => n.children?.includes(nodeId));

  if (parents.length === 0) return null;

  // Look for a parent that has a completed mapping
  for (const parent of parents) {
    const parentMapping = state.completedMappings.find(m => m.dagNodeId === parent.id);

    if (parentMapping && parentMapping.mappedCode) {
      // Create a candidate from the parent's mapping
      return {
        file: parentMapping.mappedCode.file,
        symbol: parentMapping.mappedCode.symbol,
        lines: parentMapping.mappedCode.lines,
        embeddingScore: 1.0, // Inherited certainty
        codeSnippet: parentMapping.mappedCode.codeSnippet || '',
        metadata: {
          type: 'function', // We assume function level for now
          complexity: 0,
          callGraph: [],
          codeSnippet: parentMapping.mappedCode.codeSnippet,
          distance: 0,
          spark_ops: ['causal_attachment']
        },
        astScore: 1.0,
        astReasoning: `Causally attached to parent node ${parent.id} (${parent.operator})`
      };
    }
  }

  return null;
}
