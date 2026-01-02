# Environment Variables Reference

**BrickOptima Backend - Complete Configuration**

## Core Configuration

### NODE_ENV
**Description**: Application environment
**Values**: `development` | `production` | `test`
**Default**: `development`
**Required**: No
**Example**: `NODE_ENV=production`

**Impact**:
- `production`: JSON logs, CORS restrictions, error handling in production mode
- `development`: Pretty logs, relaxed CORS, stack traces in errors

---

### PORT
**Description**: HTTP server port
**Default**: `3001`
**Required**: No
**Example**: `PORT=3001`

**Note**: Cloud Run sets this automatically. Don't override in Cloud Run deployments.

---

### DATABASE_URL
**Description**: PostgreSQL connection string
**Required**: Yes
**Example**: `DATABASE_URL=postgresql://user:password@host:5432/database?schema=public`

**Format**:
```
postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE?schema=SCHEMA
```

**For Supabase**:
```
postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
```

---

### JWT_SECRET
**Description**: Secret key for signing JWT tokens
**Required**: Yes
**Example**: `JWT_SECRET=your-super-secret-key-min-32-chars`

**Security**:
- Minimum 32 characters
- Use cryptographically random string
- Never commit to version control
- Rotate periodically in production

**Generate**:
```bash
openssl rand -base64 32
```

---

### CORS_ORIGIN
**Description**: Allowed CORS origins (comma-separated)
**Default**: `http://localhost:3000`
**Required**: No
**Example**: `CORS_ORIGIN=https://app.example.com,https://www.example.com`

**Special values**:
- `*`: Allow all origins (not recommended for production)
- Cloud Run frontend URLs automatically allowed: `https://brickoptima-frontend-*.run.app`

---

## Observability (Phase 1)

### LOG_LEVEL
**Description**: Logging verbosity
**Values**: `error` | `warn` | `info` | `debug` | `verbose`
**Default**: `info`
**Required**: No
**Example**: `LOG_LEVEL=info`

**Levels**:
- `error`: Only errors
- `warn`: Warnings + errors
- `info`: Info + warn + errors (recommended for production)
- `debug`: Debug + info + warn + errors (development)
- `verbose`: All logs (very noisy)

---

### REQUEST_AUDIT_SAMPLING_RATE
**Description**: Percentage of successful requests to store in database
**Values**: `0.0` to `1.0` | `all` | `none`
**Default**: `0.1` (10%)
**Required**: No
**Example**: `REQUEST_AUDIT_SAMPLING_RATE=0.1`

**Values**:
- `0.1`: 10% of successful requests (recommended for production)
- `0.5`: 50% of successful requests
- `1.0` or `all`: All requests (caution: high volume)
- `0.0` or `none`: No successful requests (errors only)

**Note**: Errors (4xx, 5xx) are always stored regardless of this setting.

**Cost impact**:
- `0.1`: ~10 GB/month for 100K requests/day
- `1.0`: ~100 GB/month for 100K requests/day

---

### OTEL_ENABLED
**Description**: Enable OpenTelemetry distributed tracing
**Values**: `true` | `false`
**Default**: `false`
**Required**: No
**Example**: `OTEL_ENABLED=true`

**When to enable**:
- Production environments (recommended)
- Debugging distributed systems
- Performance profiling

**When to disable**:
- Local development (less noise)
- Cost-sensitive environments

---

### GCP_PROJECT_ID
**Description**: Google Cloud Platform project ID
**Required**: Only if `OTEL_ENABLED=true`
**Example**: `GCP_PROJECT_ID=my-project-123`

**Find your project ID**:
```bash
gcloud config get-value project
```

---

### SERVICE_NAME
**Description**: Service name for tracing and logging
**Default**: `brickoptima-api`
**Required**: No
**Example**: `SERVICE_NAME=brickoptima-api`

**Best practices**:
- Use kebab-case
- Include environment suffix for multi-env: `brickoptima-api-staging`
- Keep consistent across all services

---

### APP_VERSION
**Description**: Application version for tracing
**Default**: `unknown`
**Required**: No
**Example**: `APP_VERSION=1.0.0`

**Recommended**:
- Use semantic versioning: `MAJOR.MINOR.PATCH`
- Auto-set via CI/CD: `APP_VERSION=$CI_COMMIT_TAG`
- Or use Git SHA: `APP_VERSION=$CI_COMMIT_SHA`

---

### GOOGLE_APPLICATION_CREDENTIALS
**Description**: Path to GCP service account key JSON
**Required**: Only for local development with OTEL
**Example**: `GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json`

**Usage**:
- **Local development**: Set this variable
- **Cloud Run**: Not needed (uses service account automatically)
- **CI/CD**: Use workload identity or key injection

**Create service account key**:
```bash
gcloud iam service-accounts keys create key.json \
  --iam-account=SERVICE_ACCOUNT@PROJECT.iam.gserviceaccount.com
```

**Security**:
- Never commit key files to version control
- Add `*.json` to `.gitignore`
- Use workload identity in production

---

## Rate Limiting

### THROTTLE_TTL
**Description**: Rate limit time window (milliseconds)
**Default**: `60000` (1 minute)
**Required**: No
**Example**: `THROTTLE_TTL=60000`

---

### THROTTLE_LIMIT
**Description**: Maximum requests per TTL window
**Default**: `100`
**Required**: No
**Example**: `THROTTLE_LIMIT=100`

**Calculation**:
- 100 requests per 60 seconds = 100 req/min
- Adjust based on your API load

---

## External Services

### SENTRY_DSN
**Description**: Sentry error tracking DSN
**Required**: No (optional)
**Example**: `SENTRY_DSN=https://[KEY]@[ORG].ingest.sentry.io/[PROJECT]`

