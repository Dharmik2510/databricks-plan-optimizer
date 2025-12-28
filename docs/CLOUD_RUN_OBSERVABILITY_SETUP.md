# Google Cloud Run Observability Integration Guide

Complete guide for integrating observability stack (Prometheus, Sentry, Winston Logging, OpenTelemetry) with Google Cloud Run.

---

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Architecture Overview](#architecture-overview)
3. [Step-by-Step Setup](#step-by-step-setup)
4. [Google Cloud Monitoring Integration](#google-cloud-monitoring-integration)
5. [Sentry Configuration](#sentry-configuration)
6. [Logging with Cloud Logging](#logging-with-cloud-logging)
7. [Dashboards & Alerts](#dashboards--alerts)
8. [Testing & Verification](#testing--verification)

---

## Prerequisites

### 1. Google Cloud Project Setup
```bash
# Set your project ID
export PROJECT_ID="your-gcp-project-id"
export REGION="us-central1"

# Login to Google Cloud
gcloud auth login
gcloud config set project $PROJECT_ID

# Enable required APIs
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  containerregistry.googleapis.com \
  secretmanager.googleapis.com \
  monitoring.googleapis.com \
  logging.googleapis.com \
  cloudtrace.googleapis.com
```

### 2. Sentry Account
1. Go to [sentry.io](https://sentry.io) and create an account
2. Create a new project for "BrickOptima Backend"
3. Copy the DSN (Data Source Name) - looks like: `https://xxxxx@xxxxx.ingest.sentry.io/xxxxx`

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Google Cloud Run                          │
│  ┌────────────────────────────────────────────────────┐     │
│  │         BrickOptima Backend Container              │     │
│  │  ┌──────────────┐  ┌──────────────┐               │     │
│  │  │   NestJS     │  │  Prometheus  │               │     │
│  │  │     App      │──│   /metrics   │───────┐       │     │
│  │  └──────────────┘  └──────────────┘       │       │     │
│  │         │                                  │       │     │
│  │         │ Winston Logger                   │       │     │
│  │         ↓                                  ↓       │     │
│  │  ┌──────────────┐              ┌──────────────┐   │     │
│  │  │    Sentry    │              │ Google Cloud │   │     │
│  │  │  SDK (OTel)  │              │  Monitoring  │   │     │
│  │  └──────────────┘              └──────────────┘   │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
         │                                    │
         ↓                                    ↓
  ┌─────────────┐                    ┌─────────────────┐
  │   Sentry    │                    │  Google Cloud   │
  │  Dashboard  │                    │   Logging UI    │
  └─────────────┘                    └─────────────────┘
         │                                    │
         ↓                                    ↓
  ┌─────────────┐                    ┌─────────────────┐
  │   Error     │                    │   Grafana /     │
  │  Tracking   │                    │   Dashboards    │
  │   + Traces  │                    └─────────────────┘
  └─────────────┘
```

---

## Step-by-Step Setup

### Step 1: Store Secrets in Google Secret Manager

```bash
# Navigate to backend directory
cd backend

# Create secrets
echo -n "your-sentry-dsn-here" | gcloud secrets create SENTRY_DSN --data-file=-
echo -n "$DATABASE_URL" | gcloud secrets create DATABASE_URL --data-file=-
echo -n "$JWT_SECRET" | gcloud secrets create JWT_SECRET --data-file=-
echo -n "$GEMINI_API_KEY" | gcloud secrets create GEMINI_API_KEY --data-file=-
echo -n "$SMTP_PASS" | gcloud secrets create SMTP_PASS --data-file=-

# Grant Cloud Run service account access to secrets
gcloud secrets add-iam-policy-binding SENTRY_DSN \
  --member="serviceAccount:${PROJECT_ID}@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding DATABASE_URL \
  --member="serviceAccount:${PROJECT_ID}@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding JWT_SECRET \
  --member="serviceAccount:${PROJECT_ID}@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_ID}@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding SMTP_PASS \
  --member="serviceAccount:${PROJECT_ID}@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Step 2: Update Environment Variables for Production

Create `backend/.env.production` (DO NOT COMMIT):
```bash
NODE_ENV=production
PORT=3001

# These will be injected via Secret Manager
# DATABASE_URL=
# JWT_SECRET=
# GEMINI_API_KEY=
# SENTRY_DSN=
# SMTP_PASS=

# Public env vars (safe to set in Cloud Run)
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
CORS_ORIGIN=https://your-frontend-domain.run.app
THROTTLE_TTL=60000
THROTTLE_LIMIT=100
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=brickoptima@gmail.com
SMTP_FROM="BrickOptima Support" <brickoptima@gmail.com>
FRONTEND_URL=https://your-frontend-domain.run.app
```

### Step 3: Build and Deploy to Cloud Run

#### Option A: Using Cloud Build (Recommended for CI/CD)

```bash
# Submit build to Cloud Build
gcloud builds submit --config=cloudbuild.yaml ..

# Cloud Build will:
# 1. Build Docker image
# 2. Push to Container Registry
# 3. Deploy to Cloud Run
```

#### Option B: Manual Deployment

```bash
# Build Docker image locally
docker build -t gcr.io/$PROJECT_ID/brickoptima-backend:latest .

# Push to Google Container Registry
docker push gcr.io/$PROJECT_ID/brickoptima-backend:latest

# Deploy to Cloud Run
gcloud run deploy brickoptima-backend \
  --image gcr.io/$PROJECT_ID/brickoptima-backend:latest \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production,PORT=3001,CORS_ORIGIN=https://your-frontend.run.app \
  --set-secrets DATABASE_URL=DATABASE_URL:latest,JWT_SECRET=JWT_SECRET:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest,SENTRY_DSN=SENTRY_DSN:latest,SMTP_PASS=SMTP_PASS:latest \
  --min-instances 1 \
  --max-instances 10 \
  --cpu 2 \
  --memory 2Gi \
  --timeout 300 \
  --concurrency 80 \
  --port 3001
```

### Step 4: Verify Deployment

```bash
# Get the service URL
export SERVICE_URL=$(gcloud run services describe brickoptima-backend \
  --region $REGION \
  --format 'value(status.url)')

echo "Service URL: $SERVICE_URL"

# Test health endpoint
curl $SERVICE_URL/api/v1/health

# Test metrics endpoint
curl $SERVICE_URL/api/v1/metrics
```

---

## Google Cloud Monitoring Integration

### Automatic Metrics from Cloud Run

Cloud Run automatically provides these metrics in Google Cloud Monitoring:
- Request count
- Request latencies (p50, p95, p99)
- Container CPU utilization
- Container memory utilization
- Container instance count
- Billable container instance time

**View in Console:**
```
https://console.cloud.google.com/run/detail/$REGION/brickoptima-backend/metrics
```

### Custom Prometheus Metrics Integration

Your `/api/v1/metrics` endpoint exposes Prometheus metrics. To scrape them into Cloud Monitoring:

#### Option 1: Use Managed Prometheus (Google Cloud Managed Service for Prometheus)

```bash
# Enable Managed Prometheus
gcloud services enable monitoring.googleapis.com

# Deploy a metrics scraper as a Cloud Run Job
gcloud run jobs create metrics-scraper \
  --image gcr.io/google.com/cloudsdktool/cloud-sdk:latest \
  --region $REGION \
  --task-timeout 5m \
  --schedule "*/5 * * * *" \
  --command "/bin/sh,-c,curl -s $SERVICE_URL/api/v1/metrics | gcloud monitoring metrics write --project=$PROJECT_ID"
```

#### Option 2: OpenTelemetry Collector Sidecar (More Advanced)

Create `backend/otel-collector-config.yaml`:
```yaml
receivers:
  prometheus:
    config:
      scrape_configs:
        - job_name: 'brickoptima-backend'
          scrape_interval: 30s
          static_configs:
            - targets: ['localhost:3001']
          metrics_path: '/api/v1/metrics'

exporters:
  googlecloud:
    project: ${PROJECT_ID}
    metric:
      prefix: custom.googleapis.com/brickoptima/

service:
  pipelines:
    metrics:
      receivers: [prometheus]
      exporters: [googlecloud]
```

Update `Dockerfile` to include OTel Collector (multi-container not directly supported in Cloud Run, use Cloud Run Jobs or GKE instead).

---

## Sentry Configuration

### Verify Sentry Integration

Your Sentry is already configured in `main.ts`. Verify it's working:

```bash
# Trigger a test error
curl -X POST $SERVICE_URL/api/v1/test-error

# Check Sentry dashboard
open https://sentry.io/organizations/your-org/projects/
```

### Sentry Features Available

1. **Error Tracking**: All 500+ errors auto-captured
2. **Performance Monitoring**: Transaction traces with OpenTelemetry
3. **Profiling**: CPU/Memory profiles (enabled in main.ts)
4. **Release Tracking**: Add to Cloud Build

#### Add Release Tracking to Cloud Build

Update `cloudbuild.yaml`:
```yaml
steps:
  # ... existing steps ...

  # Create Sentry release
  - name: 'getsentry/sentry-cli'
    args:
      - 'releases'
      - 'new'
      - '$COMMIT_SHA'
      - '--finalize'
    env:
      - 'SENTRY_AUTH_TOKEN=$_SENTRY_AUTH_TOKEN'
      - 'SENTRY_ORG=$_SENTRY_ORG'
      - 'SENTRY_PROJECT=$_SENTRY_PROJECT'

substitutions:
  _SENTRY_AUTH_TOKEN: 'your-sentry-auth-token'
  _SENTRY_ORG: 'your-org'
  _SENTRY_PROJECT: 'brickoptima-backend'
```

---

## Logging with Cloud Logging

### Structured Logging Integration

Your Winston logger is already configured for production (JSON format). Cloud Run automatically ingests stdout/stderr to Cloud Logging.

**View Logs:**
```bash
# Via CLI
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=brickoptima-backend" \
  --limit 50 \
  --format json

# Via Console
open "https://console.cloud.google.com/logs/query?project=$PROJECT_ID"
```

### Log-based Metrics

Create custom metrics from logs:

```bash
# Example: Count 500 errors
gcloud logging metrics create error_500_count \
  --description="Count of 500 errors" \
  --log-filter='resource.type="cloud_run_revision"
    resource.labels.service_name="brickoptima-backend"
    jsonPayload.level="error"
    jsonPayload.statusCode=500'
```

### Correlation ID Tracking

Your middleware adds `X-Correlation-ID` to all requests. Search logs by correlation ID:

```bash
gcloud logging read 'jsonPayload.correlationId="your-correlation-id"' --limit 50
```

---

## Dashboards & Alerts

### Create Cloud Monitoring Dashboard

1. Go to [Cloud Monitoring](https://console.cloud.google.com/monitoring)
2. Click **Dashboards** → **Create Dashboard**
3. Add the following widgets:

#### Widget 1: Request Rate
- Resource: Cloud Run Revision
- Metric: `run.googleapis.com/request_count`
- Aggregator: Rate

#### Widget 2: Request Latency (p95, p99)
- Resource: Cloud Run Revision
- Metric: `run.googleapis.com/request_latencies`
- Aggregator: 95th percentile, 99th percentile

#### Widget 3: Custom HTTP Request Duration
- Resource: Prometheus Target
- Metric: `custom.googleapis.com/brickoptima/http_request_duration_seconds`
- Filter: `status_code != 200`

#### Widget 4: Error Rate
- Resource: Cloud Run Revision
- Metric: Log-based metric `error_500_count`

### Create Alerts

#### Alert 1: High Error Rate
```bash
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="High Error Rate - BrickOptima Backend" \
  --condition-display-name="Error rate > 5%" \
  --condition-threshold-value=0.05 \
  --condition-threshold-duration=300s \
  --condition-filter='resource.type="cloud_run_revision" AND resource.labels.service_name="brickoptima-backend" AND metric.type="run.googleapis.com/request_count"'
```

#### Alert 2: High Latency
```bash
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="High Latency - BrickOptima Backend" \
  --condition-display-name="P95 latency > 2s" \
  --condition-threshold-value=2000 \
  --condition-threshold-duration=300s \
  --condition-filter='resource.type="cloud_run_revision" AND resource.labels.service_name="brickoptima-backend" AND metric.type="run.googleapis.com/request_latencies"'
```

---

## Testing & Verification

### 1. Health Check
```bash
curl $SERVICE_URL/api/v1/health
# Expected: {"status":"ok","timestamp":"...","uptime":...}
```

### 2. Metrics Endpoint
```bash
curl $SERVICE_URL/api/v1/metrics
# Expected: Prometheus-formatted metrics
```

### 3. Generate Load & Check Observability

```bash
# Generate traffic
for i in {1..100}; do
  curl $SERVICE_URL/api/v1/health &
done
wait

# Check Cloud Logging
gcloud logging read "resource.type=cloud_run_revision" --limit 10 --format json

# Check Cloud Monitoring
open "https://console.cloud.google.com/monitoring/dashboards?project=$PROJECT_ID"

# Check Sentry
open "https://sentry.io"
```

### 4. Trigger Error & Verify Sentry

```bash
# Call a non-existent endpoint
curl $SERVICE_URL/api/v1/non-existent

# Check Sentry dashboard for the error
```

---

## Cost Optimization

### Cloud Run Pricing Considerations

- **CPU allocation**: Set to `--cpu 2` (allocated only during request processing)
- **Memory**: `2Gi` - adjust based on actual usage
- **Min instances**: `1` (to avoid cold starts, but costs more)
- **Concurrency**: `80` requests per container

**Optimize:**
```bash
# Reduce min instances to 0 for dev
gcloud run services update brickoptima-backend \
  --region $REGION \
  --min-instances 0

# Monitor actual resource usage
gcloud monitoring time-series list \
  --filter='metric.type="run.googleapis.com/container/memory/utilizations"'
```

### Free Tier Limits

- Cloud Run: 2 million requests/month
- Cloud Logging: 50 GB/month
- Cloud Monitoring: Free for GCP resources
- Sentry: 5k errors/month (free tier)

---

## Troubleshooting

### Logs not appearing in Cloud Logging
- Ensure `NODE_ENV=production` to enable JSON logging
- Check that Winston is logging to stdout/stderr
- Verify service account has `roles/logging.logWriter`

### Metrics not in Cloud Monitoring
- Verify `/api/v1/metrics` endpoint is accessible
- Check if Managed Prometheus scraper is running
- Ensure service account has `roles/monitoring.metricWriter`

### Sentry not capturing errors
- Verify `SENTRY_DSN` secret is correctly set
- Check Sentry project settings
- Ensure errors are 500+ status codes (configured in sentry-exception.filter.ts)

### High Latency
- Check cold start times (increase min-instances)
- Review database query performance
- Check external API call durations in Sentry traces

---

## Production Checklist

- [ ] Secrets stored in Google Secret Manager
- [ ] Sentry DSN configured
- [ ] CORS_ORIGIN set to production frontend URL
- [ ] NODE_ENV=production
- [ ] Min instances set appropriately (1+ for prod, 0 for dev)
- [ ] Cloud Monitoring dashboard created
- [ ] Alerts configured (error rate, latency)
- [ ] Log-based metrics created
- [ ] Sentry release tracking enabled in CI/CD
- [ ] Health check endpoint verified
- [ ] Metrics endpoint verified
- [ ] Database migrations run (`prisma migrate deploy`)

---

## Useful Commands Reference

```bash
# View Cloud Run logs
gcloud run services logs read brickoptima-backend --region $REGION

# Tail logs in real-time
gcloud run services logs tail brickoptima-backend --region $REGION

# Update environment variable
gcloud run services update brickoptima-backend \
  --region $REGION \
  --update-env-vars KEY=VALUE

# Update secret
echo -n "new-value" | gcloud secrets versions add SECRET_NAME --data-file=-

# View service details
gcloud run services describe brickoptima-backend --region $REGION

# Delete service
gcloud run services delete brickoptima-backend --region $REGION
```

---

## Next Steps

1. **Set up CI/CD Pipeline**: Configure GitHub Actions or Cloud Build triggers
2. **Add Custom Metrics**: Extend MetricsInterceptor for business metrics
3. **Implement Alerting**: Set up Slack/Email notifications
4. **Performance Testing**: Use k6 or Artillery to load test
5. **Security Scanning**: Enable Cloud Security Scanner
6. **Cost Monitoring**: Set up billing alerts

---

## Resources

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Cloud Monitoring](https://cloud.google.com/monitoring/docs)
- [Sentry Node.js Guide](https://docs.sentry.io/platforms/node/)
- [Winston Logger](https://github.com/winstonjs/winston)
- [Prometheus Metrics](https://prometheus.io/docs/practices/naming/)
