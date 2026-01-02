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
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { join, extname, relative } from 'path';
import { MappingState, RepoContext } from '../state/mapping-state.schema';
import { Logger } from '@nestjs/common';
import { OpenAIEmbeddings } from '@langchain/openai';
import { ChromaDBCloudService } from '../../services/chromadb-cloud.service';
import { ASTParserService } from '../../ast-parser.service';
import { SupportedLanguage } from '../../agent-types';
import { PrismaClient, IndexStatus, RepoSnapshot } from '@prisma/client';

const execAsync = promisify(exec);
// Use module-level Prisma client to reuse connections
const prisma = new PrismaClient();

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
  // New Versioning Config
  EMBEDDING_MODEL: 'text-embedding-3-small',
  SCHEMA_VERSION: 4, // Bumped to 4: Added .parquet(), .csv() read operation detection
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

    // Validate Required State
    if (!state.userId) {
      throw new Error('UserId is required for multi-tenant repo mapping');
    }

    // --- 1. Resolve Repository and Snapshot in Postgres ---
    const { repository, snapshot } = await resolveRepoAndSnapshot(
      state.userId,
      state.repoUrl,
      state.repoCommitHash,
      logger
    );

    logger.log(`Resolved Snapshot: ${snapshot.id} (Status: ${snapshot.status})`);

    // --- 2. Check if Snapshot is already indexed ---
    if (snapshot.status === IndexStatus.ACTIVE) {
      logger.log(`Snapshot ${snapshot.id} is already ACTIVE. Reusing...`);

      // Update lastUsedAt
      await prisma.repoSnapshot.update({
        where: { id: snapshot.id },
        data: { lastUsedAt: new Date() }
      });

      const repoContext: RepoContext = {
        clonePath: '', // Not needed for retrieval-only flows, but might be needed if we need source code
        commitHash: snapshot.commitHash,
        cacheKey: snapshot.id,
        repoId: repository.id,
        snapshotId: snapshot.id,
        collectionName: snapshot.collectionName,
        fileCount: 0, // Could store this in DB to populate correct stats
        embeddingsGenerated: 0,
        astIndexSize: 0,
        timestamp: snapshot.createdAt.toISOString(),
      };

      return {
        repoContext,
        metadata: {
          ...state.metadata,
          repoLoadSkipped: true,
          snapshotId: snapshot.id
        },
      };
    }

    // --- 3. Indexing Logic (Clone -> Parse -> Embed) ---
    // If we are here, we need to perform indexing (or resume it)

    // Update status to INDEXING
    await prisma.repoSnapshot.update({
      where: { id: snapshot.id },
      data: { status: IndexStatus.INDEXING }
    });

    // Step 3a: Clone repository
    logger.log('Cloning repository...');
    const cloneResult = await cloneRepository(
      state.repoUrl,
      snapshot.commitHash, // Use the specific hash from snapshot
      state.githubToken,
    );

    // Step 3b: Parse AST
    logger.log('Parsing AST...');
    const astResult = await parseAST(cloneResult.clonePath);

    // Step 3c: Embed and Store
    const collectionName = snapshot.collectionName;
    const shouldGenerateEmbeddings = process.env.SKIP_EMBEDDING_GENERATION !== 'true';

    let embeddingsGenerated = 0;
    if (shouldGenerateEmbeddings && astResult.symbolCount > 0) {
      logger.log(`Generating embeddings for snapshot ${snapshot.id}...`);
      const res = await generateEmbeddings(
        astResult.astIndex,
        collectionName,
        state.userId,
        repository.id,
        snapshot.id
      );
      embeddingsGenerated = res.embeddingsGenerated;
    } else {
      logger.log(`Skipping embedding generation (SKIP=${!shouldGenerateEmbeddings}, syms=${astResult.symbolCount})`);
    }

    // Step 3d: Mark as ACTIVE
    logger.log(`Indexing complete. Marking snapshot ${snapshot.id} as ACTIVE.`);
    await prisma.repoSnapshot.update({
      where: { id: snapshot.id },
      data: {
        status: IndexStatus.ACTIVE,
        indexedAt: new Date(),
      }
    });

    // Step 4: Build Context
    const repoContext: RepoContext = {
      clonePath: cloneResult.clonePath,
      commitHash: snapshot.commitHash,
      cacheKey: snapshot.id,
      repoId: repository.id,
      snapshotId: snapshot.id,
      collectionName: snapshot.collectionName,
      fileCount: astResult.fileCount,
      embeddingsGenerated: embeddingsGenerated,
      astIndexSize: astResult.symbolCount,
      timestamp: new Date().toISOString(),
    };

    const duration = Date.now() - startTime;
    logger.log(`Repo context loaded and indexed in ${duration}ms`);

    return {
      repoContext,
      metadata: {
        ...state.metadata,
        repoLoadDuration: duration,
        repoLoadCached: false,
        snapshotId: snapshot.id
      },
      repoCommitHash: snapshot.commitHash // Ensure state has the precise hash
    };

  } catch (error) {
    logger.error('Failed to load repo context', error);
    if (error instanceof Error) {
      // If snapshot exists, mark as FAILED
      // (We might need to pass snapshot id down or handle it better, but strict types make this hard here without complex try/catch block placement)

      // Try to mark failed if we can find the snapshot ID effectively?
      // For now just throw.
    }
    throw error;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Resolve DB entities for Repo and Snapshot
 */
async function resolveRepoAndSnapshot(
  userId: string,
  repoUrl: string,
  commitHash: string | null,
  logger: Logger
) {
  // 1. Find or Create Repository
  let repo = await prisma.repository.findFirst({
    where: { userId, url: repoUrl }
  });

  if (!repo) {
    logger.log(`Creating new repository entry for ${repoUrl}`);
    const name = repoUrl.split('/').pop()?.replace('.git', '') || 'repo';
    repo = await prisma.repository.create({
      data: {
        userId,
        url: repoUrl,
        name: name
      }
    });
  }

  // 2. Determine Commit Hash (if not provided, fetch remote HEAD)
  let targetHash = commitHash;
  if (!targetHash) {
    logger.log(`No commit hash provided, resolving remote HEAD for ${repoUrl}...`);
    targetHash = await getRemoteHeadHash(repoUrl);
  }

  // 3. Resolve Collection Name (Versioned)
  // Format: code_v1_{model_name}_{sanitized_suffix}
  // e.g., code_v1_openai_text_3_small
  // User Override: If CHROMA_COLLECTION_NAME is set in .env, use that (Monolith mode)
  let collectionName = process.env.CHROMA_COLLECTION_NAME;

  if (!collectionName) {
    const modelSanitized = CONFIG.EMBEDDING_MODEL.replace(/[^a-zA-Z0-9]/g, '_');
    collectionName = `code_v${CONFIG.SCHEMA_VERSION}_${modelSanitized}`;
  }

  // 4. Find or Create Snapshot
  let snapshot = await prisma.repoSnapshot.findFirst({
    where: {
      repoId: repo.id,
      commitHash: targetHash,
      collectionName: collectionName // Ensure we match the correct index version!
    }
  });

  if (!snapshot) {
    logger.log(`Creating new pending snapshot for ${targetHash}`);
    snapshot = await prisma.repoSnapshot.create({
      data: {
        repoId: repo.id,
        commitHash: targetHash!,
        branch: 'main', // TODO: detect branch if possible or pass in state
        collectionName: collectionName,
        embeddingModel: CONFIG.EMBEDDING_MODEL,
        schemaVersion: CONFIG.SCHEMA_VERSION,
        status: IndexStatus.PENDING,
      }
    });
  }

  return { repository: repo, snapshot };
}

async function getRemoteHeadHash(repoAuthUrl: string): Promise<string> {
  const { stdout } = await execAsync(`git ls-remote "${repoAuthUrl}" HEAD`);
  const hash = stdout.split('\t')[0];
  if (!hash || hash.length < 40) {
    throw new Error('Failed to resolve remote HEAD hash');
  }
  return hash;
}

/**
 * Clone repository to local filesystem
 */
async function cloneRepository(
  repoUrl: string,
  commitHash: string,
  githubToken: string | null,
): Promise<CloneResult> {
  const logger = new Logger('CloneRepository');

  // Ensure clone directory exists
  if (!existsSync(CONFIG.CLONE_DIR)) {
    mkdirSync(CONFIG.CLONE_DIR, { recursive: true });
  }

  // Generate unique directory for this clone
  // Using commit hash in path prevents collisions
  const repoName = repoUrl.split('/').pop()?.replace('.git', '') || 'repo';
  const clonePath = join(CONFIG.CLONE_DIR, `${repoName}_${commitHash}`);

  try {
    // If it already exists, assume it's good (cache dir)
    if (existsSync(clonePath)) {
      logger.log(`Clone directory exists: ${clonePath}`);
      return { clonePath, commitHash };
    }

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
      timeout: 300000,
    });

    // Checkout specific commit
    logger.log(`Checking out commit ${commitHash}`);
    await execAsync(`git fetch origin ${commitHash} && git checkout ${commitHash}`, {
      cwd: clonePath,
    }).catch(async () => {
      // Fallback if fetch by hash fails (some servers deny)
      // Try checking out if it was the default branch
      logger.warn(`Direct fetch of hash failed. Trying simple checkout...`);
    });

    return {
      clonePath,
      commitHash,
    };
  } catch (error) {
    logger.error('Git clone failed', error);
    throw new Error(`Failed to clone repository: ${error.message}`);
  }
}

