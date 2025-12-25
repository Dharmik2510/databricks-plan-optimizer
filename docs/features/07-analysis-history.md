# Analysis History

## Feature Overview

Persistent storage and management of all Spark execution plan analyses with advanced filtering, searching, pagination, and quick access to past results for comparison and tracking optimization progress over time.

---

## Technical Architecture

### Frontend Components

#### 1. **History Tab (in App.tsx)**
- **Location:** [frontend/App.tsx](../frontend/App.tsx:750-850)
- **Purpose:** Display user's analysis history with filtering and search
- **Features:**
  - Paginated list of analyses
  - Filter by status (All, Completed, Failed, Processing)
  - Filter by severity (All, Critical, High, Medium, Low)
  - Search by title/content
  - Date range filter
  - Sort by creation date (newest/oldest)
  - Quick actions (view, retry, delete)

**UI Layout:**
```
┌───────────────────────────────────────────────┐
│ Analysis History                              │
├───────────────────────────────────────────────┤
│ [Search: ___________] [Status: All ▼]         │
│ [Severity: All ▼] [Date Range: ________]     │
│                                               │
│ ┌───────────────────────────────────────────┐ │
│ │ Q3 Sales Query Optimization               │ │
│ │ Status: ✓ Completed                       │ │
│ │ Severity: CRITICAL • 12 issues found      │ │
│ │ Created: Jan 15, 2024 10:30 AM           │ │
│ │ [View] [Retry] [Delete]                  │ │
│ └───────────────────────────────────────────┘ │
│                                               │
│ ┌───────────────────────────────────────────┐ │
│ │ Daily ETL Pipeline Analysis               │ │
│ │ Status: ✓ Completed                       │ │
│ │ Severity: HIGH • 8 issues found           │ │
│ │ Created: Jan 14, 2024 3:15 PM            │ │
│ │ [View] [Retry] [Delete]                  │ │
│ └───────────────────────────────────────────┘ │
│                                               │
│ ┌───────────────────────────────────────────┐ │
│ │ Customer Analytics                        │ │
│ │ Status: ⚠ Failed                          │ │
│ │ Error: Invalid plan format                │ │
│ │ Created: Jan 13, 2024 9:00 AM            │ │
│ │ [Retry] [Delete]                         │ │
│ └───────────────────────────────────────────┘ │
│                                               │
│ [← Previous] Page 1 of 5 [Next →]           │
└───────────────────────────────────────────────┘
```

#### 2. **AnalysisCard Component**
- **Location:** [frontend/components/history/AnalysisCard.tsx](../frontend/components/history/AnalysisCard.tsx)
- **Purpose:** Individual analysis preview card
- **Displayed Information:**
  - Analysis title
  - Status badge (Completed, Failed, Processing)
  - Severity badge (Critical, High, Medium, Low)
  - Issue count
  - Creation timestamp
  - Processing duration (if completed)
  - Action buttons

**Status Badge Styling:**
```typescript
const statusStyles = {
  COMPLETED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  PROCESSING: 'bg-yellow-100 text-yellow-800 animate-pulse',
  PENDING: 'bg-gray-100 text-gray-800'
};
```

#### 3. **useAnalysis Hook**
- **Location:** [frontend/hooks/useAnalysis.ts](../frontend/hooks/useAnalysis.ts)
- **Purpose:** Analysis CRUD operations and state management
- **Methods:**
  - `getAnalyses(filters, pagination)`: Fetch filtered list
  - `getRecentAnalyses()`: Fetch last 5 analyses
  - `getAnalysisById(id)`: Fetch full analysis result
  - `deleteAnalysis(id)`: Delete analysis
  - `retryAnalysis(id)`: Retry failed analysis
  - `updateAnalysisTitle(id, title)`: Update title

**State:**
```typescript
{
  analyses: Analysis[];
  currentAnalysis: Analysis | null;
  recentAnalyses: Analysis[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
  filters: {
    status?: AnalysisStatus;
    severity?: Severity;
    search?: string;
    dateFrom?: Date;
    dateTo?: Date;
  };
  isLoading: boolean;
  error: string | null;
}
```

### Backend Modules

#### 1. **AnalysisController**
- **Location:** [backend/src/modules/analysis/analysis.controller.ts](../backend/src/modules/analysis/analysis.controller.ts)

