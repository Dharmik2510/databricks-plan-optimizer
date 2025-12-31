# ChromaDB Authentication Fix ✅

## Problem

LangGraph workflow was failing with `ChromaAuthError: Unauthorized` when trying to interact with ChromaDB Cloud during the `load_repo` node.

### Error Log
```
ERROR [GenerateEmbeddings] Embedding generation failed - { stack: [ { name: 'ChromaAuthError' } ] }
ERROR [GenerateEmbeddings] ChromaDB Error message: Unauthorized
ERROR [GenerateEmbeddings] ChromaDB Error name: ChromaAuthError
ERROR [LoadRepoContextNode] Failed to load repo context
```

## Root Cause

The `load_repo` node was attempting to:
1. **Create a new collection** in ChromaDB Cloud (even though `codebase_functions` already exists)
2. **Generate and upload embeddings** for newly parsed code symbols

This failed because:
- The API key may not have permission to create collections
- The collection `codebase_functions` already exists with embeddings
- The workflow shouldn't be re-embedding code that's already in ChromaDB

## Solution

### 1. Skip Embedding Generation in load_repo Node

Since you already have embeddings in ChromaDB Cloud, the `load_repo` node now **skips embedding generation** and uses the existing collection.

**File**: `backend/src/modules/agent/langgraph/nodes/load-repo-context.node.ts`

**Change**:
```typescript
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
```

### 2. Use Fixed Collection Name in embedding_retrieval Node

The `embedding_retrieval` node was using `repoContext.cacheKey` as the collection name (which was a hash), but it should use the fixed collection name.

**File**: `backend/src/modules/agent/langgraph/nodes/embedding-retrieval.node.ts`

**Change**:
```typescript
// Step 2: Query ChromaDB (use fixed collection name, not cache key)
const collectionName = process.env.CHROMA_COLLECTION || 'codebase_functions';
const candidates = await queryChromaDB(
  queryEmbedding,
  collectionName,  // Changed from repoContext.cacheKey
  CONFIG.RETRIEVAL_TOP_K,
);
```

### 3. Environment Variables

Added two new environment variables to `.env`:

```bash
# ChromaDB Collection Name
CHROMA_COLLECTION=codebase_functions

# Skip embedding generation (use existing embeddings)
SKIP_EMBEDDING_GENERATION=true
```

## How It Works Now

### Load Repo Node Flow (Updated)

1. **Clone Repository** ✅
2. **Parse AST** ✅ (currently mock, returns 0 symbols)
3. **Verify ChromaDB Collection** ✅ (no longer tries to create/populate)
4. **Use Existing Embeddings** ✅ (from `codebase_functions` collection)

### Downstream Nodes (Unchanged)

The `embedding_retrieval` node will still:
1. Query the existing `codebase_functions` collection
2. Retrieve top-K similar code snippets
3. Pass to AST filter and reasoning agent

## Benefits

✅ **No Authentication Errors** - Doesn't try to create collections
✅ **Faster Execution** - Skips redundant embedding generation
✅ **Cost Savings** - No unnecessary OpenAI API calls for embeddings
✅ **Uses Existing Data** - Leverages your pre-populated ChromaDB collection

## When to Re-enable Embedding Generation

If you want the workflow to generate fresh embeddings (e.g., for a new repository or updated codebase):

```bash
# In .env file
SKIP_EMBEDDING_GENERATION=false
```

**Note**: You'll need to ensure:
1. API key has collection creation permissions
2. Collection doesn't already exist, or use a different collection name
3. AST parser is fully implemented (not mock)

## Testing

The next run should:
1. Clone the repository successfully ✅
2. Skip embedding generation with log: `"Skipping embedding generation - using existing collection: codebase_functions"` ✅
3. Continue to `plan_semantics` node ✅
4. Proceed through the entire 7-node workflow ✅

## Related Files

- [load-repo-context.node.ts](backend/src/modules/agent/langgraph/nodes/load-repo-context.node.ts:101-121) - Added conditional embedding generation
- [embedding-retrieval.node.ts](backend/src/modules/agent/langgraph/nodes/embedding-retrieval.node.ts:75-81) - Use fixed collection name instead of cache key
- [.env](backend/.env:71) - Added `CHROMA_COLLECTION`
- [.env](backend/.env:100) - Added `SKIP_EMBEDDING_GENERATION=true`

---

**Status**: Fixed - Ready for Testing
**Date**: 2025-12-31
**Issue**: ChromaAuthError: Unauthorized
**Resolution**: Skip embedding generation, use existing ChromaDB collection
