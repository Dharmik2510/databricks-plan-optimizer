# Observability Quick Start Guide

**BrickOptima Phase 1 - Core Observability**

## 🚀 Quick Setup (5 minutes)

### 1. Environment Variables

Add to your `.env` file:

```bash
# Required for production
NODE_ENV=production
LOG_LEVEL=info

# Request audit sampling (10% of successful requests)
REQUEST_AUDIT_SAMPLING_RATE=0.1

# OpenTelemetry (optional, recommended for production)
OTEL_ENABLED=true
GCP_PROJECT_ID=your-project-id
SERVICE_NAME=brickoptima-api
APP_VERSION=1.0.0

# Local development only (not needed on Cloud Run)
# GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
```

### 2. Run Database Migration

```bash
cd backend
npx prisma migrate deploy
```

### 3. Start the Application

```bash
npm run start:prod
```

That's it! Your observability stack is now active.

## 📊 What's Now Available

### Structured Logs
All logs are now JSON-formatted and include:
- Request ID, Correlation ID, Trace ID
- User ID, Session ID
- Feature area, duration, status code
- Automatic PII redaction

**View logs**:
- Development: Console output
- Production: GCP Cloud Logging

### Request Auditing
All requests (sampled) are stored in the database:
```sql
SELECT * FROM request_audits
WHERE userId = 'user_123'
ORDER BY createdAt DESC
LIMIT 10;
```

### User Session Tracking
Every authenticated request updates session:
```sql
SELECT * FROM user_sessions
WHERE userId = 'user_123'
ORDER BY lastActivityAt DESC;
```

### Distributed Tracing (if OTEL_ENABLED=true)
View in GCP Console:
https://console.cloud.google.com/traces/list?project=YOUR_PROJECT

### Multi-User Data Isolation
All queries are automatically scoped by userId:
```typescript
// This automatically filters by current user:
const analyses = await prisma.analysis.findMany();

// This automatically adds userId on create:
const analysis = await prisma.analysis.create({ data: {...} });
```

## 🔍 Debugging a User Issue (Step-by-Step)

### User reports: "My analysis failed"

**Step 1**: Get user email/ID
```
User: john@example.com
Time: 2026-01-02 14:30 UTC
```

**Step 2**: Find correlation IDs
```sql
SELECT correlationId, traceId, path, statusCode, errorMessage
FROM request_audits
WHERE userId = (SELECT id FROM users WHERE email = 'john@example.com')
  AND createdAt >= '2026-01-02 14:25:00'
  AND createdAt <= '2026-01-02 14:35:00'
ORDER BY createdAt DESC;
```

**Step 3**: Query Cloud Logging
Go to: https://console.cloud.google.com/logs

Query:
```
resource.type="cloud_run_revision"
jsonPayload.correlationId="CORRELATION_ID_FROM_STEP_2"
severity>=ERROR
```

**Step 4**: View distributed trace (if enabled)
Copy `traceId` from logs → Go to Cloud Trace → Paste trace ID

**Done!** You now have full context of what went wrong.

## 📈 Common Queries

### Find all errors for a user (last hour)
```sql
SELECT * FROM request_audits
WHERE userId = 'user_123'
  AND statusCode >= 400
  AND createdAt >= NOW() - INTERVAL '1 hour'
ORDER BY createdAt DESC;
```

### Find slowest requests
```sql
SELECT path, AVG(durationMs) as avg_duration, COUNT(*) as count
FROM request_audits
WHERE createdAt >= NOW() - INTERVAL '24 hours'
GROUP BY path
ORDER BY avg_duration DESC
LIMIT 10;
```

### Active user sessions
```sql
SELECT userId, sessionId, lastActivityAt, ipAddress, userAgent
FROM user_sessions
WHERE lastActivityAt >= NOW() - INTERVAL '15 minutes'
ORDER BY lastActivityAt DESC;
```

### Error rate by feature
```sql
SELECT
  feature,
  COUNT(*) as total,
  COUNT(CASE WHEN statusCode >= 500 THEN 1 END) as server_errors,
  COUNT(CASE WHEN statusCode >= 400 AND statusCode < 500 THEN 1 END) as client_errors
FROM request_audits
WHERE createdAt >= NOW() - INTERVAL '24 hours'
GROUP BY feature;
```