**Endpoints:**

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/v1/analyses` | List analyses with filters | Yes |
| GET | `/api/v1/analyses/recent` | Get recent 5 analyses | Yes |
| GET | `/api/v1/analyses/:id` | Get specific analysis | Yes |
| PATCH | `/api/v1/analyses/:id` | Update analysis title | Yes |
| DELETE | `/api/v1/analyses/:id` | Delete analysis | Yes |
| POST | `/api/v1/analyses/:id/retry` | Retry failed analysis | Yes |

**List Analyses Request:**
```typescript
// GET /api/v1/analyses?page=1&pageSize=10&status=COMPLETED&severity=CRITICAL&search=sales
{
  page: number;           // Default: 1
  pageSize: number;       // Default: 10, Max: 100
  status?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  search?: string;        // Search in title and content
  dateFrom?: string;      // ISO date
  dateTo?: string;        // ISO date
  sortBy?: 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';  // Default: 'desc'
}
```

**List Analyses Response:**
```typescript
{
  data: [
    {
      id: string;
      analysisTitle: string;
      status: AnalysisStatus;
      maxSeverity: Severity;
      optimizationCount: number;
      dagNodeCount: number;
      processingMs: number;
      createdAt: Date;
      updatedAt: Date;
      error?: string;
    }
  ],
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  }
}
```

#### 2. **AnalysisService**
- **Location:** [backend/src/modules/analysis/analysis.service.ts](../backend/src/modules/analysis/analysis.service.ts)

**Key Methods:**

**`findAll(userId, filters, pagination)`**
```typescript
async findAll(
  userId: string,
  filters: AnalysisFilters,
  pagination: Pagination
): Promise<PaginatedAnalyses> {
  const { page, pageSize } = pagination;
  const skip = (page - 1) * pageSize;

  // Build where clause
  const where: Prisma.AnalysisWhereInput = {
    userId,
    ...(filters.status && { status: filters.status }),
    ...(filters.severity && { maxSeverity: filters.severity }),
    ...(filters.search && {
      OR: [
        { analysisTitle: { contains: filters.search, mode: 'insensitive' } },
        { content: { contains: filters.search, mode: 'insensitive' } }
      ]
    }),
    ...(filters.dateFrom || filters.dateTo) && {
      createdAt: {
        ...(filters.dateFrom && { gte: filters.dateFrom }),
        ...(filters.dateTo && { lte: filters.dateTo })
      }
    }
  };

  // Fetch analyses with pagination
  const [analyses, totalCount] = await Promise.all([
    this.prisma.analysis.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: {
        [filters.sortBy || 'createdAt']: filters.sortOrder || 'desc'
      },
      select: {
        id: true,
        analysisTitle: true,
        status: true,
        maxSeverity: true,
        optimizationCount: true,
        dagNodeCount: true,
        processingMs: true,
        createdAt: true,
        updatedAt: true,
        error: true
        // Exclude heavy fields: content, result
      }
    }),
    this.prisma.analysis.count({ where })
  ]);

  return {
    data: analyses,
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize)
    }
  };
}
```

**`findRecent(userId)`**
```typescript
async findRecent(userId: string): Promise<Analysis[]> {
  return this.prisma.analysis.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      analysisTitle: true,
      status: true,
      maxSeverity: true,
      optimizationCount: true,
      createdAt: true
    }
  });
}
```

**`delete(id, userId)`**
```typescript
async delete(id: string, userId: string): Promise<void> {
  // Validate ownership
  const analysis = await this.prisma.analysis.findFirst({
    where: { id, userId }
  });

  if (!analysis) {
    throw new NotFoundException('Analysis not found');
  }

  // Cascade delete (chat sessions automatically deleted)
  await this.prisma.analysis.delete({
    where: { id }
  });
}
```

**`retry(id, userId)`**
```typescript
async retry(id: string, userId: string): Promise<Analysis> {
  const analysis = await this.prisma.analysis.findFirst({
    where: { id, userId }
  });

  if (!analysis) {
    throw new NotFoundException('Analysis not found');
  }

  if (analysis.status !== 'FAILED') {
    throw new BadRequestException('Can only retry failed analyses');
  }

  // Reset analysis state
  const updated = await this.prisma.analysis.update({
    where: { id },
    data: {
      status: 'PROCESSING',
      error: null,
      result: null
    }
  });

  // Re-queue processing
  await this.processAnalysis(id);

  return updated;
}
```

**`updateTitle(id, userId, title)`**
```typescript
async updateTitle(
  id: string,
  userId: string,
  title: string
): Promise<Analysis> {
  // Validate ownership
  await this.validateOwnership(id, userId);

  return this.prisma.analysis.update({
    where: { id },
    data: { analysisTitle: title }
  });
}
```

---

## Data Flow

### Fetch Analysis History Flow

```
┌─────────────────────────────────┐
│ Frontend: History Tab           │
│ - User navigates to History     │
│ - Sets filters (status, search) │
│ - Clicks page 2                 │
└───────────┬─────────────────────┘
            │
            │ 1. Fetch analyses
            ▼
