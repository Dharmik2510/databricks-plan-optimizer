# AI Consultant Chat

## Feature Overview

Context-aware conversational AI assistant powered by Google Gemini that provides personalized Spark optimization advice, code examples, and best practices based on the user's current analysis results.

---

## Technical Architecture

### Frontend Components

#### 1. **ChatInterface (Main Component)**
- **Location:** [frontend/ChatInterface.tsx](../frontend/ChatInterface.tsx)
- **Purpose:** Chat UI with message history and input field
- **Features:**
  - Message display (user and assistant messages)
  - Markdown rendering for AI responses
  - Code syntax highlighting
  - Auto-scroll to latest message
  - Loading indicator during AI response
  - Session management

**UI Layout:**
```
┌─────────────────────────────────────────┐
│ Chat Assistant                     [X]  │
├─────────────────────────────────────────┤
│                                         │
│  [User] How can I optimize the join?   │
│                                         │
│  [AI] Based on your analysis, the join │
│  in Stage 3 is a BroadcastHashJoin...  │
│                                         │
│  ```python                              │
│  df.join(broadcast(small_df), ...)     │
│  ```                                    │
│                                         │
│  [User] What about data skew?          │
│                                         │
│  [AI] Data skew in Stage 5 can be...   │
│                                         │
├─────────────────────────────────────────┤
│ [Type your message...]           [Send]│
└─────────────────────────────────────────┘
```

#### 2. **useChat Hook**
- **Location:** [frontend/hooks/useChat.ts](../frontend/hooks/useChat.ts)
- **Purpose:** Chat state management and API interaction
- **Methods:**
  - `createSession(analysisId?)`: Start new chat session
  - `sendMessage(sessionId, content)`: Send user message
  - `getSessions()`: Fetch user's chat history
  - `getSession(sessionId)`: Fetch specific session with messages
  - `deleteSession(sessionId)`: Delete chat session

**State:**
```typescript
{
  sessions: ChatSession[];
  currentSession: ChatSession | null;
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
}
```

#### 3. **Message Component**
- **Location:** [frontend/components/chat/Message.tsx](../frontend/components/chat/Message.tsx)
- **Purpose:** Individual message rendering
- **Features:**
  - Role-based styling (user vs assistant)
  - Markdown-to-HTML conversion (using `marked` library)
  - Code block syntax highlighting (using `highlight.js`)
  - Timestamp display
  - Copy-to-clipboard for code blocks

### Backend Modules

#### 1. **ChatController**
- **Location:** [backend/src/modules/chat/chat.controller.ts](../backend/src/modules/chat/chat.controller.ts)

