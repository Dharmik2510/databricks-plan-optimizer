# ============================================================================
# PHASE 5: GCP OBSERVABILITY CONFIGURATION
# ============================================================================
# This file contains:
# - BigQuery dataset for log analytics
# - Log sinks (errors, workflows, feedback)
# - Cloud Monitoring alert policies
# - Custom metrics
# - Notification channels
# ============================================================================

# Enable required APIs
resource "google_project_service" "logging" {
  service            = "logging.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "monitoring" {
  service            = "monitoring.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "bigquery" {
  service            = "bigquery.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "cloudtrace" {
  service            = "cloudtrace.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "clouderrorreporting" {
  service            = "clouderrorreporting.googleapis.com"
  disable_on_destroy = false
}

# ============================================================================
# BIGQUERY: OBSERVABILITY DATASET
# ============================================================================

resource "google_bigquery_dataset" "observability_logs" {
  dataset_id                  = "observability_logs"
  friendly_name               = "Observability Logs"
  description                 = "Central repository for application logs, workflow events, and error tracking"
  location                    = "US"
  default_table_expiration_ms = 7776000000 # 90 days

  labels = {
    environment = var.environment
    team        = "engineering"
    purpose     = "observability"
  }

  depends_on = [google_project_service.bigquery]
}

# ============================================================================
# LOG SINKS: Export logs to BigQuery
# ============================================================================

# Sink 1: Error Logs (severity >= ERROR)
resource "google_logging_project_sink" "error_logs" {
  name        = "error-logs-sink"
  description = "Export all ERROR and CRITICAL logs to BigQuery"
  destination = "bigquery.googleapis.com/projects/${var.project_id}/datasets/${google_bigquery_dataset.observability_logs.dataset_id}"

  # Filter for errors from our services
  filter = <<-EOT
    severity >= ERROR
    AND (
      resource.type = "cloud_run_revision"
      OR resource.type = "k8s_container"
      OR resource.type = "gce_instance"
    )
    AND (
      labels.service = "brickoptima-api"
      OR jsonPayload.service = "brickoptima-api"
    )
  EOT

  # Use partitioned tables for better performance
  bigquery_options {
    use_partitioned_tables = true
  }

  unique_writer_identity = true

  depends_on = [google_project_service.logging]
}

# Sink 2: Workflow Logs
resource "google_logging_project_sink" "workflow_logs" {
  name        = "workflow-logs-sink"
  description = "Export all workflow-related logs to BigQuery"
  destination = "bigquery.googleapis.com/projects/${var.project_id}/datasets/${google_bigquery_dataset.observability_logs.dataset_id}"

  # Filter for workflow events
  filter = <<-EOT
    jsonPayload.eventName =~ "workflow\\..*"
    OR jsonPayload.workflowRunId != ""
    OR jsonPayload.dagNodeId != ""
  EOT

  bigquery_options {
    use_partitioned_tables = true
  }

  unique_writer_identity = true

  depends_on = [google_project_service.logging]
}

# Sink 3: Feedback System Logs
resource "google_logging_project_sink" "feedback_logs" {
  name        = "feedback-logs-sink"
  description = "Export feedback ticket and admin action logs to BigQuery"
  destination = "bigquery.googleapis.com/projects/${var.project_id}/datasets/${google_bigquery_dataset.observability_logs.dataset_id}"

  # Filter for feedback-related events
  filter = <<-EOT
    jsonPayload.eventName =~ "feedback\\..*"
    OR jsonPayload.ticketId != ""
    OR (
      resource.type = "cloud_run_revision"
      AND httpRequest.requestUrl =~ ".*/feedback/.*"
    )
  EOT

  bigquery_options {
    use_partitioned_tables = true
  }

  unique_writer_identity = true

  depends_on = [google_project_service.logging]
}

# Sink 4: HTTP Request Logs (for traffic analysis)
resource "google_logging_project_sink" "http_logs" {
  name        = "http-request-logs-sink"
  description = "Export HTTP request logs for API analytics"
  destination = "bigquery.googleapis.com/projects/${var.project_id}/datasets/${google_bigquery_dataset.observability_logs.dataset_id}"

  filter = <<-EOT
    jsonPayload.eventName = "http.request"
    AND jsonPayload.service = "brickoptima-api"
  EOT

  bigquery_options {
    use_partitioned_tables = true
  }

  unique_writer_identity = true

  depends_on = [google_project_service.logging]
}

# Grant BigQuery Data Editor role to log sink service accounts
resource "google_bigquery_dataset_iam_member" "error_logs_writer" {
  dataset_id = google_bigquery_dataset.observability_logs.dataset_id
  role       = "roles/bigquery.dataEditor"
  member     = google_logging_project_sink.error_logs.writer_identity
}

