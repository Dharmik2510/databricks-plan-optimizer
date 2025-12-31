# ChromaDB Authentication Issue - Root Cause Identified

## Problem

The LangGraph workflow is failing with `ChromaAuthError: Unauthorized` when trying to query the `codebase_functions` collection in ChromaDB Cloud.

## Test Results

Running the ChromaDB connection test revealed the issue:

```bash
✅ Heartbeat successful: Basic connection works
❌ List collections: Unauthorized - ChromaAuthError
```

The API key can connect to ChromaDB Cloud (heartbeat works), but **does NOT have permission to list or query collections**.

## Root Cause

Your ChromaDB API key (`ck-GGtwrH4aWh9VnjXdP3VpFWCi171vTcN5RpYvT5KZgGfP`) has **limited permissions**:

- ✅ Can authenticate (heartbeat)
- ❌ Cannot list collections
- ❌ Cannot query collections
- ❌ Cannot create collections

## Solution Options

### Option 1: Generate New API Key with Full Permissions (Recommended)

1. Log in to your ChromaDB Cloud dashboard
2. Navigate to Settings → API Keys
3. Create a new API key with the following permissions:
   - ✅ Read collections
   - ✅ Query collections
   - ✅ List collections
   - (Optional) Create collections
4. Update `.env` with the new key:
   ```bash
   CHROMA_API_KEY=your_new_key_here
   ```

### Option 2: Update Existing API Key Permissions

1. Log in to ChromaDB Cloud dashboard
2. Find the existing API key
3. Update its permissions to include:
   - Read collections
   - Query collections
   - List collections
4. No code changes needed - just restart the application

### Option 3: Use Service Account Key

If you're using a service account, ensure it has the correct role:
- Role: `database_read` or `database_admin`
- Tenant: `0768a056-c28e-4e2e-9019-d03a04b334f2`
- Database: `prod`

## Testing

After updating the API key, run the test script to verify:

```bash
npx ts-node test-chromadb.ts
```

Expected output:
```
✅ Test 1: Initializing ChromaDB client
✅ Test 2: Testing connection (heartbeat)
✅ Test 3: Listing collections (should show codebase_functions)
✅ Test 4: Getting collection
✅ Test 5: Counting documents
✅ Test 6: Testing query
```

## Verification Checklist

Before running the LangGraph workflow again:

- [ ] New API key generated with read/query permissions
- [ ] `.env` updated with new API key
- [ ] Test script passes all 6 tests
- [ ] Application restarted to pick up new env vars

## Temp Workaround (Not Recommended)

If you cannot update the API key permissions immediately, you can:

1. **Disable ChromaDB retrieval** temporarily:
   ```bash
   # In .env
   DISABLE_CHROMADB_RETRIEVAL=true
   ```

2. **Modify embedding_retrieval.node.ts** to skip ChromaDB queries and return empty results (this will reduce mapping quality significantly)

However, this defeats the purpose of using semantic search, so fixing the API key permissions is strongly recommended.

## Additional Information

### ChromaDB Cloud Configuration

- **Host**: api.trychroma.com
- **Tenant**: 0768a056-c28e-4e2e-9019-d03a04b334f2
- **Database**: prod
- **Collection**: codebase_functions

### Expected Permissions

For production use, your API key needs:

| Permission | Required | Purpose |
|------------|----------|---------|
| `heartbeat` | ✅ | Basic connection testing |
| `listCollections` | ✅ | Verify collection exists |
| `getCollection` | ✅ | Access collection metadata |
| `query` | ✅ | Semantic search queries |
| `count` | ✅ (nice to have) | Collection stats |
| `createCollection` | ❌ (if using existing) | Only if auto-creating |
| `add` | ❌ (if using existing) | Only if adding embeddings |

## Next Steps

1. **Generate new API key** with proper permissions in ChromaDB Cloud dashboard
2. **Update `.env`** file with new key
3. **Run test script**: `npx ts-node test-chromadb.ts`
4. **Restart application** to test full workflow
5. **Verify** that LangGraph workflow completes successfully

---

**Status**: Awaiting API key update
**Blocker**: Current API key lacks collection read/query permissions
**Impact**: LangGraph workflow cannot perform semantic code search
**Priority**: High - Core functionality blocked
