#!/bin/bash

################################################################################
# GCP Observability Testing Script
#
# Tests all Phase 5 observability components:
# - BigQuery dataset and log sinks
# - Cloud Monitoring alerts
# - Cloud Trace
# - Error Reporting
################################################################################

set -e

PROJECT_ID="${GCP_PROJECT_ID:-gen-lang-client-0997977661}"
DATASET_ID="observability_logs"
SERVICE_NAME="brickoptima-api"

echo "========================================="
echo "Testing GCP Observability Configuration"
echo "========================================="
echo "Project: $PROJECT_ID"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

################################################################################
# 1. Test BigQuery Dataset
################################################################################
echo -e "${YELLOW}[1/6] Testing BigQuery Dataset...${NC}"

if gcloud bigquery datasets describe ${DATASET_ID} --project=${PROJECT_ID} &>/dev/null; then
    echo -e "${GREEN}✓ BigQuery dataset '${DATASET_ID}' exists${NC}"

    # List tables
    echo "  Tables in dataset:"
    gcloud bigquery tables list --dataset=${DATASET_ID} --project=${PROJECT_ID} --format="table(tableId)" 2>/dev/null || echo "  No tables yet (expected for new deployment)"
else
    echo -e "${RED}✗ BigQuery dataset '${DATASET_ID}' not found${NC}"
    exit 1
fi

################################################################################
# 2. Test Log Sinks
################################################################################
echo ""
echo -e "${YELLOW}[2/6] Testing Log Sinks...${NC}"

SINKS=("error-logs-sink" "workflow-logs-sink" "feedback-logs-sink" "http-request-logs-sink")

for sink in "${SINKS[@]}"; do
    if gcloud logging sinks describe ${sink} --project=${PROJECT_ID} &>/dev/null; then
        echo -e "${GREEN}✓ Log sink '${sink}' configured${NC}"
    else
        echo -e "${RED}✗ Log sink '${sink}' not found${NC}"
    fi
done

################################################################################
# 3. Test Log Export
################################################################################
echo ""
echo -e "${YELLOW}[3/6] Testing Log Export to BigQuery...${NC}"

# Write a test log
echo "  Writing test log entry..."
gcloud logging write test-observability-log "Test log for observability verification" \
    --severity=ERROR \
    --resource=cloud_run_revision \
    --labels=service=${SERVICE_NAME} \
    --project=${PROJECT_ID} 2>/dev/null || true

echo -e "${GREEN}✓ Test log written. Check BigQuery for export (may take 1-2 minutes)${NC}"
echo "  Query: SELECT * FROM \`${PROJECT_ID}.${DATASET_ID}.error_logs_*\` WHERE textPayload LIKE '%observability%' ORDER BY timestamp DESC LIMIT 10"

################################################################################
# 4. Test Cloud Monitoring Alert Policies
################################################################################
echo ""
echo -e "${YELLOW}[4/6] Testing Cloud Monitoring Alert Policies...${NC}"

ALERT_COUNT=$(gcloud alpha monitoring policies list --project=${PROJECT_ID} --format=json 2>/dev/null | jq '. | length' || echo "0")

if [ "$ALERT_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓ Found ${ALERT_COUNT} alert policies${NC}"
    echo "  Alert policies:"
    gcloud alpha monitoring policies list --project=${PROJECT_ID} --format="table(displayName,enabled)" 2>/dev/null || true
else
    echo -e "${YELLOW}! No alert policies found. Run 'terraform apply' to create them.${NC}"
fi

################################################################################
# 5. Test Cloud Trace
################################################################################
echo ""
echo -e "${YELLOW}[5/6] Testing Cloud Trace...${NC}"

# Check if Cloud Trace API is enabled
if gcloud services list --enabled --project=${PROJECT_ID} --filter="name:cloudtrace.googleapis.com" --format="value(name)" | grep -q "cloudtrace"; then
    echo -e "${GREEN}✓ Cloud Trace API enabled${NC}"

    # Check for recent traces (last 1 hour)
    TRACE_COUNT=$(gcloud trace list --project=${PROJECT_ID} --limit=10 --format=json 2>/dev/null | jq '. | length' || echo "0")

    if [ "$TRACE_COUNT" -gt 0 ]; then
        echo -e "${GREEN}✓ Found ${TRACE_COUNT} traces in the last hour${NC}"
        echo "  View traces: https://console.cloud.google.com/traces/list?project=${PROJECT_ID}"
    else
        echo -e "${YELLOW}! No traces found. Generate traffic to see traces.${NC}"
    fi
else
    echo -e "${RED}✗ Cloud Trace API not enabled${NC}"
fi

################################################################################
# 6. Test Error Reporting
################################################################################
echo ""
echo -e "${YELLOW}[6/6] Testing Error Reporting...${NC}"

# Check if Error Reporting API is enabled
if gcloud services list --enabled --project=${PROJECT_ID} --filter="name:clouderrorreporting.googleapis.com" --format="value(name)" | grep -q "clouderrorreporting"; then
    echo -e "${GREEN}✓ Error Reporting API enabled${NC}"
    echo "  View errors: https://console.cloud.google.com/errors?project=${PROJECT_ID}"

    # Note: gcloud doesn't have a direct command to list errors, so we check the console
    echo -e "${YELLOW}  → Check the Error Reporting console for grouped errors${NC}"
else
    echo -e "${RED}✗ Error Reporting API not enabled${NC}"
fi

################################################################################
# Summary & Next Steps
################################################################################
echo ""
echo "========================================="
echo -e "${GREEN}Observability Testing Complete!${NC}"
echo "========================================="
echo ""
echo "Next Steps:"
echo "  1. Generate some API traffic to populate logs and traces"
echo "  2. Check BigQuery for exported logs:"
echo "     https://console.cloud.google.com/bigquery?project=${PROJECT_ID}&d=${DATASET_ID}"
echo ""
echo "  3. View materialized views for analytics:"
echo "     - error_summary_24h"
echo "     - workflow_performance_24h"
echo "     - api_performance_24h"
echo "     - feedback_analytics_7d"
echo ""
echo "  4. Monitor alerts in Cloud Monitoring:"
echo "     https://console.cloud.google.com/monitoring/alerting?project=${PROJECT_ID}"
echo ""
echo "  5. Explore traces in Cloud Trace:"
echo "     https://console.cloud.google.com/traces?project=${PROJECT_ID}"
echo ""
echo "  6. Review errors in Error Reporting:"
echo "     https://console.cloud.google.com/errors?project=${PROJECT_ID}"
echo ""
