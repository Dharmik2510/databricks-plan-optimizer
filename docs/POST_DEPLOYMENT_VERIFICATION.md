# Post-Deployment Verification Guide

After running `terraform apply`, follow these steps to verify everything is working correctly.

---

## ✅ Step-by-Step Verification

### 1️⃣ Verify Terraform Deployment Success

**Check Terraform Outputs:**
```bash
cd terraform
terraform output
```

**Expected Output:**
```
bigquery_dataset_id = "observability_logs"
log_sink_ids = {
  error_logs = "projects/gen-lang-client-0997977661/sinks/error-logs-sink"
  feedback_logs = "projects/gen-lang-client-0997977661/sinks/feedback-logs-sink"
  http_logs = "projects/gen-lang-client-0997977661/sinks/http-request-logs-sink"
  workflow_logs = "projects/gen-lang-client-0997977661/sinks/workflow-logs-sink"
}
alert_policy_ids = {
  api_error_rate = "projects/gen-lang-client-0997977661/alertPolicies/..."
  critical_tickets_unassigned = "projects/gen-lang-client-0997977661/alertPolicies/..."
  high_db_connections = "projects/gen-lang-client-0997977661/alertPolicies/..."
  high_memory_usage = "projects/gen-lang-client-0997977661/alertPolicies/..."
  workflow_failure_rate = "projects/gen-lang-client-0997977661/alertPolicies/..."
}
```

---

### 2️⃣ Verify BigQuery Dataset

**Check Dataset Exists:**
```bash
bq ls --project_id=gen-lang-client-0997977661
```

**Expected Output:**
```
  datasetId
 ----------------------
  observability_logs
```

**View Dataset Details:**
```bash
bq show gen-lang-client-0997977661:observability_logs
```

**Or in Console:**
https://console.cloud.google.com/bigquery?project=gen-lang-client-0997977661&d=observability_logs

---

### 3️⃣ Verify Log Sinks

**List All Log Sinks:**
```bash
gcloud logging sinks list --project=gen-lang-client-0997977661
```

**Expected Output:**
```
NAME                      DESTINATION                                                          FILTER
error-logs-sink           bigquery.googleapis.com/projects/gen-lang-client-0997977661/...     severity >= ERROR AND ...
workflow-logs-sink        bigquery.googleapis.com/projects/gen-lang-client-0997977661/...     jsonPayload.eventName =~ "workflow\\..*"
feedback-logs-sink        bigquery.googleapis.com/projects/gen-lang-client-0997977661/...     jsonPayload.eventName =~ "feedback\\..*"
http-request-logs-sink    bigquery.googleapis.com/projects/gen-lang-client-0997977661/...     jsonPayload.eventName = "http.request"
```

**Check Specific Sink:**
```bash
gcloud logging sinks describe error-logs-sink --project=gen-lang-client-0997977661
```

**Or in Console:**
https://console.cloud.google.com/logs/router?project=gen-lang-client-0997977661

---

### 4️⃣ Verify Alert Policies

**List Alert Policies:**
```bash
gcloud alpha monitoring policies list --project=gen-lang-client-0997977661 --format="table(displayName,enabled)"
```

**Expected Output:**
```
DISPLAY_NAME                              ENABLED
High API Error Rate (>5%)                 True
High Workflow Failure Rate (>10%)         True
Critical Feedback Tickets Unassigned      True
High Memory Usage (>90%)                  True
High Database Connections                 True
```

**Check Alert Details:**
```bash
gcloud alpha monitoring policies list --project=gen-lang-client-0997977661 --format=json | jq '.[] | {name: .displayName, enabled: .enabled, channels: .notificationChannels}'
```

**Or in Console:**
https://console.cloud.google.com/monitoring/alerting?project=gen-lang-client-0997977661

---

### 5️⃣ Verify Notification Channel

**List Notification Channels:**
```bash
gcloud alpha monitoring channels list --project=gen-lang-client-0997977661 --format="table(displayName,type,labels)"
```

**Expected Output:**
```
DISPLAY_NAME              TYPE    LABELS
Engineering Team Email    email   email_address=brickoptima@gmail.com
```

**Test Email Channel (Optional):**
1. Go to https://console.cloud.google.com/monitoring/alerting/notifications?project=gen-lang-client-0997977661
2. Click on "Engineering Team Email"
3. Click "SEND TEST NOTIFICATION"
4. Check brickoptima@gmail.com for test email

---

### 6️⃣ Verify IAM Permissions

**Check Service Account Permissions:**
```bash
# Get project number
PROJECT_NUMBER=$(gcloud projects describe gen-lang-client-0997977661 --format="value(projectNumber)")

# Check IAM bindings
gcloud projects get-iam-policy gen-lang-client-0997977661 \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --format="table(bindings.role)"
```

