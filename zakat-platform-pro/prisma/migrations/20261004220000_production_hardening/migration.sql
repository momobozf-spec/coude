-- CreateEnum
CREATE TYPE "PublishedPriceKind" AS ENUM ('GOLD_PER_GRAM', 'SILVER_PER_GRAM', 'FX_PER_EUR');

-- AlterEnum
ALTER TYPE "MetalPriceSourceType" ADD VALUE 'PUBLISHED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'PASSWORD_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'PASSWORD_RESET_REQUESTED';
ALTER TYPE "AuditAction" ADD VALUE 'PASSWORD_RESET_COMPLETED';
ALTER TYPE "AuditAction" ADD VALUE 'ACCOUNT_LOCKED';
ALTER TYPE "AuditAction" ADD VALUE 'SESSIONS_REVOKED';
ALTER TYPE "AuditAction" ADD VALUE 'DATA_EXPORTED';
ALTER TYPE "AuditAction" ADD VALUE 'PRICE_PUBLISHED';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "passwordChangedAt" TIMESTAMP(3),
ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "published_prices" (
    "id" TEXT NOT NULL,
    "kind" "PublishedPriceKind" NOT NULL,
    "currency" TEXT NOT NULL,
    "value" DECIMAL(18,8) NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "source" TEXT NOT NULL,
    "publishedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "published_prices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "published_prices_kind_currency_effectiveDate_key" ON "published_prices"("kind", "currency", "effectiveDate");
