# Observability Deployment Guide

This guide explains how to deploy the BrickOptima backend with full observability to Google Cloud Run using the existing GitHub Actions workflow.

---

## 🚀 Quick Start

### Prerequisites

1. **Google Cloud Project** set up with required APIs enabled
2. **Sentry Account** with a project created
3. **GitHub Secrets** configured in your repository

---

## Step 1: Setup Google Cloud Secrets

Your backend requires the following secrets to be stored in Google Cloud Secret Manager:

```bash
# Set your project ID
export PROJECT_ID="gen-lang-client-0997977661"

# Navigate to backend scripts
cd backend/scripts

# Run the automated secret setup script
./setup-secrets.sh
```

The script will create/update these secrets:
- `database-url` - PostgreSQL connection string
- `jwt-secret` - JWT signing secret
- `gemini-api-key` - Google Gemini API key
- `sentry-dsn` - Sentry Data Source Name (NEW! 🎉)
- `SMTP_PASS` - SMTP password for emails
- `smtp-user` - SMTP username

### Manual Secret Creation (Alternative)

If you prefer manual setup:

```bash
# Create Sentry DSN secret
echo -n "https://xxxxx@xxxxx.ingest.sentry.io/xxxxx" | \
  gcloud secrets create sentry-dsn --data-file=- --project=$PROJECT_ID

# Grant access to Cloud Run service account
gcloud secrets add-iam-policy-binding sentry-dsn \
  --member="serviceAccount:${PROJECT_ID}@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=$PROJECT_ID
```

---

## Step 2: Configure GitHub Repository Secrets

Your GitHub repository needs these secrets for the deployment workflow:

Go to: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

### Required Secrets:

| Secret Name | Description | Example Value |
|------------|-------------|---------------|
| `GCP_SA_KEY` | Google Cloud Service Account JSON key | `{"type":"service_account",...}` |
| `DATABASE_URL` | Database connection string (for migrations) | `postgresql://user:pass@host:5432/db` |

### How to Get GCP_SA_KEY:

```bash
# Create a service account
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions Deployer" \
  --project=$PROJECT_ID

# Grant necessary roles
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# Create and download key
gcloud iam service-accounts keys create github-actions-key.json \
  --iam-account=github-actions@${PROJECT_ID}.iam.gserviceaccount.com

# Copy the contents of github-actions-key.json to GitHub Secrets as GCP_SA_KEY
cat github-actions-key.json
```

---

## Step 3: Get Your Sentry DSN

