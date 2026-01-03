# Phase 5: GCP Observability Configuration

**Status:** ✅ Implemented
**Date:** January 2026
**Author:** Engineering Team

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Components](#components)
4. [Deployment Guide](#deployment-guide)
5. [Testing & Verification](#testing--verification)
6. [Monitoring & Alerts](#monitoring--alerts)
7. [Troubleshooting](#troubleshooting)
8. [Best Practices](#best-practices)

---

## Overview

Phase 5 implements comprehensive observability for the BrickOptima platform using Google Cloud Platform's native monitoring, logging, and tracing services. This enables proactive monitoring, rapid incident response, and data-driven performance optimization.

### Key Features

- **Centralized Logging**: All application logs exported to BigQuery for analytics
- **Distributed Tracing**: Request flow visualization across services
- **Proactive Alerting**: Automated alerts for errors, failures, and performance issues
- **Custom Metrics**: Business and operational metrics in Cloud Monitoring
- **Error Grouping**: Intelligent error aggregation in Error Reporting

### Services Used

| Service | Purpose | Cost Impact |
|---------|---------|-------------|
| Cloud Logging | Log ingestion and routing | ~$0.50/GB |
| BigQuery | Log storage and analytics | ~$5/TB/month + queries |
| Cloud Monitoring | Metrics, alerts, dashboards | First 150MB free, then ~$0.26/MB |
| Cloud Trace | Distributed tracing | First 2.5M spans free/month |
| Error Reporting | Error aggregation and notifications | Free |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     BrickOptima Application                      │
│  ┌───────────────┐  ┌────────────────┐  ┌───────────────────┐  │
│  │ AppLogger     │  │ WorkflowLogger │  │ ErrorReporting    │  │
│  │ Service       │  │ Service        │  │ Filter            │  │
│  └───────┬───────┘  └────────┬───────┘  └─────────┬─────────┘  │
│          │                   │                      │            │
└──────────┼───────────────────┼──────────────────────┼────────────┘
           │                   │                      │
           ▼                   ▼                      ▼
    ┌──────────────────────────────────────────────────────┐
    │            GCP Cloud Logging (Console Output)         │
    └──────────────────┬───────────────────────────────────┘
                       │
           ┌───────────┼───────────┐
           │           │           │
           ▼           ▼           ▼
    ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
    │  Error   │ │ Workflow │ │ Feedback │ │   HTTP   │
    │  Sink    │ │   Sink   │ │   Sink   │ │   Sink   │
    └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘
         │            │            │            │
         └────────────┴────────────┴────────────┘
                       │
                       ▼
         ┌─────────────────────────────┐
         │  BigQuery: observability_logs │
         │  ┌─────────────────────────┐ │
         │  │ • error_logs_*          │ │
         │  │ • workflow_logs_*       │ │
         │  │ • feedback_logs_*       │ │
         │  │ • http_logs_*           │ │
         │  └─────────────────────────┘ │
         │  ┌─────────────────────────┐ │
         │  │ Materialized Views:     │ │
         │  │ • error_summary_24h     │ │
         │  │ • workflow_performance  │ │
         │  │ • api_performance       │ │
         │  │ • feedback_analytics    │ │
         │  └─────────────────────────┘ │
         └─────────────────────────────┘

    ┌──────────────────────────────────────────┐
    │       Cloud Monitoring & Alerting        │
    │  ┌────────────────────────────────────┐  │
    │  │ Alert Policies:                    │  │
    │  │ • API Error Rate > 5%              │  │
    │  │ • Workflow Failure Rate > 10%      │  │
    │  │ • Critical Tickets Unassigned      │  │
    │  │ • High Memory Usage > 90%          │  │
    │  │ • High DB Connections              │  │
    │  └────────────────────────────────────┘  │
    │  ┌────────────────────────────────────┐  │
    │  │ Notification Channels:             │  │
    │  │ • Email: engineering@brickoptima   │  │
    │  │ • Slack: #engineering (optional)   │  │
    │  └────────────────────────────────────┘  │
    └──────────────────────────────────────────┘

    ┌──────────────────────────────────────────┐
    │           Cloud Trace (OpenTelemetry)    │
    │  • HTTP request tracing                  │
    │  • Workflow execution spans              │
    │  • Database query tracing (Prisma)       │
    │  • External API call tracking            │
    └──────────────────────────────────────────┘

    ┌──────────────────────────────────────────┐
    │              Error Reporting             │
    │  • Automatic error grouping              │
    │  • Stack trace analysis                  │
    │  • User impact tracking                  │
    │  • Error notifications                   │
    └──────────────────────────────────────────┘
```

---

## Components

### 1. Cloud Logging

#### Log Sinks

Four log sinks route application logs to BigQuery:

**1.1 Error Logs Sink** ([observability.tf:64](../terraform/observability.tf#L64))
- **Filter**: `severity >= ERROR AND labels.service = "brickoptima-api"`
- **Purpose**: Capture all errors and critical issues
- **Table**: `observability_logs.error_logs_*`

**1.2 Workflow Logs Sink** ([observability.tf:90](../terraform/observability.tf#L90))
- **Filter**: `jsonPayload.eventName =~ "workflow\\..*"`
- **Purpose**: Track workflow execution lifecycle
- **Table**: `observability_logs.workflow_logs_*`

**1.3 Feedback Logs Sink** ([observability.tf:108](../terraform/observability.tf#L108))
- **Filter**: `jsonPayload.eventName =~ "feedback\\..*"`
- **Purpose**: Monitor feedback system activity
- **Table**: `observability_logs.feedback_logs_*`

**1.4 HTTP Request Logs Sink** ([observability.tf:128](../terraform/observability.tf#L128))
- **Filter**: `jsonPayload.eventName = "http.request"`
- **Purpose**: API performance and traffic analysis
- **Table**: `observability_logs.http_logs_*`

#### BigQuery Dataset

- **Dataset ID**: `observability_logs`
- **Location**: US (multi-region)
- **Retention**: 90 days (configurable)
- **Partitioning**: Daily partitioned tables for query performance
- **Cost**: ~$5/TB/month storage + query costs

### 2. BigQuery Analytics

#### Materialized Views

**2.1 Error Summary (24h)** ([observability.tf:185](../terraform/observability.tf#L185))
```sql
-- Hourly error aggregation with affected users
SELECT
  TIMESTAMP_TRUNC(timestamp, HOUR) as hour,
  severity,
  jsonPayload.error.name as error_name,
  COUNT(*) as error_count,
  COUNT(DISTINCT jsonPayload.userId) as affected_users
FROM observability_logs.error_logs_*
WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
GROUP BY hour, severity, error_name
ORDER BY hour DESC, error_count DESC
```

**2.2 Workflow Performance (24h)** ([observability.tf:211](../terraform/observability.tf#L211))
```sql
-- Workflow performance metrics with percentiles
SELECT
  workflow_name,
  COUNT(*) as total_runs,
  SUM(is_failed) as failed_runs,
  ROUND(AVG(duration_ms), 2) as avg_duration_ms,
  ROUND(APPROX_QUANTILES(duration_ms, 100)[OFFSET(95)], 2) as p95_duration_ms,
  ROUND(100.0 * SUM(is_failed) / COUNT(*), 2) as failure_rate_percent
FROM workflow_runs
GROUP BY workflow_name
```

**2.3 API Performance (24h)** ([observability.tf:256](../terraform/observability.tf#L256))
```sql
-- API endpoint performance and error rates
SELECT
  TIMESTAMP_TRUNC(timestamp, HOUR) as hour,
  http_method,
  endpoint_base,
  COUNT(*) as request_count,
  SUM(CASE WHEN statusCode >= 500 THEN 1 ELSE 0 END) as server_errors,
  ROUND(AVG(durationMs), 2) as avg_duration_ms,
  ROUND(100.0 * server_errors / request_count, 2) as error_rate_percent
FROM observability_logs.http_logs_*
GROUP BY hour, http_method, endpoint_base
```

**2.4 Feedback Analytics (7d)** ([observability.tf:291](../terraform/observability.tf#L291))
```sql
-- Feedback ticket metrics and resolution times
SELECT
  DATE(timestamp) as date,
  category,
  priority,
  status,
  COUNT(DISTINCT ticketId) as ticket_count,
  AVG(resolution_time_hours) as avg_resolution_time_hours
FROM observability_logs.feedback_logs_*
GROUP BY date, category, priority, status
```

### 3. Cloud Monitoring

#### Alert Policies

**3.1 High API Error Rate** ([observability.tf:378](../terraform/observability.tf#L378))
- **Condition**: 5xx error rate > 5% for 5 minutes
- **Severity**: Critical
- **Notifications**: Email
- **Auto-close**: 24 hours
- **Rate limit**: Max 1 alert/hour

**3.2 Workflow Failure Rate** ([observability.tf:438](../terraform/observability.tf#L438))
- **Condition**: Workflow failures > 10% in 30 minutes
- **Severity**: Critical
- **Notifications**: Email
- **Documentation**: Includes troubleshooting steps

**3.3 Critical Tickets Unassigned** ([observability.tf:499](../terraform/observability.tf#L499))
- **Condition**: Critical priority tickets unassigned > 1 hour
- **Severity**: High
- **Notifications**: Email
- **Rate limit**: Alert every 30 minutes

**3.4 High Memory Usage** ([observability.tf:547](../terraform/observability.tf#L547))
- **Condition**: Container memory > 90% for 5 minutes
- **Severity**: High
- **Notifications**: Email only
- **Documentation**: Memory optimization guide

**3.5 High Database Connections** ([observability.tf:590](../terraform/observability.tf#L590))
- **Condition**: DB connections > 80% of pool limit
- **Severity**: Medium
- **Notifications**: Email only

#### Notification Channels

- **Email**: `brickoptima@gmail.com` (configurable via `alert_email` variable)
- **Slack**: Disabled by default (can be enabled by uncommenting in `observability.tf`)

### 4. Cloud Trace

#### OpenTelemetry Configuration ([tracing.config.ts](../backend/src/common/monitoring/tracing.config.ts))

**Automatic Instrumentation**:
- HTTP requests (incoming/outgoing)
- Express.js routes
- Prisma database queries
- External API calls

**Custom Spans**:
```typescript
// Trace a workflow execution
await traceService.traceWorkflow('data-analysis', workflowRunId, async () => {
  // Workflow logic
});

// Trace a database operation
await traceService.traceDbOperation('select', 'workflow_runs', async () => {
  return prisma.workflowRun.findMany();
});

// Trace an external API call
await traceService.traceExternalApi('openai', '/v1/chat/completions', async () => {
  return openai.chat.completions.create({...});
});
```

**Trace Correlation with Logs**:
- Every log entry includes `traceId` and `spanId`
- Cloud Logging UI shows "View in Trace" links
- Click through from logs to distributed traces

### 5. Error Reporting

#### Error Reporting Filter ([error-reporting.filter.ts](../backend/src/common/filters/error-reporting.filter.ts))

**Features**:
- Catches all unhandled exceptions
- Automatic error grouping by stack trace
- User impact tracking
- HTTP context capture
- Sensitive data redaction

**Error Grouping**:
```
Error Reporting groups errors by:
1. Error type (e.g., TypeError, ValidationError)
2. File location
3. Line number
4. Stack trace signature
```

**Notifications**:
- Configured in Error Reporting console
- Can trigger alerts for new errors
- Can send digests for recurring errors

### 6. Custom Metrics

#### Custom Metrics Service ([custom-metrics.service.ts](../backend/src/common/monitoring/custom-metrics.service.ts))

**Exported Metrics**:

1. **workflow_failures** (DOUBLE)
   - Workflow failure rate (0.0 - 1.0)
   - Calculated every 60 seconds
   - Based on last 5 minutes of data

2. **critical_tickets_unassigned** (INT64)
   - Count of critical tickets unassigned > 1 hour
   - Updated every 60 seconds
   - Triggers alert when > 0

3. **db_connection_count** (INT64)
   - Current database connection pool usage
   - Placeholder for Prisma metrics integration

4. **workflow_duration** (INT64)
   - Workflow execution duration in milliseconds
   - Recorded per workflow with labels
   - Used for performance analysis

---

## Deployment Guide

### Prerequisites

1. **GCP Project**: `gen-lang-client-0997977661`
2. **Terraform**: >= 1.0
3. **gcloud CLI**: Configured and authenticated
4. **Permissions**:
   - `roles/bigquery.admin`
   - `roles/logging.admin`
   - `roles/monitoring.admin`

### Step 1: Configure Variables

Edit `terraform/terraform.tfvars`:

```hcl
# Required
project_id = "gen-lang-client-0997977661"
region     = "us-central1"

# Observability
environment = "production"
alert_email = "brickoptima@gmail.com"
# slack_webhook_url = ""  # Optional - disabled by default
```

### Step 2: Deploy Infrastructure

```bash
cd terraform

# Initialize Terraform
terraform init -upgrade

# Review changes
terraform plan

# Apply changes
terraform apply

# Verify outputs
terraform output
```

**Expected Outputs**:
```
bigquery_dataset_id = "observability_logs"
log_sink_ids = {
  error_logs    = "projects/gen-lang-client-0997977661/sinks/error-logs-sink"
  workflow_logs = "projects/gen-lang-client-0997977661/sinks/workflow-logs-sink"
  feedback_logs = "projects/gen-lang-client-0997977661/sinks/feedback-logs-sink"
  http_logs     = "projects/gen-lang-client-0997977661/sinks/http-request-logs-sink"
}
alert_policy_ids = {
  api_error_rate              = "projects/gen-lang-client-0997977661/alertPolicies/123456"
  workflow_failure_rate       = "projects/gen-lang-client-0997977661/alertPolicies/123457"
  critical_tickets_unassigned = "projects/gen-lang-client-0997977661/alertPolicies/123458"
  high_memory_usage           = "projects/gen-lang-client-0997977661/alertPolicies/123459"
  high_db_connections         = "projects/gen-lang-client-0997977661/alertPolicies/123460"
}
```

### Step 3: Update Application Code

**3.1 Install Dependencies**

```bash
cd backend
npm install --save \
  @google-cloud/monitoring \
  @google-cloud/error-reporting \
  @google-cloud/opentelemetry-cloud-trace-exporter \
  @opentelemetry/auto-instrumentations-node \
  @opentelemetry/sdk-node \
  @opentelemetry/semantic-conventions \
  @opentelemetry/instrumentation-http \
  @opentelemetry/instrumentation-express \
  @prisma/instrumentation
```

**3.2 Initialize Tracing in main.ts**

```typescript
// MUST be first import - before NestFactory
import { initializeTracing } from './common/monitoring/tracing.config';
initializeTracing();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
// ... rest of main.ts
```

**3.3 Register Monitoring Module**

```typescript
// app.module.ts
import { MonitoringModule } from './common/monitoring/monitoring.module';

@Module({
  imports: [
    MonitoringModule,  // Add this
    // ... other modules
  ],
})
export class AppModule {}
```

**3.4 Apply Global Error Filter**

```typescript
// main.ts
import { ErrorReportingFilter } from './common/filters/error-reporting.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Get logger from DI
  const logger = app.get(AppLoggerService);

  // Apply global error filter
  app.useGlobalFilters(new ErrorReportingFilter(logger));

  await app.listen(3000);
}
```

### Step 4: Deploy Application

```bash
# Build and deploy to Cloud Run
npm run build
gcloud run deploy brickoptima-api --source . --project=gen-lang-client-0997977661
```

---

## Testing & Verification

### Automated Testing

Run the automated test script:

```bash
cd scripts
./test-observability.sh
```

**Output**:
```
=========================================
Testing GCP Observability Configuration
=========================================
Project: gen-lang-client-0997977661

[1/6] Testing BigQuery Dataset...
✓ BigQuery dataset 'observability_logs' exists

[2/6] Testing Log Sinks...
✓ Log sink 'error-logs-sink' configured
✓ Log sink 'workflow-logs-sink' configured
✓ Log sink 'feedback-logs-sink' configured
✓ Log sink 'http-request-logs-sink' configured

[3/6] Testing Log Export to BigQuery...
✓ Test log written. Check BigQuery for export (may take 1-2 minutes)

[4/6] Testing Cloud Monitoring Alert Policies...
✓ Found 5 alert policies

[5/6] Testing Cloud Trace...
✓ Cloud Trace API enabled
✓ Found 142 traces in the last hour

[6/6] Testing Error Reporting...
✓ Error Reporting API enabled
```

### Manual Verification

#### 1. Verify Logs in Cloud Logging

```bash
# View error logs
gcloud logging read "severity >= ERROR" --limit=10 --format=json

# View workflow logs
gcloud logging read 'jsonPayload.eventName=~"workflow\\..*"' --limit=10 --format=json
```

**Console**: https://console.cloud.google.com/logs/query?project=gen-lang-client-0997977661

#### 2. Query BigQuery

```sql
-- Check error logs
SELECT
  timestamp,
  severity,
  jsonPayload.error.name as error_name,
  jsonPayload.error.message as error_message
FROM `gen-lang-client-0997977661.observability_logs.error_logs_*`
WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)
ORDER BY timestamp DESC
LIMIT 100;

-- Check workflow performance
SELECT * FROM `gen-lang-client-0997977661.observability_logs.workflow_performance_24h`;

-- Check API performance
SELECT * FROM `gen-lang-client-0997977661.observability_logs.api_performance_24h`
ORDER BY error_rate_percent DESC;
```

**Console**: https://console.cloud.google.com/bigquery?project=gen-lang-client-0997977661&d=observability_logs

#### 3. View Traces

**Console**: https://console.cloud.google.com/traces/list?project=gen-lang-client-0997977661

**Features**:
- Timeline view of request execution
- Span details with duration
- Log correlation (click "View Logs")
- Latency distribution charts

#### 4. Check Error Reporting

**Console**: https://console.cloud.google.com/errors?project=gen-lang-client-0997977661

**Features**:
- Errors grouped by type and location
- First/last occurrence timestamps
- Affected users count
- Stack traces with source code links

#### 5. Monitor Alerts

**Console**: https://console.cloud.google.com/monitoring/alerting?project=gen-lang-client-0997977661

**Verify**:
- All 5 alert policies are enabled
- Notification channels configured
- Test an alert (optional):
  ```bash
  # Trigger error rate alert
  for i in {1..100}; do
    curl -X POST https://brickoptima-api-xyz.run.app/api/v1/test/error
  done
  ```

---

## Monitoring & Alerts

### Alert Response Playbook

#### Alert 1: High API Error Rate

**Trigger**: 5xx error rate > 5% for 5 minutes

**Investigation Steps**:
1. Check Cloud Logging for recent errors
   ```bash
   gcloud logging read "severity >= ERROR AND timestamp >= '5 minutes ago'" --limit=20
   ```

2. Review Error Reporting console
   - Identify error patterns
   - Check affected endpoints

3. Verify recent deployments
   ```bash
   gcloud run revisions list --service=brickoptima-api --limit=5
   ```

4. Check database connectivity
   ```sql
   SELECT COUNT(*) FROM workflow_runs WHERE created_at >= NOW() - INTERVAL '5 minutes';
   ```

5. Check external service status
   - OpenAI API status
   - Gemini API status
   - Database (Neon/Supabase)

**Resolution**:
- If caused by deployment: rollback to previous revision
- If database issue: check connection pool and network
- If external API: implement retry logic or fallback

#### Alert 2: Workflow Failure Rate

**Trigger**: Workflow failures > 10% in 30 minutes

**Investigation Steps**:
1. Query BigQuery for failing workflows:
   ```sql
   SELECT * FROM observability_logs.workflow_performance_24h
   WHERE failure_rate_percent > 10
   ORDER BY failed_runs DESC;
   ```

2. Check workflow error patterns:
   ```sql
   SELECT
     jsonPayload.workflowName,
     jsonPayload.error.message,
     COUNT(*) as occurrences
   FROM observability_logs.workflow_logs_*
   WHERE jsonPayload.eventName = 'workflow.failed'
     AND timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 MINUTE)
   GROUP BY 1, 2
   ORDER BY occurrences DESC;
   ```

3. Check database for stuck workflows:
   ```sql
   SELECT * FROM workflow_runs
   WHERE status = 'running'
     AND started_at < NOW() - INTERVAL '1 hour';
   ```

**Common Causes**:
- External API timeouts (Gemini, OpenAI)
- Database connection issues
- Invalid workflow configurations
- Resource exhaustion (memory, CPU)

#### Alert 3: Critical Tickets Unassigned

**Trigger**: Critical tickets unassigned > 1 hour

**Action Required**:
1. Go to Admin Dashboard: https://brickoptima.com/admin/feedback
2. Filter by Priority: Critical
3. Filter by Status: Open
4. Assign tickets to appropriate team members

**Database Query**:
```sql
SELECT * FROM feedback_tickets
WHERE priority = 'critical'
  AND status = 'open'
  AND assigned_to IS NULL
  AND created_at < NOW() - INTERVAL '1 hour'
ORDER BY created_at ASC;
```

#### Alert 4: High Memory Usage

**Trigger**: Container memory > 90% for 5 minutes

**Immediate Actions**:
1. Check for memory leaks in recent deployments
2. Review workflow execution logs for large payloads
3. Consider increasing memory limits in Cloud Run

**Long-term Solutions**:
- Optimize workflow graph node memory usage
- Implement streaming for large data processing
- Add pagination for database queries
- Profile memory usage with heap snapshots

#### Alert 5: High Database Connections

**Trigger**: DB connections > 80% of pool limit

**Actions**:
1. Check for connection leaks:
   ```typescript
   // Ensure Prisma clients are properly closed
   await prisma.$disconnect();
   ```

2. Review Prisma client configuration:
   ```env
   DATABASE_URL="postgresql://user:pass@host/db?connection_limit=20"
   ```

3. Verify connections are being properly closed in:
   - Long-running workflows
   - Error handlers
   - API endpoints

4. Consider increasing connection pool size (if database supports it)

### Dashboard Creation

Create custom dashboards in Cloud Monitoring:

**Dashboard 1: API Health**
- Request rate (QPS)
- Error rate (%)
- P50/P95/P99 latency
- Active connections

**Dashboard 2: Workflow Performance**
- Workflow runs (total, completed, failed)
- Average duration by workflow type
- Failure rate over time
- Node execution times

**Dashboard 3: Business Metrics**
- Feedback tickets created
- Ticket resolution time
- User activity
- API usage by endpoint

---

## Troubleshooting

### Logs Not Appearing in BigQuery

**Problem**: Log sinks configured but no data in BigQuery tables

**Diagnosis**:
```bash
# Check sink status
gcloud logging sinks describe error-logs-sink

# Verify sink permissions
gcloud projects get-iam-policy gen-lang-client-0997977661 \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:*logging*"
```

**Solutions**:
1. **Wait 1-2 minutes**: Log export has a slight delay
2. **Check filter syntax**: Ensure log filter matches your logs
   ```bash
   # Test filter
   gcloud logging read 'YOUR_FILTER_HERE' --limit=1
   ```
3. **Verify IAM permissions**: Sink service account needs `bigquery.dataEditor`
   ```bash
   # Grant permissions
   gcloud projects add-iam-policy-binding gen-lang-client-0997977661 \
     --member="serviceAccount:SINK_SERVICE_ACCOUNT" \
     --role="roles/bigquery.dataEditor"
   ```

### Traces Not Appearing

**Problem**: Cloud Trace enabled but no traces visible

**Diagnosis**:
```bash
# Check if tracing is initialized
# Look for log: "[Tracing] OpenTelemetry initialized successfully"

# Verify trace API is enabled
gcloud services list --enabled | grep cloudtrace
```

**Solutions**:
1. **Ensure tracing.config.ts is imported first**:
   ```typescript
   // main.ts - MUST be first line
   import { initializeTracing } from './common/monitoring/tracing.config';
   initializeTracing();
   ```

2. **Check production environment**:
   ```bash
   # Tracing only enabled in production
   echo $NODE_ENV  # Should be "production"
   ```

3. **Verify GCP_PROJECT_ID**:
   ```typescript
   // tracing.config.ts
   const projectId = process.env.GCP_PROJECT_ID || 'gen-lang-client-0997977661';
   ```

4. **Generate traffic**:
   ```bash
   # Make some API requests
   for i in {1..10}; do
     curl https://brickoptima-api-xyz.run.app/api/v1/health
   done
   ```

### Alerts Not Triggering

**Problem**: Alert policies configured but no notifications received

**Diagnosis**:
```bash
# List alert policies
gcloud alpha monitoring policies list

# Describe specific policy
gcloud alpha monitoring policies describe POLICY_ID

# Check notification channels
gcloud alpha monitoring channels list
```

**Solutions**:
1. **Verify notification channel**:
   - Email: Check spam folder
   - Slack: Verify webhook URL is correct

2. **Check alert conditions**:
   ```bash
   # View recent incidents
   gcloud alpha monitoring policies list --filter="enabled=true" --format=json
   ```

3. **Test notification**:
   ```bash
   # Manually trigger condition (e.g., generate errors)
   for i in {1..100}; do
     curl -X POST https://your-api.run.app/api/v1/test/error
   done
   ```

4. **Verify alert is enabled**:
   ```hcl
   # observability.tf
   enabled = true  # Check this is set
   ```

### Custom Metrics Not Exporting

**Problem**: CustomMetricsService initialized but metrics not visible

**Diagnosis**:
```bash
# Check metrics client initialization logs
gcloud logging read 'jsonPayload.message=~"Custom metrics"' --limit=10

# List custom metrics
gcloud monitoring metrics-descriptors list --filter="metric.type:custom.googleapis.com"
```

**Solutions**:
1. **Verify production environment**:
   ```typescript
   // Custom metrics only exported in production
   this.isProduction = process.env.NODE_ENV === 'production';
   ```

2. **Check MonitoringModule is imported**:
   ```typescript
   // app.module.ts
   @Module({
     imports: [MonitoringModule, ...],
   })
   ```

3. **Wait 60 seconds**: Metrics are collected every minute

4. **Check permissions**:
   ```bash
   # Service account needs monitoring.metricWriter
   gcloud projects add-iam-policy-binding gen-lang-client-0997977661 \
     --member="serviceAccount:SERVICE_ACCOUNT" \
     --role="roles/monitoring.metricWriter"
   ```

---

## Best Practices

### Logging

1. **Use Structured Logging**
   ```typescript
   // Good ✓
   logger.info('Workflow completed', {
     eventName: 'workflow.completed',
     workflowRunId: 'wfrun_123',
     durationMs: 4523,
   });

   // Bad ✗
   logger.info(`Workflow wfrun_123 completed in 4523ms`);
   ```

2. **Include Correlation IDs**
   - Every log should include `requestId`, `correlationId`, `traceId`
   - Automatically added by AppLoggerService

3. **Use Appropriate Log Levels**
   - `ERROR`: Unhandled exceptions, failures
   - `WARN`: Degraded functionality, retry attempts
   - `INFO`: Business events, significant operations
   - `DEBUG`: Detailed diagnostic information (dev only)

4. **Redact Sensitive Data**
   - Automatically redacted: passwords, tokens, secrets, API keys
   - Add custom fields to `redactPIIFormat()` if needed

### Tracing

1. **Create Spans for Business Operations**
   ```typescript
   await traceService.withSpan('analyze-dag', async (span) => {
     span.setAttribute('dag.node_count', nodeCount);
     span.setAttribute('dag.complexity', complexity);
     return analyzeDag(dag);
   });
   ```

2. **Add Meaningful Attributes**
   ```typescript
   span.setAttribute('workflow.name', workflowName);
   span.setAttribute('workflow.duration_ms', duration);
   span.setAttribute('user.id', userId);
   ```

3. **Record Events**
   ```typescript
   span.addEvent('dag.parsed', { node_count: 42 });
   span.addEvent('optimization.complete', { improvements: 15 });
   ```

4. **Link Logs to Traces**
   - Use `traceService.getCurrentTraceId()` in log metadata
   - AppLoggerService does this automatically

### Alerting

1. **Set Appropriate Thresholds**
   - Too sensitive: Alert fatigue
   - Too relaxed: Miss critical issues
   - Monitor and adjust based on actual data

2. **Include Runbooks in Alert Docs**
   ```hcl
   documentation {
     content = <<-EOT
       ## Investigation Steps
       1. Check Cloud Logging
       2. Review Error Reporting
       3. Verify database connectivity

       ## Resolution
       - If deployment issue: rollback
       - If database issue: check connection pool
     EOT
   }
   ```

3. **Rate Limit Notifications**
   ```hcl
   notification_rate_limit {
     period = "3600s"  # Max 1 alert per hour
   }
   ```

4. **Auto-Close Resolved Incidents**
   ```hcl
   alert_strategy {
     auto_close = "86400s"  # Close after 24 hours
   }
   ```

### Cost Optimization

1. **Use Log Exclusion Filters**
   ```bash
   # Exclude health check logs from storage
   gcloud logging exclusions create health-checks \
     --log-filter='httpRequest.requestUrl=~"/health"'
   ```

2. **Set Table Expiration**
   ```hcl
   default_table_expiration_ms = 7776000000  # 90 days
   ```

3. **Use Partitioned Tables**
   ```hcl
   bigquery_options {
     use_partitioned_tables = true  # Much cheaper queries
   }
   ```

4. **Sample High-Volume Logs**
   ```typescript
   // Only log 10% of successful requests
   if (statusCode < 400 && Math.random() < 0.1) {
     logger.logRequest(method, path, statusCode, duration);
   }
   ```

5. **Archive Old Logs to Cloud Storage**
   ```bash
   # Export to GCS for long-term storage (~$0.01/GB/month)
   bq extract --destination_format=JSON \
     'observability_logs.error_logs_20250101' \
     'gs://brickoptima-log-archive/error_logs_20250101.json'
   ```

### Performance

1. **Batch Metric Exports**
   - CustomMetricsService exports every 60 seconds
   - Reduces API calls and costs

2. **Use Sampling for High-Volume Traces**
   ```typescript
   // tracing.config.ts
   sampler: new TraceIdRatioBasedSampler(0.1),  // Sample 10% of requests
   ```

3. **Async Logging**
   - Winston batches log writes
   - Non-blocking for application code

4. **Connection Pooling**
   - Reuse Monitoring/Logging clients
   - Initialize once in service constructor

---

## Summary

Phase 5 delivers production-grade observability for BrickOptima:

✅ **Centralized Logging** - All logs in BigQuery with 90-day retention
✅ **Real-time Alerting** - 5 critical alert policies with email/Slack notifications
✅ **Distributed Tracing** - Request flow visualization across services
✅ **Error Grouping** - Intelligent error aggregation in Error Reporting
✅ **Custom Metrics** - Business and operational metrics in Cloud Monitoring
✅ **Analytics Views** - Pre-built queries for error, workflow, and API analysis

### Key Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| API Error Rate | < 1% | > 5% |
| Workflow Success Rate | > 95% | < 90% |
| P95 Latency | < 2s | > 5s |
| Memory Usage | < 80% | > 90% |
| Unassigned Critical Tickets | 0 | > 0 for 1 hour |

### Next Steps

1. ✅ Deploy infrastructure: `./scripts/deploy-observability.sh`
2. ✅ Verify deployment: `./scripts/test-observability.sh`
3. 📊 Create custom dashboards in Cloud Monitoring
4. 📧 Test alert notifications
5. 📈 Baseline metrics for 1 week
6. 🎯 Tune alert thresholds based on actual traffic
7. 📚 Train team on incident response playbooks

---

## Resources

- **Cloud Logging**: https://cloud.google.com/logging/docs
- **BigQuery**: https://cloud.google.com/bigquery/docs
- **Cloud Monitoring**: https://cloud.google.com/monitoring/docs
- **Cloud Trace**: https://cloud.google.com/trace/docs
- **Error Reporting**: https://cloud.google.com/error-reporting/docs
- **OpenTelemetry**: https://opentelemetry.io/docs/
- **Terraform Google Provider**: https://registry.terraform.io/providers/hashicorp/google/latest/docs

---

**Document Version**: 1.0
**Last Updated**: January 2, 2026
**Maintained By**: Engineering Team
