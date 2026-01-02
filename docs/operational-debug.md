Operational Playbook: How to Debug a User Issue
Scenario: User reports "Analysis stuck at 50%"
Step 1: Find the ticket
Go to Admin Panel → Support Inbox
Search by ticket ID (from user email) or user email
Open ticket detail page
Step 2: Gather context from ticket Ticket detail page shows:
correlationId: abc-123-def
traceId: xyz789
workflowRunId: wf_run_456
analysisId: analysis_789
Feature: analysis
Timestamp: 2026-01-02T14:30:00Z
Step 3: Check workflow status
Click "View Workflow" link → opens /admin/observability/workflows/wf_run_456
See timeline:
✅ parse_repo completed in 2.3s
✅ extract_dependencies completed in 5.1s
🔵 build_code_map running for 10 minutes (STUCK!)
⏸️ generate_insights pending
Step 4: Check logs for the stuck node
Click "View Logs for build_code_map" → opens Cloud Logging with pre-filled query:

jsonPayload.workflowRunId="wf_run_456"
jsonPayload.dagNodeId="build_code_map"
See logs:

{
  "severity": "INFO",
  "message": "Processing file 150/5000",
  "workflowRunId": "wf_run_456",
  "dagNodeId": "build_code_map",
  "timestamp": "2026-01-02T14:35:00Z"
}
→ Still processing, but very slow (5000 files!)
Step 5: Check for errors
Click "View All Errors for Workflow" → Cloud Logging query:

jsonPayload.workflowRunId="wf_run_456"
severity>=ERROR
See error:

{
  "severity": "ERROR",
  "message": "ChromaDB rate limit exceeded",
  "error": {
    "name": "RateLimitError",
    "code": "429"
  },
  "dagNodeId": "build_code_map",
  "timestamp": "2026-01-02T14:32:00Z"
}
→ Root cause identified: ChromaDB rate limit!
Step 6: Take action
Add internal note to ticket: "Identified rate limit issue with ChromaDB. Will implement batch retry logic."
Assign to engineer
Update status to "investigating"
Reply to user: "We've identified the issue – your repository has more files than expected. We're implementing a fix and will retry your analysis shortly."
Step 7: Implement fix & monitor
Engineer implements retry logic with exponential backoff
Deploy fix
Manually trigger workflow retry via admin panel
Monitor workflow_run progress
Once completed, update ticket status to "resolved"
Reply to user: "Your analysis is now complete! The issue was due to a rate limit we've now resolved."
Total debug time: ~10 minutes (vs hours of log grepping!)
Scenario: User reports "Can't login with Google"
Step 1: Find context
Ticket shows:
correlationId: auth-failure-123
feature: auth
No userId (unauthenticated)
Browser: Chrome 120, macOS
Timestamp: 2026-01-02T10:15:00Z
Step 2: Query auth failures Click "View Auth Logs" → Cloud Logging query:

jsonPayload.correlationId="auth-failure-123"
jsonPayload.feature="auth"
See logs:

{
  "severity": "ERROR",
  "message": "OAuth callback failed",
  "error": {
    "name": "OAuthError",
    "message": "invalid_grant",
    "code": "OAUTH_INVALID_GRANT"
  },
  "correlationId": "auth-failure-123",
  "timestamp": "2026-01-02T10:15:03Z"
}
Step 3: Check GCP Error Reporting
Go to Error Reporting console
Filter by "OAuthError" + timeframe
See similar errors for 5 other users
Pattern identified: Google OAuth issue affecting multiple users
Step 4: Check Google OAuth console
Verify OAuth client ID/secret
Check redirect URIs
Find issue: redirect URI changed after recent deploy!
Step 5: Fix & notify
Update OAuth redirect URI in GCP Console
Reply to all affected users
Update ticket: "Fixed OAuth configuration issue"
Status → resolved
Scenario: "Dashboard shows no data after analysis"
Step 1: Ticket context
analysisId: analysis_999
workflowRunId: wf_run_999
User: user_123
Step 2: Check workflow status
Workflow shows "completed" ✅
All nodes completed successfully
Output: { insightsGenerated: 42, mappingsCreated: 156 }
Step 3: Check database

-- Run in admin panel DB query tool
SELECT * FROM analyses WHERE id = 'analysis_999';
-- Shows status = 'completed', has data

SELECT COUNT(*) FROM insights WHERE analysisId = 'analysis_999';
-- Returns 42 (data exists!)
Step 4: Check frontend logs
Ask user to open browser console
See error: 403 Forbidden when fetching /api/analysis/analysis_999
Step 5: Check API logs Query:

jsonPayload.analysisId="analysis_999"
jsonPayload.path=~"/api/analysis.*"
severity>=ERROR
See:

{
  "severity": "ERROR",
  "message": "Access denied: user not member of tenant",
  "userId": "user_123",
  "tenantId": "tenant_A",
  "analysisId": "analysis_999",
  "analysisTenantId": "tenant_B" // MISMATCH!
}
Root cause: Analysis created under wrong tenant (multi-tenancy bug) Step 6: Fix
Manually update analysis tenantId (one-time fix)
File bug for engineer: "Analysis creation not respecting user's tenantId"
Reply to user: "Fixed access issue, please refresh"