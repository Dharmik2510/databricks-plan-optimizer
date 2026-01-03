#!/bin/bash

################################################################################
# Create BigQuery Views for Observability Analytics
#
# This script creates BigQuery views after logs have started flowing.
# Run this AFTER deploying observability infrastructure and generating some logs.
################################################################################

set -e

PROJECT_ID="${GCP_PROJECT_ID:-gen-lang-client-0997977661}"
DATASET_ID="observability_logs"

echo "========================================="
echo "Creating BigQuery Views for Analytics"
echo "========================================="
echo "Project: $PROJECT_ID"
echo "Dataset: $DATASET_ID"
echo ""

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

################################################################################
# Check if log tables exist
################################################################################
echo -e "${YELLOW}[1/5] Checking for log tables...${NC}"

TABLES=$(bq ls --project_id=${PROJECT_ID} --dataset_id=${DATASET_ID} --format=json 2>/dev/null | jq -r '.[].tableReference.tableId' || echo "")

if [ -z "$TABLES" ]; then
    echo -e "${YELLOW}⚠ No tables found in dataset. Make sure logs are flowing first!${NC}"
    echo ""
    echo "Steps to generate logs:"
    echo "  1. Deploy and run your application"
    echo "  2. Generate some API traffic"
    echo "  3. Wait 1-2 minutes for log export"
    echo "  4. Run this script again"
    exit 1
fi

echo -e "${GREEN}✓ Found tables:${NC}"
echo "$TABLES" | grep -E "(error_logs|workflow_logs|feedback_logs|http_logs)" || echo "  (No log tables yet)"
echo ""

################################################################################
# View 1: Error Summary
################################################################################
echo -e "${YELLOW}[2/5] Creating error_summary_24h view...${NC}"

bq mk --use_legacy_sql=false --view="
SELECT
  TIMESTAMP_TRUNC(timestamp, HOUR) as hour,
  severity,
  jsonPayload.error.name as error_name,
  jsonPayload.error.message as error_message,
  COUNT(*) as error_count,
  COUNT(DISTINCT jsonPayload.userId) as affected_users,
  COUNT(DISTINCT jsonPayload.requestId) as affected_requests
