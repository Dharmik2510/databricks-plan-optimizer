# Phase 5: GCP Observability - Deployment Checklist

Use this checklist to ensure Phase 5 is properly deployed and configured.

---

## Pre-Deployment

- [ ] GCP project ID confirmed: `gen-lang-client-0997977661`
- [ ] gcloud CLI installed and authenticated
- [ ] Terraform >= 1.0 installed
- [ ] Required IAM permissions:
  - [ ] `roles/bigquery.admin`
  - [ ] `roles/logging.admin`
  - [ ] `roles/monitoring.admin`
  - [ ] `roles/cloudtrace.admin`

---

## Configuration

- [ ] Edit `terraform/terraform.tfvars`:
  - [ ] `project_id` set correctly
  - [ ] `region` configured (default: `us-central1`)
  - [ ] `environment` set (default: `production`)
  - [ ] `alert_email` = "brickoptima@gmail.com"

---

## Infrastructure Deployment

- [ ] Run `terraform init` successfully
- [ ] Run `terraform plan` and review changes
- [ ] Run `terraform apply` and confirm
- [ ] Verify outputs:
  - [ ] `bigquery_dataset_id` = "observability_logs"
  - [ ] 4 log sink IDs displayed
  - [ ] 5 alert policy IDs displayed

---

## BigQuery Verification

- [ ] Dataset exists: https://console.cloud.google.com/bigquery?project=gen-lang-client-0997977661&d=observability_logs
- [ ] Wait 2 minutes for log sinks to initialize
- [ ] Check for tables created:
  - [ ] `error_logs_*` (may be empty initially)
  - [ ] `workflow_logs_*` (may be empty initially)
  - [ ] `feedback_logs_*` (may be empty initially)
  - [ ] `http_logs_*` (may be empty initially)
- [ ] Views created:
  - [ ] `error_summary_24h`
  - [ ] `workflow_performance_24h`
  - [ ] `api_performance_24h`
  - [ ] `feedback_analytics_7d`

---

## Cloud Logging Verification

- [ ] Log sinks configured:
  - [ ] `error-logs-sink`
  - [ ] `workflow-logs-sink`
  - [ ] `feedback-logs-sink`
  - [ ] `http-request-logs-sink`
- [ ] Test log export:
  ```bash
  gcloud logging write test-observability "Test log" --severity=ERROR
  ```
- [ ] Wait 1-2 minutes and check BigQuery for log entry

---

## Cloud Monitoring Verification

- [ ] Alert policies enabled:
  - [ ] High API Error Rate (>5%)
  - [ ] Workflow Failure Rate (>10%)
  - [ ] Critical Tickets Unassigned
  - [ ] High Memory Usage (>90%)
  - [ ] High DB Connections
- [ ] Notification channels configured:
  - [ ] Email channel active (brickoptima@gmail.com)
- [ ] Test notification (optional):
  - [ ] Send test alert from console
  - [ ] Verify email received at brickoptima@gmail.com

---

## Backend Code Updates

- [ ] Install dependencies:
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

- [ ] Update `backend/src/main.ts`:
  ```typescript
  // MUST be first import
  import { initializeTracing } from './common/monitoring/tracing.config';
  initializeTracing();
  ```

- [ ] Update `backend/src/app.module.ts`:
  ```typescript
  import { MonitoringModule } from './common/monitoring/monitoring.module';

  @Module({
    imports: [
      MonitoringModule,  // Add this
      // ... other modules
    ],
  })
  ```

- [ ] Apply global error filter in `backend/src/main.ts`:
  ```typescript
  import { ErrorReportingFilter } from './common/filters/error-reporting.filter';

  const logger = app.get(AppLoggerService);
  app.useGlobalFilters(new ErrorReportingFilter(logger));
  ```

- [ ] Set environment variables:
  - [ ] `GCP_PROJECT_ID=gen-lang-client-0997977661`
  - [ ] `NODE_ENV=production`
  - [ ] `APP_VERSION=1.0.0` (or current version)

---

## Application Deployment

- [ ] Build application: `npm run build`
- [ ] Deploy to Cloud Run:
  ```bash
  gcloud run deploy brickoptima-api \
    --source . \
    --project=gen-lang-client-0997977661
  ```
- [ ] Verify deployment successful
- [ ] Check application logs for initialization messages:
  - [ ] "[Tracing] OpenTelemetry initialized successfully"
  - [ ] "Custom metrics service initialized"
  - [ ] "Error Reporting initialized"

---

## Cloud Trace Verification

- [ ] Cloud Trace API enabled
- [ ] Generate some API traffic:
  ```bash
  for i in {1..20}; do
    curl https://your-api.run.app/api/v1/health
  done
  ```
- [ ] Wait 1-2 minutes
- [ ] Check traces: https://console.cloud.google.com/traces?project=gen-lang-client-0997977661
- [ ] Verify traces appear with:
  - [ ] Request spans
  - [ ] Database query spans (if using Prisma)
  - [ ] Proper timing information