**Endpoints:**

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/v1/chat/sessions` | Create new chat session | Yes |
| GET | `/api/v1/chat/sessions` | List user's chat sessions | Yes |
| GET | `/api/v1/chat/sessions/:id` | Get session with messages | Yes |
| POST | `/api/v1/chat/sessions/:id/messages` | Send message to session | Yes |
| DELETE | `/api/v1/chat/sessions/:id` | Delete session | Yes |

**Create Session Request:**
```typescript
{
  analysisId?: string;  // Optional: link to specific analysis
  title?: string;       // Custom session title
}
```

**Send Message Request:**
```typescript
{
  content: string;      // User's message
}
```

**Message Response:**
```typescript
{
  id: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  createdAt: Date;
  tokenCount?: number;  // For usage tracking
}
```

#### 2. **ChatService**
- **Location:** [backend/src/modules/chat/chat.service.ts](../backend/src/modules/chat/chat.service.ts)
- **Purpose:** Chat session management and message processing

**Key Methods:**

**`createSession(userId, dto)`**
```typescript
async createSession(userId: string, dto: CreateSessionDto) {
  const session = await this.prisma.chatSession.create({
    data: {
      userId,
      analysisId: dto.analysisId,
      title: dto.title || 'New Chat',
      metadata: {}
    }
  });

  return session;
}
```

**`sendMessage(sessionId, userId, content)`**
```typescript
async sendMessage(sessionId: string, userId: string, content: string) {
  // 1. Validate session ownership
  const session = await this.validateSession(sessionId, userId);

  // 2. Save user message
  const userMessage = await this.prisma.chatMessage.create({
    data: {
      sessionId,
      role: 'USER',
      content,
      tokenCount: this.estimateTokens(content)
    }
  });

  // 3. Build context
  const context = await this.buildContext(session);

  // 4. Get AI response
  const aiResponse = await this.geminiService.chat(content, context);

  // 5. Save assistant message
  const assistantMessage = await this.prisma.chatMessage.create({
    data: {
      sessionId,
      role: 'ASSISTANT',
      content: aiResponse.content,
      tokenCount: aiResponse.tokenCount
    }
  });

  return {
    userMessage,
    assistantMessage
  };
}
```

**`buildContext(session)`**
```typescript
async buildContext(session: ChatSession): Promise<ChatContext> {
  const context: ChatContext = {
    conversationHistory: [],
    analysisContext: null
  };

  // Fetch recent messages (last 10)
  const recentMessages = await this.prisma.chatMessage.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  context.conversationHistory = recentMessages.reverse();

  // Fetch linked analysis if exists
  if (session.analysisId) {
    const analysis = await this.prisma.analysis.findUnique({
      where: { id: session.analysisId }
    });

    if (analysis && analysis.result) {
      context.analysisContext = {
        summary: analysis.result.summary,
        optimizations: analysis.result.optimizations.map(opt => ({
          title: opt.title,
          severity: opt.severity,
          category: opt.category
        })),
        dagNodeCount: analysis.dagNodeCount,
        maxSeverity: analysis.maxSeverity
      };
    }
  }

  return context;
}
```

#### 3. **GeminiService - Chat Method**
- **Location:** [backend/src/integrations/gemini/gemini.service.ts](../backend/src/integrations/gemini/gemini.service.ts:300-400)
- **Purpose:** AI-powered conversation with context awareness

**Method Signature:**
```typescript
async chat(
  userMessage: string,
  context: ChatContext
): Promise<{ content: string; tokenCount: number }>
```

**Prompt Engineering:**

**System Prompt:**
```
You are an expert Apache Spark and Databricks optimization consultant.
Your role is to provide actionable advice on Spark performance tuning,
query optimization, and cost reduction.

Guidelines:
- Provide specific, code-based recommendations
- Explain trade-offs when suggesting optimizations
- Reference Spark documentation when applicable
- Use markdown formatting for code examples
- Be concise but thorough
- If the user's analysis shows specific issues, reference them directly
```

**Context Injection:**
```typescript
// Build conversation messages for Gemini
const messages = [];

// Add system prompt
messages.push({
  role: 'user',
  parts: [{ text: systemPrompt }]
});

// Add analysis context if available
if (context.analysisContext) {
  const analysisInfo = `
Current Analysis Context:
- Summary: ${context.analysisContext.summary}
- Total Issues: ${context.analysisContext.optimizations.length}
- Critical Issues: ${context.analysisContext.optimizations.filter(o => o.severity === 'CRITICAL').length}
- High Priority Issues: ${context.analysisContext.optimizations.filter(o => o.severity === 'HIGH').length}

Key Optimizations:
${context.analysisContext.optimizations.slice(0, 5).map(opt =>
  `- [${opt.severity}] ${opt.title} (Category: ${opt.category})`
).join('\n')}
  `;

  messages.push({
    role: 'user',
    parts: [{ text: analysisInfo }]
  });
}

// Add conversation history
context.conversationHistory.forEach(msg => {
  messages.push({
    role: msg.role === 'USER' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  });
});

// Add current user message
messages.push({
  role: 'user',
  parts: [{ text: userMessage }]
});
```

**AI Model Configuration:**
```typescript
const model = this.genAI.getGenerativeModel({
  model: 'gemini-2.0-flash-exp',
  generationConfig: {
    temperature: 0.7,          // Balanced creativity
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 2048      // Detailed responses
  }
});

const chat = model.startChat({
  history: messages.slice(0, -1),  // All but last message
  generationConfig: { ... }
});

const result = await chat.sendMessage(userMessage);
const response = result.response.text();

return {
  content: response,
  tokenCount: this.estimateTokens(response)
};
```

---

## Data Flow

### Chat Message Flow

```
┌─────────────────────────────────┐
│ Frontend: ChatInterface         │
│ - User types message            │
│ - Clicks Send                   │
└───────────┬─────────────────────┘
            │
            │ 1. Send message
            ▼
