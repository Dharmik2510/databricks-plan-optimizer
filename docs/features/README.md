# BrickOptima - Feature Documentation

Comprehensive technical documentation covering all features from frontend to backend implementation.

---

## Overview

BrickOptima is a full-stack AI-powered Databricks Spark optimization platform that helps data engineers identify performance bottlenecks, optimize execution plans, and reduce costs. Built with React/TypeScript frontend, NestJS/PostgreSQL backend, and powered by Google Gemini 2.0 AI.

---

## Features Documentation

### Core Features

#### [01. Authentication & User Management](./01-authentication-user-management.md)
- **Summary:** JWT-based authentication with refresh token rotation, multi-device session management, and password reset
- **Key Technologies:** JWT, bcrypt, Prisma, PostgreSQL
- **Frontend:** AuthContext, AuthPage, ProtectedRoute
- **Backend:** AuthService, JwtAuthGuard, RefreshToken management
- **Highlights:**
  - Token refresh flow with automatic retry
  - Multi-device session tracking
  - Password reset via email
  - Secure token storage and rotation

---

#### [02. Spark Plan Analysis](./02-spark-plan-analysis.md)
- **Summary:** AI-powered analysis of Apache Spark execution plans to detect bottlenecks and generate optimization recommendations
- **Key Technologies:** Google Gemini 2.0 Flash, Structured JSON output, Async processing
- **Frontend:** Plan input (text/file upload), Analysis polling, Results display
- **Backend:** AnalysisService, GeminiService, DAG parsing and repair
- **Highlights:**
  - Detects Cartesian products, shuffle storms, data skew, memory pressure
  - Generates actionable recommendations with confidence scores
  - Estimates time and cost savings per optimization
  - Content deduplication via SHA-256 hashing

---

#### [03. DAG Visualization](./03-dag-visualization.md)
- **Summary:** Interactive D3.js-powered directed acyclic graph visualization of Spark execution plans
- **Key Technologies:** D3.js force simulation, SVG rendering, Zoom/pan behavior
- **Frontend:** EnhancedDagVisualizer, DAGCanvas, useDagLayout hook
- **Backend:** DAG data from analysis result
- **Highlights:**
  - Force-directed layout with collision detection
  - Node coloring by operation type
  - Edge highlighting for problematic shuffles
  - Minimap for large DAGs (50+ nodes)
  - Interactive node selection and details panel

---

#### [04. Code Mapping Agent](./04-code-mapping-agent.md)
- **Summary:** Intelligent agentic system that maps execution plan stages to actual source code using evidence-based matching
- **Key Technologies:** simple-git, Multi-strategy matching, Evidence scoring
- **Frontend:** PlanCodeMapper, AgentProgressTracker, MappingResultsView
- **Backend:** PlanCodeAgentOrchestrator, RepositoryCrawler, PlanParser, MappingEngine
- **Highlights:**
  - Clones GitHub repos and analyzes Python/Scala/SQL files
  - 5 matching strategies (table name, operation, keyword, function, comment)
  - Confidence scoring (0-100%) with evidence breakdown
  - Async job processing with real-time progress updates
  - Supports .py, .scala, .sql, .ipynb files

---

#### [05. AI Consultant Chat](./05-ai-consultant-chat.md)
- **Summary:** Context-aware conversational AI assistant for Spark optimization advice and code examples
- **Key Technologies:** Google Gemini 2.0 Chat API, Markdown rendering, Conversation history
- **Frontend:** ChatInterface, useChat hook, Message component with syntax highlighting
- **Backend:** ChatService, Session management, Context building
- **Highlights:**
  - Analysis-linked sessions for context-aware responses
  - Conversation history (last 10 messages)
  - Markdown rendering with code syntax highlighting
  - Token usage tracking
  - Persistent chat sessions

---

#### [06. Cost Estimation & Pricing](./06-cost-estimation-pricing.md)
- **Summary:** Real-time cloud instance pricing from AWS/Azure/GCP with DBU cost calculations
- **Key Technologies:** AWS/Azure pricing APIs, DBU pricing logic, 24-hour caching
- **Frontend:** CostEstimator component, Instance selector, Cost breakdown
- **Backend:** PricingService, Cloud provider integrations, PricingCache
- **Highlights:**
  - Real-time pricing from runs-on.com (AWS) and Azure Retail API
  - DBU pricing calculations by workload type (Jobs, All-Purpose, SQL)
  - Regional pricing multipliers
  - Cost savings projections based on optimizations
  - 24-hour cache TTL for performance

---

#### [07. Analysis History](./07-analysis-history.md)
- **Summary:** Persistent storage and management of all analyses with filtering, searching, and pagination
- **Key Technologies:** PostgreSQL with indexes, Pagination, Full-text search
- **Frontend:** History tab, AnalysisCard component, useAnalysis hook
- **Backend:** AnalysisService with filters, Prisma queries, Denormalized fields
- **Highlights:**
  - Filter by status, severity, date range
  - Search by title/content
  - Paginated results (10 per page)
  - Quick actions (view, retry, delete)
  - Denormalized fields for fast filtering
  - Composite indexes for performance

---

#### [08. Advanced Insights](./08-advanced-insights.md)
- **Summary:** AI-generated predictive analytics, bottleneck identification, cluster recommendations, and what-if scenarios
- **Key Technologies:** Predictive modeling, Scalability scoring, Configuration tuning
- **Frontend:** Insights tab, ScalabilityGauge, InsightCard components
- **Backend:** Generated by Gemini during analysis
- **Highlights:**
  - Bottleneck analysis with 1x/10x/100x projections
  - Scalability score (0-100) with breakdown
  - Cluster right-sizing recommendations
  - Spark configuration tuning suggestions
  - Query rewrite suggestions (denormalization, materialized views)
  - What-if scenarios for data scale growth

