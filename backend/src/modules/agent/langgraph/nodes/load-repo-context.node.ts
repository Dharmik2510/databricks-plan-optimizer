/**
 * Node 1: load_repo_context
 *
 * Purpose: Clone repository, parse AST, generate embeddings, store in ChromaDB
 *
 * This node:
 * - Clones GitHub repository (public or private)
 * - Runs AST parsing on all source files
 * - Generates embeddings for code symbols
 * - Stores embeddings in ChromaDB
 * - Caches results per repo hash
 *
 * Idempotent: Checks cache before processing
 */

import { createHash } from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { MappingState, RepoContext } from '../state/mapping-state.schema';
import { Logger } from '@nestjs/common';
import { OpenAIEmbeddings } from '@langchain/openai';
import { ChromaDBCloudService } from '../../services/chromadb-cloud.service';

const execAsync = promisify(exec);

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  CLONE_DIR: process.env.REPO_CLONE_DIR || '/tmp/code-mapping-repos',
  CACHE_TTL_SECONDS: parseInt(process.env.REPO_CACHE_TTL || '604800', 10), // 7 days
  SUPPORTED_EXTENSIONS: ['.py', '.scala', '.java', '.sql'],
  MAX_FILE_SIZE_BYTES: 1024 * 1024, // 1MB
  EMBEDDING_BATCH_SIZE: 100,
  MAX_PARALLEL_EMBEDS: 5,
};

// ============================================================================
// Types
// ============================================================================

interface CloneResult {
  clonePath: string;
  commitHash: string;
}

interface ASTParseResult {
  fileCount: number;
  symbolCount: number;
  astIndex: any;
}

interface EmbeddingResult {
  embeddingsGenerated: number;
  collectionName: string;
}

// ============================================================================
// Main Node Function
// ============================================================================