┌─────────────────────────────────┐
│ POST /api/v1/chat/sessions/:id/ │
│      messages                   │
│ Body: {                         │
│   content: "How do I fix the    │
│             shuffle storm?"     │
│ }                               │
└───────────┬─────────────────────┘
            │
            │ 2. Validate & save
            ▼
┌─────────────────────────────────┐
│ ChatService.sendMessage()       │
│ - Validate session ownership    │
│ - Save user message to DB       │
└───────────┬─────────────────────┘
            │
            │ 3. Build context
            ▼
┌─────────────────────────────────┐
│ ChatService.buildContext()      │
│ - Fetch last 10 messages        │
│ - Fetch linked analysis         │
│ - Extract key optimizations     │
└───────────┬─────────────────────┘
            │
            │ 4. Context object
            ▼
┌─────────────────────────────────┐
│ {                               │
│   conversationHistory: [        │
│     { role: 'USER', content...},│
│     { role: 'ASSISTANT', ...}   │
│   ],                            │
│   analysisContext: {            │
│     summary: "...",             │
│     optimizations: [            │
│       { title: "Reduce shuffle",│
│         severity: "HIGH" }      │
│     ]                           │
│   }                             │
│ }                               │
└───────────┬─────────────────────┘
            │
            │ 5. Generate AI response
            ▼
┌─────────────────────────────────┐
│ GeminiService.chat()            │
│ - Build prompt with context     │
│ - Call Gemini API               │
│ - Stream response               │
└───────────┬─────────────────────┘
            │
            │ 6. AI processes
            ▼
┌─────────────────────────────────┐
│ Google Gemini 2.0 Flash         │
│ - Analyzes conversation history │
│ - References analysis context   │
│ - Generates response            │
└───────────┬─────────────────────┘
            │
            │ 7. Response text
            ▼
┌─────────────────────────────────┐
│ "To fix the shuffle storm in    │
│  Stage 5, consider these...     │
│                                 │
│  1. Increase partition count... │
│                                 │
│  ```python                      │
│  df.repartition(400, 'key')     │
│  ```                            │
│                                 │
│  2. Pre-aggregate before...     │
│  ..."                           │
└───────────┬─────────────────────┘
            │
            │ 8. Save assistant message
            ▼
┌─────────────────────────────────┐
│ ChatService (continued)         │
│ - Save assistant message to DB  │
│ - Record token usage            │
└───────────┬─────────────────────┘
            │
            │ 9. Return both messages
            ▼
┌─────────────────────────────────┐
│ Response: {                     │
│   userMessage: {...},           │
│   assistantMessage: {...}       │
│ }                               │
└───────────┬─────────────────────┘
            │
            │ 10. Update UI
            ▼
