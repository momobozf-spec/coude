-- CreateEnum
CREATE TYPE "CharityClaimType" AS ENUM ('REGISTERED_ENTITY', 'CONTACT_DETAILS_PUBLISHED', 'GOVERNANCE_DISCLOSED', 'ANNUAL_REPORT_PUBLISHED', 'FINANCIAL_STATEMENTS_PUBLISHED', 'AUDITOR_DISCLOSED', 'ADMIN_COST_DISCLOSED', 'IMPACT_REPORT_PUBLISHED', 'ACCEPTS_ZAKAT', 'ZAKAT_POLICY_PUBLISHED', 'ZAKAT_ALLOCATION_DESCRIBED', 'ZAKAT_ELIGIBILITY_INDEPENDENTLY_VERIFIED', 'OPERATES_IN_COUNTRY');

-- CreateEnum
CREATE TYPE "ClaimValue" AS ENUM ('YES', 'NO', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('UNVERIFIED', 'SELF_REPORTED', 'VERIFIED', 'DISPUTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CharitySourceType" ADD VALUE 'AUDITED_REPORT';
ALTER TYPE "CharitySourceType" ADD VALUE 'INDEPENDENT_REVIEW';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'CHARITY_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'CHARITY_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'CHARITY_CLAIM_ADDED';
ALTER TYPE "AuditAction" ADD VALUE 'CHARITY_CLAIM_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'CHARITY_CLAIM_EXPIRED';
ALTER TYPE "AuditAction" ADD VALUE 'CHARITY_SOURCE_ADDED';
ALTER TYPE "AuditAction" ADD VALUE 'CHARITY_VERIFICATION_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'TRANSPARENCY_SCORE_RECALCULATED';
ALTER TYPE "AuditAction" ADD VALUE 'CHARITY_FAVORITED';
ALTER TYPE "AuditAction" ADD VALUE 'CHARITY_UNFAVORITED';

-- AlterTable
ALTER TABLE "charities" ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "transparencyCoverage" INTEGER,
ADD COLUMN     "transparencyScoreVersion" TEXT;

-- AlterTable
ALTER TABLE "charity_sources" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "publisher" TEXT,
ADD COLUMN     "retrievedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "validFrom" TIMESTAMP(3),
ADD COLUMN     "validUntil" TIMESTAMP(3),
ADD COLUMN     "verifiedBy" TEXT;

-- CreateTable
CREATE TABLE "charity_claims" (
    "id" TEXT NOT NULL,
    "charityId" TEXT NOT NULL,
    "type" "CharityClaimType" NOT NULL,
    "value" "ClaimValue" NOT NULL DEFAULT 'UNKNOWN',
    "status" "ClaimStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "valueText" TEXT,
    "sourceId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "note" TEXT,
    "supersededAt" TIMESTAMP(3),
    "supersededById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "charity_claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "charity_claims_supersededById_key" ON "charity_claims"("supersededById");

-- CreateIndex
CREATE INDEX "charity_claims_charityId_type_supersededAt_idx" ON "charity_claims"("charityId", "type", "supersededAt");

-- CreateIndex
CREATE INDEX "charity_claims_sourceId_idx" ON "charity_claims"("sourceId");

-- AddForeignKey
ALTER TABLE "charity_claims" ADD CONSTRAINT "charity_claims_charityId_fkey" FOREIGN KEY ("charityId") REFERENCES "charities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charity_claims" ADD CONSTRAINT "charity_claims_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "charity_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charity_claims" ADD CONSTRAINT "charity_claims_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "charity_claims"("id") ON DELETE SET NULL ON UPDATE CASCADE;

