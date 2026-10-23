-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'ONBOARDING_COMPLETED';
ALTER TYPE "AuditAction" ADD VALUE 'ZAKAT_PROFILE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'CALCULATION_RECALCULATED';

-- AlterTable
ALTER TABLE "zakat_profiles" ADD COLUMN     "onboardingStep" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "relevantAssetTypes" "AssetType"[] DEFAULT ARRAY[]::"AssetType"[];

-- AlterTable
ALTER TABLE "zakat_calculations" ADD COLUMN     "engineVersion" TEXT NOT NULL DEFAULT 'zakat-engine@1',
ADD COLUMN     "wizardStep" INTEGER NOT NULL DEFAULT 1;