┌─────────────────────────────────┐
│ GET /api/v1/analyses?           │
│   page=2&                       │
│   pageSize=10&                  │
│   status=COMPLETED&             │
│   search=sales                  │
└───────────┬─────────────────────┘
            │
            │ 2. Validate & parse params
            ▼
┌─────────────────────────────────┐
│ AnalysisController.findAll()    │
│ - Extract query params          │
│ - Validate page/pageSize        │
│ - Pass to service               │
└───────────┬─────────────────────┘
            │
            │ 3. Build query
            ▼
┌─────────────────────────────────┐
│ AnalysisService.findAll()       │
│ - Build Prisma where clause     │
│ - Apply filters                 │
│ - Apply pagination              │
│ - Apply sorting                 │
└───────────┬─────────────────────┘
            │
            │ 4. Database query
            ▼
┌─────────────────────────────────┐
│ PostgreSQL Query:               │
│ SELECT id, analysisTitle, ...   │
│ FROM Analysis                   │
│ WHERE userId = ?                │
│   AND status = 'COMPLETED'      │
│   AND (analysisTitle ILIKE '%sales%' │
│         OR content ILIKE '%sales%')  │
│ ORDER BY createdAt DESC         │
│ OFFSET 10 LIMIT 10;             │
│                                 │
│ + COUNT query for total         │
└───────────┬─────────────────────┘
            │
            │ 5. Results
            ▼
┌─────────────────────────────────┐
│ {                               │
│   data: [                       │
│     {                           │
│       id: "abc-123",            │
│       analysisTitle: "Q3 Sales",│
│       status: "COMPLETED",      │
│       maxSeverity: "CRITICAL",  │
│       optimizationCount: 12,    │
│       createdAt: "2024-01-15"   │
│     },                          │
│     // ... 9 more               │
│   ],                            │
│   pagination: {                 │
│     page: 2,                    │
│     pageSize: 10,               │
│     totalCount: 47,             │
│     totalPages: 5               │
│   }                             │
│ }                               │
└───────────┬─────────────────────┘
            │
            │ 6. Update UI
            ▼
┌─────────────────────────────────┐
│ Frontend: History Tab           │
│ - Render analysis cards         │
│ - Show pagination controls      │
│ - Display "Page 2 of 5"         │
└─────────────────────────────────┘
```

### Delete Analysis Flow

```
┌─────────────────────────────────┐
│ Frontend: User clicks Delete    │
└───────────┬─────────────────────┘
            │
            │ 1. Confirm deletion
            ▼
┌─────────────────────────────────┐
│ Confirmation Dialog:            │
│ "Are you sure you want to       │
│  delete this analysis?"         │
│ [Cancel] [Delete]               │
└───────────┬─────────────────────┘
            │ User clicks Delete
            │
            ▼
┌─────────────────────────────────┐
│ DELETE /api/v1/analyses/:id     │
└───────────┬─────────────────────┘
            │
            │ 2. Validate ownership
            ▼
┌─────────────────────────────────┐
│ AnalysisService.delete()        │
│ - Check if analysis.userId      │
│   matches req.user.id           │
│ - Throw 404 if not found        │
└───────────┬─────────────────────┘
            │
            │ 3. Delete from DB
            ▼
┌─────────────────────────────────┐
│ PostgreSQL:                     │
│ DELETE FROM Analysis            │
│ WHERE id = ?;                   │
│                                 │
│ Cascade deletes:                │
│ - ChatSession records           │
│ - ChatMessage records           │
└───────────┬─────────────────────┘
            │
            │ 4. Success response
            ▼
┌─────────────────────────────────┐
│ Frontend: Remove from list      │
│ - Update local state            │
│ - Show toast: "Analysis deleted"│
│ - Refresh list if page empty    │
└─────────────────────────────────┘
```

### Retry Analysis Flow

```
┌─────────────────────────────────┐
│ Frontend: User clicks Retry     │
│ (on failed analysis)            │
└───────────┬─────────────────────┘
            │
            │ 1. Retry request
            ▼
┌─────────────────────────────────┐
│ POST /api/v1/analyses/:id/retry │
└───────────┬─────────────────────┘
            │
            │ 2. Validate state
            ▼
┌─────────────────────────────────┐
│ AnalysisService.retry()         │
│ - Check status is FAILED        │
│ - Return 400 if not failed      │
└───────────┬─────────────────────┘
            │
            │ 3. Reset state
            ▼
