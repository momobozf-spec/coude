-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PLATFORM_ADMIN', 'AGENCY_ADMIN', 'AGENT');

-- CreateEnum
CREATE TYPE "TerritoryKind" AS ENUM ('POSTAL_CODE', 'MUNICIPALITY', 'PROVINCE');

-- CreateEnum
CREATE TYPE "SourceStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ERROR');

-- CreateEnum
CREATE TYPE "CollectorRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('HOUSE', 'APARTMENT', 'LAND', 'COMMERCIAL', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ListingType" AS ENUM ('SALE', 'RENT');

-- CreateEnum
CREATE TYPE "SellerType" AS ENUM ('PRIVATE', 'PROFESSIONAL', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('ACTIVE', 'REMOVED', 'PENDING_REMOVAL');

-- CreateEnum
CREATE TYPE "ListingEventType" AS ENUM ('NEW_LISTING', 'FSBO_DETECTED', 'PRICE_DROP', 'PRICE_INCREASE', 'STALE_30', 'STALE_60', 'STALE_90', 'LISTING_REMOVED', 'RELISTED', 'AGENCY_TO_PRIVATE', 'PRIVATE_TO_AGENCY');

-- CreateEnum
CREATE TYPE "CrmContactType" AS ENUM ('BUYER', 'SELLER', 'LANDLORD', 'TENANT', 'VALUATION_LEAD', 'PROSPECT', 'FORMER_CLIENT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CrmContactStatus" AS ENUM ('ACTIVE', 'DORMANT', 'LOST', 'WON', 'ARCHIVED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CrmImportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "CrmImportRowOutcome" AS ENUM ('CREATED', 'UPDATED', 'SKIPPED_DUPLICATE', 'SKIPPED_CONFLICT', 'ERROR');

-- CreateEnum
CREATE TYPE "ContactPropertyRelationKind" AS ENUM ('OWNER', 'PREVIOUS_OWNER', 'BOUGHT', 'SOLD', 'VALUATION_REQUESTED', 'RENTED', 'LANDLORD_OF', 'INTERESTED_IN', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "OpportunityType" AS ENUM ('NEW_FSBO', 'STALE_FSBO', 'PRIVATE_PRICE_DROP', 'PRIVATE_MULTIPLE_PRICE_DROP', 'PRIVATE_RELIST', 'AGENCY_TO_PRIVATE', 'DORMANT_VALUATION_LEAD', 'FORMER_SELLER_PROSPECT', 'FORMER_CLIENT', 'OLD_BUYER', 'LOST_MANDATE', 'UNCONTACTED_LEAD', 'CRM_MARKET_MATCH');

-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('NEW', 'ASSIGNED', 'TO_CONTACT', 'CONTACTED', 'INTERESTED', 'VALUATION_BOOKED', 'MANDATE_PROPOSED', 'MANDATE_WON', 'LOST', 'DISMISSED', 'SNOOZED');

-- CreateEnum
CREATE TYPE "OpportunityOrigin" AS ENUM ('MARKET', 'CRM', 'CROSS');

-- CreateEnum
CREATE TYPE "AlertChannel" AS ENUM ('TELEGRAM', 'IN_APP');

-- CreateEnum
CREATE TYPE "AlertKind" AS ENUM ('HOT_OPPORTUNITY', 'CRM_MARKET_MATCH', 'MORNING_DIGEST');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SUPPRESSED_DUPLICATE');

-- CreateTable
CREATE TABLE "agencies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "telegramChatId" TEXT,
    "minAlertScore" INTEGER NOT NULL DEFAULT 85,
    "digestHourLocal" INTEGER NOT NULL DEFAULT 7,
    "digestEnabled" BOOLEAN NOT NULL DEFAULT true,
    "instantAlertsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "crmRetentionDays" INTEGER,

    CONSTRAINT "agencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'AGENT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "territories" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "kind" "TerritoryKind" NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "territories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sources" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "baseUrl" TEXT,
    "status" "SourceStatus" NOT NULL DEFAULT 'ACTIVE',
    "pollIntervalMinutes" INTEGER NOT NULL DEFAULT 60,
    "rateLimitPerMinute" INTEGER NOT NULL DEFAULT 30,
    "timeoutMs" INTEGER NOT NULL DEFAULT 15000,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collector_runs" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" "CollectorRunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "listingsFound" INTEGER NOT NULL DEFAULT 0,
    "listingsNew" INTEGER NOT NULL DEFAULT 0,
    "listingsUpdated" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "durationMs" INTEGER,

    CONSTRAINT "collector_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" TEXT NOT NULL,
    "address" TEXT,
    "street" TEXT,
    "houseNumber" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "province" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "propertyType" "PropertyType" NOT NULL DEFAULT 'UNKNOWN',
    "bedrooms" INTEGER,
    "surfaceArea" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listings" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT,
    "sourceId" TEXT NOT NULL,
    "sourceListingId" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "listingType" "ListingType" NOT NULL DEFAULT 'SALE',
    "title" TEXT,
    "description" TEXT,
    "sellerType" "SellerType" NOT NULL DEFAULT 'UNKNOWN',
    "sellerConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentPrice" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "publishedAt" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "missingSince" TIMESTAMP(3),
    "status" "ListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_snapshots" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "price" INTEGER,
    "title" TEXT,
    "description" TEXT,
    "sellerName" TEXT,
    "sellerPhone" TEXT,
    "status" TEXT,
    "rawData" JSONB,

    CONSTRAINT "listing_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_events" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "type" "ListingEventType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_identities" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "listingCountAtSource" INTEGER,

    CONSTRAINT "seller_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agency_identities" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "name" TEXT,
    "vatNumber" TEXT,
    "website" TEXT,

    CONSTRAINT "agency_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_contacts" (
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
    "postalCode" TEXT,
    "city" TEXT,
    "assignedAgentId" TEXT,
    "assignedAgentName" TEXT,
    "contactType" "CrmContactType" NOT NULL DEFAULT 'UNKNOWN',
    "leadType" TEXT,
    "status" "CrmContactStatus" NOT NULL DEFAULT 'UNKNOWN',
    "sourceCreatedAt" TIMESTAMP(3),
    "lastContactAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_interactions" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_imports" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "uploadedById" TEXT,
    "fileName" TEXT NOT NULL,
    "adapter" TEXT NOT NULL DEFAULT 'csv',
    "status" "CrmImportStatus" NOT NULL DEFAULT 'PENDING',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "importedRows" INTEGER NOT NULL DEFAULT 0,
    "updatedRows" INTEGER NOT NULL DEFAULT 0,
    "skippedRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "crm_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_import_rows" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "rawData" JSONB NOT NULL,
    "outcome" "CrmImportRowOutcome" NOT NULL,
    "message" TEXT,
    "contactId" TEXT,

    CONSTRAINT "crm_import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_property_relationships" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "kind" "ContactPropertyRelationKind" NOT NULL DEFAULT 'UNKNOWN',
    "since" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_property_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunities" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "type" "OpportunityType" NOT NULL,
    "origin" "OpportunityOrigin" NOT NULL DEFAULT 'MARKET',
    "status" "OpportunityStatus" NOT NULL DEFAULT 'NEW',
    "propertyId" TEXT,
    "listingId" TEXT,
    "contactId" TEXT,
    "crmMatchConfidence" DOUBLE PRECISION,
    "crmMatchReasons" JSONB,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snoozedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_signals" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "eventId" TEXT,
    "kind" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opportunity_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_scores" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total" INTEGER NOT NULL,
    "intentScore" INTEGER NOT NULL,
    "relationshipScore" INTEGER NOT NULL,
    "timingScore" INTEGER NOT NULL,
    "territoryScore" INTEGER NOT NULL,
    "confidenceScore" INTEGER NOT NULL,
    "reasons" JSONB NOT NULL,
    "breakdown" JSONB,

    CONSTRAINT "opportunity_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_assignments" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "assignedToId" TEXT NOT NULL,
    "assignedById" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "opportunity_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_activities" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "userId" TEXT,
    "kind" TEXT NOT NULL,
    "fromStatus" "OpportunityStatus",
    "toStatus" "OpportunityStatus",
    "note" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opportunity_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_rules" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "kind" "AlertKind" NOT NULL,
    "channel" "AlertChannel" NOT NULL DEFAULT 'TELEGRAM',
    "minScore" INTEGER NOT NULL DEFAULT 85,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "kind" "AlertKind" NOT NULL,
    "channel" "AlertChannel" NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agencies_slug_key" ON "agencies"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_agencyId_idx" ON "users"("agencyId");

-- CreateIndex
CREATE INDEX "territories_agencyId_idx" ON "territories"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "territories_agencyId_kind_value_key" ON "territories"("agencyId", "kind", "value");

-- CreateIndex
CREATE UNIQUE INDEX "sources_code_key" ON "sources"("code");

-- CreateIndex
CREATE INDEX "collector_runs_sourceId_startedAt_idx" ON "collector_runs"("sourceId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "properties_postalCode_idx" ON "properties"("postalCode");

-- CreateIndex
CREATE INDEX "properties_postalCode_street_houseNumber_idx" ON "properties"("postalCode", "street", "houseNumber");

-- CreateIndex
CREATE INDEX "listings_propertyId_idx" ON "listings"("propertyId");

-- CreateIndex
CREATE INDEX "listings_status_lastSeenAt_idx" ON "listings"("status", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "listings_sourceId_sourceListingId_key" ON "listings"("sourceId", "sourceListingId");

-- CreateIndex
CREATE INDEX "listing_snapshots_listingId_capturedAt_idx" ON "listing_snapshots"("listingId", "capturedAt");

-- CreateIndex
CREATE INDEX "listing_events_listingId_occurredAt_idx" ON "listing_events"("listingId", "occurredAt");

-- CreateIndex
CREATE INDEX "listing_events_type_occurredAt_idx" ON "listing_events"("type", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "listing_events_listingId_type_occurredAt_key" ON "listing_events"("listingId", "type", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "seller_identities_listingId_key" ON "seller_identities"("listingId");

-- CreateIndex
CREATE INDEX "seller_identities_phone_idx" ON "seller_identities"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "agency_identities_listingId_key" ON "agency_identities"("listingId");

-- CreateIndex
CREATE INDEX "crm_contacts_agencyId_normalizedPhone_idx" ON "crm_contacts"("agencyId", "normalizedPhone");

-- CreateIndex
CREATE INDEX "crm_contacts_agencyId_normalizedEmail_idx" ON "crm_contacts"("agencyId", "normalizedEmail");

-- CreateIndex
CREATE INDEX "crm_contacts_agencyId_normalizedName_postalCode_idx" ON "crm_contacts"("agencyId", "normalizedName", "postalCode");

-- CreateIndex
CREATE INDEX "crm_contacts_agencyId_contactType_status_idx" ON "crm_contacts"("agencyId", "contactType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "crm_contacts_agencyId_externalContactId_key" ON "crm_contacts"("agencyId", "externalContactId");

-- CreateIndex
CREATE INDEX "crm_interactions_contactId_occurredAt_idx" ON "crm_interactions"("contactId", "occurredAt");

-- CreateIndex
CREATE INDEX "crm_imports_agencyId_createdAt_idx" ON "crm_imports"("agencyId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "crm_import_rows_importId_idx" ON "crm_import_rows"("importId");

-- CreateIndex
CREATE INDEX "contact_property_relationships_propertyId_idx" ON "contact_property_relationships"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "contact_property_relationships_contactId_propertyId_kind_key" ON "contact_property_relationships"("contactId", "propertyId", "kind");

-- CreateIndex
CREATE INDEX "opportunities_agencyId_status_detectedAt_idx" ON "opportunities"("agencyId", "status", "detectedAt" DESC);

-- CreateIndex
CREATE INDEX "opportunities_agencyId_propertyId_idx" ON "opportunities"("agencyId", "propertyId");

-- CreateIndex
CREATE INDEX "opportunities_agencyId_contactId_idx" ON "opportunities"("agencyId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX "opportunities_agencyId_type_listingId_contactId_key" ON "opportunities"("agencyId", "type", "listingId", "contactId");

-- CreateIndex
CREATE INDEX "opportunity_signals_opportunityId_idx" ON "opportunity_signals"("opportunityId");

-- CreateIndex
CREATE INDEX "opportunity_scores_opportunityId_computedAt_idx" ON "opportunity_scores"("opportunityId", "computedAt" DESC);

-- CreateIndex
CREATE INDEX "opportunity_assignments_opportunityId_idx" ON "opportunity_assignments"("opportunityId");

-- CreateIndex
CREATE INDEX "opportunity_assignments_assignedToId_active_idx" ON "opportunity_assignments"("assignedToId", "active");

-- CreateIndex
CREATE INDEX "opportunity_activities_opportunityId_occurredAt_idx" ON "opportunity_activities"("opportunityId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "alert_rules_agencyId_kind_channel_key" ON "alert_rules"("agencyId", "kind", "channel");

-- CreateIndex
CREATE INDEX "alerts_agencyId_createdAt_idx" ON "alerts"("agencyId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "alerts_agencyId_dedupeKey_key" ON "alerts"("agencyId", "dedupeKey");

-- CreateIndex
CREATE INDEX "audit_logs_agencyId_createdAt_idx" ON "audit_logs"("agencyId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "territories" ADD CONSTRAINT "territories_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collector_runs" ADD CONSTRAINT "collector_runs_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_snapshots" ADD CONSTRAINT "listing_snapshots_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_events" ADD CONSTRAINT "listing_events_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_identities" ADD CONSTRAINT "seller_identities_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_identities" ADD CONSTRAINT "agency_identities_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_assignedAgentId_fkey" FOREIGN KEY ("assignedAgentId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_interactions" ADD CONSTRAINT "crm_interactions_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "crm_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_imports" ADD CONSTRAINT "crm_imports_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_imports" ADD CONSTRAINT "crm_imports_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_import_rows" ADD CONSTRAINT "crm_import_rows_importId_fkey" FOREIGN KEY ("importId") REFERENCES "crm_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_import_rows" ADD CONSTRAINT "crm_import_rows_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_property_relationships" ADD CONSTRAINT "contact_property_relationships_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "crm_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_property_relationships" ADD CONSTRAINT "contact_property_relationships_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_signals" ADD CONSTRAINT "opportunity_signals_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_signals" ADD CONSTRAINT "opportunity_signals_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "listing_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_scores" ADD CONSTRAINT "opportunity_scores_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_assignments" ADD CONSTRAINT "opportunity_assignments_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_assignments" ADD CONSTRAINT "opportunity_assignments_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_assignments" ADD CONSTRAINT "opportunity_assignments_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_activities" ADD CONSTRAINT "opportunity_activities_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_activities" ADD CONSTRAINT "opportunity_activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
