-- CreateEnum
CREATE TYPE "SourceAccessMethod" AS ENUM ('OFFICIAL_API', 'PUBLIC_FEED', 'STRUCTURED_DATA', 'PUBLIC_HTML', 'FIXTURE', 'SYNTHETIC');

-- CreateEnum
CREATE TYPE "SourceHealth" AS ENUM ('UNKNOWN', 'HEALTHY', 'DEGRADED', 'FAILING', 'BLOCKED', 'DISABLED');

-- CreateEnum
CREATE TYPE "CollectorRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ListingType" AS ENUM ('SALE', 'RENT');

-- CreateEnum
CREATE TYPE "SellerType" AS ENUM ('PRIVATE', 'PROFESSIONAL', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('ACTIVE', 'DUPLICATE', 'ARCHIVED', 'REDACTED');

-- CreateEnum
CREATE TYPE "TerritoryKind" AS ENUM ('POSTAL_CODE', 'MUNICIPALITY', 'PROVINCE', 'RADIUS');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AlertChannel" AS ENUM ('TELEGRAM');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SUPPRESSED_DRY_RUN');

-- CreateEnum
CREATE TYPE "ListingChangeType" AS ENUM ('CREATED', 'PRICE_CHANGED', 'FIELD_CHANGED', 'RELISTED', 'SELLER_RECLASSIFIED', 'MARKED_DUPLICATE', 'ARCHIVED', 'REDACTED');

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "accessMethod" "SourceAccessMethod" NOT NULL,
    "baseUrl" TEXT,
    "pollIntervalSeconds" INTEGER NOT NULL DEFAULT 300,
    "rateLimitPerMinute" INTEGER NOT NULL DEFAULT 20,
    "timeoutMs" INTEGER NOT NULL DEFAULT 15000,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "health" "SourceHealth" NOT NULL DEFAULT 'UNKNOWN',
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "lastRunAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "lastError" TEXT,
    "cooldownUntil" TIMESTAMP(3),
    "lockedUntil" TIMESTAMP(3),
    "lockedBy" TEXT,
    "accessNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectorRun" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" "CollectorRunStatus" NOT NULL DEFAULT 'RUNNING',
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "itemsFetched" INTEGER NOT NULL DEFAULT 0,
    "itemsNew" INTEGER NOT NULL DEFAULT 0,
    "itemsUpdated" INTEGER NOT NULL DEFAULT 0,
    "itemsUnchanged" INTEGER NOT NULL DEFAULT 0,
    "itemsDuplicate" INTEGER NOT NULL DEFAULT 0,
    "itemsRejected" INTEGER NOT NULL DEFAULT 0,
    "leadsQualified" INTEGER NOT NULL DEFAULT 0,
    "alertsSent" INTEGER NOT NULL DEFAULT 0,
    "errorKind" TEXT,
    "error" TEXT,

    CONSTRAINT "CollectorRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Seller" (
    "id" TEXT NOT NULL,
    "displayName" TEXT,
    "phoneE164" TEXT,
    "classification" "SellerType" NOT NULL DEFAULT 'UNKNOWN',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "activeListingCount" INTEGER NOT NULL DEFAULT 0,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "redactedAt" TIMESTAMP(3),

    CONSTRAINT "Seller_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceListingId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "price" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "listingType" "ListingType",
    "propertyType" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "address" TEXT,
    "province" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "bedrooms" INTEGER,
    "surfaceArea" INTEGER,
    "sellerId" TEXT,
    "sellerTypeHint" "SellerType" NOT NULL DEFAULT 'UNKNOWN',
    "sellerClassification" "SellerType" NOT NULL DEFAULT 'UNKNOWN',
    "sellerConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "classificationReasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "leadScore" INTEGER NOT NULL DEFAULT 0,
    "leadScoreBreakdown" JSONB,
    "status" "ListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "duplicateOfId" TEXT,
    "duplicateScore" DOUBLE PRECISION,
    "duplicateReasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "fingerprint" TEXT,
    "contentHash" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawPayload" JSONB,
    "redactedAt" TIMESTAMP(3),

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingHistory" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "changeType" "ListingChangeType" NOT NULL,
    "field" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agency" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactEmail" TEXT,
    "telegramChatId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Territory" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "TerritoryKind" NOT NULL,
    "postalCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "municipalities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "provinces" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "centerLat" DOUBLE PRECISION,
    "centerLng" DOUBLE PRECISION,
    "radiusKm" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Territory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "listingTypes" "ListingType"[] DEFAULT ARRAY[]::"ListingType"[],
    "propertyTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "minPrice" INTEGER,
    "maxPrice" INTEGER,
    "minLeadScore" INTEGER NOT NULL DEFAULT 55,
    "minPrivateConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0.85,
    "requirePhone" BOOLEAN NOT NULL DEFAULT false,
    "telegramChatId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionTerritory" (
    "subscriptionId" TEXT NOT NULL,
    "territoryId" TEXT NOT NULL,

    CONSTRAINT "SubscriptionTerritory_pkey" PRIMARY KEY ("subscriptionId","territoryId")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "channel" "AlertChannel" NOT NULL DEFAULT 'TELEGRAM',
    "status" "AlertStatus" NOT NULL DEFAULT 'PENDING',
    "dedupeKey" TEXT NOT NULL,
    "leadScore" INTEGER NOT NULL,
    "chatId" TEXT NOT NULL,
    "messageText" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "providerMessageId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Source_key_key" ON "Source"("key");

-- CreateIndex
CREATE INDEX "Source_enabled_cooldownUntil_idx" ON "Source"("enabled", "cooldownUntil");

-- CreateIndex
CREATE INDEX "CollectorRun_sourceId_startedAt_idx" ON "CollectorRun"("sourceId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "CollectorRun_startedAt_idx" ON "CollectorRun"("startedAt" DESC);

-- CreateIndex
CREATE INDEX "Seller_classification_idx" ON "Seller"("classification");

-- CreateIndex
CREATE INDEX "Seller_lastSeenAt_idx" ON "Seller"("lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "Seller_phoneE164_key" ON "Seller"("phoneE164");

-- CreateIndex
CREATE INDEX "Listing_status_firstSeenAt_idx" ON "Listing"("status", "firstSeenAt" DESC);

-- CreateIndex
CREATE INDEX "Listing_sellerClassification_leadScore_idx" ON "Listing"("sellerClassification", "leadScore" DESC);

-- CreateIndex
CREATE INDEX "Listing_postalCode_idx" ON "Listing"("postalCode");

-- CreateIndex
CREATE INDEX "Listing_fingerprint_idx" ON "Listing"("fingerprint");

-- CreateIndex
CREATE INDEX "Listing_sourceId_firstSeenAt_idx" ON "Listing"("sourceId", "firstSeenAt" DESC);

-- CreateIndex
CREATE INDEX "Listing_lastSeenAt_idx" ON "Listing"("lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_sourceId_sourceListingId_key" ON "Listing"("sourceId", "sourceListingId");

-- CreateIndex
CREATE INDEX "ListingHistory_listingId_createdAt_idx" ON "ListingHistory"("listingId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Agency_active_idx" ON "Agency"("active");

-- CreateIndex
CREATE INDEX "Territory_agencyId_active_idx" ON "Territory"("agencyId", "active");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "SubscriptionTerritory_territoryId_idx" ON "SubscriptionTerritory"("territoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Alert_dedupeKey_key" ON "Alert"("dedupeKey");

-- CreateIndex
CREATE INDEX "Alert_agencyId_createdAt_idx" ON "Alert"("agencyId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Alert_status_createdAt_idx" ON "Alert"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Alert_listingId_idx" ON "Alert"("listingId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "CollectorRun" ADD CONSTRAINT "CollectorRun_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingHistory" ADD CONSTRAINT "ListingHistory_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Territory" ADD CONSTRAINT "Territory_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionTerritory" ADD CONSTRAINT "SubscriptionTerritory_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionTerritory" ADD CONSTRAINT "SubscriptionTerritory_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
