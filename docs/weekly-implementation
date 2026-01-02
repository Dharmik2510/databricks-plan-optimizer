Phase 1: Core Observability (Week 1)
 Database Schema
 Add Prisma models (UserSession, RequestAudit, WorkflowRun, WorkflowEvent, UserFeedback, FeedbackAttachment, FeedbackEvent)
 Create migration
 Run migration in dev/staging
 Add indexes
 Backend Core
 Implement RequestContextMiddleware with AsyncLocalStorage
 Implement AppLoggerService with Winston + Cloud Logging
 Add LoggingInterceptor with DB audit sampling
 Add AllExceptionsFilter with Error Reporting
 Update JwtAuthGuard to track sessions
 Add Prisma multi-tenancy middleware
 OpenTelemetry Setup
 Install @opentelemetry/sdk-node + GCP exporters
 Create tracing.ts initialization
 Enable in main.ts
 Test trace propagation locally
 Deploy & Validate
 Deploy to staging
 Verify logs appear in Cloud Logging
 Verify traces appear in Cloud Trace
 Verify errors appear in Error Reporting
 Check RequestAudit table populated
Phase 2: Workflow Observability (Week 1-2)
 Workflow Logging
 Implement WorkflowLoggerService
 Create @LogWorkflowNode decorator
 Wrap all LangGraph nodes with decorator
 Test workflow event logging in DB
 Add workflow correlation to request context
 LangGraph Integration
 Update analysis workflow to call startWorkflowRun
 Update code mapping workflow
 Add error handling to log node failures
 Test end-to-end workflow observability
Phase 3: User Feedback System (Week 2)
 Backend API
 Implement FeedbackController + FeedbackService
 Add GCS bucket for screenshot uploads
 Test feedback creation with context auto-capture
 Test screenshot upload
 Frontend
 Implement ApiClient with correlation headers
 Implement ErrorBoundary component
 Implement FeedbackButton + FeedbackModal
 Add feedback widget to app layout
 Test feedback submission flow
 Test screenshot capture
 User Feedback UI
 Add "My Tickets" page for users
 Add ticket detail view for users
 Test user reply flow
Phase 4: Admin Panel (Week 2-3)
 Support Inbox
 Implement SupportInboxController + SupportInboxService
 Build ticket list UI with filters
 Build ticket detail UI with timeline
 Build reply form (admin + internal notes)
 Add assignment/status/tag controls
 Add "View in Cloud Logging" links
 Test end-to-end support workflow
 Observability Dashboard
 Implement ObservabilityController + ObservabilityService
 Build workflow runs list UI
 Build workflow detail UI with timeline visualization
 Build metrics summary page
 Add Cloud Logging query links
 Test workflow debugging flow
Phase 5: GCP Configuration (Week 3)
 Cloud Logging
 Create BigQuery dataset observability_logs
 Create log sinks (errors, workflows, feedback)
 Create materialized views for analytics
 Test log export to BigQuery
 Cloud Monitoring
 Create alert policy: API error rate > 5%
 Create alert policy: workflow failure rate > 10%
 Create alert policy: unassigned critical tickets
 Create custom metrics (if needed)
 Set up notification channels (email/Slack)
 Cloud Trace
 Verify traces visible in console
 Test trace linking from logs
 Verify distributed tracing across services
 Error Reporting
 Verify errors visible in console
 Test error grouping
 Set up error notifications
Phase 6: Production Rollout (Week 3-4)
 Testing
 Load test with observability enabled
 Verify log sampling works (no log explosion)
 Test full debug workflow (ticket → logs → fix)
 Security audit (PII redaction, multi-tenancy)
 Documentation
 Write operational runbook (how to debug issues)
 Document Cloud Logging query templates
 Write admin panel user guide
 Create video walkthrough for support team
 Deploy to Production
 Deploy schema migration
 Deploy backend with OBSERVABILITY_ENABLED=true
 Deploy frontend with feedback widget
 Deploy admin panel updates
 Monitor for issues (24h watch)
 Iteration
 Gather feedback from support team
 Add missing query templates
 Optimize slow admin queries
 Tune log sampling rates based on volume/cost
