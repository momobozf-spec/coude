-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "HouseholdRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('MOSQUE', 'FOUNDATION', 'NONPROFIT', 'COMPANY', 'OTHER');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PLUS', 'FAMILY', 'ORGANIZATION');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ZakatMethodology" AS ENUM ('DEFAULT', 'HANAFI', 'SHAFII', 'MALIKI', 'HANBALI', 'CUSTOM');

-- CreateEnum
CREATE TYPE "NisabBasis" AS ENUM ('GOLD', 'SILVER', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CalendarSystem" AS ENUM ('GREGORIAN', 'HIJRI');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('CASH', 'BANK_ACCOUNT', 'SAVINGS', 'GOLD', 'SILVER', 'INVESTMENTS', 'CRYPTO', 'BUSINESS_CASH', 'BUSINESS_INVENTORY', 'RECEIVABLES', 'PROPERTY_INVESTMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "LiabilityType" AS ENUM ('SHORT_TERM_DEBT', 'INVOICE_DUE', 'CREDIT_CARD', 'TAX_DUE', 'BUSINESS_PAYABLE', 'OTHER');

-- CreateEnum
CREATE TYPE "CalculationStatus" AS ENUM ('DRAFT', 'FINALIZED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CalculationItemType" AS ENUM ('ASSET', 'LIABILITY', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "MetalPriceSourceType" AS ENUM ('LIVE_PROVIDER', 'MANUAL', 'FIXTURE');

-- CreateEnum
CREATE TYPE "CauseCategory" AS ENUM ('POVERTY', 'FOOD', 'ORPHANS', 'EDUCATION', 'HEALTHCARE', 'WATER', 'EMERGENCY', 'REFUGEES', 'MOSQUE', 'DAWAH', 'WAQF', 'LOCAL_COMMUNITY', 'OTHER');

-- CreateEnum
CREATE TYPE "CharityScope" AS ENUM ('LOCAL', 'NATIONAL', 'INTERNATIONAL');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('VERIFIED', 'PARTIALLY_VERIFIED', 'SELF_REPORTED', 'UNVERIFIED');

-- CreateEnum
CREATE TYPE "CharitySourceType" AS ENUM ('OFFICIAL_WEBSITE', 'GOVERNMENT_REGISTER', 'ANNUAL_REPORT', 'FINANCIAL_REPORT', 'ZAKAT_POLICY', 'OTHER');

-- CreateEnum
CREATE TYPE "DonationType" AS ENUM ('ZAKAT', 'SADAQAH', 'SADAQAH_JARIYAH', 'FIDYA', 'KAFFARAH', 'WAQF', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'CARD', 'CASH', 'DIRECT_DEBIT', 'IN_KIND', 'OTHER');

-- CreateEnum
CREATE TYPE "SadaqahPeriod" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('DONATION_RECEIPT', 'BANK_STATEMENT', 'ZAKAT_REPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "StorageProvider" AS ENUM ('LOCAL', 'S3');

-- CreateEnum
CREATE TYPE "ReminderType" AS ENUM ('ZAKAT_DUE', 'ZAKAT_PREPARATION', 'SADAQAH_GOAL', 'DOCUMENT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('SCHEDULED', 'SENT', 'DISMISSED', 'CANCELED');

-- CreateEnum
CREATE TYPE "Recurrence" AS ENUM ('NONE', 'MONTHLY', 'YEARLY', 'HIJRI_YEARLY');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'PUSH', 'TELEGRAM');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "KnowledgeCategory" AS ENUM ('ZAKAT_BASICS', 'NISAB', 'GOLD', 'SILVER', 'INVESTMENTS', 'BUSINESS', 'DEBT', 'CRYPTO', 'CHARITY', 'SADAQAH');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'REVIEWED', 'NEEDS_UPDATE');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('SCHOLARLY_REFERENCE', 'CHARITY_OFFICIAL', 'GOVERNMENT_REGISTER', 'FINANCIAL_REPORT', 'MARKET_DATA', 'INTERNAL_RULE');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('USER_REGISTERED', 'USER_DELETED', 'PROFILE_UPDATED', 'ASSET_CREATED', 'ASSET_UPDATED', 'ASSET_DELETED', 'LIABILITY_CREATED', 'LIABILITY_UPDATED', 'LIABILITY_DELETED', 'CALCULATION_CREATED', 'CALCULATION_FINALIZED', 'CALCULATION_ARCHIVED', 'DONATION_CREATED', 'DONATION_UPDATED', 'DONATION_DELETED', 'DOCUMENT_UPLOADED', 'DOCUMENT_DELETED', 'HOUSEHOLD_CREATED', 'HOUSEHOLD_MEMBER_ADDED', 'HOUSEHOLD_MEMBER_REMOVED', 'HOUSEHOLD_MEMBER_ROLE_CHANGED', 'SUBSCRIPTION_CHANGED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "passwordHash" TEXT,
    "name" TEXT,
    "image" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "locale" TEXT NOT NULL DEFAULT 'nl',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Brussels',
    "onboardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
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

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "households" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'EUR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "households_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household_members" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "HouseholdRole" NOT NULL DEFAULT 'MEMBER',
    "sharesFinancials" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "household_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "OrganizationType" NOT NULL DEFAULT 'NONPROFIT',
    "country" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_members" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "HouseholdRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "organizationId" TEXT,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentPeriodEnd" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "externalCustomerId" TEXT,
    "externalSubscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zakat_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "methodology" "ZakatMethodology" NOT NULL DEFAULT 'DEFAULT',
    "nisabBasis" "NisabBasis" NOT NULL DEFAULT 'SILVER',
    "customNisabValue" DECIMAL(18,2),
    "customNisabCurrency" TEXT,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'EUR',
    "haulStartDate" TIMESTAMP(3),
    "zakatDueDate" TIMESTAMP(3),
    "hijriDueDay" INTEGER,
    "hijriDueMonth" INTEGER,
    "preferredCalendar" "CalendarSystem" NOT NULL DEFAULT 'GREGORIAN',
    "deductShortTermDebts" BOOLEAN NOT NULL DEFAULT true,
    "businessAssetsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "advancedMode" BOOLEAN NOT NULL DEFAULT false,
    "reminderDaysBefore" INTEGER[] DEFAULT ARRAY[30, 7, 0]::INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zakat_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zakat_rule_sets" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "methodology" "ZakatMethodology" NOT NULL DEFAULT 'DEFAULT',
    "zakatRate" DECIMAL(6,5) NOT NULL,
    "goldNisabGrams" DECIMAL(10,3) NOT NULL,
    "silverNisabGrams" DECIMAL(10,3) NOT NULL,
    "allowLiabilityDeduction" BOOLEAN NOT NULL DEFAULT true,
    "summary" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zakat_rule_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zakat_asset_rules" (
    "id" TEXT NOT NULL,
    "ruleSetId" TEXT NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "zakatable" BOOLEAN NOT NULL DEFAULT true,
    "defaultZakatablePercentage" DECIMAL(5,2) NOT NULL DEFAULT 100,
    "rationale" TEXT,

    CONSTRAINT "zakat_asset_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zakat_liability_rules" (
    "id" TEXT NOT NULL,
    "ruleSetId" TEXT NOT NULL,
    "liabilityType" "LiabilityType" NOT NULL,
    "deductibleByDefault" BOOLEAN NOT NULL DEFAULT false,
    "maxMonthsAhead" INTEGER,
    "rationale" TEXT,

    CONSTRAINT "zakat_liability_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "householdId" TEXT,
    "type" "AssetType" NOT NULL,
    "name" TEXT NOT NULL,
    "value" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "zakatablePercentage" DECIMAL(5,2),
    "weightGrams" DECIMAL(12,3),
    "purityKarat" INTEGER,
    "notes" TEXT,
    "metadata" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liabilities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "householdId" TEXT,
    "type" "LiabilityType" NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "dueDate" TIMESTAMP(3),
    "deductibleForZakat" BOOLEAN,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "liabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zakat_calculations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "householdId" TEXT,
    "calculationDate" TIMESTAMP(3) NOT NULL,
    "zakatYearLabel" TEXT,
    "hijriYear" INTEGER,
    "currency" TEXT NOT NULL,
    "grossAssets" DECIMAL(18,2) NOT NULL,
    "deductibleLiabilities" DECIMAL(18,2) NOT NULL,
    "netWealth" DECIMAL(18,2) NOT NULL,
    "nisabBasis" "NisabBasis" NOT NULL,
    "nisabValue" DECIMAL(18,2) NOT NULL,
    "nisabMetalGrams" DECIMAL(10,3),
    "nisabPricePerGram" DECIMAL(18,6),
    "nisabPriceCurrency" TEXT,
    "nisabPriceSource" "MetalPriceSourceType",
    "nisabPriceProvider" TEXT,
    "nisabPriceAsOf" TIMESTAMP(3),
    "aboveNisab" BOOLEAN NOT NULL,
    "zakatRate" DECIMAL(6,5) NOT NULL,
    "zakatDue" DECIMAL(18,2) NOT NULL,
    "methodology" "ZakatMethodology" NOT NULL,
    "ruleSetId" TEXT NOT NULL,
    "rulesVersion" TEXT NOT NULL,
    "status" "CalculationStatus" NOT NULL DEFAULT 'DRAFT',
    "finalizedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zakat_calculations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zakat_calculation_items" (
    "id" TEXT NOT NULL,
    "calculationId" TEXT NOT NULL,
    "itemType" "CalculationItemType" NOT NULL,
    "sourceEntityId" TEXT,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "originalAmount" DECIMAL(18,2),
    "originalCurrency" TEXT,
    "exchangeRate" DECIMAL(18,8),
    "zakatablePercentage" DECIMAL(5,2),
    "included" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zakat_calculation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zakat_calculation_rates" (
    "id" TEXT NOT NULL,
    "calculationId" TEXT NOT NULL,
    "fromCurrency" TEXT NOT NULL,
    "toCurrency" TEXT NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "provider" TEXT NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zakat_calculation_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "causes" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" "CauseCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "causes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charities" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "country" TEXT NOT NULL,
    "operatingCountries" TEXT[],
    "organizationType" "OrganizationType" NOT NULL DEFAULT 'NONPROFIT',
    "scope" "CharityScope" NOT NULL DEFAULT 'INTERNATIONAL',
    "website" TEXT NOT NULL,
    "donationUrl" TEXT,
    "logoUrl" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "transparencyScore" INTEGER,
    "transparencyScoredAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "charities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charity_causes" (
    "charityId" TEXT NOT NULL,
    "causeId" TEXT NOT NULL,

    CONSTRAINT "charity_causes_pkey" PRIMARY KEY ("charityId","causeId")
);

-- CreateTable
CREATE TABLE "charity_transparency_profiles" (
    "id" TEXT NOT NULL,
    "charityId" TEXT NOT NULL,
    "registeredOrganization" BOOLEAN NOT NULL DEFAULT false,
    "registrationNumber" TEXT,
    "countryOfRegistration" TEXT,
    "annualReportUrl" TEXT,
    "financialReportUrl" TEXT,
    "zakatPolicyUrl" TEXT,
    "acceptsZakat" BOOLEAN NOT NULL DEFAULT false,
    "zakatEligibleProgramsDescription" TEXT,
    "adminCostPercentage" DECIMAL(5,2),
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "lastReviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "charity_transparency_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charity_sources" (
    "id" TEXT NOT NULL,
    "charityId" TEXT NOT NULL,
    "sourceType" "CharitySourceType" NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "charity_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorite_charities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "charityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorite_charities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "householdId" TEXT,
    "charityId" TEXT,
    "recipientName" TEXT,
    "type" "DonationType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "donatedAt" TIMESTAMP(3) NOT NULL,
    "paymentMethod" "PaymentMethod",
    "reference" TEXT,
    "notes" TEXT,
    "receiptDocumentId" TEXT,
    "zakatCalculationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "donations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sadaqah_goals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "householdId" TEXT,
    "label" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "period" "SadaqahPeriod" NOT NULL DEFAULT 'MONTHLY',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sadaqah_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "householdId" TEXT,
    "type" "DocumentType" NOT NULL DEFAULT 'DONATION_RECEIPT',
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageProvider" "StorageProvider" NOT NULL DEFAULT 'LOCAL',
    "storageKey" TEXT NOT NULL,
    "checksumSha256" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "householdId" TEXT,
    "type" "ReminderType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "recurrence" "Recurrence" NOT NULL DEFAULT 'NONE',
    "status" "ReminderStatus" NOT NULL DEFAULT 'SCHEDULED',
    "lastSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "type" "ReminderType" NOT NULL DEFAULT 'CUSTOM',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "reminderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT false,
    "telegramEnabled" BOOLEAN NOT NULL DEFAULT false,
    "telegramChatId" TEXT,
    "zakatReminders" BOOLEAN NOT NULL DEFAULT true,
    "sadaqahReminders" BOOLEAN NOT NULL DEFAULT true,
    "productUpdates" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_articles" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "KnowledgeCategory" NOT NULL,
    "summary" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "country" TEXT,
    "methodology" "ZakatMethodology",
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewedBy" TEXT,
    "lastReviewedAt" TIMESTAMP(3),
    "sourceUrl" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organization" TEXT,
    "url" TEXT,
    "sourceType" "SourceType" NOT NULL,
    "country" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_sources" (
    "articleId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,

    CONSTRAINT "article_sources_pkey" PRIMARY KEY ("articleId","sourceId")
);

-- CreateTable
CREATE TABLE "rule_set_sources" (
    "ruleSetId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "appliesTo" TEXT,

    CONSTRAINT "rule_set_sources_pkey" PRIMARY KEY ("ruleSetId","sourceId")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE INDEX "households_ownerUserId_idx" ON "households"("ownerUserId");

-- CreateIndex
CREATE INDEX "household_members_userId_idx" ON "household_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "household_members_householdId_userId_key" ON "household_members"("householdId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "organization_members_userId_idx" ON "organization_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "organization_members_organizationId_userId_key" ON "organization_members"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_userId_key" ON "subscriptions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_organizationId_key" ON "subscriptions"("organizationId");

-- CreateIndex
CREATE INDEX "subscriptions_plan_status_idx" ON "subscriptions"("plan", "status");

-- CreateIndex
CREATE UNIQUE INDEX "zakat_profiles_userId_key" ON "zakat_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "zakat_rule_sets_version_key" ON "zakat_rule_sets"("version");

-- CreateIndex
CREATE INDEX "zakat_rule_sets_active_validFrom_idx" ON "zakat_rule_sets"("active", "validFrom");

-- CreateIndex
CREATE UNIQUE INDEX "zakat_asset_rules_ruleSetId_assetType_key" ON "zakat_asset_rules"("ruleSetId", "assetType");

-- CreateIndex
CREATE UNIQUE INDEX "zakat_liability_rules_ruleSetId_liabilityType_key" ON "zakat_liability_rules"("ruleSetId", "liabilityType");

-- CreateIndex
CREATE INDEX "assets_userId_active_idx" ON "assets"("userId", "active");

-- CreateIndex
CREATE INDEX "assets_householdId_idx" ON "assets"("householdId");

-- CreateIndex
CREATE INDEX "assets_userId_type_idx" ON "assets"("userId", "type");

-- CreateIndex
CREATE INDEX "liabilities_userId_active_idx" ON "liabilities"("userId", "active");

-- CreateIndex
CREATE INDEX "liabilities_householdId_idx" ON "liabilities"("householdId");

-- CreateIndex
CREATE INDEX "zakat_calculations_userId_calculationDate_idx" ON "zakat_calculations"("userId", "calculationDate");

-- CreateIndex
CREATE INDEX "zakat_calculations_userId_status_idx" ON "zakat_calculations"("userId", "status");

-- CreateIndex
CREATE INDEX "zakat_calculations_householdId_idx" ON "zakat_calculations"("householdId");

-- CreateIndex
CREATE INDEX "zakat_calculation_items_calculationId_sortOrder_idx" ON "zakat_calculation_items"("calculationId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "zakat_calculation_rates_calculationId_fromCurrency_toCurren_key" ON "zakat_calculation_rates"("calculationId", "fromCurrency", "toCurrency");

-- CreateIndex
CREATE UNIQUE INDEX "causes_slug_key" ON "causes"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "charities_slug_key" ON "charities"("slug");

-- CreateIndex
CREATE INDEX "charities_active_verified_idx" ON "charities"("active", "verified");

-- CreateIndex
CREATE INDEX "charities_country_idx" ON "charities"("country");

-- CreateIndex
CREATE INDEX "charity_causes_causeId_idx" ON "charity_causes"("causeId");

-- CreateIndex
CREATE UNIQUE INDEX "charity_transparency_profiles_charityId_key" ON "charity_transparency_profiles"("charityId");

-- CreateIndex
CREATE INDEX "charity_sources_charityId_sourceType_idx" ON "charity_sources"("charityId", "sourceType");

-- CreateIndex
CREATE INDEX "favorite_charities_charityId_idx" ON "favorite_charities"("charityId");

-- CreateIndex
CREATE UNIQUE INDEX "favorite_charities_userId_charityId_key" ON "favorite_charities"("userId", "charityId");

-- CreateIndex
CREATE INDEX "donations_userId_donatedAt_idx" ON "donations"("userId", "donatedAt");

-- CreateIndex
CREATE INDEX "donations_userId_type_idx" ON "donations"("userId", "type");

-- CreateIndex
CREATE INDEX "donations_zakatCalculationId_idx" ON "donations"("zakatCalculationId");

-- CreateIndex
CREATE INDEX "donations_charityId_idx" ON "donations"("charityId");

-- CreateIndex
CREATE INDEX "donations_householdId_idx" ON "donations"("householdId");

-- CreateIndex
CREATE INDEX "sadaqah_goals_userId_active_idx" ON "sadaqah_goals"("userId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "documents_storageKey_key" ON "documents"("storageKey");

-- CreateIndex
CREATE INDEX "documents_userId_type_idx" ON "documents"("userId", "type");

-- CreateIndex
CREATE INDEX "reminders_status_scheduledFor_idx" ON "reminders"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "reminders_userId_scheduledFor_idx" ON "reminders"("userId", "scheduledFor");

-- CreateIndex
CREATE INDEX "notifications_userId_status_idx" ON "notifications"("userId", "status");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_userId_key" ON "notification_preferences"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_articles_slug_key" ON "knowledge_articles"("slug");

-- CreateIndex
CREATE INDEX "knowledge_articles_category_published_idx" ON "knowledge_articles"("category", "published");

-- CreateIndex
CREATE INDEX "sources_sourceType_idx" ON "sources"("sourceType");

-- CreateIndex
CREATE INDEX "article_sources_sourceId_idx" ON "article_sources"("sourceId");

-- CreateIndex
CREATE INDEX "rule_set_sources_sourceId_idx" ON "rule_set_sources"("sourceId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "households" ADD CONSTRAINT "households_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zakat_profiles" ADD CONSTRAINT "zakat_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zakat_asset_rules" ADD CONSTRAINT "zakat_asset_rules_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "zakat_rule_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zakat_liability_rules" ADD CONSTRAINT "zakat_liability_rules_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "zakat_rule_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liabilities" ADD CONSTRAINT "liabilities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liabilities" ADD CONSTRAINT "liabilities_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zakat_calculations" ADD CONSTRAINT "zakat_calculations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zakat_calculations" ADD CONSTRAINT "zakat_calculations_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zakat_calculations" ADD CONSTRAINT "zakat_calculations_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "zakat_rule_sets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zakat_calculation_items" ADD CONSTRAINT "zakat_calculation_items_calculationId_fkey" FOREIGN KEY ("calculationId") REFERENCES "zakat_calculations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zakat_calculation_rates" ADD CONSTRAINT "zakat_calculation_rates_calculationId_fkey" FOREIGN KEY ("calculationId") REFERENCES "zakat_calculations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charity_causes" ADD CONSTRAINT "charity_causes_charityId_fkey" FOREIGN KEY ("charityId") REFERENCES "charities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charity_causes" ADD CONSTRAINT "charity_causes_causeId_fkey" FOREIGN KEY ("causeId") REFERENCES "causes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charity_transparency_profiles" ADD CONSTRAINT "charity_transparency_profiles_charityId_fkey" FOREIGN KEY ("charityId") REFERENCES "charities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charity_sources" ADD CONSTRAINT "charity_sources_charityId_fkey" FOREIGN KEY ("charityId") REFERENCES "charities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_charities" ADD CONSTRAINT "favorite_charities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_charities" ADD CONSTRAINT "favorite_charities_charityId_fkey" FOREIGN KEY ("charityId") REFERENCES "charities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_charityId_fkey" FOREIGN KEY ("charityId") REFERENCES "charities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_receiptDocumentId_fkey" FOREIGN KEY ("receiptDocumentId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_zakatCalculationId_fkey" FOREIGN KEY ("zakatCalculationId") REFERENCES "zakat_calculations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sadaqah_goals" ADD CONSTRAINT "sadaqah_goals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sadaqah_goals" ADD CONSTRAINT "sadaqah_goals_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "reminders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_sources" ADD CONSTRAINT "article_sources_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "knowledge_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_sources" ADD CONSTRAINT "article_sources_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_set_sources" ADD CONSTRAINT "rule_set_sources_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "zakat_rule_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_set_sources" ADD CONSTRAINT "rule_set_sources_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

