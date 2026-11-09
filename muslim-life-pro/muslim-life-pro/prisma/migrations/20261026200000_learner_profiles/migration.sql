-- Learner profiles (the account holder and children), age group and level.

-- CreateEnum
CREATE TYPE "LearnerKind" AS ENUM ('SELF', 'CHILD');

-- CreateEnum
CREATE TYPE "LearnerAgeGroup" AS ENUM ('KIDS', 'TEENS', 'ADULTS');

-- CreateTable
CREATE TABLE "learner_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "LearnerKind" NOT NULL,
    "name" TEXT,
    "ageGroup" "LearnerAgeGroup" NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "placedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learner_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "learner_profiles_userId_idx" ON "learner_profiles"("userId");

-- AddForeignKey
ALTER TABLE "learner_profiles" ADD CONSTRAINT "learner_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every account that already finished a lesson gets its own profile,
-- and those completions are attached to it. The id is derived from the user id
-- so this step needs no extension for generating UUIDs.
INSERT INTO "learner_profiles" ("id", "userId", "kind", "ageGroup", "level", "placedAt", "updatedAt")
SELECT DISTINCT 'self-' || "userId", "userId", 'SELF'::"LearnerKind", 'ADULTS'::"LearnerAgeGroup", 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "lesson_completions";

-- AlterTable
ALTER TABLE "lesson_completions" ADD COLUMN "learnerId" TEXT;
ALTER TABLE "lesson_completions" ADD COLUMN "missed" TEXT[] DEFAULT ARRAY[]::TEXT[];

UPDATE "lesson_completions" SET "learnerId" = 'self-' || "userId";

ALTER TABLE "lesson_completions" ALTER COLUMN "learnerId" SET NOT NULL;

-- DropIndex
DROP INDEX "lesson_completions_userId_lessonSlug_localDate_key";

-- CreateIndex
CREATE UNIQUE INDEX "lesson_completions_learnerId_lessonSlug_localDate_key" ON "lesson_completions"("learnerId", "lessonSlug", "localDate");

-- CreateIndex
CREATE INDEX "lesson_completions_learnerId_localDate_idx" ON "lesson_completions"("learnerId", "localDate");

-- AddForeignKey
ALTER TABLE "lesson_completions" ADD CONSTRAINT "lesson_completions_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "learner_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
