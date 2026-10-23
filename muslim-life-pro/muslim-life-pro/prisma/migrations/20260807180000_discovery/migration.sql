-- CreateEnum
CREATE TYPE "BusinessVerification" AS ENUM ('DEMO', 'UNVERIFIED', 'SELF_REPORTED', 'VERIFIED');

-- CreateEnum
CREATE TYPE "BusinessSourceType" AS ENUM ('SEED', 'MANUAL', 'COMMUNITY', 'PARTNER', 'OFFICIAL', 'IMPORT');

-- CreateEnum
CREATE TYPE "RedemptionStatus" AS ENUM ('ISSUED', 'REDEEMED', 'EXPIRED', 'CANCELLED');

-- AlterEnum
BEGIN;
CREATE TYPE "BusinessTier_new" AS ENUM ('BASIC', 'ENHANCED', 'FEATURED');
ALTER TABLE "businesses" ALTER COLUMN "tier" DROP DEFAULT;
ALTER TABLE "businesses" ALTER COLUMN "tier" TYPE "BusinessTier_new" USING ("tier"::text::"BusinessTier_new");
ALTER TYPE "BusinessTier" RENAME TO "BusinessTier_old";
ALTER TYPE "BusinessTier_new" RENAME TO "BusinessTier";
DROP TYPE "BusinessTier_old";
ALTER TABLE "businesses" ALTER COLUMN "tier" SET DEFAULT 'BASIC';
COMMIT;

-- DropForeignKey
ALTER TABLE "favorites" DROP CONSTRAINT "favorites_userId_fkey";

-- DropIndex
DROP INDEX "deal_redemptions_userId_idx";

-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "lastVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "sourceType" "BusinessSourceType" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "sourceUrl" TEXT,
ADD COLUMN     "verification" "BusinessVerification" NOT NULL DEFAULT 'UNVERIFIED';

-- AlterTable
ALTER TABLE "deal_redemptions" ADD COLUMN     "code" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "status" "RedemptionStatus" NOT NULL DEFAULT 'ISSUED',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "redeemedAt" DROP NOT NULL,
ALTER COLUMN "redeemedAt" DROP DEFAULT;

-- DropTable
DROP TABLE "favorites";

-- DropEnum
DROP TYPE "FavoriteType";

-- CreateTable
CREATE TABLE "favorite_businesses" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorite_businesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorite_deals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorite_deals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "favorite_businesses_userId_createdAt_idx" ON "favorite_businesses"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "favorite_businesses_userId_businessId_key" ON "favorite_businesses"("userId", "businessId");

-- CreateIndex
CREATE INDEX "favorite_deals_userId_createdAt_idx" ON "favorite_deals"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "favorite_deals_userId_dealId_key" ON "favorite_deals"("userId", "dealId");

-- CreateIndex
CREATE INDEX "businesses_status_cityId_tier_name_idx" ON "businesses"("status", "cityId", "tier", "name");

-- CreateIndex
CREATE INDEX "deals_status_startsAt_endsAt_idx" ON "deals"("status", "startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "deal_redemptions_code_key" ON "deal_redemptions"("code");

-- CreateIndex
CREATE INDEX "deal_redemptions_userId_status_idx" ON "deal_redemptions"("userId", "status");

-- AddForeignKey
ALTER TABLE "favorite_businesses" ADD CONSTRAINT "favorite_businesses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_businesses" ADD CONSTRAINT "favorite_businesses_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_deals" ADD CONSTRAINT "favorite_deals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_deals" ADD CONSTRAINT "favorite_deals_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