1. Go to [sentry.io](https://sentry.io) and sign up/login
2. Create a new project:
   - **Platform**: Node.js
   - **Project Name**: BrickOptima Backend
3. Copy your DSN from: **Settings** → **Projects** → **BrickOptima Backend** → **Client Keys (DSN)**
4. It looks like: `https://xxxxxxxxxxxxx@xxxxx.ingest.sentry.io/xxxxxxx`
5. Store it in Google Secret Manager using the script above

---

## Step 4: Deploy via GitHub Actions

### Option A: Automatic Deployment (Recommended)

Every push to the `main` branch triggers:

1. **Semantic Release** workflow:
   - Analyzes commits
   - Creates a new version/release
   - Updates CHANGELOG.md
   - Creates git tags

2. **Deploy** workflow (if new release):
   - Builds Docker image
   - Pushes to Artifact Registry
   - Deploys backend to Cloud Run with observability
   - Verifies health and metrics endpoints
   - Deploys frontend
   - Runs database migrations

```bash
# Commit and push to main
git add .
git commit -m "feat: add observability stack"
git push origin main

# GitHub Actions will automatically:
# 1. Create a release (if semantic commit)
# 2. Deploy to Cloud Run
# 3. Verify observability endpoints
```

### Option B: Manual Deployment

Trigger deployment manually from GitHub:

1. Go to **Actions** tab
2. Select **Deploy to Cloud Run** workflow
3. Click **Run workflow**
4. Choose branch: `main`
5. Enter version (optional): e.g., `1.0.0` or leave as `latest`
6. Click **Run workflow**

---

## Step 5: Verify Deployment

After deployment completes, the workflow automatically verifies:

✅ Health endpoint: `/api/v1/health`
✅ Metrics endpoint: `/api/v1/metrics`

### Manual Verification:

```bash
# Get your service URL from GitHub Actions logs or run:
export SERVICE_URL="https://brickoptima-backend-xxxxx-uc.a.run.app"

# Test health
curl $SERVICE_URL/api/v1/health
# Expected: {"status":"ok","timestamp":"...","uptime":...}

# Test metrics
curl $SERVICE_URL/api/v1/metrics
# Expected: Prometheus metrics output

# Generate some traffic
for i in {1..50}; do curl $SERVICE_URL/api/v1/health & done
wait
```

---

## Step 6: Access Observability Dashboards

### 1. Google Cloud Monitoring

**Service Metrics:**
```
https://console.cloud.google.com/run/detail/us-central1/brickoptima-backend/metrics?project=gen-lang-client-0997977661
```

**Available Metrics:**
- Request count & rate
- Request latencies (p50, p95, p99)
- Container CPU utilization
- Container memory utilization
- Instance count
- Error rates

### 2. Google Cloud Logging

**View Logs:**
```bash
# Via CLI
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=brickoptima-backend" \
  --limit 50 \
  --format json \
  --project gen-lang-client-0997977661

# Via Console
open "https://console.cloud.google.com/logs/query?project=gen-lang-client-0997977661"
```

**Search by Correlation ID:**
```bash
gcloud logging read 'jsonPayload.correlationId="your-correlation-id-here"' --limit 50
```

### 3. Sentry Dashboard

**Access:** https://sentry.io

**Features Available:**
- Real-time error tracking
- Performance monitoring with traces
- CPU/Memory profiling
- User context from JWT
- Correlation ID tracking
- Stack traces

---

## What's Deployed?

### Observability Stack Configuration

Your deployed backend includes:

#### 1. **Structured Logging**
- Winston logger with JSON formatting in production
- Correlation IDs on every request
- Automatic log ingestion to Cloud Logging

#### 2. **Prometheus Metrics**
- Endpoint: `/api/v1/metrics`
- RED metrics (Rate, Errors, Duration)
- System metrics (CPU, Memory)
- Custom business metrics

#### 3. **Sentry Error Tracking**
- Automatic capture of 500+ errors
- Performance traces with OpenTelemetry
- CPU/Memory profiling (enabled)
- Release tracking via git SHA

#### 4. **Distributed Tracing**
- X-Correlation-ID header on all requests
- Correlation IDs in logs and Sentry
- Request tracking across services

### Deployment Configuration

```yaml
Resource Limits:
  CPU: 2 cores
  Memory: 2Gi
  Min Instances: 1 (no cold starts)
  Max Instances: 10
  Concurrency: 80 requests/instance
  Timeout: 300s (5 minutes)

Environment:
  NODE_ENV: production
  PORT: 3001

Secrets (from Secret Manager):
  DATABASE_URL
  JWT_SECRET
  GEMINI_API_KEY
  SENTRY_DSN ← NEW!
  SMTP_PASS
  SMTP_USER
  FRONTEND_URL
```

---

## Monitoring & Alerts

### Create Alerts in Cloud Monitoring

#### High Error Rate Alert:

```bash
gcloud alpha monitoring policies create \
  --notification-channels=YOUR_CHANNEL_ID \
  --display-name="BrickOptima Backend - High Error Rate" \
  --condition-display-name="Error rate > 5%" \
  --condition-threshold-value=0.05 \
  --condition-threshold-duration=300s \
  --condition-filter='resource.type="cloud_run_revision"
    resource.labels.service_name="brickoptima-backend"
    metric.type="run.googleapis.com/request_count"' \
  --project gen-lang-client-0997977661
```

#### High Latency Alert:

```bash
gcloud alpha monitoring policies create \
  --notification-channels=YOUR_CHANNEL_ID \
  --display-name="BrickOptima Backend - High Latency" \
  --condition-display-name="P95 latency > 2s" \
  --condition-threshold-value=2000 \
  --condition-threshold-duration=300s \
  --condition-filter='resource.type="cloud_run_revision"
    resource.labels.service_name="brickoptima-backend"
    metric.type="run.googleapis.com/request_latencies"' \
  --project gen-lang-client-0997977661
```

---

## Troubleshooting

### Deployment Fails

**Check GitHub Actions logs:**
1. Go to **Actions** tab in GitHub
2. Click on the failed workflow
3. Expand the failed step

**Common Issues:**

| Issue | Solution |
|-------|----------|
| Secret not found | Verify secret exists in Secret Manager and has correct name |
| Permission denied | Check service account has `secretmanager.secretAccessor` role |
| Image build fails | Check Dockerfile syntax and build context |
| Health check fails | Verify app starts correctly, check Cloud Run logs |

### Observability Not Working

**Metrics endpoint returns 404:**
- Verify [metrics.controller.ts](../backend/src/health/metrics.controller.ts) exists
- Ensure [health.module.ts](../backend/src/health/health.module.ts) imports MetricsController

**Logs not in JSON format:**
- Check `NODE_ENV=production` is set in Cloud Run
- Verify [logger.config.ts](../backend/src/config/logger.config.ts) has correct configuration

**Sentry not capturing errors:**
- Verify `SENTRY_DSN` secret is set correctly
- Check Sentry project settings
- Test by triggering a 500 error: `curl $SERVICE_URL/api/v1/nonexistent`

### View Logs

```bash
# Real-time logs
gcloud run services logs tail brickoptima-backend \
  --region us-central1 \
  --project gen-lang-client-0997977661

# Recent errors only
gcloud logging read 'resource.type="cloud_run_revision"
  resource.labels.service_name="brickoptima-backend"
  severity>=ERROR' \
  --limit 50 \
  --project gen-lang-client-0997977661
```

---

## Cost Optimization

### Current Configuration Costs

With the current setup (2 CPU, 2Gi RAM, min-instances=1):

**Estimated Monthly Cost:**
- Cloud Run: ~$40-80 (depends on traffic)
- Cloud Logging: $0 (within free tier for moderate logging)
- Cloud Monitoring: $0 (free for GCP resources)
- Sentry: $0-26 (free tier: 5k errors/month)

**Total: ~$40-106/month**

### Reduce Costs for Development:

```bash
# Update to dev-friendly settings (no min instances, lower resources)
gcloud run services update brickoptima-backend \
  --region us-central1 \
  --min-instances 0 \
  --memory 512Mi \
  --cpu 1 \
  --project gen-lang-client-0997977661

# Cost: ~$5-15/month
```

---

## Production Checklist

Before going live, ensure:

- [ ] `SENTRY_DSN` secret created and accessible
- [ ] All secrets have correct IAM permissions
- [ ] `NODE_ENV=production` set in Cloud Run
- [ ] `CORS_ORIGIN` updated with actual frontend URL
- [ ] Min instances set appropriately (1+ for prod, 0 for dev)
- [ ] Health endpoint verified
- [ ] Metrics endpoint verified
- [ ] Sentry dashboard shows events
- [ ] Cloud Logging shows structured JSON logs
- [ ] Database migrations completed
- [ ] Alerts configured (error rate, latency)

---

## Useful Commands

```bash
# View service details
gcloud run services describe brickoptima-backend \
  --region us-central1 \
  --project gen-lang-client-0997977661

# Update CORS origin after frontend deploys
gcloud run services update brickoptima-backend \
  --region us-central1 \
  --update-env-vars CORS_ORIGIN=https://your-frontend.run.app \
  --project gen-lang-client-0997977661

# View all secrets
gcloud secrets list --project gen-lang-client-0997977661

# Update a secret
echo -n "new-value" | gcloud secrets versions add SECRET_NAME \
  --data-file=- \
  --project gen-lang-client-0997977661

# Trigger deployment manually
gh workflow run deploy.yml --ref main
```

---

## Next Steps

1. **Configure Alerts**: Set up Cloud Monitoring alerts for your SLAs
2. **Create Grafana Dashboard**: Import Prometheus metrics for visualization
3. **Enable Uptime Monitoring**: Use Cloud Monitoring uptime checks
4. **Setup Sentry Releases**: Track deployments in Sentry
5. **Performance Testing**: Load test with k6 or Artillery
6. **Cost Monitoring**: Set up billing alerts in GCP

---

## Support

For issues or questions:
- **Backend Issues**: Check Cloud Run logs
- **Observability Issues**: Review this guide
- **Deployment Issues**: Check GitHub Actions workflow logs
- **Sentry Issues**: Check Sentry project settings

---

## Resources

- [GitHub Actions Workflow](.github/workflows/deploy.yml)
- [Setup Secrets Script](backend/scripts/setup-secrets.sh)
- [Cloud Run Console](https://console.cloud.google.com/run?project=gen-lang-client-0997977661)
- [Cloud Monitoring](https://console.cloud.google.com/monitoring?project=gen-lang-client-0997977661)
- [Sentry Dashboard](https://sentry.io)