**Expected Roles:**
```
ROLE
roles/bigquery.admin
roles/cloudtrace.agent
roles/errorreporting.writer
roles/iam.serviceAccountTokenCreator
roles/logging.admin
roles/monitoring.metricWriter
roles/secretmanager.secretAccessor (multiple)
```

---

### 7️⃣ Verify APIs Enabled

**Check Required APIs:**
```bash
gcloud services list --enabled --project=gen-lang-client-0997977661 \
  --filter="name:(logging OR monitoring OR bigquery OR cloudtrace OR errorreporting)" \
  --format="table(name)"
```

**Expected Output:**
```
NAME
bigquery.googleapis.com
cloudtrace.googleapis.com
clouderrorreporting.googleapis.com
logging.googleapis.com
monitoring.googleapis.com
```

---

### 8️⃣ Generate Test Logs (Important!)

**Why?** Log sinks won't create BigQuery tables until logs start flowing.

**Option A: Write Test Logs via gcloud:**
```bash
# Write test error log
gcloud logging write test-error-log "Test error message" \
  --severity=ERROR \
  --resource=cloud_run_revision \
  --labels=service=brickoptima-api \
  --project=gen-lang-client-0997977661

# Write test workflow log
gcloud logging write test-workflow-log '{"eventName":"workflow.started","workflowRunId":"test-123"}' \
  --severity=INFO \
  --resource=cloud_run_revision \
  --project=gen-lang-client-0997977661

# Write test HTTP log
gcloud logging write test-http-log '{"eventName":"http.request","method":"GET","path":"/api/v1/health","statusCode":200,"durationMs":45}' \
  --severity=INFO \
  --resource=cloud_run_revision \
  --project=gen-lang-client-0997977661
```

**Option B: Deploy Application and Generate Real Traffic:**
```bash
# Deploy backend
cd backend
npm run build
gcloud run deploy brickoptima-api --source . --project=gen-lang-client-0997977661

# Make some API calls
curl https://brickoptima-api-YOUR-URL.run.app/api/v1/health
```

---

### 9️⃣ Wait for Log Export (1-2 minutes)

**Monitor Log Export:**
```bash
# Check if tables are being created
watch -n 10 'bq ls --project_id=gen-lang-client-0997977661 --dataset_id=observability_logs'
```

**Expected Tables After Logs Flow:**
```
  tableId              Type
 -------------------- -------
  error_logs_20260102   TABLE
  workflow_logs_20260102 TABLE
  http_logs_20260102    TABLE
```

**Note:** Table names include date suffix (YYYYMMDD)

---

### 🔟 Create BigQuery Views

**Once log tables exist, create the analytics views:**
```bash
cd scripts
./create-bigquery-views.sh
```

**Expected Output:**
```
=========================================
Creating BigQuery Views for Analytics
=========================================
Project: gen-lang-client-0997977661
Dataset: observability_logs

[1/5] Checking for log tables...
✓ Found tables:
error_logs_20260102
workflow_logs_20260102
http_logs_20260102

[2/5] Creating error_summary_24h view...
✓ error_summary_24h created

[3/5] Creating workflow_performance_24h view...
✓ workflow_performance_24h created

[4/5] Creating api_performance_24h view...
✓ api_performance_24h created

[5/5] Creating feedback_analytics_7d view...
✓ feedback_analytics_7d created

=========================================
BigQuery Views Created!
=========================================
```

---

### 1️⃣1️⃣ Verify BigQuery Views Work

**Query Error Summary:**
```bash
bq query --use_legacy_sql=false '
SELECT *
FROM `gen-lang-client-0997977661.observability_logs.error_summary_24h`
LIMIT 10
'
```

**Query Workflow Performance:**
```bash
bq query --use_legacy_sql=false '
SELECT *
FROM `gen-lang-client-0997977661.observability_logs.workflow_performance_24h`
LIMIT 10
'
```

**Or in Console:**
https://console.cloud.google.com/bigquery?project=gen-lang-client-0997977661&d=observability_logs

---

### 1️⃣2️⃣ Verify Cloud Trace (After Application Deployment)

**Check Traces:**
```bash
gcloud trace list --project=gen-lang-client-0997977661 --limit=10
```

**Or in Console:**
https://console.cloud.google.com/traces/list?project=gen-lang-client-0997977661

**Expected:** Traces appear after deploying application and generating traffic

---

### 1️⃣3️⃣ Verify Error Reporting (After Application Deployment)

**Check Errors:**
https://console.cloud.google.com/errors?project=gen-lang-client-0997977661

**Expected:** Errors appear when application encounters exceptions

---

## 🎯 Complete Verification Checklist