export async function loadRepoContextNode(
  state: MappingState,
): Promise<Partial<MappingState>> {
  const logger = new Logger('LoadRepoContextNode');
  const startTime = Date.now();

  try {
    logger.log(`Starting repo context load for ${state.repoUrl}`);

    // Step 1: Check cache
    const cacheKey = generateCacheKey(state.repoUrl, state.repoCommitHash);
    const cachedContext = await checkCache(cacheKey);

    if (cachedContext) {
      logger.log(`Cache hit for ${cacheKey}`);
      return {
        repoContext: cachedContext,
        metadata: {
          ...state.metadata,
          repoLoadCached: true,
        },
      };
    }

    // Step 2: Clone repository
    logger.log('Cloning repository...');
    const cloneResult = await cloneRepository(
      state.repoUrl,
      state.repoCommitHash,
      state.githubToken,
    );

    // Step 3: Parse AST
    logger.log('Parsing AST...');
    const astResult = await parseAST(cloneResult.clonePath);

    // Step 4: Verify ChromaDB collection exists (skip embedding generation if collection already populated)
    logger.log('Verifying ChromaDB collection...');
    const collectionName = process.env.CHROMA_COLLECTION || 'codebase_functions';

    // Check if we should generate embeddings or use existing ones
    const shouldGenerateEmbeddings = process.env.SKIP_EMBEDDING_GENERATION !== 'true';

    let embeddingResult: EmbeddingResult;
    if (shouldGenerateEmbeddings && astResult.symbolCount > 0) {
      logger.log('Generating embeddings for parsed symbols...');
      embeddingResult = await generateEmbeddings(
        astResult.astIndex,
        collectionName,
      );
    } else {
      logger.log(`Skipping embedding generation - using existing collection: ${collectionName}`);
      embeddingResult = {
        embeddingsGenerated: 0,
        collectionName,
      };
    }

    // Step 5: Build repo context
    const repoContext: RepoContext = {
      clonePath: cloneResult.clonePath,
      commitHash: cloneResult.commitHash,
      cacheKey,
      fileCount: astResult.fileCount,
      embeddingsGenerated: embeddingResult.embeddingsGenerated,
      astIndexSize: astResult.symbolCount,
      timestamp: new Date().toISOString(),
    };

    // Step 6: Cache result
    await cacheRepoContext(cacheKey, repoContext);

    const duration = Date.now() - startTime;
    logger.log(`Repo context loaded in ${duration}ms`);

    return {
      repoContext,
      metadata: {
        ...state.metadata,
        repoLoadDuration: duration,
        repoLoadCached: false,
      },
    };
  } catch (error) {
    logger.error('Failed to load repo context', error);
    throw error;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate deterministic cache key from repo URL and commit
 */
function generateCacheKey(repoUrl: string, commitHash: string | null): string {
  const input = `${repoUrl}:${commitHash || 'HEAD'}`;
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Check if repo context exists in cache
 */
async function checkCache(cacheKey: string): Promise<RepoContext | null> {
  // TODO: Implement Redis cache lookup
  // For now, return null (always miss)
  return null;
}

/**
 * Clone repository to local filesystem
 */
async function cloneRepository(
  repoUrl: string,
  commitHash: string | null,
  githubToken: string | null,
): Promise<CloneResult> {
  const logger = new Logger('CloneRepository');

  // Ensure clone directory exists
  if (!existsSync(CONFIG.CLONE_DIR)) {
    mkdirSync(CONFIG.CLONE_DIR, { recursive: true });
  }

  // Generate unique directory for this clone
  const repoName = repoUrl.split('/').pop()?.replace('.git', '') || 'repo';
  const timestamp = Date.now();
  const clonePath = join(CONFIG.CLONE_DIR, `${repoName}_${timestamp}`);

  try {
    // Build clone URL with auth if needed
    let authUrl = repoUrl;
    if (githubToken) {
      authUrl = repoUrl.replace(
        'https://',
        `https://x-access-token:${githubToken}@`,
      );
    }

    // Clone repository
    logger.log(`Cloning ${repoUrl} to ${clonePath}`);
    await execAsync(`git clone --depth 1 "${authUrl}" "${clonePath}"`, {
      timeout: 300000, // 5 minutes
    });

    // Checkout specific commit if provided
    let actualCommitHash: string;
    if (commitHash) {
      logger.log(`Checking out commit ${commitHash}`);
      await execAsync(`git checkout ${commitHash}`, {
        cwd: clonePath,
      });
      actualCommitHash = commitHash;
    } else {
      // Get HEAD commit hash
      const { stdout } = await execAsync('git rev-parse HEAD', {
        cwd: clonePath,
      });
      actualCommitHash = stdout.trim();
    }

    logger.log(`Repository cloned successfully at ${actualCommitHash}`);

    return {
      clonePath,
      commitHash: actualCommitHash,
    };
  } catch (error) {
    logger.error('Git clone failed', error);
    throw new Error(`Failed to clone repository: ${error.message}`);
  }
}

/**
 * Parse AST for all supported source files
 */
async function parseAST(repoPath: string): Promise<ASTParseResult> {
  const logger = new Logger('ParseAST');

  try {
    // Find all supported source files
    const extensions = CONFIG.SUPPORTED_EXTENSIONS.join(',');
    const findCommand = `find "${repoPath}" -type f \\( ${CONFIG.SUPPORTED_EXTENSIONS.map((ext) => `-name "*${ext}"`).join(' -o ')} \\) -size -${CONFIG.MAX_FILE_SIZE_BYTES}c`;

    const { stdout } = await execAsync(findCommand);
    const files = stdout
      .trim()
      .split('\n')
      .filter((f) => f && !f.includes('/test/') && !f.includes('/__pycache__/'));

    logger.log(`Found ${files.length} source files to parse`);

    // TODO: Integrate with existing AST parser service
    // For now, create mock AST index
    const astIndex = {
      files: files.map((file) => ({
        path: file,
        symbols: [],
      })),
    };

    return {
      fileCount: files.length,
      symbolCount: 0, // Populated by actual AST parser
      astIndex,
    };
  } catch (error) {
    logger.error('AST parsing failed', error);
    throw new Error(`Failed to parse AST: ${error.message}`);
  }
}

/**
 * Generate embeddings for code symbols and store in ChromaDB Cloud
 */
async function generateEmbeddings(
  astIndex: any,
  collectionName: string,
): Promise<EmbeddingResult> {
  const logger = new Logger('GenerateEmbeddings');

  try {
    const chromaService = new ChromaDBCloudService();
    const embedder = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'text-embedding-3-small',
    });

    // Create collection in ChromaDB Cloud
    await chromaService.createCollection(collectionName);

    // Extract code snippets from AST
    const codeSnippets = astIndex.files.flatMap((file: any) =>
      file.symbols.map((symbol: any) => ({
        id: `${file.path}:${symbol.name}`,
        text: `${symbol.signature || ''} ${symbol.docstring || ''}`.trim(),
        metadata: {
          file: file.path,
          symbol: symbol.name,
          lines: `${symbol.startLine || 0}-${symbol.endLine || 0}`,
          type: symbol.type || 'function',
          complexity: symbol.complexity || 0,
        },
      })),
    );

    if (codeSnippets.length === 0) {
      logger.warn('No code snippets to embed');
      return {
        embeddingsGenerated: 0,
        collectionName,
      };
    }

    logger.log(`Embedding ${codeSnippets.length} code snippets...`);

    // Batch embed (100 at a time)
    const BATCH_SIZE = CONFIG.EMBEDDING_BATCH_SIZE;
    let totalEmbedded = 0;

    for (let i = 0; i < codeSnippets.length; i += BATCH_SIZE) {
      const batch = codeSnippets.slice(i, i + BATCH_SIZE);
      const texts = batch.map((s: any) => s.text);

      // Generate embeddings
      const embeddings = await embedder.embedDocuments(texts);

      // Store in ChromaDB Cloud
      await chromaService.addEmbeddings(
        collectionName,
        embeddings,
        batch.map((s: any) => s.metadata),
        batch.map((s: any) => s.id),
      );

      totalEmbedded += batch.length;
      logger.log(`Embedded ${totalEmbedded}/${codeSnippets.length} snippets`);
    }

    logger.log(`Successfully embedded ${totalEmbedded} code snippets`);

    return {
      embeddingsGenerated: totalEmbedded,
      collectionName,
    };
  } catch (error) {
    logger.error('Embedding generation failed', error);
    if (error instanceof Error) {
      logger.error(`ChromaDB Error message: ${error.message}`);
      logger.error(`ChromaDB Error name: ${error.name}`);
    }
    throw new Error(`Failed to generate embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Cache repo context in Redis
 */
async function cacheRepoContext(
  cacheKey: string,
  context: RepoContext,
): Promise<void> {
  const logger = new Logger('CacheRepoContext');

  try {
    // TODO: Implement Redis cache storage
    logger.log(`Caching repo context with key ${cacheKey}`);
  } catch (error) {
    logger.warn('Failed to cache repo context', error);
    // Non-fatal: continue without caching
  }
}

/**
 * Cleanup cloned repository
 */
export async function cleanupRepo(clonePath: string): Promise<void> {
  const logger = new Logger('CleanupRepo');

  try {
    await execAsync(`rm -rf "${clonePath}"`);
    logger.log(`Cleaned up ${clonePath}`);
  } catch (error) {
    logger.warn(`Failed to cleanup ${clonePath}`, error);
  }
}
