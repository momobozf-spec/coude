-- CreateEnum
CREATE TYPE "CalendarMethod" AS ENUM ('GREGORIAN', 'ISLAMIC_UMALQURA');

-- CreateEnum
CREATE TYPE "NotificationEvent" AS ENUM ('ZAKAT_REMINDER_DUE', 'ZAKAT_PREPARATION_DUE', 'SADAQAH_REMINDER_DUE', 'ANNUAL_REPORT_READY', 'GENERAL');

-- CreateEnum
CREATE TYPE "ReportPeriodType" AS ENUM ('GREGORIAN_YEAR', 'HIJRI_YEAR');

-- AlterEnum
BEGIN;
CREATE TYPE "ReminderStatus_new" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');
ALTER TABLE "reminders" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "reminders" ALTER COLUMN "status" TYPE "ReminderStatus_new" USING ("status"::text::"ReminderStatus_new");
ALTER TYPE "ReminderStatus" RENAME TO "ReminderStatus_old";
ALTER TYPE "ReminderStatus_new" RENAME TO "ReminderStatus";
DROP TYPE "ReminderStatus_old";
ALTER TABLE "reminders" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "Recurrence_new" AS ENUM ('ONE_TIME', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'HIJRI_YEARLY');
ALTER TABLE "reminders" ALTER COLUMN "recurrence" DROP DEFAULT;
ALTER TABLE "reminders" ALTER COLUMN "recurrence" TYPE "Recurrence_new" USING ("recurrence"::text::"Recurrence_new");
ALTER TYPE "Recurrence" RENAME TO "Recurrence_old";
ALTER TYPE "Recurrence_new" RENAME TO "Recurrence";
DROP TYPE "Recurrence_old";
ALTER TABLE "reminders" ALTER COLUMN "recurrence" SET DEFAULT 'ONE_TIME';
COMMIT;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'REMINDER_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'REMINDER_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'REMINDER_PAUSED';
ALTER TYPE "AuditAction" ADD VALUE 'REMINDER_RESUMED';
ALTER TYPE "AuditAction" ADD VALUE 'REMINDER_CANCELLED';
ALTER TYPE "AuditAction" ADD VALUE 'NOTIFICATION_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'NOTIFICATION_READ';
ALTER TYPE "AuditAction" ADD VALUE 'REPORT_GENERATED';
ALTER TYPE "AuditAction" ADD VALUE 'REPORT_DOWNLOADED';

-- DropIndex
DROP INDEX "reminders_status_scheduledFor_idx";

-- DropIndex
DROP INDEX "reminders_userId_scheduledFor_idx";

-- AlterTable
ALTER TABLE "reminders" DROP COLUMN "lastSentAt",
DROP COLUMN "scheduledFor",
ADD COLUMN     "calendarMethod" "CalendarMethod" NOT NULL DEFAULT 'GREGORIAN',
ADD COLUMN     "endAt" TIMESTAMP(3),
ADD COLUMN     "hijriDay" INTEGER,
ADD COLUMN     "hijriMonth" INTEGER,
ADD COLUMN     "hijriYear" INTEGER,
ADD COLUMN     "lastTriggeredAt" TIMESTAMP(3),
ADD COLUMN     "localTime" TEXT NOT NULL DEFAULT '09:00',
ADD COLUMN     "manualAdjustmentDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "nextTriggerAt" TIMESTAMP(3),
ADD COLUMN     "startAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "timezone" TEXT NOT NULL,
ADD COLUMN     "zakatCalculationId" TEXT,
ALTER COLUMN "recurrence" SET DEFAULT 'ONE_TIME',
ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "notifications" DROP COLUMN "type",
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "dedupeKey" TEXT,
ADD COLUMN     "event" "NotificationEvent" NOT NULL DEFAULT 'GENERAL',
ADD COLUMN     "occurrenceAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "notification_preferences" ADD COLUMN     "annualReportReady" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "systemNotifications" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "annual_reports" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodType" "ReportPeriodType" NOT NULL DEFAULT 'GREGORIAN_YEAR',
    "year" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "reportVersion" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "documentId" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "annual_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "annual_reports_documentId_key" ON "annual_reports"("documentId");

-- CreateIndex
CREATE INDEX "annual_reports_userId_year_idx" ON "annual_reports"("userId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "annual_reports_userId_periodType_year_sequence_key" ON "annual_reports"("userId", "periodType", "year", "sequence");

-- CreateIndex
CREATE INDEX "reminders_status_nextTriggerAt_idx" ON "reminders"("status", "nextTriggerAt");

-- CreateIndex
CREATE INDEX "reminders_userId_status_idx" ON "reminders"("userId", "status");

-- CreateIndex
CREATE INDEX "reminders_zakatCalculationId_idx" ON "reminders"("zakatCalculationId");

-- CreateIndex
CREATE INDEX "notifications_userId_archivedAt_idx" ON "notifications"("userId", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_userId_dedupeKey_key" ON "notifications"("userId", "dedupeKey");

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_zakatCalculationId_fkey" FOREIGN KEY ("zakatCalculationId") REFERENCES "zakat_calculations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annual_reports" ADD CONSTRAINT "annual_reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annual_reports" ADD CONSTRAINT "annual_reports_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