**Find your DSN**:
1. Go to Sentry project settings
2. Client Keys (DSN)
3. Copy DSN

**When to use**:
- Production environments
- Staging environments
- Not needed for local development

---

### GOOGLE_GENERATIVE_AI_API_KEY
**Description**: Google Gemini API key
**Required**: Yes (for analysis features)
**Example**: `GOOGLE_GENERATIVE_AI_API_KEY=AIzaSy...`

**Get API key**:
1. Go to: https://makersuite.google.com/app/apikey
2. Create API key
3. Copy and paste

---

## Email (Optional)

### SMTP_HOST
**Description**: SMTP server hostname
**Required**: No
**Example**: `SMTP_HOST=smtp.gmail.com`

---

### SMTP_PORT
**Description**: SMTP server port
**Default**: `587`
**Required**: No
**Example**: `SMTP_PORT=587`

---

### SMTP_USER
**Description**: SMTP authentication username
**Required**: No
**Example**: `SMTP_USER=noreply@example.com`

---

### SMTP_PASSWORD
**Description**: SMTP authentication password
**Required**: No
**Example**: `SMTP_PASSWORD=your-password`

---

### SMTP_FROM
**Description**: Default sender email address
**Default**: `noreply@brickoptima.com`
**Required**: No
**Example**: `SMTP_FROM=noreply@example.com`

---

## Complete Example (.env)

### Local Development
```bash
# Core
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://postgres:password@localhost:5432/brickoptima
JWT_SECRET=your-super-secret-key-change-this-in-production-min-32-chars
CORS_ORIGIN=http://localhost:3000

# Observability (minimal for local dev)
LOG_LEVEL=debug
REQUEST_AUDIT_SAMPLING_RATE=none
OTEL_ENABLED=false

# Rate Limiting
THROTTLE_TTL=60000
THROTTLE_LIMIT=100

# External Services
GOOGLE_GENERATIVE_AI_API_KEY=AIzaSy...
# SENTRY_DSN=  # Optional
```

### Production (Cloud Run)
```bash
# Core
NODE_ENV=production
# PORT=8080  # Set automatically by Cloud Run
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres
JWT_SECRET=[ROTATE-THIS-SECRET-PERIODICALLY-MIN-32-CHARS]
CORS_ORIGIN=https://app.brickoptima.com,https://www.brickoptima.com

# Observability (full stack)
LOG_LEVEL=info
REQUEST_AUDIT_SAMPLING_RATE=0.1
OTEL_ENABLED=true
GCP_PROJECT_ID=brickoptima-prod
SERVICE_NAME=brickoptima-api
APP_VERSION=1.0.0
# GOOGLE_APPLICATION_CREDENTIALS not needed on Cloud Run

# Rate Limiting
THROTTLE_TTL=60000
THROTTLE_LIMIT=1000  # Higher limit for production

# External Services
GOOGLE_GENERATIVE_AI_API_KEY=AIzaSy...
SENTRY_DSN=https://[KEY]@[ORG].ingest.sentry.io/[PROJECT]

# Email (if configured)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=[SENDGRID_API_KEY]
SMTP_FROM=noreply@brickoptima.com
```

---

## Security Best Practices

### 1. Never Commit Secrets
```bash
# Add to .gitignore
.env
.env.local
.env.production
*.json  # GCP service account keys
```

### 2. Use Secret Management
- **Local dev**: `.env.local` (gitignored)
- **Cloud Run**: Secret Manager
- **CI/CD**: Repository secrets

### 3. Rotate Secrets Regularly
- JWT_SECRET: Every 90 days
- API keys: Every 6 months
- Database passwords: Every year

### 4. Principle of Least Privilege
- Only grant necessary GCP permissions
- Use separate service accounts per environment
- Limit API key scopes

### 5. Environment Separation
- Separate `.env` files per environment
- Never reuse production secrets in development
- Use different GCP projects for prod/staging

---

## Setting Environment Variables

### Local Development
```bash
# Create .env file
cp .env.example .env

# Edit .env
nano .env

# Variables are automatically loaded by NestJS ConfigModule
npm run start:dev
```

### Cloud Run
```bash
# Set via gcloud CLI
gcloud run services update brickoptima-api \
  --update-env-vars NODE_ENV=production,LOG_LEVEL=info

# Set via Secret Manager (recommended for secrets)
gcloud run services update brickoptima-api \
  --update-secrets DATABASE_URL=database-url:latest,JWT_SECRET=jwt-secret:latest
```

### Docker
```bash
# Via docker-compose.yml
environment:
  - NODE_ENV=production
  - DATABASE_URL=${DATABASE_URL}

# Via docker run
docker run -e NODE_ENV=production -e DATABASE_URL=... brickoptima-api
```

---

## Troubleshooting

### "Environment variable not found"
1. Check spelling (case-sensitive)
2. Ensure `.env` file exists
3. Restart the application
4. Check `ConfigModule.forRoot()` in `app.module.ts`

### "Cannot connect to database"
1. Check `DATABASE_URL` format
2. Verify database is accessible
3. Check firewall rules
4. Test connection: `psql $DATABASE_URL`

### "Tracing not working"
1. Ensure `OTEL_ENABLED=true`
2. Verify `GCP_PROJECT_ID` is set
3. Check service account permissions
4. Look for errors in logs: `OpenTelemetry`

### "CORS errors"
1. Check `CORS_ORIGIN` includes your frontend URL
2. Verify URL format (include protocol: `https://`)
3. Check browser console for exact error

---

**Last Updated**: January 2, 2026
**Version**: 1.0.0