FROM
  \`${PROJECT_ID}.${DATASET_ID}.error_logs_*\`
WHERE
  timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
GROUP BY
  hour, severity, error_name, error_message
ORDER BY
  hour DESC, error_count DESC
" --project_id=${PROJECT_ID} --dataset_id=${DATASET_ID} --force error_summary_24h 2>/dev/null || \
echo -e "${YELLOW}  Note: View will work once error logs start flowing${NC}"

echo -e "${GREEN}✓ error_summary_24h created${NC}"

################################################################################
# View 2: Workflow Performance
################################################################################
echo ""
echo -e "${YELLOW}[3/5] Creating workflow_performance_24h view...${NC}"

bq mk --use_legacy_sql=false --view="
WITH workflow_runs AS (
  SELECT
    jsonPayload.workflowRunId as workflow_run_id,
    jsonPayload.workflowName as workflow_name,
    MIN(CASE WHEN jsonPayload.eventName = 'workflow.started' THEN timestamp END) as start_time,
    MAX(CASE WHEN jsonPayload.eventName IN ('workflow.completed', 'workflow.failed') THEN timestamp END) as end_time,
    MAX(CASE WHEN jsonPayload.eventName = 'workflow.failed' THEN 1 ELSE 0 END) as is_failed,
    MAX(jsonPayload.durationMs) as duration_ms
  FROM
    \`${PROJECT_ID}.${DATASET_ID}.workflow_logs_*\`
  WHERE
    timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
  GROUP BY
    workflow_run_id, workflow_name
)
SELECT
  workflow_name,
  COUNT(*) as total_runs,
  SUM(is_failed) as failed_runs,
  ROUND(AVG(duration_ms), 2) as avg_duration_ms,
  ROUND(APPROX_QUANTILES(duration_ms, 100)[OFFSET(50)], 2) as p50_duration_ms,
  ROUND(APPROX_QUANTILES(duration_ms, 100)[OFFSET(95)], 2) as p95_duration_ms,
  ROUND(APPROX_QUANTILES(duration_ms, 100)[OFFSET(99)], 2) as p99_duration_ms,
  ROUND(100.0 * SUM(is_failed) / COUNT(*), 2) as failure_rate_percent
FROM
  workflow_runs
WHERE
  end_time IS NOT NULL
GROUP BY
  workflow_name
ORDER BY
  total_runs DESC
" --project_id=${PROJECT_ID} --dataset_id=${DATASET_ID} --force workflow_performance_24h 2>/dev/null || \
echo -e "${YELLOW}  Note: View will work once workflow logs start flowing${NC}"

echo -e "${GREEN}✓ workflow_performance_24h created${NC}"

################################################################################
# View 3: API Performance
################################################################################
echo ""
echo -e "${YELLOW}[4/5] Creating api_performance_24h view...${NC}"

bq mk --use_legacy_sql=false --view="
SELECT
  TIMESTAMP_TRUNC(timestamp, HOUR) as hour,
  jsonPayload.method as http_method,
  REGEXP_EXTRACT(jsonPayload.path, r'^(/[^/]+/[^/]+)') as endpoint_base,
  COUNT(*) as request_count,
  SUM(CASE WHEN jsonPayload.statusCode >= 500 THEN 1 ELSE 0 END) as server_errors,
  SUM(CASE WHEN jsonPayload.statusCode >= 400 AND jsonPayload.statusCode < 500 THEN 1 ELSE 0 END) as client_errors,
  ROUND(AVG(jsonPayload.durationMs), 2) as avg_duration_ms,
  ROUND(APPROX_QUANTILES(jsonPayload.durationMs, 100)[OFFSET(95)], 2) as p95_duration_ms,
  ROUND(100.0 * SUM(CASE WHEN jsonPayload.statusCode >= 500 THEN 1 ELSE 0 END) / COUNT(*), 2) as error_rate_percent
FROM
  \`${PROJECT_ID}.${DATASET_ID}.http_logs_*\`
WHERE
  timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
GROUP BY
  hour, http_method, endpoint_base
HAVING
  request_count > 10
ORDER BY
  hour DESC, request_count DESC
" --project_id=${PROJECT_ID} --dataset_id=${DATASET_ID} --force api_performance_24h 2>/dev/null || \
echo -e "${YELLOW}  Note: View will work once HTTP logs start flowing${NC}"

echo -e "${GREEN}✓ api_performance_24h created${NC}"

################################################################################
# View 4: Feedback Analytics
################################################################################
echo ""
echo -e "${YELLOW}[5/5] Creating feedback_analytics_7d view...${NC}"

bq mk --use_legacy_sql=false --view="
SELECT
  DATE(timestamp) as date,
  jsonPayload.category as category,
  jsonPayload.priority as priority,
  jsonPayload.status as status,
  COUNT(DISTINCT jsonPayload.ticketId) as ticket_count,
  COUNT(DISTINCT jsonPayload.userId) as unique_users,
  AVG(TIMESTAMP_DIFF(
    TIMESTAMP(jsonPayload.resolvedAt),
    TIMESTAMP(jsonPayload.createdAt),
    HOUR
  )) as avg_resolution_time_hours
FROM
  \`${PROJECT_ID}.${DATASET_ID}.feedback_logs_*\`
WHERE
  timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
  AND jsonPayload.eventName = 'feedback.created'
GROUP BY
  date, category, priority, status
ORDER BY
  date DESC
" --project_id=${PROJECT_ID} --dataset_id=${DATASET_ID} --force feedback_analytics_7d 2>/dev/null || \
echo -e "${YELLOW}  Note: View will work once feedback logs start flowing${NC}"

echo -e "${GREEN}✓ feedback_analytics_7d created${NC}"

################################################################################
# Summary
################################################################################
echo ""
echo "========================================="
echo -e "${GREEN}BigQuery Views Created!${NC}"
echo "========================================="
echo ""
echo "Views created in ${PROJECT_ID}:${DATASET_ID}:"
echo "  ✓ error_summary_24h"
echo "  ✓ workflow_performance_24h"
echo "  ✓ api_performance_24h"
echo "  ✓ feedback_analytics_7d"
echo ""
echo "Query views:"
echo "  bq query --use_legacy_sql=false 'SELECT * FROM ${PROJECT_ID}.${DATASET_ID}.error_summary_24h LIMIT 10'"
echo ""
echo "Or in BigQuery console:"
echo "  https://console.cloud.google.com/bigquery?project=${PROJECT_ID}&d=${DATASET_ID}"
echo ""