resource "google_bigquery_dataset_iam_member" "workflow_logs_writer" {
  dataset_id = google_bigquery_dataset.observability_logs.dataset_id
  role       = "roles/bigquery.dataEditor"
  member     = google_logging_project_sink.workflow_logs.writer_identity
}

resource "google_bigquery_dataset_iam_member" "feedback_logs_writer" {
  dataset_id = google_bigquery_dataset.observability_logs.dataset_id
  role       = "roles/bigquery.dataEditor"
  member     = google_logging_project_sink.feedback_logs.writer_identity
}

resource "google_bigquery_dataset_iam_member" "http_logs_writer" {
  dataset_id = google_bigquery_dataset.observability_logs.dataset_id
  role       = "roles/bigquery.dataEditor"
  member     = google_logging_project_sink.http_logs.writer_identity
}

# ============================================================================
# BIGQUERY: MATERIALIZED VIEWS FOR ANALYTICS
# ============================================================================
# NOTE: Views are commented out initially because they reference log tables
# that won't exist until logs are exported by the sinks (takes 1-2 minutes).
# Uncomment these resources AFTER logs start flowing, or create views manually.
# See scripts/create-bigquery-views.sh for manual creation.
# ============================================================================

# # View 1: Error Summary (last 24 hours)
# resource "google_bigquery_table" "error_summary_view" {
#   dataset_id = google_bigquery_dataset.observability_logs.dataset_id
#   table_id   = "error_summary_24h"
#   deletion_protection = false
#
#   view {
#     query = <<-SQL
#       SELECT
#         TIMESTAMP_TRUNC(timestamp, HOUR) as hour,
#         severity,
#         jsonPayload.error.name as error_name,
#         jsonPayload.error.message as error_message,
#         COUNT(*) as error_count,
#         COUNT(DISTINCT jsonPayload.userId) as affected_users,
#         COUNT(DISTINCT jsonPayload.requestId) as affected_requests
#       FROM
#         `${var.project_id}.${google_bigquery_dataset.observability_logs.dataset_id}.error_logs_*`
#       WHERE
#         timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
#       GROUP BY
#         hour, severity, error_name, error_message
#       ORDER BY
#         hour DESC, error_count DESC
#     SQL
#     use_legacy_sql = false
#   }
#
#   depends_on = [
#     google_logging_project_sink.error_logs,
#     google_bigquery_dataset_iam_member.error_logs_writer
#   ]
# }
#
# # View 2: Workflow Performance Metrics
# resource "google_bigquery_table" "workflow_performance_view" {
#   dataset_id = google_bigquery_dataset.observability_logs.dataset_id
#   table_id   = "workflow_performance_24h"
#   deletion_protection = false
#
#   view {
#     query = <<-SQL
#       WITH workflow_runs AS (
#         SELECT
#           jsonPayload.workflowRunId as workflow_run_id,
#           jsonPayload.workflowName as workflow_name,
#           MIN(CASE WHEN jsonPayload.eventName = 'workflow.started' THEN timestamp END) as start_time,
#           MAX(CASE WHEN jsonPayload.eventName IN ('workflow.completed', 'workflow.failed') THEN timestamp END) as end_time,
#           MAX(CASE WHEN jsonPayload.eventName = 'workflow.failed' THEN 1 ELSE 0 END) as is_failed,
#           MAX(jsonPayload.durationMs) as duration_ms
#         FROM
#           `${var.project_id}.${google_bigquery_dataset.observability_logs.dataset_id}.workflow_logs_*`
#         WHERE
#           timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
#         GROUP BY
#           workflow_run_id, workflow_name
#       )
#       SELECT
#         workflow_name,
#         COUNT(*) as total_runs,
#         SUM(is_failed) as failed_runs,
#         ROUND(AVG(duration_ms), 2) as avg_duration_ms,
#         ROUND(APPROX_QUANTILES(duration_ms, 100)[OFFSET(50)], 2) as p50_duration_ms,
#         ROUND(APPROX_QUANTILES(duration_ms, 100)[OFFSET(95)], 2) as p95_duration_ms,
#         ROUND(APPROX_QUANTILES(duration_ms, 100)[OFFSET(99)], 2) as p99_duration_ms,
#         ROUND(100.0 * SUM(is_failed) / COUNT(*), 2) as failure_rate_percent
#       FROM
#         workflow_runs
#       WHERE
#         end_time IS NOT NULL
#       GROUP BY
#         workflow_name
#       ORDER BY
#         total_runs DESC
#     SQL
#     use_legacy_sql = false
#   }
#
#   depends_on = [google_logging_project_sink.workflow_logs]
# }
#
# # View 3: API Performance Metrics
# resource "google_bigquery_table" "api_performance_view" {
#   dataset_id = google_bigquery_dataset.observability_logs.dataset_id
#   table_id   = "api_performance_24h"
#   deletion_protection = false
#
#   view {
#     query = <<-SQL
#       SELECT
#         TIMESTAMP_TRUNC(timestamp, HOUR) as hour,
#         jsonPayload.method as http_method,
#         REGEXP_EXTRACT(jsonPayload.path, r'^(/[^/]+/[^/]+)') as endpoint_base,
#         COUNT(*) as request_count,
#         SUM(CASE WHEN jsonPayload.statusCode >= 500 THEN 1 ELSE 0 END) as server_errors,
#         SUM(CASE WHEN jsonPayload.statusCode >= 400 AND jsonPayload.statusCode < 500 THEN 1 ELSE 0 END) as client_errors,
#         ROUND(AVG(jsonPayload.durationMs), 2) as avg_duration_ms,
#         ROUND(APPROX_QUANTILES(jsonPayload.durationMs, 100)[OFFSET(95)], 2) as p95_duration_ms,
#         ROUND(100.0 * SUM(CASE WHEN jsonPayload.statusCode >= 500 THEN 1 ELSE 0 END) / COUNT(*), 2) as error_rate_percent
#       FROM
#         `${var.project_id}.${google_bigquery_dataset.observability_logs.dataset_id}.http_logs_*`
#       WHERE
#         timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
#       GROUP BY
#         hour, http_method, endpoint_base
#       HAVING
#         request_count > 10
#       ORDER BY
#         hour DESC, request_count DESC
#     SQL
#     use_legacy_sql = false
#   }
#
#   depends_on = [google_logging_project_sink.http_logs]
# }
#
# # View 4: Feedback Ticket Analytics
# resource "google_bigquery_table" "feedback_analytics_view" {
#   dataset_id = google_bigquery_dataset.observability_logs.dataset_id
#   table_id   = "feedback_analytics_7d"
#   deletion_protection = false
#
#   view {
#     query = <<-SQL
#       SELECT
#         DATE(timestamp) as date,
#         jsonPayload.category as category,
#         jsonPayload.priority as priority,
#         jsonPayload.status as status,
#         COUNT(DISTINCT jsonPayload.ticketId) as ticket_count,
#         COUNT(DISTINCT jsonPayload.userId) as unique_users,
#         AVG(TIMESTAMP_DIFF(
#           TIMESTAMP(jsonPayload.resolvedAt),
#           TIMESTAMP(jsonPayload.createdAt),
#           HOUR
#         )) as avg_resolution_time_hours
#       FROM
#         `${var.project_id}.${google_bigquery_dataset.observability_logs.dataset_id}.feedback_logs_*`
#       WHERE
#         timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
#         AND jsonPayload.eventName = 'feedback.created'
#       GROUP BY
#         date, category, priority, status
#       ORDER BY
#         date DESC
#     SQL
#     use_legacy_sql = false
#   }
#
#   depends_on = [google_logging_project_sink.feedback_logs]
# }

