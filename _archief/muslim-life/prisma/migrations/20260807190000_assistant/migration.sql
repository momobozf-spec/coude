-- CreateEnum
CREATE TYPE "GeneratedPlanStatus" AS ENUM ('DRAFT', 'READY', 'APPLIED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "GeneratedPlanItemKind" AS ENUM ('TASK', 'BLOCK', 'HABIT_SUGGESTION', 'NOTE');

-- CreateEnum
CREATE TYPE "GeneratedPlanItemStatus" AS ENUM ('PROPOSED', 'APPLIED', 'SKIPPED', 'DUPLICATE');

-- AlterEnum
BEGIN;
CREATE TYPE "GeneratorType_new" AS ENUM ('WEEKLY', 'RAMADAN', 'TRAVEL', 'LIFE_EVENT', 'CUSTOM');
ALTER TABLE "ai_conversations" ALTER COLUMN "generatorType" TYPE "GeneratorType_new" USING ("generatorType"::text::"GeneratorType_new");
ALTER TABLE "generated_plans" ALTER COLUMN "type" TYPE "GeneratorType_new" USING ("type"::text::"GeneratorType_new");
ALTER TYPE "GeneratorType" RENAME TO "GeneratorType_old";
ALTER TYPE "GeneratorType_new" RENAME TO "GeneratorType";
DROP TYPE "GeneratorType_old";
COMMIT;

-- DropIndex
DROP INDEX "generated_plans_userId_createdAt_idx";

-- AlterTable
ALTER TABLE "ai_messages" ADD COLUMN     "provider" TEXT;

-- AlterTable
ALTER TABLE "ai_usage" ADD COLUMN     "reserved" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "generated_plans" DROP COLUMN "payload",
ADD COLUMN     "generatorVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "status" "GeneratedPlanStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "structuredContent" JSONB NOT NULL;

-- CreateTable
CREATE TABLE "generated_plan_items" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "GeneratedPlanItemKind" NOT NULL DEFAULT 'TASK',
    "status" "GeneratedPlanItemStatus" NOT NULL DEFAULT 'PROPOSED',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "localDate" DATE,
    "startTime" TEXT,
    "endTime" TEXT,
    "estimatedMinutes" INTEGER,
    "category" TEXT,
    "itemKey" TEXT NOT NULL,
    "duplicateOfTaskId" TEXT,
    "taskId" TEXT,
    "blockId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generated_plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "generated_plan_items_userId_status_idx" ON "generated_plan_items"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "generated_plan_items_planId_itemKey_key" ON "generated_plan_items"("planId", "itemKey");

-- CreateIndex
CREATE INDEX "generated_plans_userId_status_createdAt_idx" ON "generated_plans"("userId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "generated_plan_items" ADD CONSTRAINT "generated_plan_items_planId_fkey" FOREIGN KEY ("planId") REFERENCES "generated_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