┌─────────────────────────────────┐
│ PostgreSQL:                     │
│ UPDATE Analysis                 │
│ SET status = 'PROCESSING',      │
│     error = NULL,               │
│     result = NULL               │
│ WHERE id = ?;                   │
└───────────┬─────────────────────┘
            │
            │ 4. Re-queue processing
            ▼
┌─────────────────────────────────┐
│ AnalysisService.processAnalysis()│
│ - Same pipeline as new analysis │
│ - Gemini AI analysis            │
│ - Update status on completion   │
└───────────┬─────────────────────┘
            │
            │ 5. Frontend polls
            ▼
┌─────────────────────────────────┐
│ GET /api/v1/analyses/:id/status │
│ - Every 2 seconds               │
│ - Until status !== PROCESSING   │
└─────────────────────────────────┘
```

---

## Database Schema

### Analysis Table (Optimized for History)
```prisma
model Analysis {
  id                  String           @id @default(uuid())
  userId              String
  user                User             @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Searchable fields
  analysisTitle       String?
  content             String           @db.Text
  contentHash         String

  // Filterable fields
  status              AnalysisStatus   @default(PENDING)
  maxSeverity         String?          // Denormalized for quick filtering

  // Countable fields
  optimizationCount   Int?
  dagNodeCount        Int?
  dagLinkCount        Int?

  // Timestamps (for sorting/filtering)
  createdAt           DateTime         @default(now())
  updatedAt           DateTime         @updatedAt

  // Heavy fields (excluded from list queries)
  result              Json?
  error               String?

  // Indexes for performance
  @@index([userId, createdAt])         // User's history sorted by date
  @@index([userId, status])            // Filter by status
  @@index([userId, maxSeverity])       // Filter by severity
  @@index([contentHash])               // Deduplication
}
```

**Index Strategy:**
- **Composite index `[userId, createdAt]`:** Fastest for user's recent analyses
- **Index `[userId, status]`:** Quick filtering by status
- **Index `[userId, maxSeverity]`:** Quick filtering by severity
- **Index `[contentHash]`:** Fast duplicate detection

---

## Search Implementation

### Full-Text Search

**PostgreSQL Query:**
```sql
SELECT *
FROM Analysis
WHERE userId = ?
  AND (
    analysisTitle ILIKE '%search_term%'
    OR content ILIKE '%search_term%'
  )
ORDER BY createdAt DESC;
```

**Performance Note:**
- `ILIKE` is case-insensitive but slower than `LIKE`
- For large datasets, consider adding full-text search index:
  ```sql
  CREATE INDEX idx_analysis_search
  ON Analysis
  USING GIN(to_tsvector('english', analysisTitle || ' ' || content));
  ```

**Future Enhancement: Advanced Search**
```typescript
// Search syntax:
// - status:completed
// - severity:critical
// - date:2024-01-15
// - title:"Sales Query"

function parseAdvancedSearch(query: string): SearchFilters {
  const filters = {};

  // Extract status
  const statusMatch = query.match(/status:(\w+)/);
  if (statusMatch) {
    filters.status = statusMatch[1].toUpperCase();
  }

  // Extract severity
  const severityMatch = query.match(/severity:(\w+)/);
  if (severityMatch) {
    filters.severity = severityMatch[1].toUpperCase();
  }

  // Extract date
  const dateMatch = query.match(/date:(\S+)/);
  if (dateMatch) {
    filters.dateFrom = new Date(dateMatch[1]);
    filters.dateTo = new Date(dateMatch[1]);
  }

  // Remaining text as general search
  const cleanedQuery = query
    .replace(/status:\w+/g, '')
    .replace(/severity:\w+/g, '')
    .replace(/date:\S+/g, '')
    .trim();

  filters.search = cleanedQuery;

  return filters;
}
```

---

## Pagination Strategy

### Offset-Based Pagination

**Pros:**
- Simple to implement
- Users can jump to specific pages
- Total count available

**Cons:**
- Slower for large offsets (e.g., page 100)
- Inconsistent if data changes between requests

**Implementation:**
```typescript
const skip = (page - 1) * pageSize;  // Offset
const take = pageSize;               // Limit

