-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "JourneyStage" AS ENUM ('ORIENTATION', 'BUDGET', 'FINANCING', 'PROPERTY_SEARCH', 'VIEWINGS', 'OFFER', 'AGREEMENT', 'NOTARY', 'INSURANCE_ADMIN', 'MOVING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "JourneyStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "TaskDependencyType" AS ENUM ('BLOCKING', 'ADVISORY');

-- CreateEnum
CREATE TYPE "JourneyEventType" AS ENUM ('VIEWING', 'FINANCING_APPOINTMENT', 'NOTARY_APPOINTMENT', 'DOCUMENT_DEADLINE', 'MOVING', 'CUSTOM');

-- CreateEnum
CREATE TYPE "PurchaseType" AS ENUM ('EXISTING', 'NEW_BUILD', 'LAND', 'RENOVATION');

-- CreateEnum
CREATE TYPE "PurchaseTimeline" AS ENUM ('ASAP', 'WITHIN_3_MONTHS', 'WITHIN_6_MONTHS', 'WITHIN_12_MONTHS', 'NO_DEADLINE');

-- CreateEnum
CREATE TYPE "OnboardingGoal" AS ENUM ('ORIENTING', 'READY_TO_BUY', 'FOUND_PROPERTY');

-- CreateEnum
CREATE TYPE "FinancingQuoteStatus" AS ENUM ('DRAFT', 'INTERESTED', 'SHORTLISTED', 'SELECTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ChecklistImportance" AS ENUM ('REQUIRED', 'RECOMMENDED', 'OPTIONAL');

-- CreateEnum
CREATE TYPE "AnalyticsEventType" AS ENUM ('ONBOARDING_STARTED', 'ONBOARDING_STEP_COMPLETED', 'ONBOARDING_COMPLETED', 'JOURNEY_CREATED', 'STAGE_OPENED', 'STAGE_COMPLETED', 'TASK_COMPLETED', 'TASK_REOPENED', 'TASK_SKIPPED', 'CHECKLIST_ITEM_COMPLETED', 'CHECKLIST_ITEM_REOPENED', 'RECOMMENDATION_OPENED', 'FINANCING_OPENED', 'FINANCING_PRODUCT_OPENED', 'FINANCING_COMPARISON_CREATED', 'FINANCING_CALCULATION_COMPLETED', 'FINANCING_QUOTE_SAVED', 'DOCUMENT_UPLOADED', 'DOCUMENT_DELETED', 'DOCUMENT_EXPLANATION_REQUESTED', 'NOTARY_OPENED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('BUY', 'RENT');

-- CreateEnum
CREATE TYPE "SearchFrequency" AS ENUM ('MANUAL', 'DAILY', 'EVERY_6_HOURS', 'HOURLY');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "SavedPropertyStatus" AS ENUM ('SAVED', 'SHORTLISTED', 'VIEWING_PLANNED', 'VISITED', 'OFFER_CONSIDERED', 'OFFERED', 'REJECTED', 'PURCHASED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "FinancingType" AS ENUM ('MURABAHA', 'IJARA', 'DIMINISHING_MUSHARAKA', 'ISTISNA', 'QARD_HASAN', 'CONVENTIONAL_MORTGAGE', 'OTHER');

-- CreateEnum
CREATE TYPE "ShariahAssessmentStatus" AS ENUM ('CERTIFIED', 'PROVIDER_CLAIMED', 'REVIEWED', 'UNVERIFIED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('IDENTITY', 'INCOME', 'BANK', 'FINANCING', 'PROPERTY', 'OFFER', 'PURCHASE_AGREEMENT', 'NOTARY', 'INSURANCE', 'TAX', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'AVAILABLE', 'FAILED', 'EXPIRED', 'DELETED');

-- CreateEnum
CREATE TYPE "ExplanationSource" AS ENUM ('FIXTURE', 'AI');

-- CreateEnum
CREATE TYPE "ChecklistScope" AS ENUM ('JOURNEY', 'DOCUMENTS', 'NOTARY', 'MOVING', 'INSURANCE');

-- CreateEnum
CREATE TYPE "TermCategory" AS ENUM ('REAL_ESTATE', 'FINANCING', 'NOTARY', 'TAX', 'INSURANCE', 'LEGAL', 'ENERGY');

-- CreateEnum
CREATE TYPE "PlaceCategory" AS ENUM ('MOSQUE', 'SCHOOL', 'HALAL_BUTCHER', 'HALAL_SUPERMARKET', 'HALAL_RESTAURANT', 'HALAL_BAKERY', 'SUPERMARKET', 'PUBLIC_TRANSPORT', 'HOSPITAL', 'PHARMACY', 'PARK');

-- CreateEnum
CREATE TYPE "HalalVerification" AS ENUM ('DECLARED', 'COMMUNITY_TAGGED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('NOTARY', 'MOVING', 'INSURANCE', 'ENERGY', 'INTERNET', 'RENOVATION', 'INSPECTION', 'FINANCING');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'PUSH', 'TELEGRAM');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('NEW_PROPERTY_MATCH', 'PRICE_DROP', 'UPCOMING_VIEWING', 'MISSING_DOCUMENT', 'DEADLINE_APPROACHING', 'DOCUMENT_EXPIRING', 'JOURNEY_NEXT_STEP', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'READ');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'EDITOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'PLUS', 'PREMIUM');

-- CreateEnum
CREATE TYPE "AiConversationKind" AS ENUM ('JOURNEY_ASSISTANT', 'DOCUMENT_EXPLANATION', 'PROPERTY_SUMMARY', 'TERM_EXPLANATION');

-- CreateEnum
CREATE TYPE "AiRole" AS ENUM ('SYSTEM', 'USER', 'ASSISTANT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "passwordHash" TEXT,
    "name" TEXT,
    "image" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'FREE',
    "locale" TEXT NOT NULL DEFAULT 'nl',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Brussels',
    "country" TEXT NOT NULL DEFAULT 'BE',
    "onboarding" JSONB,
    "onboardingStep" INTEGER NOT NULL DEFAULT 0,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "HomeBuyingJourney" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currentStage" "JourneyStage" NOT NULL DEFAULT 'ORIENTATION',
    "status" "JourneyStatus" NOT NULL DEFAULT 'ACTIVE',
    "progressPercentage" INTEGER NOT NULL DEFAULT 0,
    "targetBudgetCents" INTEGER,
    "ownContributionCents" INTEGER,
    "needsFinancing" BOOLEAN,
    "targetLocation" TEXT,
    "targetPostalCode" TEXT,
    "searchRadiusKm" INTEGER,
    "country" TEXT NOT NULL DEFAULT 'BE',
    "region" TEXT,
    "purchaseType" "PurchaseType" NOT NULL DEFAULT 'EXISTING',
    "targetDate" TIMESTAMP(3),
    "timeline" "PurchaseTimeline",
    "firstHome" BOOLEAN NOT NULL DEFAULT true,
    "blueprintVersion" INTEGER NOT NULL DEFAULT 1,
    "initializedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "HomeBuyingJourney_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourneyTask" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stage" "JourneyStage" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "templateKey" TEXT,
    "system" BOOLEAN NOT NULL DEFAULT false,
    "optional" BOOLEAN NOT NULL DEFAULT false,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JourneyTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskDependency" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "dependsOnId" TEXT NOT NULL,
    "type" "TaskDependencyType" NOT NULL DEFAULT 'ADVISORY',

    CONSTRAINT "TaskDependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourneyEvent" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "JourneyEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "propertyId" TEXT,
    "completedAt" TIMESTAMP(3),
    "remindDaysBefore" INTEGER,
    "reminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JourneyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertySearch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "journeyId" TEXT,
    "name" TEXT NOT NULL,
    "originalQuery" TEXT NOT NULL,
    "criteria" JSONB NOT NULL,
    "criteriaVersion" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "frequency" "SearchFrequency" NOT NULL DEFAULT 'DAILY',
    "alertsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertySearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchRun" (
    "id" TEXT NOT NULL,
    "searchId" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "fetchedCount" INTEGER NOT NULL DEFAULT 0,
    "newPropertyCount" INTEGER NOT NULL DEFAULT 0,
    "matchCount" INTEGER NOT NULL DEFAULT 0,
    "notifiedCount" INTEGER NOT NULL DEFAULT 0,
    "sourceStats" JSONB,
    "error" TEXT,

    CONSTRAINT "SearchRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "urlNormalized" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "address" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "region" TEXT,
    "country" TEXT NOT NULL DEFAULT 'BE',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "propertyType" TEXT,
    "transactionType" "TransactionType" NOT NULL DEFAULT 'BUY',
    "price" INTEGER,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "livingAreaM2" INTEGER,
    "landAreaM2" INTEGER,
    "epcLabel" TEXT,
    "epcValue" INTEGER,
    "buildYear" INTEGER,
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "imageUrl" TEXT,
    "raw" JSONB,
    "publishedAt" TIMESTAMP(3),
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delistedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyHistory" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyMatch" (
    "id" TEXT NOT NULL,
    "searchId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "hardPass" BOOLEAN NOT NULL,
    "reasons" JSONB NOT NULL,
    "aiSummary" TEXT,
    "aiGeneratedAt" TIMESTAMP(3),
    "seenAt" TIMESTAMP(3),
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedProperty" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "journeyId" TEXT,
    "status" "SavedPropertyStatus" NOT NULL DEFAULT 'SAVED',
    "notes" TEXT,
    "rating" INTEGER,
    "priceAtSave" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedProperty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancingProvider" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'BE',
    "website" TEXT,
    "description" TEXT,
    "logoUrl" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancingProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancingProduct" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "financingType" "FinancingType" NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'BE',
    "description" TEXT NOT NULL,
    "structureExplanation" TEXT,
    "minAmount" INTEGER,
    "maxAmount" INTEGER,
    "minOwnContributionPercentage" INTEGER,
    "termMinMonths" INTEGER,
    "termMaxMonths" INTEGER,
    "profitRateBasisPoints" INTEGER,
    "rateBasisDescription" TEXT,
    "feesDescription" TEXT,
    "setupFeeAmount" INTEGER,
    "shariahAssessmentStatus" "ShariahAssessmentStatus" NOT NULL DEFAULT 'UNKNOWN',
    "certificationBody" TEXT,
    "certificationUrl" TEXT,
    "sourceUrl" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "disclaimer" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancingProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancingQuote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "journeyId" TEXT,
    "productId" TEXT,
    "propertyId" TEXT,
    "status" "FinancingQuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "purchasePrice" INTEGER NOT NULL,
    "ownContribution" INTEGER NOT NULL,
    "amountFinanced" INTEGER NOT NULL,
    "termMonths" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "monthlyPaymentCents" INTEGER NOT NULL,
    "totalPaymentCents" INTEGER NOT NULL,
    "totalCostCents" INTEGER NOT NULL,
    "feesCents" INTEGER NOT NULL DEFAULT 0,
    "providerName" TEXT,
    "productName" TEXT,
    "financingType" "FinancingType",
    "profitRateBasisPoints" INTEGER,
    "rateBasisDescription" TEXT,
    "shariahAssessmentStatus" "ShariahAssessmentStatus",
    "certificationBody" TEXT,
    "sourceUrl" TEXT,
    "sourceLastVerifiedAt" TIMESTAMP(3),
    "productWasDemo" BOOLEAN NOT NULL DEFAULT false,
    "calculatorVersion" TEXT NOT NULL,
    "assumptions" JSONB NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancingQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostRule" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'BE',
    "region" TEXT,
    "ruleType" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3),
    "configuration" JSONB NOT NULL,
    "sourceUrl" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "journeyId" TEXT,
    "propertyId" TEXT,
    "financingQuoteId" TEXT,
    "category" "DocumentCategory" NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "displayName" TEXT,
    "description" TEXT,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "checklistItemKey" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "purgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentExplanation" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "ExplanationSource" NOT NULL,
    "model" TEXT,
    "provider" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "sourceChecksum" TEXT,
    "summary" TEXT NOT NULL,
    "keyPoints" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "attentionPoints" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "questionsForProfessional" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "disclaimer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentExplanation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scope" "ChecklistScope" NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'BE',
    "region" TEXT,
    "stage" "JourneyStage",
    "purchaseType" "PurchaseType",
    "financingType" "FinancingType",
    "firstHomeOnly" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "sourceUrl" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "disclaimer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "section" TEXT,
    "importance" "ChecklistImportance" NOT NULL DEFAULT 'REQUIRED',
    "documentCategory" "DocumentCategory",
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "helpText" TEXT,
    "termSlug" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserChecklistItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "notApplicable" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "documentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyTerm" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "category" "TermCategory" NOT NULL,
    "simpleExplanation" TEXT NOT NULL,
    "detailedExplanation" TEXT,
    "country" TEXT NOT NULL DEFAULT 'BE',
    "region" TEXT,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sourceUrl" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceProvider" (
    "id" TEXT NOT NULL,
    "category" "ServiceCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "country" TEXT NOT NULL DEFAULT 'BE',
    "city" TEXT,
    "postalCode" TEXT,
    "address" TEXT,
    "website" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "partner" BOOLEAN NOT NULL DEFAULT false,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NearbyPlaceCache" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "category" "PlaceCategory" NOT NULL,
    "radiusMeters" INTEGER NOT NULL,
    "places" JSONB NOT NULL,
    "provider" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NearbyPlaceCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NeighborhoodPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mosqueWeight" INTEGER NOT NULL DEFAULT 3,
    "schoolWeight" INTEGER NOT NULL DEFAULT 3,
    "halalShopWeight" INTEGER NOT NULL DEFAULT 3,
    "supermarketWeight" INTEGER NOT NULL DEFAULT 2,
    "publicTransportWeight" INTEGER NOT NULL DEFAULT 2,
    "healthcareWeight" INTEGER NOT NULL DEFAULT 2,
    "parkWeight" INTEGER NOT NULL DEFAULT 1,
    "maxRelevantDistanceM" INTEGER NOT NULL DEFAULT 3000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NeighborhoodPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "data" JSONB,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "journeyId" TEXT,
    "kind" "AiConversationKind" NOT NULL DEFAULT 'JOURNEY_ASSISTANT',
    "title" TEXT,
    "subjectType" TEXT,
    "subjectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "AiRole" NOT NULL,
    "content" TEXT NOT NULL,
    "model" TEXT,
    "promptTokens" INTEGER,
    "outputTokens" INTEGER,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" "AnalyticsEventType" NOT NULL,
    "stage" "JourneyStage",
    "entityKey" TEXT,
    "properties" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "HomeBuyingJourney_userId_status_idx" ON "HomeBuyingJourney"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "HomeBuyingJourney_userId_name_key" ON "HomeBuyingJourney"("userId", "name");

-- CreateIndex
CREATE INDEX "JourneyTask_journeyId_stage_sortOrder_idx" ON "JourneyTask"("journeyId", "stage", "sortOrder");

-- CreateIndex
CREATE INDEX "JourneyTask_userId_status_dueDate_idx" ON "JourneyTask"("userId", "status", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "JourneyTask_journeyId_templateKey_key" ON "JourneyTask"("journeyId", "templateKey");

-- CreateIndex
CREATE INDEX "TaskDependency_dependsOnId_idx" ON "TaskDependency"("dependsOnId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskDependency_taskId_dependsOnId_key" ON "TaskDependency"("taskId", "dependsOnId");

-- CreateIndex
CREATE INDEX "JourneyEvent_journeyId_startsAt_idx" ON "JourneyEvent"("journeyId", "startsAt");

-- CreateIndex
CREATE INDEX "JourneyEvent_userId_dueAt_idx" ON "JourneyEvent"("userId", "dueAt");

-- CreateIndex
CREATE INDEX "PropertySearch_active_nextRunAt_idx" ON "PropertySearch"("active", "nextRunAt");

-- CreateIndex
CREATE INDEX "PropertySearch_userId_createdAt_idx" ON "PropertySearch"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PropertySearch_userId_name_key" ON "PropertySearch"("userId", "name");

-- CreateIndex
CREATE INDEX "SearchRun_searchId_startedAt_idx" ON "SearchRun"("searchId", "startedAt");

-- CreateIndex
CREATE INDEX "Property_fingerprint_idx" ON "Property"("fingerprint");

-- CreateIndex
CREATE INDEX "Property_city_transactionType_price_idx" ON "Property"("city", "transactionType", "price");

-- CreateIndex
CREATE INDEX "Property_discoveredAt_idx" ON "Property"("discoveredAt");

-- CreateIndex
CREATE UNIQUE INDEX "Property_source_externalId_key" ON "Property"("source", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Property_urlNormalized_key" ON "Property"("urlNormalized");

-- CreateIndex
CREATE INDEX "PropertyHistory_propertyId_field_changedAt_idx" ON "PropertyHistory"("propertyId", "field", "changedAt");

-- CreateIndex
CREATE INDEX "PropertyMatch_userId_createdAt_idx" ON "PropertyMatch"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PropertyMatch_searchId_notifiedAt_idx" ON "PropertyMatch"("searchId", "notifiedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyMatch_searchId_propertyId_key" ON "PropertyMatch"("searchId", "propertyId");

-- CreateIndex
CREATE INDEX "SavedProperty_journeyId_status_idx" ON "SavedProperty"("journeyId", "status");

-- CreateIndex
CREATE INDEX "SavedProperty_userId_status_updatedAt_idx" ON "SavedProperty"("userId", "status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SavedProperty_userId_propertyId_key" ON "SavedProperty"("userId", "propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancingProvider_slug_key" ON "FinancingProvider"("slug");

-- CreateIndex
CREATE INDEX "FinancingProvider_country_active_idx" ON "FinancingProvider"("country", "active");

-- CreateIndex
CREATE UNIQUE INDEX "FinancingProduct_slug_key" ON "FinancingProduct"("slug");

-- CreateIndex
CREATE INDEX "FinancingProduct_country_active_financingType_idx" ON "FinancingProduct"("country", "active", "financingType");

-- CreateIndex
CREATE INDEX "FinancingProduct_providerId_idx" ON "FinancingProduct"("providerId");

-- CreateIndex
CREATE INDEX "FinancingQuote_userId_createdAt_idx" ON "FinancingQuote"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "FinancingQuote_journeyId_idx" ON "FinancingQuote"("journeyId");

-- CreateIndex
CREATE INDEX "FinancingQuote_userId_status_idx" ON "FinancingQuote"("userId", "status");

-- CreateIndex
CREATE INDEX "FinancingQuote_propertyId_idx" ON "FinancingQuote"("propertyId");

-- CreateIndex
CREATE INDEX "CostRule_country_region_ruleType_validFrom_idx" ON "CostRule"("country", "region", "ruleType", "validFrom");

-- CreateIndex
CREATE UNIQUE INDEX "Document_storageKey_key" ON "Document"("storageKey");

-- CreateIndex
CREATE INDEX "Document_userId_category_status_idx" ON "Document"("userId", "category", "status");

-- CreateIndex
CREATE INDEX "Document_journeyId_category_idx" ON "Document"("journeyId", "category");

-- CreateIndex
CREATE INDEX "Document_propertyId_idx" ON "Document"("propertyId");

-- CreateIndex
CREATE INDEX "Document_expiresAt_idx" ON "Document"("expiresAt");

-- CreateIndex
CREATE INDEX "Document_deletedAt_purgedAt_idx" ON "Document"("deletedAt", "purgedAt");

-- CreateIndex
CREATE INDEX "DocumentExplanation_documentId_createdAt_idx" ON "DocumentExplanation"("documentId", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentExplanation_userId_createdAt_idx" ON "DocumentExplanation"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistTemplate_key_key" ON "ChecklistTemplate"("key");

-- CreateIndex
CREATE INDEX "ChecklistTemplate_scope_country_active_idx" ON "ChecklistTemplate"("scope", "country", "active");

-- CreateIndex
CREATE INDEX "ChecklistTemplate_stage_country_active_idx" ON "ChecklistTemplate"("stage", "country", "active");

-- CreateIndex
CREATE INDEX "ChecklistItem_templateId_sortOrder_idx" ON "ChecklistItem"("templateId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistItem_templateId_key_key" ON "ChecklistItem"("templateId", "key");

-- CreateIndex
CREATE INDEX "UserChecklistItem_userId_completed_idx" ON "UserChecklistItem"("userId", "completed");

-- CreateIndex
CREATE INDEX "UserChecklistItem_documentId_idx" ON "UserChecklistItem"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "UserChecklistItem_journeyId_itemId_key" ON "UserChecklistItem"("journeyId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyTerm_slug_key" ON "PropertyTerm"("slug");

-- CreateIndex
CREATE INDEX "PropertyTerm_category_country_idx" ON "PropertyTerm"("category", "country");

-- CreateIndex
CREATE INDEX "PropertyTerm_country_term_idx" ON "PropertyTerm"("country", "term");

-- CreateIndex
CREATE INDEX "ServiceProvider_category_country_city_idx" ON "ServiceProvider"("category", "country", "city");

-- CreateIndex
CREATE INDEX "NearbyPlaceCache_expiresAt_idx" ON "NearbyPlaceCache"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "NearbyPlaceCache_propertyId_category_radiusMeters_key" ON "NearbyPlaceCache"("propertyId", "category", "radiusMeters");

-- CreateIndex
CREATE UNIQUE INDEX "NeighborhoodPreference_userId_key" ON "NeighborhoodPreference"("userId");

-- CreateIndex
CREATE INDEX "Notification_userId_status_createdAt_idx" ON "Notification"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_status_createdAt_idx" ON "Notification"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_type_channel_key" ON "NotificationPreference"("userId", "type", "channel");

-- CreateIndex
CREATE INDEX "AiConversation_userId_updatedAt_idx" ON "AiConversation"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "AiConversation_subjectType_subjectId_idx" ON "AiConversation"("subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "AiMessage_conversationId_createdAt_idx" ON "AiMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_type_createdAt_idx" ON "AnalyticsEvent"("type", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_userId_createdAt_idx" ON "AnalyticsEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeBuyingJourney" ADD CONSTRAINT "HomeBuyingJourney_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyTask" ADD CONSTRAINT "JourneyTask_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "HomeBuyingJourney"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "JourneyTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_dependsOnId_fkey" FOREIGN KEY ("dependsOnId") REFERENCES "JourneyTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyEvent" ADD CONSTRAINT "JourneyEvent_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "HomeBuyingJourney"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyEvent" ADD CONSTRAINT "JourneyEvent_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertySearch" ADD CONSTRAINT "PropertySearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertySearch" ADD CONSTRAINT "PropertySearch_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "HomeBuyingJourney"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchRun" ADD CONSTRAINT "SearchRun_searchId_fkey" FOREIGN KEY ("searchId") REFERENCES "PropertySearch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyHistory" ADD CONSTRAINT "PropertyHistory_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyMatch" ADD CONSTRAINT "PropertyMatch_searchId_fkey" FOREIGN KEY ("searchId") REFERENCES "PropertySearch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyMatch" ADD CONSTRAINT "PropertyMatch_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyMatch" ADD CONSTRAINT "PropertyMatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedProperty" ADD CONSTRAINT "SavedProperty_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedProperty" ADD CONSTRAINT "SavedProperty_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedProperty" ADD CONSTRAINT "SavedProperty_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "HomeBuyingJourney"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancingProduct" ADD CONSTRAINT "FinancingProduct_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "FinancingProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancingQuote" ADD CONSTRAINT "FinancingQuote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancingQuote" ADD CONSTRAINT "FinancingQuote_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "HomeBuyingJourney"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancingQuote" ADD CONSTRAINT "FinancingQuote_productId_fkey" FOREIGN KEY ("productId") REFERENCES "FinancingProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancingQuote" ADD CONSTRAINT "FinancingQuote_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "HomeBuyingJourney"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_financingQuoteId_fkey" FOREIGN KEY ("financingQuoteId") REFERENCES "FinancingQuote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentExplanation" ADD CONSTRAINT "DocumentExplanation_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserChecklistItem" ADD CONSTRAINT "UserChecklistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserChecklistItem" ADD CONSTRAINT "UserChecklistItem_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "HomeBuyingJourney"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserChecklistItem" ADD CONSTRAINT "UserChecklistItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ChecklistItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserChecklistItem" ADD CONSTRAINT "UserChecklistItem_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NearbyPlaceCache" ADD CONSTRAINT "NearbyPlaceCache_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NeighborhoodPreference" ADD CONSTRAINT "NeighborhoodPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiConversation" ADD CONSTRAINT "AiConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiConversation" ADD CONSTRAINT "AiConversation_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "HomeBuyingJourney"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiMessage" ADD CONSTRAINT "AiMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