/**
 * Detect language from file extension
 */
function detectLanguage(filePath: string): SupportedLanguage {
  const ext = extname(filePath).toLowerCase();
  const extMap: Record<string, SupportedLanguage> = {
    '.py': 'python',
    '.scala': 'scala',
    '.java': 'java',
    '.sql': 'sql',
  };
  return extMap[ext] || 'python';
}

/**
 * Parse AST for all supported source files using production AST parser
 */
async function parseAST(repoPath: string): Promise<ASTParseResult> {
  const logger = new Logger('ParseAST');

  try {
    // Find all supported source files
    const findCommand = `find "${repoPath}" -type f \\( ${CONFIG.SUPPORTED_EXTENSIONS.map((ext) => `-name "*${ext}"`).join(' -o ')} \\) -size -${CONFIG.MAX_FILE_SIZE_BYTES}c`;

    const { stdout } = await execAsync(findCommand);
    const filePaths = stdout
      .trim()
      .split('\n')
      .filter((f) => f && !f.includes('/test/') && !f.includes('/__pycache__/'));

    logger.log(`Found ${filePaths.length} source files to parse`);

    // Initialize AST parser service
    const astParser = new ASTParserService();

    // Parse all files and extract symbols
    const parsedFiles = [];
    let totalSymbols = 0;

    for (const filePath of filePaths) {
      try {
        // Read file content
        const content = readFileSync(filePath, 'utf-8');
        const language = detectLanguage(filePath);

        // Parse with production AST parser
        const analysis = astParser.parseFile(content, language, filePath);

        // Extract symbols (functions and classes)
        const lines = content.split('\n');

        // Extract symbols (functions and classes)
        const symbols = [
          ...analysis.functions.map((f) => {
            // correlate spark ops - prefer pre-calculated transformations if available
            const transformations = f.sparkTransformations || [];

            const sparkOps = transformations.length > 0
              ? transformations.map(t => t.type)
              : analysis.dataOperations
                .filter(op => op.line >= f.startLine && op.line <= f.endLine)
                .map(op => op.type);

            // Extract columns from transformations
            const columns = transformations
              .flatMap(t => t.columns || [])
              .filter((c, i, arr) => arr.indexOf(c) === i); // dedupe

            // extract body
            const startLine = Math.max(0, f.startLine - 1);
            const endLine = Math.min(lines.length, f.endLine);
            const codeSnippet = lines.slice(startLine, endLine).join('\n');

            return {
              name: f.name,
              type: 'function' as const,
              signature: `${f.name}(${f.parameters.map(p => p.name).join(', ')})`,
              docstring: f.docstring || '',
              startLine: f.startLine,
              endLine: f.endLine,
              complexity: f.complexity || 1,
              sparkOps: sparkOps,
              columns: columns,
              codeSnippet: codeSnippet,
            };
          }),
          ...analysis.classes.map((c) => {
            // extract body
            const startLine = Math.max(0, c.startLine - 1);
            const endLine = Math.min(lines.length, c.endLine);
            const codeSnippet = lines.slice(startLine, endLine).join('\n');

            return {
              name: c.name,
              type: 'class' as const,
              signature: c.name,
              docstring: '',
              startLine: c.startLine,
              endLine: c.endLine,
              complexity: 1,
              sparkOps: [],
              codeSnippet: codeSnippet,
            };
          }),
        ];

        parsedFiles.push({
          path: filePath,
          symbols,
          chunks: analysis.codeChunks || [],
        });

        totalSymbols += symbols.length;
      } catch (parseError: any) {
        logger.warn(`Failed to parse ${filePath}: ${parseError.message}`);
        parsedFiles.push({
          path: filePath,
          symbols: [],
        });
      }
    }

    logger.log(`Successfully parsed ${totalSymbols} symbols from ${filePaths.length} files`);

    const astIndex = {
      files: parsedFiles,
      repoRoot: repoPath, // Essential for stable relative pathing
    };

    return {
      fileCount: filePaths.length,
      symbolCount: totalSymbols,
      astIndex,
    };
  } catch (error: any) {
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
  tenantId: string,
  repoId: string,
  snapshotId: string
): Promise<EmbeddingResult> {
  const logger = new Logger("GenerateEmbeddings");

  const chromaService = new ChromaDBCloudService();
  const embedder = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: CONFIG.EMBEDDING_MODEL,
  });

  // Create or Get Collection
  await chromaService.createCollection(collectionName, {
    metadata: { "hnsw:space": "cosine" },
  });

  // --- 1) Build candidates ---
  const candidates: Array<{
    id: string;
    text: string;
    metadata: Record<string, any>;
  }> = [];

  const seen = new Set<string>();
  const repoRoot = astIndex?.repoRoot || "";

  for (const file of astIndex.files || []) {
    const filePath: string = file.path || "";
    const relFile = repoRoot ? relative(repoRoot, filePath) : filePath;

    const chunks = file.chunks || [];
    const symbols = file.symbols || [];

    for (const chunk of chunks) {
      // Deterministic ID: v{ver}_{snapshot}_{fileHash}_{chunkHash}
      const fileHash = createHash("md5").update(relFile).digest("hex").slice(0, 12);
      // chunk.id is typically "func:name:line" or "stmt:line"
      const chunkHash = createHash("md5").update(chunk.id).digest("hex").slice(0, 8);

      const id = `v${CONFIG.SCHEMA_VERSION}_${snapshotId}_${fileHash}_${chunkHash}`;

      if (seen.has(id)) continue;
      seen.add(id);

      // Resolve Parent Symbol for Context
      const parentSymbol = symbols.find((s: any) => s.name === chunk.parentSymbol);

      const text = buildEmbeddingDocument({
        file: relFile,
        symbolName: chunk.parentSymbol || 'global',
        symbolType: parentSymbol?.type || 'logic',
        chunkType: chunk.type,
        signature: parentSymbol?.signature,
        docstring: parentSymbol?.docstring,
        codeSnippet: chunk.content, // Actual code content
        sparkOps: chunk.sparkOps,
        columns: parentSymbol?.columns || [],
        sources: parentSymbol?.sources || [],
        sinks: parentSymbol?.sinks || [],
      });

      if (!text || text.length < 50) continue;

      candidates.push({
        id,
        text,
        metadata: {
          // --- STRICT ISOLATION FIELDS ---
          tenant_id: tenantId,
          repo_id: repoId,
          snapshot_id: snapshotId,

          // --- Content Fields ---
          file: relFile,
          symbol: chunk.parentSymbol || 'global',
          lines: `${chunk.startLine}-${chunk.endLine}`,
          type: parentSymbol?.type || 'statement',
          chunk_type: chunk.type,
          parent_symbol: chunk.parentSymbol,
          complexity: parentSymbol?.complexity || 1,

          // Truncate snippet for metadata
          codeSnippet: chunk.content.slice(0, 2000),

          // Arrays as strings for filtering
          spark_ops: (chunk.sparkOps || [])
            .map((s: any) => String(s).toLowerCase().trim())
            .slice(0, 20)
            .join(","),

          columns: (parentSymbol?.columns || [])
            .map((s: any) => String(s).toLowerCase().trim())
            .slice(0, 50)
            .join(","),

          active: true,
          created_at: Date.now(),
          embedding_model: CONFIG.EMBEDDING_MODEL
        },
      });
    }
  }

  if (candidates.length === 0) {
    logger.warn("No embed-worthy code symbols found.");
    return { embeddingsGenerated: 0, collectionName };
  }

  logger.log(`Embedding ${candidates.length} unique code symbols for snapshot ${snapshotId}...`);

  // --- 2) Embed + upsert in batches ---
  const BATCH_SIZE = CONFIG.EMBEDDING_BATCH_SIZE;
  let total = 0;

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    const docs = batch.map((b) => b.text);

    try {
      const vectors = await embedder.embedDocuments(docs);

      await chromaService.addEmbeddings(
        collectionName,
        vectors,
        batch.map((b) => b.metadata),
        batch.map((b) => b.id),
        batch.map((b) => b.text),
      );

      total += batch.length;
      logger.log(`Embedded ${total}/${candidates.length} snippets`);
    } catch (embError) {
      logger.error(`Batch embedding failed`, embError);
      throw embError;
    }
  }

  return { embeddingsGenerated: total, collectionName };
}