const analyses = await prisma.analysis.findMany({
  skip,
  take,
  where: { ... },
  orderBy: { createdAt: 'desc' }
});
```

### Cursor-Based Pagination (Future)

**Pros:**
- Faster for large datasets
- Consistent results even if data changes

**Cons:**
- Can't jump to arbitrary pages
- No total count

**Implementation:**
```typescript
const analyses = await prisma.analysis.findMany({
  cursor: { id: lastSeenId },
  skip: 1,  // Skip the cursor itself
  take: pageSize,
  where: { ... },
  orderBy: { createdAt: 'desc' }
});
```

---

## Performance Optimizations

### 1. Denormalized Fields

**Why:**
- Avoid JSON parsing in list queries
- Enable efficient filtering and sorting

**Fields:**
- `maxSeverity`: Extracted from `result.optimizations`
- `optimizationCount`: Count of optimizations
- `dagNodeCount`: Count of DAG nodes

**Update on Analysis Completion:**
```typescript
await prisma.analysis.update({
  where: { id },
  data: {
    result: analysisResult,
    maxSeverity: calculateMaxSeverity(analysisResult.optimizations),
    optimizationCount: analysisResult.optimizations.length,
    dagNodeCount: analysisResult.dagNodes.length
  }
});
```

### 2. Selective Field Loading

**List Query:** Only load lightweight fields
```typescript
select: {
  id: true,
  analysisTitle: true,
  status: true,
  maxSeverity: true,
  optimizationCount: true,
  createdAt: true
  // Exclude: content, result
}
```

**Detail Query:** Load full analysis
```typescript
// When user clicks "View"
const fullAnalysis = await prisma.analysis.findUnique({
  where: { id },
  // Load all fields including result
});
```

### 3. Count Query Optimization

**Parallel Execution:**
```typescript
const [analyses, totalCount] = await Promise.all([
  prisma.analysis.findMany({ ... }),
  prisma.analysis.count({ where })
]);
```

**Approximate Count (Future):**
For very large datasets, use approximate count:
```sql
SELECT reltuples::bigint AS estimate
FROM pg_class
WHERE relname = 'Analysis';
```

### 4. Caching Recent Analyses

**Frontend Cache:**
```typescript
// Cache in component state for 60 seconds
const [cachedRecent, setCachedRecent] = useState({
  data: [],
  timestamp: null
});

const fetchRecent = async () => {
  const now = Date.now();
  if (cachedRecent.timestamp && now - cachedRecent.timestamp < 60000) {
    return cachedRecent.data;
  }

  const data = await apiClient.get('/api/v1/analyses/recent');
  setCachedRecent({ data, timestamp: now });
  return data;
};
```

---

## Error Handling

### Frontend Errors
- **No analyses found:** Display empty state with CTA
- **Network error:** Retry with exponential backoff
- **Pagination out of bounds:** Redirect to last valid page

### Backend Errors
- **Invalid page number:** Return 400 Bad Request
- **Analysis not found:** Return 404 Not Found
- **Unauthorized access:** Return 403 Forbidden (if userId mismatch)

---

## Usage Examples

### Frontend: Fetch with Filters
```typescript
const fetchAnalyses = async () => {
  const response = await apiClient.get('/api/v1/analyses', {
    params: {
      page: currentPage,
      pageSize: 10,
      status: selectedStatus,
      severity: selectedSeverity,
      search: searchQuery,
      sortBy: 'createdAt',
      sortOrder: 'desc'
    }
  });

  setAnalyses(response.data);
  setPagination(response.pagination);
};
```

### Frontend: Delete with Confirmation
```typescript
const handleDelete = async (analysisId: string) => {
  if (!window.confirm('Are you sure you want to delete this analysis?')) {
    return;
  }

  try {
    await deleteAnalysis(analysisId);
    showToast('Analysis deleted successfully', 'success');
    fetchAnalyses(); // Refresh list
  } catch (error) {
    showToast('Failed to delete analysis', 'error');
  }
};
```

---

## Integration with Other Features

### 1. Analysis Creation
- New analyses automatically appear in history
- Real-time status updates via polling

### 2. Chat Sessions
- Clicking analysis shows linked chat sessions
- Delete analysis cascades to chat sessions

### 3. Cost Estimation
- History shows baseline cost for each analysis
- Track cost savings over time

---

## Future Enhancements

- [ ] **Bulk operations:** Select multiple analyses to delete
- [ ] **Export history:** Download as CSV/Excel
- [ ] **Analysis comparison:** Side-by-side comparison of 2 analyses
- [ ] **Tagging system:** User-defined tags for organization
- [ ] **Favorites/Bookmarks:** Pin important analyses
- [ ] **Activity timeline:** Visual timeline of all analyses
- [ ] **Automated cleanup:** Delete old failed analyses after 30 days
- [ ] **Duplicate detection:** Warn before analyzing same plan
- [ ] **Share analyses:** Generate shareable links
- [ ] **Version history:** Track re-analyses of same plan over time
- [ ] **Advanced sorting:** Sort by optimization count, severity, etc.
- [ ] **Saved filters:** Save commonly used filter combinations