┌─────────────────────────────────┐
│ Frontend: ChatInterface         │
│ - Append messages to state      │
│ - Render markdown               │
│ - Scroll to bottom              │
└─────────────────────────────────┘
```

---

## Database Schema

### ChatSession Table
```prisma
model ChatSession {
  id          String    @id @default(uuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  analysisId  String?
  analysis    Analysis? @relation(fields: [analysisId], references: [id], onDelete: SetNull)

  title       String    @default("New Chat")
  metadata    Json?     // Custom session data

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  messages    ChatMessage[]

  @@index([userId, createdAt])
  @@index([analysisId])
}
```

### ChatMessage Table
```prisma
model ChatMessage {
  id          String       @id @default(uuid())
  sessionId   String
  session     ChatSession  @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  role        MessageRole  // USER, ASSISTANT, SYSTEM
  content     String       @db.Text

  tokenCount  Int?         // For usage tracking

  createdAt   DateTime     @default(now())

  @@index([sessionId, createdAt])
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}
```

---

## Context-Aware Features

### 1. Analysis Linking

**Purpose:** Provide AI with specific context about user's current analysis

**Implementation:**
```typescript
// When creating session from analysis page
const session = await createSession({
  analysisId: currentAnalysisId,
  title: `Chat about ${analysisTitle}`
});
```

**Benefits:**
- AI can reference specific stages, tables, and issues
- Recommendations tailored to detected problems
- Code examples based on actual analysis results

**Example Context-Aware Response:**
```
User: "How should I optimize this query?"

AI: "Based on your analysis, I see you have a CRITICAL issue in Stage 3
     with a Cartesian product between the 'customers' and 'orders' tables.
     Here's how to fix it:

     The current join is missing a join condition. Looking at your DAG,
     you should add an explicit join on customer_id:

     ```python
     # Current (problematic)
     customers.crossJoin(orders)

     # Optimized
     customers.join(orders, customers.id == orders.customer_id, 'inner')
     ```

     This will reduce execution time by an estimated 30 minutes and save $42."
```

### 2. Conversation History

**Purpose:** Maintain context across multiple messages

**Implementation:**
- Last 10 messages included in Gemini prompt
- Enables follow-up questions without repeating context
- AI can reference earlier parts of conversation

**Example Multi-Turn Conversation:**
```
User: "What's causing the high shuffle volume?"

AI: "The high shuffle volume is likely caused by the groupBy operation
     in Stage 5 without pre-aggregation..."

User: "Can you show me code for pre-aggregation?"

AI: "Certainly! Based on our previous discussion about the shuffle in
     Stage 5, here's a pre-aggregation approach:

     ```python
     # Pre-aggregate before groupBy
     df.groupBy('key', 'partition_col')
       .agg(sum('value').alias('subtotal'))
       .groupBy('key')
       .agg(sum('subtotal').alias('total'))
     ```"
```

### 3. Optimization Referencing

**Purpose:** AI directly addresses detected issues

**Context Extraction:**
```typescript
// From analysis result
const criticalOpts = optimizations.filter(o => o.severity === 'CRITICAL');
const highOpts = optimizations.filter(o => o.severity === 'HIGH');

// Injected into prompt
`The analysis detected ${criticalOpts.length} critical issues:
${criticalOpts.map(o => `- ${o.title}`).join('\n')}

And ${highOpts.length} high-priority issues:
${highOpts.map(o => `- ${o.title}`).join('\n')}`
```

---

## Markdown Rendering

### Frontend Implementation

**Library:** `marked` (markdown parser)

**Configuration:**
```typescript
import { marked } from 'marked';
import hljs from 'highlight.js';

// Configure marked
marked.setOptions({
  highlight: (code, lang) => {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  },
  breaks: true,        // Convert \n to <br>
  gfm: true           // GitHub Flavored Markdown
});

// Render message
const htmlContent = marked.parse(message.content);
```

**Supported Markdown Features:**
- **Headers:** `# H1`, `## H2`, etc.
- **Code blocks:** ` ```python ... ``` `
- **Inline code:** `` `code` ``
- **Lists:** Bulleted and numbered
- **Links:** `[text](url)`
- **Bold/Italic:** `**bold**`, `*italic*`
- **Tables:** Markdown tables

**Code Syntax Highlighting:**
```typescript
// Supported languages (via highlight.js)
- Python
- Scala
- SQL
- Java
- JavaScript
- JSON
- YAML
```

---

## Usage Tracking

### Token Counting

**Purpose:** Track AI usage for billing and quotas

**Estimation Method:**
```typescript
function estimateTokens(text: string): number {
  // Rough approximation: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}
```

**Tracked Metrics:**
- User message token count
- Assistant message token count
- Total tokens per session
- Total tokens per user

**Database Storage:**
```typescript
// In ChatMessage
tokenCount: number;  // Estimated tokens for this message

// Aggregate queries
SELECT SUM(tokenCount) as totalTokens
FROM ChatMessage
WHERE sessionId = ? AND role = 'ASSISTANT';
```

---

## Example Chat Interactions

### Example 1: General Optimization Advice

```
User: "What are the best practices for optimizing Spark joins?"

AI: "Here are key best practices for optimizing Spark joins:

**1. Broadcast Joins for Small Tables**
When one table is small (<10 MB), use broadcast join to avoid shuffle:
```python
from pyspark.sql.functions import broadcast
large_df.join(broadcast(small_df), 'key')
```

**2. Partition Pruning**
Filter before joining to reduce data volume:
```python
large_df.filter(col('date') >= '2024-01-01').join(other_df, 'key')
```

**3. Choose Optimal Join Type**
- Inner join: Fastest, use when possible
- Left join: Use only when necessary
- Avoid cross joins: Almost always problematic

**4. Salting for Skewed Joins**
If one key has many values:
```python
df.withColumn('salt', (rand() * 10).cast('int'))
  .join(other_df, ['key', 'salt'])
```

Would you like me to explain any of these in more detail?"
```

### Example 2: Context-Aware Analysis Question

```
User: "Why is my query so slow?"

AI: "Looking at your analysis, I can see several factors contributing to
the slow performance:

**Critical Issues:**
1. **Cartesian Product in Stage 3** (Estimated impact: 1800s saved)
   - Your join between 'customers' and 'orders' is missing a join condition
   - This creates an exponential row explosion

2. **Shuffle Storm in Stage 5** (Estimated impact: 1200s saved)
   - 120GB of data is being shuffled across 200 partitions
   - This is caused by the groupBy without pre-aggregation

**Immediate Actions:**
1. Add explicit join condition:
```python
customers.join(orders, customers.id == orders.customer_id, 'inner')
```

2. Increase partitions before groupBy:
```python
df.repartition(400, 'key').groupBy('key').agg(...)
```

Implementing these two changes should reduce your query time by
approximately 50 minutes and save around $65 in compute costs."
```

### Example 3: Code-Specific Question

```
User: "How do I cache a DataFrame correctly?"

AI: "Here's how to effectively cache DataFrames in Spark:

**Basic Caching:**
```python
# Cache in memory
df.cache()

# Or explicitly
df.persist()

# Always trigger an action after caching
df.count()
```

**Storage Levels:**
```python
from pyspark import StorageLevel

# Memory only (fastest, but may evict)
df.persist(StorageLevel.MEMORY_ONLY)

# Memory + disk (safer)
df.persist(StorageLevel.MEMORY_AND_DISK)

# Serialized (less memory, more CPU)
df.persist(StorageLevel.MEMORY_ONLY_SER)
```

**Best Practices:**
1. **Only cache what you reuse** - Caching has overhead
2. **Unpersist when done** - Free up memory
   ```python
   df.unpersist()
   ```
3. **Cache after expensive operations** - Before filters/aggregations
4. **Monitor cache usage** - Use Spark UI to verify cache hit rate

**Example:**
```python
# Good: Cache after expensive join, before multiple aggregations
cached_df = large_df.join(other_df, 'key').cache()
cached_df.count()  # Trigger caching

agg1 = cached_df.groupBy('col1').sum()
agg2 = cached_df.groupBy('col2').count()

cached_df.unpersist()  # Clean up
```

Would you like more details on any storage level?"
```

---

## Performance Considerations

### 1. Context Size Management
- Limit conversation history to last 10 messages
- Prevents excessive token usage
- Keeps prompts under Gemini's limits

### 2. Response Streaming (Future)
- Currently: Wait for full response
- Planned: Stream tokens as they're generated
- Better UX for long responses

### 3. Caching (Future)
- Cache common questions and answers
- Reduce AI API calls for repeated queries

---

## Error Handling

### Frontend Errors
- **Network failure:** Retry with exponential backoff
- **AI timeout:** Display timeout message, allow retry
- **Empty response:** Show error, suggest rephrasing

### Backend Errors
- **Session not found:** 404 error
- **Gemini API error:** Fallback message + log error
- **Rate limiting:** Queue requests or return 429 status

---

## Future Enhancements

- [ ] **Voice input/output:** Speech-to-text and text-to-speech
- [ ] **Response streaming:** Real-time token streaming
- [ ] **Multi-modal input:** Upload images of execution plans
- [ ] **Chat templates:** Pre-defined optimization questions
- [ ] **Session sharing:** Share chat sessions with team members
- [ ] **Export conversations:** Download as PDF or markdown
- [ ] **Custom AI personalities:** Choose between concise/detailed responses
- [ ] **Code execution:** Run suggested code snippets in sandbox
- [ ] **Interactive tutorials:** Step-by-step optimization guides
- [ ] **Feedback mechanism:** Thumbs up/down on AI responses