Use this checklist to ensure everything is working:

### Infrastructure
- [ ] Terraform apply completed successfully
- [ ] BigQuery dataset `observability_logs` exists
- [ ] 4 log sinks created and active
- [ ] 5 alert policies created and enabled
- [ ] Email notification channel configured
- [ ] 5 IAM roles granted to service account
- [ ] 5 observability APIs enabled

### Logs & Data
- [ ] Test logs written to Cloud Logging
- [ ] Log tables created in BigQuery (after 1-2 min)
- [ ] 4 BigQuery views created successfully
- [ ] Views return data when queried

### Monitoring
- [ ] Test email notification received
- [ ] Alert policies show in console
- [ ] Notification channel shows in console

### Application Integration (After App Deployment)
- [ ] Application deployed with observability code
- [ ] OpenTelemetry dependencies installed
- [ ] Traces visible in Cloud Trace
- [ ] Errors visible in Error Reporting
- [ ] Custom metrics being exported

---

## 🚨 Troubleshooting

### Issue: Log tables not appearing in BigQuery

**Diagnosis:**
```bash
# Check if logs are being written
gcloud logging read "severity >= INFO" --limit=10 --project=gen-lang-client-0997977661
```

**Solutions:**
1. Wait 2-3 minutes - log export has a delay
2. Verify log sinks are active: `gcloud logging sinks list`
3. Check IAM permissions for sink writers
4. Verify logs match sink filters

---

### Issue: BigQuery views fail to create

**Error:** `does not match any table`

**Solution:**
This is expected if log tables don't exist yet. Wait for logs to flow, then run:
```bash
cd scripts
./create-bigquery-views.sh
```

---

### Issue: Alerts not triggering

**Diagnosis:**
```bash
# Check alert policy details
gcloud alpha monitoring policies list --format=json | jq '.[0]'
```

**Solutions:**
1. Verify notification channel is correct
2. Check alert thresholds are realistic
3. Generate traffic to trigger conditions
4. Check email spam folder

---

### Issue: No traces visible

**Diagnosis:**
```bash
# Check if Cloud Trace API is enabled
gcloud services list --enabled | grep cloudtrace
```

**Solutions:**
1. Ensure OpenTelemetry is initialized in `main.ts` (FIRST import)
2. Verify `NODE_ENV=production`
3. Deploy application and generate traffic
4. Wait 1-2 minutes for traces to appear
5. Check service account has `roles/cloudtrace.agent`

---

## 📊 Quick Verification Commands

**Run all checks at once:**
```bash
#!/bin/bash
echo "=== Checking BigQuery ==="
bq ls --project_id=gen-lang-client-0997977661

echo -e "\n=== Checking Log Sinks ==="
gcloud logging sinks list --project=gen-lang-client-0997977661 --format="table(name,destination)"

echo -e "\n=== Checking Alerts ==="
gcloud alpha monitoring policies list --project=gen-lang-client-0997977661 --format="table(displayName,enabled)"

echo -e "\n=== Checking Notification Channels ==="
gcloud alpha monitoring channels list --project=gen-lang-client-0997977661 --format="table(displayName,type)"

echo -e "\n=== Checking APIs ==="
gcloud services list --enabled --project=gen-lang-client-0997977661 \
  --filter="name:(logging OR monitoring OR bigquery OR cloudtrace OR errorreporting)" \
  --format="table(name)"

echo -e "\n=== Done! ==="
```

---

## 📈 Next Steps After Verification

1. **Deploy Application Code:**
   - Add monitoring imports to `main.ts`
   - Install OpenTelemetry dependencies
   - Deploy to Cloud Run

2. **Generate Traffic:**
   - Make API calls
   - Trigger workflows
   - Create feedback tickets

3. **Create Dashboards:**
   - Go to Cloud Monitoring
   - Create custom dashboards
   - Add widgets for key metrics

4. **Set Up Saved Queries:**
   - Save frequently used BigQuery queries
   - Create scheduled queries for reports

5. **Test Alerts:**
   - Manually trigger alert conditions
   - Verify email notifications work
   - Adjust thresholds if needed

---

## 🎉 Success Criteria

You've successfully deployed Phase 5 observability when:

✅ All Terraform resources created without errors
✅ BigQuery dataset and log sinks active
✅ Alert policies enabled with email notifications
✅ Log tables appearing in BigQuery after traffic
✅ BigQuery views created and returning data
✅ Test email notification received
✅ All 5 APIs enabled
✅ Service account has all 5 IAM roles

---

**For detailed troubleshooting, see:** [docs/phase-5-gcp-observability.md](phase-5-gcp-observability.md)

**For quick reference, see:** [docs/observability-quick-reference.md](observability-quick-reference.md)
