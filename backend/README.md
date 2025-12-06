# BrickOptima Backend

NestJS backend API for BrickOptima - Databricks DAG Analyzer.

## Tech Stack

- **Framework**: NestJS 10
- **Database**: PostgreSQL 16 + Prisma ORM
- **Authentication**: JWT with refresh token rotation
- **AI Integration**: Google Gemini 2.0 Flash

## Prerequisites

- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 16 (or use Docker)

## Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Setup Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your values
# - Set a strong JWT_SECRET
# - Add your GEMINI_API_KEY
```

### 3. Start Database

```bash
# Start PostgreSQL with Docker
docker-compose up -d postgres

# Or connect to existing PostgreSQL and update DATABASE_URL in .env
```

### 4. Initialize Database

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate
```

### 5. Start Development Server

```bash
npm run start:dev
```

Server will be running at `http://localhost:3001`

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - Logout
- `GET /api/v1/auth/me` - Get current user

### Users
- `GET /api/v1/users/me` - Get profile
- `PATCH /api/v1/users/me` - Update profile
- `PATCH /api/v1/users/me/password` - Change password
- `GET /api/v1/users/me/stats` - Get user statistics
- `DELETE /api/v1/users/me` - Delete account

### Analysis
- `POST /api/v1/analyses` - Create new analysis
- `GET /api/v1/analyses` - List analyses
- `GET /api/v1/analyses/:id` - Get analysis details
- `GET /api/v1/analyses/:id/status` - Get analysis status (polling)
- `POST /api/v1/analyses/:id/retry` - Retry failed analysis
- `DELETE /api/v1/analyses/:id` - Delete analysis

### Chat
- `POST /api/v1/chat/sessions` - Create chat session
- `GET /api/v1/chat/sessions` - List chat sessions
- `GET /api/v1/chat/sessions/:id` - Get session with messages
- `POST /api/v1/chat/sessions/:id/messages` - Send message
- `DELETE /api/v1/chat/sessions/:id` - Delete session

## Scripts

```bash
# Development
npm run start:dev     # Start with hot reload
npm run start:debug   # Start with debugger

# Production
npm run build         # Build for production
npm run start:prod    # Start production server

# Database
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Run migrations
npm run prisma:studio    # Open Prisma Studio
npm run db:reset         # Reset database

# Quality
npm run lint          # Run ESLint
npm run test          # Run tests
npm run test:cov      # Run tests with coverage
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | - |
| `JWT_SECRET` | Secret for JWT signing | - |
| `JWT_ACCESS_EXPIRES_IN` | Access token expiry | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiry | `7d` |
| `GEMINI_API_KEY` | Google Gemini API key | - |
| `PORT` | Server port | `3001` |
| `CORS_ORIGIN` | Allowed CORS origins | `http://localhost:3000` |

## Database Schema

```
User
├── Analysis (1:many)
│   └── ChatSession (1:many)
│       └── ChatMessage (1:many)
├── ChatSession (1:many)
└── RefreshToken (1:many)
```

## License

MIT