export async function cleanupRepo(clonePath: string): Promise<void> {
  const logger = new Logger('CleanupRepo');

  try {
    await execAsync(`rm -rf "${clonePath}"`);
    logger.log(`Cleaned up ${clonePath}`);
  } catch (error) {
    logger.warn(`Failed to cleanup ${clonePath}`, error);
  }
}

function shouldIndexSymbol(symbol: any): boolean {
  const name = (symbol?.name || "").toLowerCase();
  const type = (symbol?.type || "function").toLowerCase();

  if (!["function", "method"].includes(type)) return false;

  const skipNames = new Set([
    "main", "init", "__init__", "create_spark_session", "get_spark_session"
  ]);
  if (skipNames.has(name)) return false;
  if (symbol?.isTest === true || symbol?.isUtility === true) return false;

  const sparkOps: string[] = symbol?.sparkOps || symbol?.spark_ops || [];
  if (sparkOps.length > 0) return true;

  const code = (symbol?.codeSnippet || symbol?.code || "").toLowerCase();
  const hasSparkKeywords = [
    "spark.read", "spark.sql", "select(", "where(", "filter(",
    "groupby(", "agg(", "join(", "readstream", "writestream",
    "withcolumn(", "drop(", "orderby(", "sort(", "distinct(",
    "limit(", "union(", "alias(", "transform("
  ].some(k => code.includes(k));

  return hasSparkKeywords;
}

