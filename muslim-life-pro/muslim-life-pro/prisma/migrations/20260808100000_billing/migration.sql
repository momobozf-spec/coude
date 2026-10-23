-- DropIndex
DROP INDEX "subscriptions_stripeCustomerId_key";

-- DropIndex
DROP INDEX "subscriptions_stripeSubscriptionId_key";

-- DropIndex
DROP INDEX "webhook_events_stripeEventId_key";

-- AlterTable
ALTER TABLE "subscriptions" DROP COLUMN "stripeCustomerId",
DROP COLUMN "stripePriceId",
DROP COLUMN "stripeSubscriptionId",
ADD COLUMN     "currentPeriodStart" TIMESTAMP(3),
ADD COLUMN     "externalCustomerId" TEXT,
ADD COLUMN     "externalPriceId" TEXT,
ADD COLUMN     "externalSubscriptionId" TEXT,
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "providerUpdatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "webhook_events" DROP COLUMN "stripeEventId",
ADD COLUMN     "eventCreatedAt" TIMESTAMP(3),
ADD COLUMN     "externalEventId" TEXT NOT NULL,
ADD COLUMN     "provider" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_externalCustomerId_key" ON "subscriptions"("externalCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_externalSubscriptionId_key" ON "subscriptions"("externalSubscriptionId");

-- CreateIndex
CREATE INDEX "subscriptions_externalCustomerId_idx" ON "subscriptions"("externalCustomerId");

-- CreateIndex
CREATE INDEX "webhook_events_provider_processedAt_idx" ON "webhook_events"("provider", "processedAt");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_provider_externalEventId_key" ON "webhook_events"("provider", "externalEventId");

