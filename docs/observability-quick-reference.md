# GCP Observability Quick Reference

## 🚀 Quick Start

### Deploy Infrastructure
```bash
cd terraform
terraform init
terraform plan
terraform apply
```

### Test Deployment
```bash
cd scripts
./test-observability.sh
```

### View in Console
- **Logs**: https://console.cloud.google.com/logs/query?project=gen-lang-client-0997977661
- **BigQuery**: https://console.cloud.google.com/bigquery?project=gen-lang-client-0997977661&d=observability_logs
- **Traces**: https://console.cloud.google.com/traces?project=gen-lang-client-0997977661
- **Errors**: https://console.cloud.google.com/errors?project=gen-lang-client-0997977661
- **Alerts**: https://console.cloud.google.com/monitoring/alerting?project=gen-lang-client-0997977661

---

## 📊 Key Queries

### Find Recent Errors
```sql
SELECT
  timestamp,
  severity,
  jsonPayload.error.name,
  jsonPayload.error.message,
  jsonPayload.userId
FROM `gen-lang-client-0997977661.observability_logs.error_logs_*`
WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)
ORDER BY timestamp DESC
LIMIT 100;
```

### Workflow Performance
```sql
SELECT * FROM `gen-lang-client-0997977661.observability_logs.workflow_performance_24h`
ORDER BY failure_rate_percent DESC;
```

### API Performance by Endpoint
```sql
SELECT * FROM `gen-lang-client-0997977661.observability_logs.api_performance_24h`
ORDER BY error_rate_percent DESC;
```

### Feedback Analytics
```sql
SELECT * FROM `gen-lang-client-0997977661.observability_logs.feedback_analytics_7d`
ORDER BY date DESC;
```

---

## 🔔 Alert Thresholds

| Alert | Threshold | Notification |
|-------|-----------|--------------|
| API Error Rate | > 5% for 5 min | Email (brickoptima@gmail.com) |
| Workflow Failures | > 10% in 30 min | Email (brickoptima@gmail.com) |
| Critical Tickets Unassigned | > 0 for 1 hour | Email (brickoptima@gmail.com) |
| Memory Usage | > 90% for 5 min | Email (brickoptima@gmail.com) |
| DB Connections | > 80% of limit | Email (brickoptima@gmail.com) |

---

## 🛠️ Troubleshooting Commands

### View Recent Logs
```bash
gcloud logging read "severity >= ERROR" --limit=10 --format=json
```

### List Traces
```bash
gcloud trace list --limit=10
```

### Check Alert Policies
```bash
gcloud alpha monitoring policies list
```

### Test Log Export
```bash
gcloud logging write test-log "Test message" --severity=ERROR
```

### Query BigQuery from CLI
```bash
bq query --use_legacy_sql=false '
SELECT COUNT(*) as error_count
FROM `gen-lang-client-0997977661.observability_logs.error_logs_*`
WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)
'
```

---

## 📁 File Reference

### Terraform
- `terraform/observability.tf` - Main observability configuration
- `terraform/variables.tf` - Variable definitions
- `terraform/terraform.tfvars` - Variable values (gitignored)

### Backend Services
- `backend/src/common/monitoring/custom-metrics.service.ts` - Custom metrics
- `backend/src/common/monitoring/trace.service.ts` - Tracing utilities
- `backend/src/common/monitoring/tracing.config.ts` - OpenTelemetry setup
- `backend/src/common/filters/error-reporting.filter.ts` - Error reporting
- `backend/src/common/logging/app-logger.service.ts` - Structured logging
- `backend/src/common/logging/workflow-logger.service.ts` - Workflow logging

### Scripts
- `scripts/deploy-observability.sh` - Deploy infrastructure
- `scripts/test-observability.sh` - Test deployment

### Documentation
- `docs/phase-5-gcp-observability.md` - Complete guide
- `docs/observability-quick-reference.md` - This file

---

## 🎯 Common Tasks

### Add a New Log Sink
1. Edit `terraform/observability.tf`
2. Add new `google_logging_project_sink` resource
3. Add BigQuery IAM member for sink writer
4. Run `terraform apply`

### Create a New Alert
1. Edit `terraform/observability.tf`
2. Add new `google_monitoring_alert_policy` resource
3. Define condition, threshold, and notifications
4. Run `terraform apply`

### Add Custom Metric
1. Edit `backend/src/common/monitoring/custom-metrics.service.ts`
2. Add export method (e.g., `exportMyMetric()`)
3. Call from `collectAndExportMetrics()`
4. Deploy application

### Create BigQuery View
1. Edit `terraform/observability.tf`
2. Add new `google_bigquery_table` with view block
3. Write SQL query
4. Run `terraform apply`

---

## 💡 Best Practices

### Logging
- ✅ Use structured logging (JSON)
- ✅ Include correlation IDs
- ✅ Use appropriate log levels
- ❌ Don't log sensitive data

### Tracing
- ✅ Create spans for business operations
- ✅ Add meaningful attributes
- ✅ Record important events
- ❌ Don't create too many spans (performance)

### Alerting
- ✅ Set realistic thresholds
- ✅ Include runbooks in documentation
- ✅ Rate limit notifications
- ❌ Don't create alert fatigue

### Cost
- ✅ Use log exclusion filters
- ✅ Set table expiration
- ✅ Use partitioned tables
- ✅ Sample high-volume logs
- ❌ Don't store everything forever

---

## 📞 Support

For issues or questions:
1. Check the main documentation: [phase-5-gcp-observability.md](./phase-5-gcp-observability.md)
2. Review troubleshooting section
3. Contact engineering team

---

**Last Updated**: January 2, 2026
