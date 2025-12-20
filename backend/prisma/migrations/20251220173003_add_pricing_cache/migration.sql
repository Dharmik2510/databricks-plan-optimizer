-- CreateTable
CREATE TABLE "pricing_cache" (
    "id" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "cloudProvider" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pricing_cache_cacheKey_key" ON "pricing_cache"("cacheKey");

-- CreateIndex
CREATE INDEX "pricing_cache_cloudProvider_region_idx" ON "pricing_cache"("cloudProvider", "region");

-- CreateIndex
CREATE INDEX "pricing_cache_expiresAt_idx" ON "pricing_cache"("expiresAt");
