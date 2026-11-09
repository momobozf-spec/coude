-- CreateEnum
CREATE TYPE "DonationStatus" AS ENUM ('ACTIVE', 'VOIDED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'DONATION_VOIDED';
ALTER TYPE "AuditAction" ADD VALUE 'DONATION_CORRECTED';
ALTER TYPE "AuditAction" ADD VALUE 'RECEIPT_UPLOADED';
ALTER TYPE "AuditAction" ADD VALUE 'RECEIPT_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'SADAQAH_GOAL_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'SADAQAH_GOAL_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'SADAQAH_GOAL_ARCHIVED';

-- DropIndex
DROP INDEX "donations_zakatCalculationId_idx";

-- AlterTable
ALTER TABLE "donations" ADD COLUMN     "charityNameSnapshot" TEXT,
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "replacesDonationId" TEXT,
ADD COLUMN     "status" "DonationStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "voidReason" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "sadaqah_goals" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "donations_replacesDonationId_key" ON "donations"("replacesDonationId");

-- CreateIndex
CREATE INDEX "donations_userId_status_idx" ON "donations"("userId", "status");

-- CreateIndex
CREATE INDEX "donations_zakatCalculationId_status_idx" ON "donations"("zakatCalculationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "donations_userId_idempotencyKey_key" ON "donations"("userId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_replacesDonationId_fkey" FOREIGN KEY ("replacesDonationId") REFERENCES "donations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