# ============================================================================
# CLOUD MONITORING: NOTIFICATION CHANNELS
# ============================================================================

# Email notification channel
resource "google_monitoring_notification_channel" "email_alerts" {
  display_name = "Engineering Team Email"
  type         = "email"
  labels = {
    email_address = var.alert_email
  }

  enabled = true

  depends_on = [google_project_service.monitoring]
}

# Slack notification channel (optional - disabled by default)
# Uncomment and configure if needed
# resource "google_monitoring_notification_channel" "slack_alerts" {
#   display_name = "Engineering Team Slack"
#   type         = "slack"
#   labels = {
#     url = "YOUR_SLACK_WEBHOOK_URL"
#   }
#
#   enabled = true
#
#   depends_on = [google_project_service.monitoring]
# }

# ============================================================================
# CUSTOM METRIC DESCRIPTORS
# ============================================================================

resource "google_monitoring_metric_descriptor" "workflow_failures" {
  description = "Rate of workflow failures"
  display_name = "Workflow Failure Rate"
  type = "custom.googleapis.com/brickoptima/workflow_failures"
  metric_kind = "GAUGE"
  value_type = "DOUBLE"
  unit = "1"
  
  labels {
    key = "project_id"
    value_type = "STRING"
    description = "GCP Project ID"
  }

  depends_on = [google_project_service.monitoring]
}

