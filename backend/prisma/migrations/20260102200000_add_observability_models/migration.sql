-- CreateTable
CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceInfo" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_audits" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "traceId" TEXT,
    "spanId" TEXT,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "feature" TEXT NOT NULL,
    "analysisId" TEXT,
    "jobId" TEXT,
    "workflowRunId" TEXT,
    "errorName" TEXT,
    "errorMessage" TEXT,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_runs" (
    "id" TEXT NOT NULL,
    "workflowRunId" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "traceId" TEXT,
    "workflowType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "analysisId" TEXT,
    "jobId" TEXT,
    "input" JSONB NOT NULL,
    "output" JSONB,
    "error" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,

    CONSTRAINT "workflow_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_events" (
    "id" TEXT NOT NULL,
    "workflowRunId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "nodeName" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "input" JSONB,
    "output" JSONB,
    "error" JSONB,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMs" INTEGER,
    "traceId" TEXT,
    "spanId" TEXT,

    CONSTRAINT "workflow_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_feedbacks" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "assignedToId" TEXT,
    "tags" TEXT[],
    "correlationId" TEXT,
    "traceId" TEXT,
    "requestId" TEXT,
    "workflowRunId" TEXT,
    "analysisId" TEXT,
    "jobId" TEXT,
    "pageUrl" TEXT,
    "userAgent" TEXT,
    "browserInfo" JSONB,
    "appVersion" TEXT,
    "lastAction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "user_feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_attachments" (
    "id" TEXT NOT NULL,
    "feedbackId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "storageUrl" TEXT NOT NULL,
    "isScreenshot" BOOLEAN NOT NULL DEFAULT false,
    "screenshotMeta" JSONB,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_events" (
    "id" TEXT NOT NULL,
    "feedbackId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "authorId" TEXT,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "content" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_sessionId_key" ON "user_sessions"("sessionId");

-- CreateIndex
CREATE INDEX "user_sessions_userId_idx" ON "user_sessions"("userId");

-- CreateIndex
CREATE INDEX "user_sessions_sessionId_idx" ON "user_sessions"("sessionId");

-- CreateIndex
CREATE INDEX "user_sessions_createdAt_idx" ON "user_sessions"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "request_audits_requestId_key" ON "request_audits"("requestId");

-- CreateIndex
CREATE INDEX "request_audits_requestId_idx" ON "request_audits"("requestId");

-- CreateIndex
CREATE INDEX "request_audits_correlationId_idx" ON "request_audits"("correlationId");

-- CreateIndex
CREATE INDEX "request_audits_traceId_idx" ON "request_audits"("traceId");

-- CreateIndex
CREATE INDEX "request_audits_userId_createdAt_idx" ON "request_audits"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "request_audits_feature_createdAt_idx" ON "request_audits"("feature", "createdAt");

-- CreateIndex
CREATE INDEX "request_audits_statusCode_createdAt_idx" ON "request_audits"("statusCode", "createdAt");

-- CreateIndex
CREATE INDEX "request_audits_workflowRunId_idx" ON "request_audits"("workflowRunId");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_runs_workflowRunId_key" ON "workflow_runs"("workflowRunId");

-- CreateIndex
CREATE INDEX "workflow_runs_workflowRunId_idx" ON "workflow_runs"("workflowRunId");

-- CreateIndex
CREATE INDEX "workflow_runs_correlationId_idx" ON "workflow_runs"("correlationId");

-- CreateIndex
CREATE INDEX "workflow_runs_traceId_idx" ON "workflow_runs"("traceId");

-- CreateIndex
CREATE INDEX "workflow_runs_userId_startedAt_idx" ON "workflow_runs"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "workflow_runs_workflowType_status_idx" ON "workflow_runs"("workflowType", "status");

-- CreateIndex
CREATE INDEX "workflow_runs_analysisId_idx" ON "workflow_runs"("analysisId");

-- CreateIndex
CREATE INDEX "workflow_runs_jobId_idx" ON "workflow_runs"("jobId");

-- CreateIndex
CREATE INDEX "workflow_runs_status_startedAt_idx" ON "workflow_runs"("status", "startedAt");

-- CreateIndex
CREATE INDEX "workflow_events_workflowRunId_timestamp_idx" ON "workflow_events"("workflowRunId", "timestamp");

-- CreateIndex
CREATE INDEX "workflow_events_nodeId_idx" ON "workflow_events"("nodeId");

-- CreateIndex
CREATE INDEX "workflow_events_eventType_timestamp_idx" ON "workflow_events"("eventType", "timestamp");

-- CreateIndex
CREATE INDEX "workflow_events_traceId_idx" ON "workflow_events"("traceId");

-- CreateIndex
CREATE UNIQUE INDEX "user_feedbacks_ticketId_key" ON "user_feedbacks"("ticketId");

-- CreateIndex
CREATE INDEX "user_feedbacks_ticketId_idx" ON "user_feedbacks"("ticketId");

-- CreateIndex
CREATE INDEX "user_feedbacks_userId_createdAt_idx" ON "user_feedbacks"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "user_feedbacks_status_severity_createdAt_idx" ON "user_feedbacks"("status", "severity", "createdAt");

-- CreateIndex
CREATE INDEX "user_feedbacks_feature_createdAt_idx" ON "user_feedbacks"("feature", "createdAt");

-- CreateIndex
CREATE INDEX "user_feedbacks_assignedToId_idx" ON "user_feedbacks"("assignedToId");

-- CreateIndex
CREATE INDEX "user_feedbacks_correlationId_idx" ON "user_feedbacks"("correlationId");

-- CreateIndex
CREATE INDEX "user_feedbacks_traceId_idx" ON "user_feedbacks"("traceId");

-- CreateIndex
CREATE INDEX "user_feedbacks_workflowRunId_idx" ON "user_feedbacks"("workflowRunId");

-- CreateIndex
CREATE INDEX "user_feedbacks_analysisId_idx" ON "user_feedbacks"("analysisId");

-- CreateIndex
CREATE INDEX "feedback_attachments_feedbackId_idx" ON "feedback_attachments"("feedbackId");

-- CreateIndex
CREATE INDEX "feedback_events_feedbackId_createdAt_idx" ON "feedback_events"("feedbackId", "createdAt");

-- CreateIndex
CREATE INDEX "feedback_events_eventType_idx" ON "feedback_events"("eventType");

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_audits" ADD CONSTRAINT "request_audits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_audits" ADD CONSTRAINT "request_audits_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "user_sessions"("sessionId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "analyses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_events" ADD CONSTRAINT "workflow_events_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "workflow_runs"("workflowRunId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_feedbacks" ADD CONSTRAINT "user_feedbacks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_feedbacks" ADD CONSTRAINT "user_feedbacks_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "user_sessions"("sessionId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_feedbacks" ADD CONSTRAINT "user_feedbacks_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_feedbacks" ADD CONSTRAINT "user_feedbacks_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "workflow_runs"("workflowRunId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_attachments" ADD CONSTRAINT "feedback_attachments_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "user_feedbacks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_events" ADD CONSTRAINT "feedback_events_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "user_feedbacks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_events" ADD CONSTRAINT "feedback_events_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
