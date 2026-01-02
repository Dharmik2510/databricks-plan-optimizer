/*
  Warnings:

  - A unique constraint covering the columns `[googleId]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "googleId" TEXT,
ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verificationToken" TEXT;

-- CreateTable
CREATE TABLE "checkpoint_blobs" (
    "thread_id" TEXT NOT NULL,
    "checkpoint_ns" TEXT NOT NULL DEFAULT '',
    "channel" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "blob" BYTEA,

    CONSTRAINT "checkpoint_blobs_pkey" PRIMARY KEY ("thread_id","checkpoint_ns","channel","version")
);

-- CreateTable
CREATE TABLE "checkpoint_migrations" (
    "v" INTEGER NOT NULL,

    CONSTRAINT "checkpoint_migrations_pkey" PRIMARY KEY ("v")
);

-- CreateTable
CREATE TABLE "checkpoint_writes" (
    "thread_id" TEXT NOT NULL,
    "checkpoint_ns" TEXT NOT NULL DEFAULT '',
    "checkpoint_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "idx" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "type" TEXT,
    "blob" BYTEA NOT NULL,

    CONSTRAINT "checkpoint_writes_pkey" PRIMARY KEY ("thread_id","checkpoint_ns","checkpoint_id","task_id","idx")
);

-- CreateTable
CREATE TABLE "checkpoints" (
    "thread_id" TEXT NOT NULL,
    "checkpoint_ns" TEXT NOT NULL DEFAULT '',
    "checkpoint_id" TEXT NOT NULL,
    "parent_checkpoint_id" TEXT,
    "type" TEXT,
    "checkpoint" JSONB NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "checkpoints_pkey" PRIMARY KEY ("thread_id","checkpoint_ns","checkpoint_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");
