-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PLATFORM_ADMIN', 'AGENCY_ADMIN', 'AGENT');

-- CreateEnum
CREATE TYPE "TerritoryType" AS ENUM ('POSTAL_CODE', 'MUNICIPALITY', 'PROVINCE');

-- CreateEnum
CREATE TYPE "SourceKind" AS ENUM ('API', 'FEED', 'STRUCTURED_DATA', 'PUBLIC_HTML', 'FIXTURE');

-- CreateEnum
CREATE TYPE "SourceHealth" AS ENUM ('HEALTHY', 'DEGRADED', 'DOWN', 'DISABLED');

-- CreateEnum
CREATE TYPE "CollectorRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('HOUSE', 'APARTMENT', 'LAND', 'COMMERCIAL', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ListingType" AS ENUM ('SALE', 'RENT');

-- CreateEnum
CREATE TYPE "SellerType" AS ENUM ('PRIVATE', 'PROFESSIONAL', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('ACTIVE', 'MISSING', 'REMOVED');

-- CreateEnum
CREATE TYPE "MatchDecision" AS ENUM ('AUTO_MATCH', 'REVIEW', 'NO_MATCH');

-- CreateEnum
CREATE TYPE "ListingEventType" AS ENUM ('NEW_LISTING', 'FSBO_DETECTED', 'PRICE_DROP', 'PRICE_INCREASE', 'STALE_30', 'STALE_60', 'STALE_90', 'LISTING_REMOVED', 'RELISTED', 'AGENCY_TO_PRIVATE', 'PRIVATE_TO_AGENCY');

-- CreateEnum
CREATE TYPE "CrmContactType" AS ENUM ('BUYER', 'SELLER', 'LANDLORD', 'TENANT', 'VALUATION_LEAD', 'PROSPECT', 'FORMER_CLIENT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CrmContactStatus" AS ENUM ('ACTIVE', 'WON', 'LOST', 'CLOSED', 'INACTIVE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CrmImportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "CrmImportRowStatus" AS ENUM ('CREATED', 'UPDATED', 'DUPLICATE', 'CONFLICT', 'INVALID');

-- CreateEnum
CREATE TYPE "CrmInteractionType" AS ENUM ('CALL', 'EMAIL', 'MEETING', 'VALUATION', 'VIEWING', 'NOTE', 'IMPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "PropertyRelationshipType" AS ENUM ('OWNER', 'FORMER_OWNER', 'BOUGHT', 'SOLD', 'VALUATION_REQUESTED', 'TENANT', 'LANDLORD', 'INTERESTED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "OpportunityEngine" AS ENUM ('IMMORADAR', 'LEADREVIVE');

-- CreateEnum
CREATE TYPE "OpportunityType" AS ENUM ('NEW_FSBO', 'STALE_FSBO', 'PRIVATE_PRICE_DROP', 'PRIVATE_MULTIPLE_PRICE_DROP', 'PRIVATE_RELIST', 'AGENCY_TO_PRIVATE', 'DORMANT_VALUATION_LEAD', 'FORMER_SELLER_PROSPECT', 'FORMER_CLIENT', 'OLD_BUYER', 'LOST_MANDATE', 'UNCONTACTED_LEAD');

-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('NEW', 'ASSIGNED', 'TO_CONTACT', 'CONTACTED', 'INTERESTED', 'VALUATION_BOOKED', 'MANDATE_PROPOSED', 'MANDATE_WON', 'LOST', 'DISMISSED');

-- CreateEnum
CREATE TYPE "OpportunitySignalKind" AS ENUM ('MARKET', 'RELATIONSHIP', 'TIMING', 'TERRITORY', 'CONFIDENCE');

-- CreateEnum
CREATE TYPE "OpportunityActivityType" AS ENUM ('CREATED', 'ASSIGNED', 'UNASSIGNED', 'STATUS_CHANGED', 'CONTACTED', 'SNOOZED', 'DISMISSED', 'NOTE', 'ALERT_SENT', 'RESCORED', 'CRM_MATCHED');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('HOT_OPPORTUNITY', 'CRM_MARKET_MATCH', 'MORNING_DIGEST');

-- CreateEnum
CREATE TYPE "AlertChannel" AS ENUM ('TELEGRAM', 'IN_APP');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "Agency" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "city" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "telegramChatId" TEXT,
    "alertMinScore" INTEGER NOT NULL DEFAULT 80,
    "digestEnabled" BOOLEAN NOT NULL DEFAULT true,
    "digestHourLocal" INTEGER NOT NULL DEFAULT 7,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Brussels',
    "crmRetentionDays" INTEGER,
    "dormantMonths" INTEGER NOT NULL DEFAULT 12,
    "autoAssignByAgent" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Agency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'AGENT',
    "telegramChatId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    "ip" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Territory" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "type" "TerritoryType" NOT NULL,
    "value" TEXT NOT NULL,
    "normalizedValue" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Territory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "SourceKind" NOT NULL,
    "baseUrl" TEXT,
    "termsUrl" TEXT,
    "accessNote" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "pollIntervalMinutes" INTEGER NOT NULL DEFAULT 60,
    "rateLimitPerMinute" INTEGER NOT NULL DEFAULT 30,
    "timeoutMs" INTEGER NOT NULL DEFAULT 15000,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "health" "SourceHealth" NOT NULL DEFAULT 'HEALTHY',
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "lastSuccessAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectorRun" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" "CollectorRunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "listingsCollected" INTEGER NOT NULL DEFAULT 0,
    "listingsNew" INTEGER NOT NULL DEFAULT 0,
    "listingsUpdated" INTEGER NOT NULL DEFAULT 0,
    "listingsUnchanged" INTEGER NOT NULL DEFAULT 0,
    "eventsGenerated" INTEGER NOT NULL DEFAULT 0,
    "errorsCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "metrics" JSONB,

    CONSTRAINT "CollectorRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "addressLine" TEXT,
    "street" TEXT,
    "houseNumber" TEXT,
    "boxNumber" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "municipality" TEXT,
    "province" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "propertyType" "PropertyType" NOT NULL DEFAULT 'UNKNOWN',
    "bedrooms" INTEGER,
    "surfaceArea" INTEGER,
    "landArea" INTEGER,
    "normalizedAddressKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgencyIdentity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "website" TEXT,
    "phone" TEXT,
    "vatNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgencyIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerIdentity" (
    "id" TEXT NOT NULL,
    "displayName" TEXT,
    "normalizedName" TEXT,
    "normalizedPhone" TEXT,
    "normalizedEmail" TEXT,
    "classifiedType" "SellerType" NOT NULL DEFAULT 'UNKNOWN',
    "listingCount" INTEGER NOT NULL DEFAULT 0,
    "agencyIdentityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT,
    "sourceId" TEXT NOT NULL,
    "sourceListingId" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "listingType" "ListingType" NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "sellerType" "SellerType" NOT NULL DEFAULT 'UNKNOWN',
    "sellerConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sellerReasons" JSONB,
    "sellerIdentityId" TEXT,
    "currentPrice" INTEGER,
    "initialPrice" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "publishedAt" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "removedAt" TIMESTAMP(3),
    "relistedAt" TIMESTAMP(3),
    "missingCount" INTEGER NOT NULL DEFAULT 0,
    "status" "ListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "priceDropCount" INTEGER NOT NULL DEFAULT 0,
    "matchConfidence" DOUBLE PRECISION,
    "matchDecision" "MatchDecision",
    "matchReasons" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingSnapshot" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "collectorRunId" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "price" INTEGER,
    "title" TEXT,
    "description" TEXT,
    "sellerName" TEXT,
    "sellerPhone" TEXT,
    "sellerEmail" TEXT,
    "sellerType" "SellerType" NOT NULL DEFAULT 'UNKNOWN',
    "status" "ListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "contentHash" TEXT NOT NULL,
    "rawData" JSONB NOT NULL,

    CONSTRAINT "ListingSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingEvent" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "propertyId" TEXT,
    "type" "ListingEventType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "oldPrice" INTEGER,
    "newPrice" INTEGER,
    "difference" INTEGER,
    "percentage" DOUBLE PRECISION,
    "dedupeKey" TEXT NOT NULL,
    "payload" JSONB,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmImport" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "userId" TEXT,
    "adapter" TEXT NOT NULL DEFAULT 'csv',
    "fileName" TEXT,
    "status" "CrmImportStatus" NOT NULL DEFAULT 'PENDING',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "conflictCount" INTEGER NOT NULL DEFAULT 0,
    "invalidCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "CrmImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmImportRow" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "status" "CrmImportRowStatus" NOT NULL,
    "message" TEXT,
    "contactId" TEXT,
    "rawData" JSONB NOT NULL,
    "conflicts" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmImportRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmContact" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "externalContactId" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "normalizedName" TEXT,
    "email" TEXT,
    "normalizedEmail" TEXT,
    "phone" TEXT,
    "normalizedPhone" TEXT,
    "address" TEXT,
    "normalizedAddressKey" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "assignedAgentName" TEXT,
    "assignedUserId" TEXT,
    "contactType" "CrmContactType" NOT NULL DEFAULT 'UNKNOWN',
    "leadType" TEXT,
    "status" "CrmContactStatus" NOT NULL DEFAULT 'UNKNOWN',
    "crmCreatedAt" TIMESTAMP(3),
    "lastContactAt" TIMESTAMP(3),
    "notes" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "importId" TEXT,
    "sourceValues" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CrmContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmInteraction" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "type" "CrmInteractionType" NOT NULL DEFAULT 'NOTE',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "summary" TEXT,
    "importId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactPropertyRelationship" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "propertyId" TEXT,
    "addressKey" TEXT,
    "postalCode" TEXT,
    "relationshipType" "PropertyRelationshipType" NOT NULL DEFAULT 'UNKNOWN',
    "year" INTEGER,
    "source" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactPropertyRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "engine" "OpportunityEngine" NOT NULL,
    "type" "OpportunityType" NOT NULL,
    "status" "OpportunityStatus" NOT NULL DEFAULT 'NEW',
    "dedupeKey" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "summary" TEXT,
    "propertyId" TEXT,
    "listingId" TEXT,
    "contactId" TEXT,
    "crmMatched" BOOLEAN NOT NULL DEFAULT false,
    "crmMatchConfidence" DOUBLE PRECISION,
    "crmMatchReasons" JSONB,
    "score" INTEGER NOT NULL DEFAULT 0,
    "intentScore" INTEGER NOT NULL DEFAULT 0,
    "relationshipScore" INTEGER NOT NULL DEFAULT 0,
    "timingScore" INTEGER NOT NULL DEFAULT 0,
    "territoryScore" INTEGER NOT NULL DEFAULT 0,
    "confidenceScore" INTEGER NOT NULL DEFAULT 0,
    "scoreReasons" JSONB,
    "priceAtDetection" INTEGER,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSignalAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedUserId" TEXT,
    "snoozedUntil" TIMESTAMP(3),
    "contactedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "lastScoredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunitySignal" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "kind" "OpportunitySignalKind" NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,
    "listingEventId" TEXT,
    "detail" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpportunitySignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityScore" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total" INTEGER NOT NULL,
    "intent" INTEGER NOT NULL,
    "relationship" INTEGER NOT NULL,
    "timing" INTEGER NOT NULL,
    "territory" INTEGER NOT NULL,
    "confidence" INTEGER NOT NULL,
    "reasons" JSONB NOT NULL,
    "configVersion" TEXT NOT NULL,

    CONSTRAINT "OpportunityScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityAssignment" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedById" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassignedAt" TIMESTAMP(3),

    CONSTRAINT "OpportunityAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityActivity" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "userId" TEXT,
    "type" "OpportunityActivityType" NOT NULL,
    "fromStatus" "OpportunityStatus",
    "toStatus" "OpportunityStatus",
    "note" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpportunityActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertRule" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "channel" "AlertChannel" NOT NULL DEFAULT 'TELEGRAM',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "minScore" INTEGER NOT NULL DEFAULT 80,
    "requireCrmMatch" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "userId" TEXT,
    "type" "AlertType" NOT NULL,
    "channel" "AlertChannel" NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'PENDING',
    "dedupeKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "payload" JSONB,
    "recipient" TEXT,
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Agency_slug_key" ON "Agency"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_agencyId_idx" ON "User"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Territory_type_normalizedValue_idx" ON "Territory"("type", "normalizedValue");

-- CreateIndex
CREATE UNIQUE INDEX "Territory_agencyId_type_normalizedValue_key" ON "Territory"("agencyId", "type", "normalizedValue");

-- CreateIndex
CREATE UNIQUE INDEX "Source_key_key" ON "Source"("key");

-- CreateIndex
CREATE INDEX "CollectorRun_sourceId_startedAt_idx" ON "CollectorRun"("sourceId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "Property_normalizedAddressKey_idx" ON "Property"("normalizedAddressKey");

-- CreateIndex
CREATE INDEX "Property_postalCode_idx" ON "Property"("postalCode");

-- CreateIndex
CREATE INDEX "Property_postalCode_street_idx" ON "Property"("postalCode", "street");

-- CreateIndex
CREATE UNIQUE INDEX "AgencyIdentity_normalizedName_key" ON "AgencyIdentity"("normalizedName");

-- CreateIndex
CREATE INDEX "SellerIdentity_normalizedPhone_idx" ON "SellerIdentity"("normalizedPhone");

-- CreateIndex
CREATE INDEX "SellerIdentity_normalizedEmail_idx" ON "SellerIdentity"("normalizedEmail");

-- CreateIndex
CREATE INDEX "SellerIdentity_normalizedName_idx" ON "SellerIdentity"("normalizedName");

-- CreateIndex
CREATE INDEX "Listing_propertyId_idx" ON "Listing"("propertyId");

-- CreateIndex
CREATE INDEX "Listing_status_lastSeenAt_idx" ON "Listing"("status", "lastSeenAt");

-- CreateIndex
CREATE INDEX "Listing_sellerType_status_idx" ON "Listing"("sellerType", "status");

-- CreateIndex
CREATE INDEX "Listing_matchDecision_idx" ON "Listing"("matchDecision");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_sourceId_sourceListingId_key" ON "Listing"("sourceId", "sourceListingId");

-- CreateIndex
CREATE INDEX "ListingSnapshot_listingId_capturedAt_idx" ON "ListingSnapshot"("listingId", "capturedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ListingEvent_dedupeKey_key" ON "ListingEvent"("dedupeKey");

-- CreateIndex
CREATE INDEX "ListingEvent_listingId_occurredAt_idx" ON "ListingEvent"("listingId", "occurredAt");

-- CreateIndex
CREATE INDEX "ListingEvent_type_occurredAt_idx" ON "ListingEvent"("type", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "ListingEvent_processedAt_idx" ON "ListingEvent"("processedAt");

-- CreateIndex
CREATE INDEX "CrmImport_agencyId_startedAt_idx" ON "CrmImport"("agencyId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "CrmImportRow_importId_rowNumber_idx" ON "CrmImportRow"("importId", "rowNumber");

-- CreateIndex
CREATE INDEX "CrmImportRow_agencyId_idx" ON "CrmImportRow"("agencyId");

-- CreateIndex
CREATE INDEX "CrmContact_agencyId_externalContactId_idx" ON "CrmContact"("agencyId", "externalContactId");

-- CreateIndex
CREATE INDEX "CrmContact_agencyId_normalizedPhone_idx" ON "CrmContact"("agencyId", "normalizedPhone");

-- CreateIndex
CREATE INDEX "CrmContact_agencyId_normalizedEmail_idx" ON "CrmContact"("agencyId", "normalizedEmail");

-- CreateIndex
CREATE INDEX "CrmContact_agencyId_normalizedName_idx" ON "CrmContact"("agencyId", "normalizedName");

-- CreateIndex
CREATE INDEX "CrmContact_agencyId_normalizedAddressKey_idx" ON "CrmContact"("agencyId", "normalizedAddressKey");

-- CreateIndex
CREATE INDEX "CrmContact_agencyId_postalCode_idx" ON "CrmContact"("agencyId", "postalCode");

-- CreateIndex
CREATE INDEX "CrmContact_agencyId_contactType_status_idx" ON "CrmContact"("agencyId", "contactType", "status");

-- CreateIndex
CREATE INDEX "CrmContact_agencyId_lastContactAt_idx" ON "CrmContact"("agencyId", "lastContactAt");

-- CreateIndex
CREATE UNIQUE INDEX "CrmContact_agencyId_dedupeKey_key" ON "CrmContact"("agencyId", "dedupeKey");

-- CreateIndex
CREATE INDEX "CrmInteraction_agencyId_contactId_occurredAt_idx" ON "CrmInteraction"("agencyId", "contactId", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "ContactPropertyRelationship_agencyId_addressKey_idx" ON "ContactPropertyRelationship"("agencyId", "addressKey");

-- CreateIndex
CREATE INDEX "ContactPropertyRelationship_agencyId_propertyId_idx" ON "ContactPropertyRelationship"("agencyId", "propertyId");

-- CreateIndex
CREATE INDEX "ContactPropertyRelationship_agencyId_contactId_idx" ON "ContactPropertyRelationship"("agencyId", "contactId");

-- CreateIndex
CREATE INDEX "Opportunity_agencyId_status_score_idx" ON "Opportunity"("agencyId", "status", "score" DESC);

-- CreateIndex
CREATE INDEX "Opportunity_agencyId_assignedUserId_status_idx" ON "Opportunity"("agencyId", "assignedUserId", "status");

-- CreateIndex
CREATE INDEX "Opportunity_agencyId_engine_type_idx" ON "Opportunity"("agencyId", "engine", "type");

-- CreateIndex
CREATE INDEX "Opportunity_agencyId_detectedAt_idx" ON "Opportunity"("agencyId", "detectedAt" DESC);

-- CreateIndex
CREATE INDEX "Opportunity_listingId_idx" ON "Opportunity"("listingId");

-- CreateIndex
CREATE INDEX "Opportunity_contactId_idx" ON "Opportunity"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_agencyId_dedupeKey_key" ON "Opportunity"("agencyId", "dedupeKey");

-- CreateIndex
CREATE INDEX "OpportunitySignal_opportunityId_idx" ON "OpportunitySignal"("opportunityId");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunitySignal_opportunityId_code_key" ON "OpportunitySignal"("opportunityId", "code");

-- CreateIndex
CREATE INDEX "OpportunityScore_opportunityId_computedAt_idx" ON "OpportunityScore"("opportunityId", "computedAt" DESC);

-- CreateIndex
CREATE INDEX "OpportunityAssignment_agencyId_userId_idx" ON "OpportunityAssignment"("agencyId", "userId");

-- CreateIndex
CREATE INDEX "OpportunityAssignment_opportunityId_idx" ON "OpportunityAssignment"("opportunityId");

-- CreateIndex
CREATE INDEX "OpportunityActivity_opportunityId_createdAt_idx" ON "OpportunityActivity"("opportunityId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "OpportunityActivity_agencyId_createdAt_idx" ON "OpportunityActivity"("agencyId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "OpportunityActivity_agencyId_type_createdAt_idx" ON "OpportunityActivity"("agencyId", "type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AlertRule_agencyId_type_channel_key" ON "AlertRule"("agencyId", "type", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "Alert_dedupeKey_key" ON "Alert"("dedupeKey");

-- CreateIndex
CREATE INDEX "Alert_agencyId_createdAt_idx" ON "Alert"("agencyId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Alert_agencyId_status_idx" ON "Alert"("agencyId", "status");

-- CreateIndex
CREATE INDEX "AuditLog_agencyId_createdAt_idx" ON "AuditLog"("agencyId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Territory" ADD CONSTRAINT "Territory_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectorRun" ADD CONSTRAINT "CollectorRun_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerIdentity" ADD CONSTRAINT "SellerIdentity_agencyIdentityId_fkey" FOREIGN KEY ("agencyIdentityId") REFERENCES "AgencyIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_sellerIdentityId_fkey" FOREIGN KEY ("sellerIdentityId") REFERENCES "SellerIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingSnapshot" ADD CONSTRAINT "ListingSnapshot_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingSnapshot" ADD CONSTRAINT "ListingSnapshot_collectorRunId_fkey" FOREIGN KEY ("collectorRunId") REFERENCES "CollectorRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingEvent" ADD CONSTRAINT "ListingEvent_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingEvent" ADD CONSTRAINT "ListingEvent_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmImport" ADD CONSTRAINT "CrmImport_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmImport" ADD CONSTRAINT "CrmImport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmImportRow" ADD CONSTRAINT "CrmImportRow_importId_fkey" FOREIGN KEY ("importId") REFERENCES "CrmImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmImportRow" ADD CONSTRAINT "CrmImportRow_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmImportRow" ADD CONSTRAINT "CrmImportRow_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmContact" ADD CONSTRAINT "CrmContact_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmContact" ADD CONSTRAINT "CrmContact_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmContact" ADD CONSTRAINT "CrmContact_importId_fkey" FOREIGN KEY ("importId") REFERENCES "CrmImport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmInteraction" ADD CONSTRAINT "CrmInteraction_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmInteraction" ADD CONSTRAINT "CrmInteraction_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactPropertyRelationship" ADD CONSTRAINT "ContactPropertyRelationship_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactPropertyRelationship" ADD CONSTRAINT "ContactPropertyRelationship_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactPropertyRelationship" ADD CONSTRAINT "ContactPropertyRelationship_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunitySignal" ADD CONSTRAINT "OpportunitySignal_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunitySignal" ADD CONSTRAINT "OpportunitySignal_listingEventId_fkey" FOREIGN KEY ("listingEventId") REFERENCES "ListingEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityScore" ADD CONSTRAINT "OpportunityScore_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityAssignment" ADD CONSTRAINT "OpportunityAssignment_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityAssignment" ADD CONSTRAINT "OpportunityAssignment_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityAssignment" ADD CONSTRAINT "OpportunityAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityAssignment" ADD CONSTRAINT "OpportunityAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityActivity" ADD CONSTRAINT "OpportunityActivity_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityActivity" ADD CONSTRAINT "OpportunityActivity_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityActivity" ADD CONSTRAINT "OpportunityActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