## 🛠️ Configuration Options

### Sampling Rate

Control how many successful requests are stored:

```bash
# Store 10% of successful requests (default)
REQUEST_AUDIT_SAMPLING_RATE=0.1

# Store ALL requests (caution: high volume)
REQUEST_AUDIT_SAMPLING_RATE=all

# Store NO successful requests (errors only)
REQUEST_AUDIT_SAMPLING_RATE=none

# Store 50% of successful requests
REQUEST_AUDIT_SAMPLING_RATE=0.5
```

### Log Level

```bash
# Production (recommended)
LOG_LEVEL=info

# Debug mode (verbose)
LOG_LEVEL=debug

# Quiet mode (errors only)
LOG_LEVEL=error
```

### OpenTelemetry

```bash
# Enable tracing
OTEL_ENABLED=true

# Disable tracing (logs only)
OTEL_ENABLED=false
```

## 🧪 Testing

### Test logging
```bash
curl http://localhost:3001/api/v1/health
```

Check logs for structured output.

### Test request correlation
```bash
curl -H "X-Correlation-ID: test-123" \
     -H "X-Session-ID: session-456" \
     http://localhost:3001/api/v1/health
```

Check logs for `correlationId: test-123`.

### Test error handling
```bash
curl http://localhost:3001/api/v1/invalid-endpoint
```

Should return JSON error with `requestId` and `correlationId`.

### Test user isolation
```typescript
// Login as user A
const analysesA = await prisma.analysis.findMany(); // Only sees user A's data

// Login as user B
const analysesB = await prisma.analysis.findMany(); // Only sees user B's data
```

## 🚨 Troubleshooting

### Logs not in JSON format
- Check: `NODE_ENV=production`
- Restart the application

### Request audits not saving
- Check database connection
- Check `REQUEST_AUDIT_SAMPLING_RATE` setting
- Look for error: `Failed to create request audit`

### Traces not appearing
- Check: `OTEL_ENABLED=true`
- Check: `GCP_PROJECT_ID` is set
- Verify service account permissions
- Allow 1-2 minutes for traces to appear

### Session tracking not working
- Frontend must send `X-Session-ID` header
- JWT must be valid
- Check logs for `Failed to track session`

## 📚 Learn More

- [Full Documentation](./PHASE_1_OBSERVABILITY.md)
- [Database Schema](../backend/prisma/schema.prisma)
- [GCP Cloud Logging](https://console.cloud.google.com/logs)
- [GCP Cloud Trace](https://console.cloud.google.com/traces)

## 🎯 Next Steps

1. **Monitor production**: Watch Cloud Logging for errors
2. **Set up alerts**: Create GCP alerting policies for error rates
3. **Review data**: Check request_audits table weekly
4. **Optimize**: Adjust sampling rate based on volume
5. **Phase 2**: Implement workflow observability (LangGraph logging)

## 💡 Pro Tips

1. **Always include correlation ID** in frontend requests:
   ```typescript
   headers: {
     'X-Correlation-ID': generateUUID(),
     'X-Session-ID': getSessionId(),
   }
   ```

2. **Use structured logging** in your code:
   ```typescript
   this.logger.info('Analysis created', {
     analysisId: analysis.id,
     userId: user.id,
     duration: Date.now() - start
   });
   ```

3. **Query by correlation ID** for full request context:
   - One user action → One correlation ID → All related logs

4. **Leverage indexes**: Queries on indexed fields (correlationId, userId) are fast

5. **Monitor costs**: Review Cloud Logging costs monthly, adjust sampling if needed

## 🆘 Support

For questions or issues:
1. Check logs: `kubectl logs` or Cloud Logging
2. Check database: `npx prisma studio`
3. Review documentation: `docs/PHASE_1_OBSERVABILITY.md`
4. File an issue: GitHub repository

---

**Last Updated**: January 2, 2026
**Version**: 1.0.0
**Status**: Production Ready ✅
