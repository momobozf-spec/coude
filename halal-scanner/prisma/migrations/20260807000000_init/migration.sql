-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'MODERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "HalalStatus" AS ENUM ('CERTIFIED_HALAL', 'LIKELY_HALAL', 'MUSHBOOH', 'LIKELY_HARAM', 'HARAM', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ConfidenceLevel" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "OriginRisk" AS ENUM ('NONE', 'PLANT_ONLY', 'SYNTHETIC_ONLY', 'ANIMAL_POSSIBLE', 'ANIMAL_CERTAIN', 'ALCOHOL_RELATED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "IngredientCategory" AS ENUM ('PLANT', 'ANIMAL', 'INSECT', 'MINERAL', 'SYNTHETIC', 'MICROBIAL', 'ALCOHOL', 'ADDITIVE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('CERTIFICATION_BODY', 'FOOD_DATABASE', 'MANUFACTURER', 'SCIENTIFIC_REFERENCE', 'COMMUNITY', 'INTERNAL_RULE');

-- CreateEnum
CREATE TYPE "ExternalSource" AS ENUM ('OPEN_FOOD_FACTS', 'OCR', 'MANUAL', 'ADMIN');

-- CreateEnum
CREATE TYPE "IngredientOrigin" AS ENUM ('OPEN_FOOD_FACTS', 'OCR', 'USER', 'ADMIN', 'AI_ASSISTED');

-- CreateEnum
CREATE TYPE "CertificateStatus" AS ENUM ('PENDING', 'COMMUNITY_REVIEWED', 'VERIFIED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ReviewType" AS ENUM ('INGREDIENT_CHANGE', 'MANUFACTURER_CONFIRMATION', 'CERTIFICATE_INFORMATION', 'PRODUCT_INFORMATION', 'GENERAL');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('VISIBLE', 'HIDDEN', 'REMOVED');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('WRONG_INGREDIENTS', 'WRONG_PRODUCT_FOR_BARCODE', 'CERTIFICATE_EXPIRED', 'WRONG_HALAL_STATUS', 'PACKAGING_CHANGED', 'SUSPICIOUS_REVIEW', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "FindingType" AS ENUM ('HARAM_INGREDIENT', 'MUSHBOOH_INGREDIENT', 'HALAL_INGREDIENT', 'UNKNOWN_INGREDIENT', 'E_NUMBER', 'CERTIFICATE', 'PRODUCT_LABEL', 'CONFLICT', 'MISSING_DATA');

-- CreateEnum
CREATE TYPE "OcrStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CONFIRMED', 'DISCARDED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT,
    "image" TEXT,
    "passwordHash" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "reputationScore" INTEGER NOT NULL DEFAULT 0,
    "verifiedContributor" BOOLEAN NOT NULL DEFAULT false,
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
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "url" TEXT,
    "country" TEXT,
    "sourceType" "SourceType" NOT NULL,
    "description" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "certificationBodyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertificationBody" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "country" TEXT,
    "website" TEXT,
    "logoUrl" TEXT,
    "official" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "hasImportedRulings" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertificationBody_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ENumber" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "defaultStatus" "HalalStatus" NOT NULL DEFAULT 'UNKNOWN',
    "defaultConfidence" "ConfidenceLevel" NOT NULL DEFAULT 'LOW',
    "originRisk" "OriginRisk" NOT NULL DEFAULT 'UNKNOWN',
    "animalDerivedPossible" BOOLEAN NOT NULL DEFAULT false,
    "plantDerivedPossible" BOOLEAN NOT NULL DEFAULT false,
    "syntheticPossible" BOOLEAN NOT NULL DEFAULT false,
    "microbialPossible" BOOLEAN NOT NULL DEFAULT false,
    "possibleSources" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ENumber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ENumberSource" (
    "id" TEXT NOT NULL,
    "eNumberId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "note" TEXT,
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ENumberSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ENumberRuling" (
    "id" TEXT NOT NULL,
    "eNumberId" TEXT NOT NULL,
    "certificationBodyId" TEXT NOT NULL,
    "status" "HalalStatus" NOT NULL,
    "confidence" "ConfidenceLevel" NOT NULL DEFAULT 'MEDIUM',
    "reason" TEXT,
    "sourceId" TEXT,
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ENumberRuling_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ingredient" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "description" TEXT,
    "category" "IngredientCategory" NOT NULL DEFAULT 'UNKNOWN',
    "defaultStatus" "HalalStatus" NOT NULL DEFAULT 'UNKNOWN',
    "defaultConfidence" "ConfidenceLevel" NOT NULL DEFAULT 'LOW',
    "originRisk" "OriginRisk" NOT NULL DEFAULT 'UNKNOWN',
    "eNumberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngredientAlias" (
    "id" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "locale" TEXT,

    CONSTRAINT "IngredientAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngredientSource" (
    "id" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "note" TEXT,
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngredientSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngredientRuling" (
    "id" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "certificationBodyId" TEXT NOT NULL,
    "status" "HalalStatus" NOT NULL,
    "confidence" "ConfidenceLevel" NOT NULL DEFAULT 'MEDIUM',
    "reason" TEXT,
    "sourceId" TEXT,
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngredientRuling_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "website" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "name" TEXT,
    "brandName" TEXT,
    "brandId" TEXT,
    "imageUrl" TEXT,
    "ingredientsRaw" TEXT,
    "ingredientsLang" TEXT,
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "labels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "countries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allergens" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "externalSource" "ExternalSource",
    "externalId" TEXT,
    "externalUpdatedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "sourceConfidence" "ConfidenceLevel" NOT NULL DEFAULT 'MEDIUM',
    "ingredientsOrigin" "IngredientOrigin",
    "revision" INTEGER NOT NULL DEFAULT 0,
    "halalStatus" "HalalStatus" NOT NULL DEFAULT 'UNKNOWN',
    "confidenceLevel" "ConfidenceLevel" NOT NULL DEFAULT 'LOW',
    "analysisVersion" TEXT,
    "lastAnalyzedAt" TIMESTAMP(3),
    "needsHumanReview" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductRevision" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "changedFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "name" TEXT,
    "brandName" TEXT,
    "imageUrl" TEXT,
    "ingredientsRaw" TEXT,
    "ingredientsLang" TEXT,
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "labels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "countries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allergens" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ingredientsHash" TEXT,
    "externalSource" "ExternalSource",
    "externalId" TEXT,
    "externalUpdatedAt" TIMESTAMP(3),
    "ingredientsOrigin" "IngredientOrigin",
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductIngredient" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "ingredientId" TEXT,
    "rawName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "quantityText" TEXT,
    "origin" "IngredientOrigin" NOT NULL DEFAULT 'OPEN_FOOD_FACTS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAnalysis" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "status" "HalalStatus" NOT NULL,
    "confidence" "ConfidenceLevel" NOT NULL,
    "summary" TEXT NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "hasConflict" BOOLEAN NOT NULL DEFAULT false,
    "productRevisionId" TEXT,
    "triggeredByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisFinding" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "findingType" "FindingType" NOT NULL,
    "status" "HalalStatus" NOT NULL,
    "confidence" "ConfidenceLevel" NOT NULL,
    "label" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "ingredientId" TEXT,
    "eNumberId" TEXT,
    "certificateId" TEXT,
    "sourceId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "brandId" TEXT,
    "certificateNumber" TEXT NOT NULL,
    "certificationBodyId" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "documentKey" TEXT,
    "documentMimeType" TEXT,
    "documentSizeBytes" INTEGER,
    "scope" TEXT,
    "status" "CertificateStatus" NOT NULL DEFAULT 'PENDING',
    "uploadedByUserId" TEXT NOT NULL,
    "verifiedByUserId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityReview" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reviewType" "ReviewType" NOT NULL DEFAULT 'GENERAL',
    "content" TEXT NOT NULL,
    "evidenceUrl" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "status" "ReviewStatus" NOT NULL DEFAULT 'VISIBLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewVote" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vote" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT,
    "reviewId" TEXT,
    "certificateId" TEXT,
    "type" "ReportType" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolutionNote" TEXT,
    "resolvedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OcrSubmission" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "barcode" TEXT,
    "productId" TEXT,
    "imageKey" TEXT NOT NULL,
    "imageMimeType" TEXT NOT NULL,
    "imageSizeBytes" INTEGER NOT NULL,
    "provider" TEXT,
    "rawText" TEXT,
    "extractedIngredients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "confirmedIngredients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "OcrStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "OcrSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "barcode" TEXT NOT NULL,
    "productId" TEXT,
    "found" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScanEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "event" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

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
CREATE INDEX "Source_sourceType_idx" ON "Source"("sourceType");

-- CreateIndex
CREATE UNIQUE INDEX "Source_name_organization_key" ON "Source"("name", "organization");

-- CreateIndex
CREATE UNIQUE INDEX "CertificationBody_name_key" ON "CertificationBody"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CertificationBody_slug_key" ON "CertificationBody"("slug");

-- CreateIndex
CREATE INDEX "CertificationBody_active_idx" ON "CertificationBody"("active");

-- CreateIndex
CREATE UNIQUE INDEX "ENumber_code_key" ON "ENumber"("code");

-- CreateIndex
CREATE INDEX "ENumber_defaultStatus_idx" ON "ENumber"("defaultStatus");

-- CreateIndex
CREATE INDEX "ENumberSource_sourceId_idx" ON "ENumberSource"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "ENumberSource_eNumberId_sourceId_key" ON "ENumberSource"("eNumberId", "sourceId");

-- CreateIndex
CREATE INDEX "ENumberRuling_certificationBodyId_idx" ON "ENumberRuling"("certificationBodyId");

-- CreateIndex
CREATE UNIQUE INDEX "ENumberRuling_eNumberId_certificationBodyId_key" ON "ENumberRuling"("eNumberId", "certificationBodyId");

-- CreateIndex
CREATE UNIQUE INDEX "Ingredient_normalizedName_key" ON "Ingredient"("normalizedName");

-- CreateIndex
CREATE INDEX "Ingredient_defaultStatus_idx" ON "Ingredient"("defaultStatus");

-- CreateIndex
CREATE INDEX "Ingredient_eNumberId_idx" ON "Ingredient"("eNumberId");

-- CreateIndex
CREATE UNIQUE INDEX "IngredientAlias_alias_key" ON "IngredientAlias"("alias");

-- CreateIndex
CREATE INDEX "IngredientAlias_ingredientId_idx" ON "IngredientAlias"("ingredientId");

-- CreateIndex
CREATE INDEX "IngredientSource_sourceId_idx" ON "IngredientSource"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "IngredientSource_ingredientId_sourceId_key" ON "IngredientSource"("ingredientId", "sourceId");

-- CreateIndex
CREATE INDEX "IngredientRuling_certificationBodyId_idx" ON "IngredientRuling"("certificationBodyId");

-- CreateIndex
CREATE UNIQUE INDEX "IngredientRuling_ingredientId_certificationBodyId_key" ON "IngredientRuling"("ingredientId", "certificationBodyId");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_normalizedName_key" ON "Brand"("normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "Product_barcode_key" ON "Product"("barcode");

-- CreateIndex
CREATE INDEX "Product_name_idx" ON "Product"("name");

-- CreateIndex
CREATE INDEX "Product_brandId_idx" ON "Product"("brandId");

-- CreateIndex
CREATE INDEX "Product_halalStatus_idx" ON "Product"("halalStatus");

-- CreateIndex
CREATE INDEX "Product_lastAnalyzedAt_idx" ON "Product"("lastAnalyzedAt");

-- CreateIndex
CREATE INDEX "Product_lastSyncedAt_idx" ON "Product"("lastSyncedAt");

-- CreateIndex
CREATE INDEX "ProductRevision_productId_createdAt_idx" ON "ProductRevision"("productId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductRevision_productId_revision_key" ON "ProductRevision"("productId", "revision");

-- CreateIndex
CREATE INDEX "ProductIngredient_ingredientId_idx" ON "ProductIngredient"("ingredientId");

-- CreateIndex
CREATE INDEX "ProductIngredient_normalizedName_idx" ON "ProductIngredient"("normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "ProductIngredient_productId_position_key" ON "ProductIngredient"("productId", "position");

-- CreateIndex
CREATE INDEX "ProductAnalysis_productId_createdAt_idx" ON "ProductAnalysis"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "ProductAnalysis_engineVersion_idx" ON "ProductAnalysis"("engineVersion");

-- CreateIndex
CREATE INDEX "AnalysisFinding_analysisId_position_idx" ON "AnalysisFinding"("analysisId", "position");

-- CreateIndex
CREATE INDEX "AnalysisFinding_findingType_idx" ON "AnalysisFinding"("findingType");

-- CreateIndex
CREATE INDEX "Certificate_productId_status_idx" ON "Certificate"("productId", "status");

-- CreateIndex
CREATE INDEX "Certificate_brandId_status_idx" ON "Certificate"("brandId", "status");

-- CreateIndex
CREATE INDEX "Certificate_status_expiresAt_idx" ON "Certificate"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_certificationBodyId_certificateNumber_key" ON "Certificate"("certificationBodyId", "certificateNumber");

-- CreateIndex
CREATE INDEX "CommunityReview_productId_createdAt_idx" ON "CommunityReview"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityReview_userId_idx" ON "CommunityReview"("userId");

-- CreateIndex
CREATE INDEX "CommunityReview_status_idx" ON "CommunityReview"("status");

-- CreateIndex
CREATE INDEX "ReviewVote_userId_idx" ON "ReviewVote"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewVote_reviewId_userId_key" ON "ReviewVote"("reviewId", "userId");

-- CreateIndex
CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Report_productId_idx" ON "Report"("productId");

-- CreateIndex
CREATE INDEX "Report_userId_idx" ON "Report"("userId");

-- CreateIndex
CREATE INDEX "OcrSubmission_status_createdAt_idx" ON "OcrSubmission"("status", "createdAt");

-- CreateIndex
CREATE INDEX "OcrSubmission_userId_idx" ON "OcrSubmission"("userId");

-- CreateIndex
CREATE INDEX "Favorite_productId_idx" ON "Favorite"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_productId_key" ON "Favorite"("userId", "productId");

-- CreateIndex
CREATE INDEX "ScanEvent_barcode_idx" ON "ScanEvent"("barcode");

-- CreateIndex
CREATE INDEX "ScanEvent_userId_createdAt_idx" ON "ScanEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Source" ADD CONSTRAINT "Source_certificationBodyId_fkey" FOREIGN KEY ("certificationBodyId") REFERENCES "CertificationBody"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ENumberSource" ADD CONSTRAINT "ENumberSource_eNumberId_fkey" FOREIGN KEY ("eNumberId") REFERENCES "ENumber"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ENumberSource" ADD CONSTRAINT "ENumberSource_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ENumberRuling" ADD CONSTRAINT "ENumberRuling_eNumberId_fkey" FOREIGN KEY ("eNumberId") REFERENCES "ENumber"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ENumberRuling" ADD CONSTRAINT "ENumberRuling_certificationBodyId_fkey" FOREIGN KEY ("certificationBodyId") REFERENCES "CertificationBody"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ENumberRuling" ADD CONSTRAINT "ENumberRuling_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ingredient" ADD CONSTRAINT "Ingredient_eNumberId_fkey" FOREIGN KEY ("eNumberId") REFERENCES "ENumber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientAlias" ADD CONSTRAINT "IngredientAlias_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientSource" ADD CONSTRAINT "IngredientSource_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientSource" ADD CONSTRAINT "IngredientSource_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientRuling" ADD CONSTRAINT "IngredientRuling_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientRuling" ADD CONSTRAINT "IngredientRuling_certificationBodyId_fkey" FOREIGN KEY ("certificationBodyId") REFERENCES "CertificationBody"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientRuling" ADD CONSTRAINT "IngredientRuling_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRevision" ADD CONSTRAINT "ProductRevision_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductIngredient" ADD CONSTRAINT "ProductIngredient_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductIngredient" ADD CONSTRAINT "ProductIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAnalysis" ADD CONSTRAINT "ProductAnalysis_triggeredByUserId_fkey" FOREIGN KEY ("triggeredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAnalysis" ADD CONSTRAINT "ProductAnalysis_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAnalysis" ADD CONSTRAINT "ProductAnalysis_productRevisionId_fkey" FOREIGN KEY ("productRevisionId") REFERENCES "ProductRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisFinding" ADD CONSTRAINT "AnalysisFinding_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "ProductAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisFinding" ADD CONSTRAINT "AnalysisFinding_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisFinding" ADD CONSTRAINT "AnalysisFinding_eNumberId_fkey" FOREIGN KEY ("eNumberId") REFERENCES "ENumber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisFinding" ADD CONSTRAINT "AnalysisFinding_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisFinding" ADD CONSTRAINT "AnalysisFinding_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_certificationBodyId_fkey" FOREIGN KEY ("certificationBodyId") REFERENCES "CertificationBody"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityReview" ADD CONSTRAINT "CommunityReview_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityReview" ADD CONSTRAINT "CommunityReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewVote" ADD CONSTRAINT "ReviewVote_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "CommunityReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewVote" ADD CONSTRAINT "ReviewVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "CommunityReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OcrSubmission" ADD CONSTRAINT "OcrSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OcrSubmission" ADD CONSTRAINT "OcrSubmission_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanEvent" ADD CONSTRAINT "ScanEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanEvent" ADD CONSTRAINT "ScanEvent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- CHECK constraints die Prisma niet declaratief kan uitdrukken.
-- Deze regels zijn te belangrijk om alleen in applicatiecode te bewaken.
-- ---------------------------------------------------------------------------

-- Een certificaat hoort bij precies een product OF een merk, nooit bij beide
-- en nooit bij geen van beide.
ALTER TABLE "Certificate"
  ADD CONSTRAINT "Certificate_product_xor_brand"
  CHECK (("productId" IS NOT NULL) <> ("brandId" IS NOT NULL));

-- Een stem is +1 of -1. Voorkomt dat een bug of een ongevalideerde route een
-- willekeurig gewicht in de score schrijft.
ALTER TABLE "ReviewVote"
  ADD CONSTRAINT "ReviewVote_vote_is_plus_or_minus_one"
  CHECK ("vote" IN (-1, 1));

-- Een melding moet ergens over gaan.
ALTER TABLE "Report"
  ADD CONSTRAINT "Report_has_target"
  CHECK (
    "productId" IS NOT NULL
    OR "reviewId" IS NOT NULL
    OR "certificateId" IS NOT NULL
  );

-- Een certificaat kan niet verlopen voordat het is uitgegeven.
ALTER TABLE "Certificate"
  ADD CONSTRAINT "Certificate_expires_after_issue"
  CHECK ("issuedAt" IS NULL OR "expiresAt" IS NULL OR "expiresAt" >= "issuedAt");