resource "google_monitoring_metric_descriptor" "critical_tickets_unassigned" {
  description = "Count of unassigned critical feedback tickets"
  display_name = "Unassigned Critical Tickets"
  type = "custom.googleapis.com/brickoptima/critical_tickets_unassigned"
  metric_kind = "GAUGE"
  value_type = "INT64"
  unit = "1"

  labels {
    key = "project_id"
    value_type = "STRING"
    description = "GCP Project ID"
  }

  depends_on = [google_project_service.monitoring]
}

resource "google_monitoring_metric_descriptor" "db_connection_count" {
  description = "Number of active database connections"
  display_name = "DB Connection Count"
  type = "custom.googleapis.com/brickoptima/db_connection_count"
  metric_kind = "GAUGE"
  value_type = "INT64"
  unit = "1"

  labels {
    key = "project_id"
    value_type = "STRING"
    description = "GCP Project ID"
  }

  depends_on = [google_project_service.monitoring]
}

# ============================================================================
# CLOUD MONITORING: ALERT POLICIES
# ============================================================================

# Alert 1: API Error Rate > 5%
resource "google_monitoring_alert_policy" "api_error_rate" {
  display_name = "High API Error Rate (>5%)"
  combiner     = "OR"

  conditions {
    display_name = "API 5xx error rate > 5%"

    condition_threshold {
      filter = <<-EOT
        resource.type = "cloud_run_revision"
        AND metric.type = "run.googleapis.com/request_count"
        AND metric.labels.response_code_class = "5xx"
      EOT

      duration   = "300s" # 5 minutes
      comparison = "COMPARISON_GT"

      threshold_value = 0.05 # 5%

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_SUM"
        group_by_fields      = ["resource.service_name"]
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email_alerts.id]

  alert_strategy {
    auto_close = "86400s" # 24 hours
  }

  documentation {
    content = <<-EOT
      ## High API Error Rate Alert

      The API is experiencing an error rate greater than 5%.

      **Investigation Steps:**
      1. Check Cloud Logging for recent errors
      2. Review Error Reporting console
      3. Check for recent deployments
      4. Verify database connectivity
      5. Check external service dependencies

      **Query Logs:**
      ```
      severity >= ERROR
      resource.type = "cloud_run_revision"
      timestamp >= "30 minutes ago"
      ```

      **Dashboard:** https://console.cloud.google.com/monitoring/dashboards
    EOT
    mime_type = "text/markdown"
  }

  enabled    = true
  depends_on = [google_project_service.monitoring]
}

# Alert 2: Workflow Failure Rate > 10%
resource "google_monitoring_alert_policy" "workflow_failure_rate" {
  display_name = "High Workflow Failure Rate (>10%)"
  combiner     = "OR"

  conditions {
    display_name = "Workflow failure rate > 10% in last 30 minutes"

    condition_threshold {
      filter = <<-EOT
        metric.type = "custom.googleapis.com/brickoptima/workflow_failures"
        AND resource.type = "global"
      EOT

      duration   = "300s"
      comparison = "COMPARISON_GT"

      threshold_value = 0.10 # 10%

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_MEAN"
        cross_series_reducer = "REDUCE_MEAN"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email_alerts.id]

  alert_strategy {
    auto_close = "86400s"
  }

  documentation {
    content = <<-EOT
      ## High Workflow Failure Rate Alert

      More than 10% of workflows are failing.

      **Investigation Steps:**
      1. Query BigQuery for failing workflows:
         ```sql
         SELECT * FROM observability_logs.workflow_performance_24h
         WHERE failure_rate_percent > 10
         ORDER BY failed_runs DESC
         ```
      2. Check Cloud Logging for workflow errors
      3. Review database for stuck workflow_runs
      4. Check LangGraph service availability

      **Common Causes:**
      - External API timeouts (Gemini, OpenAI)
      - Database connection issues
      - Invalid workflow configurations
      - Resource exhaustion
    EOT
    mime_type = "text/markdown"
  }

  enabled    = true
  depends_on = [
    google_project_service.monitoring,
    google_monitoring_metric_descriptor.workflow_failures
  ]
}

# Alert 3: Unassigned Critical Feedback Tickets
resource "google_monitoring_alert_policy" "critical_tickets_unassigned" {
  display_name = "Critical Feedback Tickets Unassigned"
  combiner     = "OR"

  conditions {
    display_name = "Critical tickets unassigned for > 1 hour"

    condition_threshold {
      filter = <<-EOT
        metric.type = "custom.googleapis.com/brickoptima/critical_tickets_unassigned"
        AND resource.type = "global"
      EOT

      duration   = "60s"
      comparison = "COMPARISON_GT"

      threshold_value = 0 # Any critical unassigned ticket

      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_MAX"
        cross_series_reducer = "REDUCE_SUM"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email_alerts.id]

  alert_strategy {
    auto_close = "7200s" # 2 hours
  }

  documentation {
    content = <<-EOT
      ## Critical Feedback Tickets Unassigned

      There are critical priority feedback tickets that have not been assigned for over 1 hour.

      **Action Required:**
      1. Go to Admin Dashboard: /admin/feedback
      2. Filter by Priority: Critical
      3. Filter by Status: Open
      4. Assign tickets to appropriate team members

      **Query Database:**
      ```sql
      SELECT * FROM feedback_tickets
      WHERE priority = 'critical'
      AND status = 'open'
      AND assigned_to IS NULL
      ORDER BY created_at ASC
      ```
    EOT
    mime_type = "text/markdown"
  }

  enabled    = true
  depends_on = [
    google_project_service.monitoring,
    google_monitoring_metric_descriptor.critical_tickets_unassigned
  ]
}

# Alert 4: High Memory Usage
resource "google_monitoring_alert_policy" "high_memory_usage" {
  display_name = "High Memory Usage (>90%)"
  combiner     = "OR"

  conditions {
    display_name = "Container memory utilization > 90%"

    condition_threshold {
      filter = <<-EOT
        resource.type = "cloud_run_revision"
        AND metric.type = "run.googleapis.com/container/memory/utilizations"
      EOT

      duration   = "300s"
      comparison = "COMPARISON_GT"

      threshold_value = 0.90 # 90%

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_MEAN"
        cross_series_reducer = "REDUCE_MEAN"
        group_by_fields      = ["resource.service_name"]
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email_alerts.id]

  alert_strategy {
    auto_close = "86400s"
  }

  documentation {
    content = <<-EOT
      ## High Memory Usage Alert

      Cloud Run container is using more than 90% of allocated memory.

      **Immediate Actions:**
      1. Check for memory leaks in recent deployments
      2. Review workflow execution logs for large payloads
      3. Consider increasing memory limits in Cloud Run

      **Long-term Solutions:**
      - Optimize workflow graph node memory usage
      - Implement streaming for large data processing
      - Add pagination for database queries
    EOT
    mime_type = "text/markdown"
  }

  enabled    = true
  depends_on = [google_project_service.monitoring]
}

# Alert 5: High Database Connection Count
resource "google_monitoring_alert_policy" "high_db_connections" {
  display_name = "High Database Connection Count"
  combiner     = "OR"

  conditions {
    display_name = "Prisma connection pool near limit"

    condition_threshold {
      filter = <<-EOT
        metric.type = "custom.googleapis.com/brickoptima/db_connection_count"
        AND resource.type = "global"
      EOT

      duration   = "180s"
      comparison = "COMPARISON_GT"

      threshold_value = 80 # 80% of max connections

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MAX"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email_alerts.id]

  alert_strategy {
    auto_close = "86400s"
  }

  documentation {
    content = <<-EOT
      ## High Database Connection Count

      The application is approaching the maximum database connection limit.

      **Actions:**
      1. Check for connection leaks
      2. Review Prisma client configuration
      3. Verify connections are being properly closed
      4. Consider increasing connection pool size
    EOT
    mime_type = "text/markdown"
  }

  enabled    = true
  depends_on = [
    google_project_service.monitoring,
    google_monitoring_metric_descriptor.db_connection_count
  ]
}

# ============================================================================
# OUTPUTS
# ============================================================================

output "bigquery_dataset_id" {
  description = "BigQuery dataset ID for observability logs"
  value       = google_bigquery_dataset.observability_logs.dataset_id
}

output "log_sink_ids" {
  description = "Log sink resource IDs"
  value = {
    error_logs    = google_logging_project_sink.error_logs.id
    workflow_logs = google_logging_project_sink.workflow_logs.id
    feedback_logs = google_logging_project_sink.feedback_logs.id
    http_logs     = google_logging_project_sink.http_logs.id
  }
}

output "alert_policy_ids" {
  description = "Alert policy resource IDs"
  value = {
    api_error_rate              = google_monitoring_alert_policy.api_error_rate.id
    workflow_failure_rate       = google_monitoring_alert_policy.workflow_failure_rate.id
    critical_tickets_unassigned = google_monitoring_alert_policy.critical_tickets_unassigned.id
    high_memory_usage           = google_monitoring_alert_policy.high_memory_usage.id
    high_db_connections         = google_monitoring_alert_policy.high_db_connections.id
  }
}
