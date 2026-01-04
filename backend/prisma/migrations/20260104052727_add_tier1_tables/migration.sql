-- CreateTable
CREATE TABLE "analysis_runtime_baselines" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "baselineExecutionTimeSeconds" DOUBLE PRECISION NOT NULL,
    "stages" JSONB NOT NULL,
    "bottlenecks" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analysis_runtime_baselines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_event_logs" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "parsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analysis_event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "analysis_runtime_baselines_analysisId_key" ON "analysis_runtime_baselines"("analysisId");

-- CreateIndex
CREATE UNIQUE INDEX "analysis_event_logs_analysisId_key" ON "analysis_event_logs"("analysisId");

-- AddForeignKey
ALTER TABLE "analysis_runtime_baselines" ADD CONSTRAINT "analysis_runtime_baselines_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_event_logs" ADD CONSTRAINT "analysis_event_logs_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