- [ ] Click on a trace and verify:
  - [ ] "View Logs" link works
  - [ ] Trace details show service name
  - [ ] Spans have meaningful names

---

## Error Reporting Verification

- [ ] Error Reporting API enabled
- [ ] Trigger a test error (optional):
  ```bash
  curl -X POST https://your-api.run.app/api/v1/test/error
  ```
- [ ] Check Error Reporting: https://console.cloud.google.com/errors?project=gen-lang-client-0997977661
- [ ] Verify errors are grouped correctly
- [ ] Check error details include:
  - [ ] Stack trace
  - [ ] HTTP context
  - [ ] User information
  - [ ] Occurrence count

---

## Custom Metrics Verification

- [ ] Wait 60 seconds for first metric export
- [ ] Check metrics in Cloud Monitoring:
  ```bash
  gcloud monitoring metrics-descriptors list \
    --filter="metric.type:custom.googleapis.com/brickoptima"
  ```
- [ ] Verify metrics exist:
  - [ ] `workflow_failures`
  - [ ] `critical_tickets_unassigned`
  - [ ] `db_connection_count`
  - [ ] `workflow_duration`

---

## Automated Testing

- [ ] Run test script:
  ```bash
  cd scripts
  chmod +x test-observability.sh
  ./test-observability.sh
  ```
- [ ] Verify all checks pass:
  - [ ] ✓ BigQuery dataset exists
  - [ ] ✓ Log sinks configured
  - [ ] ✓ Alert policies enabled
  - [ ] ✓ Cloud Trace API enabled
  - [ ] ✓ Error Reporting API enabled

---

## BigQuery Query Testing

- [ ] Query error summary:
  ```sql
  SELECT * FROM `gen-lang-client-0997977661.observability_logs.error_summary_24h`
  LIMIT 10;
  ```

- [ ] Query workflow performance:
  ```sql
  SELECT * FROM `gen-lang-client-0997977661.observability_logs.workflow_performance_24h`
  LIMIT 10;
  ```

- [ ] Query API performance:
  ```sql
  SELECT * FROM `gen-lang-client-0997977661.observability_logs.api_performance_24h`
  LIMIT 10;
  ```

- [ ] Query feedback analytics:
  ```sql
  SELECT * FROM `gen-lang-client-0997977661.observability_logs.feedback_analytics_7d`
  LIMIT 10;
  ```

---

## Documentation Review

- [ ] Read complete guide: `docs/phase-5-gcp-observability.md`
- [ ] Bookmark quick reference: `docs/observability-quick-reference.md`
- [ ] Review troubleshooting section
- [ ] Share documentation with team

---

## Team Onboarding

- [ ] Share GCP console links with team
- [ ] Review alert response playbooks
- [ ] Test notification channels with team
- [ ] Schedule training session on:
  - [ ] How to query BigQuery logs
  - [ ] How to use Cloud Trace
  - [ ] How to respond to alerts
  - [ ] How to create custom dashboards

---

## Baseline Monitoring (Week 1)

- [ ] Monitor for 1 week to establish baselines
- [ ] Record typical metrics:
  - [ ] Average error rate: _______%
  - [ ] Average workflow success rate: _______%
  - [ ] Average API latency: _______ms
  - [ ] Peak memory usage: _______%
  - [ ] Peak DB connections: _______

---

## Alert Tuning (Week 2)

- [ ] Review alert incidents from Week 1
- [ ] Adjust thresholds if needed:
  - [ ] API error rate threshold
  - [ ] Workflow failure threshold
  - [ ] Memory usage threshold
  - [ ] DB connection threshold
- [ ] Update alert documentation
- [ ] Verify no alert fatigue

---

## Dashboard Creation

- [ ] Create API Health dashboard
- [ ] Create Workflow Performance dashboard
- [ ] Create Business Metrics dashboard
- [ ] Share dashboard links with team

---

## Cost Optimization

- [ ] Review initial costs after 1 week
- [ ] Implement cost optimizations:
  - [ ] Add log exclusion filters for health checks
  - [ ] Enable trace sampling if volume is high
  - [ ] Set appropriate table retention
- [ ] Set up budget alerts in GCP

---

## Production Readiness

- [ ] All checklist items completed
- [ ] No errors in Error Reporting
- [ ] Logs flowing to BigQuery
- [ ] Traces visible in Cloud Trace
- [ ] Alerts configured and tested
- [ ] Team trained on observability tools
- [ ] Documentation complete and accessible

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Tech Lead | _____________ | _______ | __________ |
| DevOps | _____________ | _______ | __________ |
| Engineering Manager | _____________ | _______ | __________ |

---

## Notes

```
Add any deployment notes, issues encountered, or customizations made:

_______________________________________________________________

_______________________________________________________________

_______________________________________________________________

_______________________________________________________________

_______________________________________________________________
```

---

**Checklist Version**: 1.0
**Last Updated**: January 2, 2026
**Next Review**: After Production Deployment