---

## Technical Architecture Summary

### Frontend Stack
- **Framework:** React 18 with TypeScript
- **Build:** Vite
- **Styling:** Tailwind CSS
- **State:** React Context API (Auth, Theme, Toast)
- **Visualization:** D3.js (DAG), Three.js (background)
- **HTTP Client:** Axios with token refresh interceptor

### Backend Stack
- **Framework:** NestJS (Node.js + TypeScript)
- **Database:** PostgreSQL 14+ with Prisma ORM
- **Authentication:** JWT with refresh token rotation
- **AI:** Google Gemini 2.0 Flash
- **Cloud APIs:** AWS/Azure/GCP pricing APIs
- **Security:** Helmet, CORS, Rate limiting

### Key Integrations
- **Google Gemini 2.0:** Structured analysis and chat
- **GitHub (simple-git):** Repository cloning for code mapping
- **Cloud Provider APIs:** Real-time instance pricing
- **PostgreSQL:** Transactional data storage with JSON fields

---

## Data Flow Overview

### Typical User Journey

1. **Login** → JWT tokens issued, stored in localStorage
2. **Submit Spark Plan** → Async AI analysis begins
3. **Poll Status** → Frontend checks every 2 seconds
4. **View DAG** → D3.js renders interactive graph
5. **Review Optimizations** → AI-generated recommendations displayed
6. **Start Code Mapping** → Clone repo, map stages to code
7. **Chat with AI** → Ask questions with analysis context
8. **Estimate Costs** → Select cloud provider, view pricing
9. **Review Insights** → Bottlenecks, scalability, what-if scenarios
10. **Access History** → View past analyses, compare results

---

## API Endpoints Reference

### Authentication
- `POST /api/v1/auth/register` - Create account
- `POST /api/v1/auth/login` - Authenticate
- `POST /api/v1/auth/refresh` - Refresh tokens
- `GET /api/v1/auth/me` - Get current user

### Analysis
- `POST /api/v1/analyses` - Create analysis
- `GET /api/v1/analyses` - List with filters
- `GET /api/v1/analyses/:id` - Get full result
- `GET /api/v1/analyses/:id/status` - Poll status
- `POST /api/v1/analyses/:id/retry` - Retry failed

### Code Mapping
- `POST /api/v1/agent/jobs` - Start mapping job
- `GET /api/v1/agent/jobs/:id` - Get job status/results
- `POST /api/v1/agent/jobs/:id/cancel` - Cancel job

### Chat
- `POST /api/v1/chat/sessions` - Create session
- `GET /api/v1/chat/sessions` - List sessions
- `POST /api/v1/chat/sessions/:id/messages` - Send message

### Pricing
- `GET /api/v1/pricing/instances` - Get instance pricing
- `GET /api/v1/pricing/regions` - List regions

---

## Database Schema Highlights

### Key Tables
- **User:** Authentication and settings
- **Analysis:** Execution plan analyses with results (JSONB)
- **ChatSession & ChatMessage:** Conversation history
- **RefreshToken:** JWT refresh token management
- **PricingCache:** Cloud pricing data (24hr TTL)

### Indexing Strategy
- Composite indexes on `(userId, createdAt)` for user history
- Status and severity indexes for filtering
- Content hash index for deduplication
- Foreign key indexes for joins

---

## Performance Optimization Techniques

1. **Content Deduplication:** SHA-256 hashing prevents re-analyzing identical plans
2. **Async Processing:** Non-blocking analysis with polling
3. **Database Indexing:** Optimized queries for filtering/pagination
4. **Caching:** 24-hour pricing cache, frontend state caching
5. **Selective Field Loading:** List queries exclude heavy JSON fields
6. **Parallel Processing:** Code analysis runs file scans in parallel
7. **Force Simulation Capping:** D3 layout stabilizes faster for large graphs

---

## Security Features

- **JWT Authentication:** HS256 signing with short-lived access tokens (15min)
- **Refresh Token Rotation:** New refresh token on every refresh
- **Password Hashing:** bcrypt with 10 salt rounds
- **SQL Injection Prevention:** Prisma ORM parameterized queries
- **XSS Protection:** Input sanitization and CSP headers
- **CORS:** Configured origins only
- **Rate Limiting:** Throttler guards on sensitive endpoints

---

## Future Roadmap

### High Priority
- [ ] Real-time streaming analysis with WebSocket updates
- [ ] Export features (PDF reports, DAG images)
- [ ] Automated Spark configuration application
- [ ] ML-based optimization predictions

### Medium Priority
- [ ] Multi-repo code mapping support
- [ ] OAuth integration (Google, GitHub)
- [ ] Two-factor authentication
- [ ] Cost budget tracking and alerts

### Long-term
- [ ] WebGL DAG rendering for 1000+ node graphs
- [ ] Collaborative features (team sharing, comments)
- [ ] Integration with Databricks workspaces
- [ ] Historical trend analysis and A/B testing

---

## Contributing

When adding new features, please create documentation following this structure:

1. **Feature Overview:** Brief description and purpose
2. **Technical Architecture:** Frontend and backend components
3. **Data Flow:** Detailed flow diagrams with steps
4. **Database Schema:** Relevant tables and indexes
5. **API Endpoints:** Request/response formats
6. **Performance Considerations:** Optimizations applied
7. **Error Handling:** Frontend and backend error cases
8. **Usage Examples:** Code snippets
9. **Future Enhancements:** Planned improvements

---

## Support

For questions or issues:
- GitHub Issues: [repository]/issues
- Documentation: This directory
- Email: support@brickoptima.com

---

**Last Updated:** January 2025
**Documentation Version:** 1.0
**Application Version:** 1.14.0