function chunkSymbolByOperations(symbol: any, relFile: string): Array<{
  idSuffix: string;
  lines: string;
  type: string;
  sparkOps: string[];
  codeSnippet: string;
}> {
  const fullCode = symbol.codeSnippet || symbol.code || "";
  const lines = fullCode.split('\n');
  const baseStartLine = symbol.startLine || 0;

  // Always emit whole chunk
  const chunks: any[] = [{
    idSuffix: `${symbol.name}_whole`,
    lines: `${baseStartLine}-${symbol.endLine}`,
    type: 'whole',
    sparkOps: symbol.sparkOps || [],
    codeSnippet: fullCode
  }];

  if (symbol.sparkTransformations && symbol.sparkTransformations.length > 0) {
    let subIndex = 0;
    for (const trans of symbol.sparkTransformations) {
      if (!trans.startLine || !trans.endLine) continue;
      if (trans.startLine < baseStartLine || trans.endLine > symbol.endLine) continue;

      const localStart = trans.startLine - baseStartLine;
      const localEnd = trans.endLine - baseStartLine + 1;

      const opSnippet = lines.slice(Math.max(0, localStart), Math.min(lines.length, localEnd)).join('\n');

      if (opSnippet.length < 5) continue;

      chunks.push({
        idSuffix: `${symbol.name}_op_${subIndex++}_${trans.type}`,
        lines: `${trans.startLine}-${trans.endLine}`,
        type: trans.type,
        sparkOps: [trans.type],
        codeSnippet: opSnippet
      });
    }
  }

  return chunks;
}

function buildEmbeddingDocument(input: any): string {
  const sparkOps = (input.sparkOps || []).map(String).filter(Boolean);
  const cols = (input.columns || []).map(String).filter(Boolean);

  // Keep snippet short to control token/embedding noise
  const snippet = (input.codeSnippet || "").trim();
  const snippetTrimmed = snippet.length > 2500 ? snippet.slice(0, 2500) + "\n# ...trimmed" : snippet;

  return [
    `ROLE: Spark code transformation`,
    `FILE: ${input.file}`,
    `SYMBOL: ${input.symbolName} (${input.symbolType})`,
    input.chunkType ? `CHUNK: ${input.chunkType}` : null,
    input.signature ? `SIGNATURE: ${input.signature}` : null,
    input.docstring ? `DOC: ${sanitize(input.docstring)}` : null,
    sparkOps.length ? `SPARK_OPS: ${sparkOps.join(", ")}` : null,
    cols.length ? `COLUMNS: ${cols.slice(0, 50).join(", ")}` : null,
    snippetTrimmed ? `CODE:\n${snippetTrimmed}` : null,
  ].filter(Boolean).join("\n");
}

function sanitize(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}
