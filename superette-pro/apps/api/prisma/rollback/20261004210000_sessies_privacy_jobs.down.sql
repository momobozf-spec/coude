-- AlterEnum
BEGIN;
CREATE TYPE "DataSourceKind_new" AS ENUM ('DEMO', 'IMPORT_FILE', 'OFFICIAL_API', 'MERCHANT_FEED', 'MANUAL');
ALTER TABLE "ProductOffer" ALTER COLUMN "source" TYPE "DataSourceKind_new" USING ("source"::text::"DataSourceKind_new");
ALTER TABLE "PriceHistory" ALTER COLUMN "source" TYPE "DataSourceKind_new" USING ("source"::text::"DataSourceKind_new");
ALTER TABLE "ImportRun" ALTER COLUMN "source" TYPE "DataSourceKind_new" USING ("source"::text::"DataSourceKind_new");
ALTER TYPE "DataSourceKind" RENAME TO "DataSourceKind_old";
ALTER TYPE "DataSourceKind_new" RENAME TO "DataSourceKind";
DROP TYPE "DataSourceKind_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_userId_fkey";

-- AlterTable
ALTER TABLE "ComparePreference" DROP COLUMN "emailNotifications";

-- AlterTable
ALTER TABLE "ImportRun" DROP COLUMN "termsReviewed";

-- DropTable
DROP TABLE "Session";

-- DropTable
DROP TABLE "JobLease";

