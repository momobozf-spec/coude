-- CreateEnum
CREATE TYPE "DeletionStatus" AS ENUM ('NONE', 'REQUESTED', 'BLOCKED_BILLING', 'READY', 'COMPLETED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SUPPRESSED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "anonymizedAt" TIMESTAMP(3),
ADD COLUMN     "deletionRequestedAt" TIMESTAMP(3),
ADD COLUMN     "deletionStatus" "DeletionStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "lastExportAt" TIMESTAMP(3);

-- AlterTable
-- Delivery moves out of `notifications` and into `notification_deliveries`, so a
-- single notification can be attempted on several channels independently.
ALTER TABLE "notifications" DROP COLUMN "channel",
DROP COLUMN "sentAt";

-- `idempotencyKey` is added nullable and backfilled before the NOT NULL, so this
-- migration is safe on a table that already holds rows. No notification writer
-- shipped before this migration, so in practice the backfill touches nothing —
-- but a migration that would fail on non-empty data is a migration we cannot
-- re-run against a restored snapshot.
ALTER TABLE "notifications" ADD COLUMN "idempotencyKey" TEXT;
UPDATE "notifications" SET "idempotencyKey" = 'legacy:' || "id" WHERE "idempotencyKey" IS NULL;
ALTER TABLE "notifications" ALTER COLUMN "idempotencyKey" SET NOT NULL;

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_deliveries_userId_status_idx" ON "notification_deliveries"("userId", "status");

-- CreateIndex
CREATE INDEX "notification_deliveries_status_createdAt_idx" ON "notification_deliveries"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "notification_deliveries_notificationId_channel_key" ON "notification_deliveries"("notificationId", "channel");

-- CreateIndex
CREATE INDEX "users_deletionStatus_idx" ON "users"("deletionStatus");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_idempotencyKey_key" ON "notifications"("idempotencyKey");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

