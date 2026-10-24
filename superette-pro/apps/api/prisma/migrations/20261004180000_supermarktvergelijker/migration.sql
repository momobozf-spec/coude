-- CreateEnum
CREATE TYPE "PackageUnit" AS ENUM ('G', 'KG', 'ML', 'CL', 'L', 'PIECE');

-- CreateEnum
CREATE TYPE "NormalizedUnit" AS ENUM ('KG', 'L', 'PIECE');

-- CreateEnum
CREATE TYPE "PromotionType" AS ENUM ('NONE', 'TEMPORARY', 'LOYALTY_CARD', 'PERSONALIZED', 'MULTIBUY', 'VOLUME_DISCOUNT', 'BUY_X_GET_Y', 'PERCENTAGE', 'ONLINE_ONLY', 'REGIONAL');

-- CreateEnum
CREATE TYPE "OfferChannel" AS ENUM ('IN_STORE', 'ONLINE', 'BOTH');

-- CreateEnum
CREATE TYPE "DataSourceKind" AS ENUM ('DEMO', 'IMPORT_FILE', 'OFFICIAL_API', 'MERCHANT_FEED', 'MANUAL');

-- CreateEnum
CREATE TYPE "BrandType" AS ENUM ('NATIONAL_BRAND', 'STORE_BRAND', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "Availability" AS ENUM ('IN_STOCK', 'OUT_OF_STOCK', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ProductMatchType" AS ENUM ('EXACT', 'EQUIVALENT', 'ALTERNATIVE', 'UNCERTAIN');

-- CreateEnum
CREATE TYPE "ProductMatchStatus" AS ENUM ('AUTO', 'CONFIRMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AlertComparisonType" AS ENUM ('PACKAGE_PRICE', 'UNIT_PRICE', 'DISCOUNT_PERCENTAGE');

-- CreateEnum
CREATE TYPE "AlertMatchPreference" AS ENUM ('EXACT', 'EQUIVALENT', 'ALTERNATIVE');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL');

-- CreateEnum
CREATE TYPE "PriceAlertStatus" AS ENUM ('ACTIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ImportRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED');

-- CreateTable
CREATE TABLE "StoreChain" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "adapterKey" TEXT NOT NULL,
    "logoUrl" TEXT,
    "websiteUrl" TEXT,
    "loyaltyCardName" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreChain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreLocation" (
    "id" TEXT NOT NULL,
    "storeChainId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "serviceArea" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogCategory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameNl" TEXT NOT NULL,
    "nameFr" TEXT NOT NULL,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CatalogCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogProduct" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "brand" TEXT,
    "normalizedBrand" TEXT,
    "brandType" "BrandType" NOT NULL DEFAULT 'UNKNOWN',
    "categoryId" TEXT,
    "imageUrl" TEXT,
    "description" TEXT,
    "barcode" TEXT,
    "packageQuantity" DOUBLE PRECISION,
    "packageUnit" "PackageUnit",
    "packCount" INTEGER NOT NULL DEFAULT 1,
    "normalizedQuantity" INTEGER,
    "normalizedUnit" "NormalizedUnit",
    "matchKey" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreProduct" (
    "id" TEXT NOT NULL,
    "storeChainId" TEXT NOT NULL,
    "catalogProductId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "imageUrl" TEXT,
    "productUrl" TEXT,
    "barcode" TEXT,
    "categoryPath" TEXT,
    "packageQuantity" DOUBLE PRECISION,
    "packageUnit" "PackageUnit",
    "packCount" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductOffer" (
    "id" TEXT NOT NULL,
    "storeProductId" TEXT NOT NULL,
    "storeChainId" TEXT NOT NULL,
    "storeLocationId" TEXT,
    "priceCents" INTEGER NOT NULL,
    "originalPriceCents" INTEGER,
    "unitPriceCents" INTEGER,
    "unitType" "NormalizedUnit",
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "promotionType" "PromotionType" NOT NULL DEFAULT 'NONE',
    "promotionText" TEXT,
    "promotionRule" JSONB,
    "conditions" TEXT,
    "requiresLoyaltyCard" BOOLEAN NOT NULL DEFAULT false,
    "isPersonalized" BOOLEAN NOT NULL DEFAULT false,
    "channel" "OfferChannel" NOT NULL DEFAULT 'BOTH',
    "minimumQuantity" INTEGER NOT NULL DEFAULT 1,
    "depositCents" INTEGER,
    "availability" "Availability" NOT NULL DEFAULT 'UNKNOWN',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "observedAt" TIMESTAMP(3) NOT NULL,
    "source" "DataSourceKind" NOT NULL,
    "sourceLabel" TEXT NOT NULL,
    "sourceReference" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" TEXT NOT NULL,
    "storeProductId" TEXT NOT NULL,
    "storeChainId" TEXT NOT NULL,
    "storeLocationId" TEXT,
    "priceCents" INTEGER NOT NULL,
    "originalPriceCents" INTEGER,
    "unitPriceCents" INTEGER,
    "promotionType" "PromotionType" NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "source" "DataSourceKind" NOT NULL,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductMatch" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "relatedProductId" TEXT NOT NULL,
    "matchType" "ProductMatchType" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "status" "ProductMatchStatus" NOT NULL DEFAULT 'AUTO',
    "reason" TEXT,
    "confirmedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductMatchReport" (
    "id" TEXT NOT NULL,
    "productMatchId" TEXT NOT NULL,
    "userId" TEXT,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductMatchReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShoppingList" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShoppingList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShoppingListItem" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "catalogProductId" TEXT,
    "freeText" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "exactBrandRequired" BOOLEAN NOT NULL DEFAULT false,
    "allowStoreBrand" BOOLEAN NOT NULL DEFAULT true,
    "allowAlternatives" BOOLEAN NOT NULL DEFAULT true,
    "maxPriceCents" INTEGER,
    "preferredChainSlug" TEXT,
    "desiredPackageLabel" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShoppingListItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComparePreference" (
    "userId" TEXT NOT NULL,
    "postalCode" TEXT,
    "municipality" TEXT,
    "maxDistanceKm" INTEGER,
    "preferStoreBrands" BOOLEAN NOT NULL DEFAULT false,
    "preferNationalBrands" BOOLEAN NOT NULL DEFAULT false,
    "allowAlternatives" BOOLEAN NOT NULL DEFAULT true,
    "includePersonalizedOffers" BOOLEAN NOT NULL DEFAULT false,
    "includeOnlineOffers" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComparePreference_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "UserChainPreference" (
    "userId" TEXT NOT NULL,
    "storeChainId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "hasLoyaltyCard" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "UserChainPreference_pkey" PRIMARY KEY ("userId","storeChainId")
);

-- CreateTable
CREATE TABLE "UserFavoriteLocation" (
    "userId" TEXT NOT NULL,
    "storeLocationId" TEXT NOT NULL,

    CONSTRAINT "UserFavoriteLocation_pkey" PRIMARY KEY ("userId","storeLocationId")
);

-- CreateTable
CREATE TABLE "PriceAlert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "catalogProductId" TEXT,
    "categoryId" TEXT,
    "targetPriceCents" INTEGER,
    "minimumDiscountPercentage" INTEGER,
    "comparisonType" "AlertComparisonType" NOT NULL,
    "matchPreference" "AlertMatchPreference" NOT NULL DEFAULT 'EXACT',
    "notificationChannel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "status" "PriceAlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "includeLoyaltyOffers" BOOLEAN NOT NULL DEFAULT true,
    "includePersonalizedOffers" BOOLEAN NOT NULL DEFAULT false,
    "includeOnlineOffers" BOOLEAN NOT NULL DEFAULT true,
    "armed" BOOLEAN NOT NULL DEFAULT true,
    "lastCheckedAt" TIMESTAMP(3),
    "lastTriggeredAt" TIMESTAMP(3),
    "lastTriggeredPriceCents" INTEGER,
    "lastTriggeredOfferId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceAlertStore" (
    "id" TEXT NOT NULL,
    "priceAlertId" TEXT NOT NULL,
    "storeChainId" TEXT NOT NULL,
    "storeLocationId" TEXT,

    CONSTRAINT "PriceAlertStore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertNotification" (
    "id" TEXT NOT NULL,
    "priceAlertId" TEXT NOT NULL,
    "productOfferId" TEXT,
    "userId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "digestKey" TEXT NOT NULL,
    "triggeredPriceCents" INTEGER NOT NULL,
    "previousPriceCents" INTEGER,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRun" (
    "id" TEXT NOT NULL,
    "adapterKey" TEXT NOT NULL,
    "storeChainId" TEXT,
    "source" "DataSourceKind" NOT NULL,
    "status" "ImportRunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "productsSeen" INTEGER NOT NULL DEFAULT 0,
    "offersUpserted" INTEGER NOT NULL DEFAULT 0,
    "offersDeactivated" INTEGER NOT NULL DEFAULT 0,
    "historyAppended" INTEGER NOT NULL DEFAULT 0,
    "matchesCreated" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "note" TEXT,

    CONSTRAINT "ImportRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreChain_slug_key" ON "StoreChain"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "StoreChain_adapterKey_key" ON "StoreChain"("adapterKey");

-- CreateIndex
CREATE INDEX "StoreLocation_postalCode_idx" ON "StoreLocation"("postalCode");

-- CreateIndex
CREATE UNIQUE INDEX "StoreLocation_storeChainId_externalId_key" ON "StoreLocation"("storeChainId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogCategory_slug_key" ON "CatalogCategory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogProduct_barcode_key" ON "CatalogProduct"("barcode");

-- CreateIndex
CREATE INDEX "CatalogProduct_normalizedName_idx" ON "CatalogProduct"("normalizedName");

-- CreateIndex
CREATE INDEX "CatalogProduct_matchKey_idx" ON "CatalogProduct"("matchKey");

-- CreateIndex
CREATE INDEX "CatalogProduct_normalizedBrand_idx" ON "CatalogProduct"("normalizedBrand");

-- CreateIndex
CREATE INDEX "CatalogProduct_categoryId_active_idx" ON "CatalogProduct"("categoryId", "active");

-- CreateIndex
CREATE INDEX "StoreProduct_catalogProductId_idx" ON "StoreProduct"("catalogProductId");

-- CreateIndex
CREATE INDEX "StoreProduct_barcode_idx" ON "StoreProduct"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "StoreProduct_storeChainId_externalId_key" ON "StoreProduct"("storeChainId", "externalId");

-- CreateIndex
CREATE INDEX "ProductOffer_storeProductId_active_idx" ON "ProductOffer"("storeProductId", "active");

-- CreateIndex
CREATE INDEX "ProductOffer_storeChainId_active_promotionType_idx" ON "ProductOffer"("storeChainId", "active", "promotionType");

-- CreateIndex
CREATE INDEX "ProductOffer_endsAt_idx" ON "ProductOffer"("endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductOffer_storeChainId_sourceReference_key" ON "ProductOffer"("storeChainId", "sourceReference");

-- CreateIndex
CREATE INDEX "PriceHistory_storeProductId_observedAt_idx" ON "PriceHistory"("storeProductId", "observedAt");

-- CreateIndex
CREATE INDEX "PriceHistory_storeChainId_observedAt_idx" ON "PriceHistory"("storeChainId", "observedAt");

-- CreateIndex
CREATE INDEX "ProductMatch_relatedProductId_idx" ON "ProductMatch"("relatedProductId");

-- CreateIndex
CREATE INDEX "ProductMatch_status_matchType_idx" ON "ProductMatch"("status", "matchType");

-- CreateIndex
CREATE UNIQUE INDEX "ProductMatch_productId_relatedProductId_key" ON "ProductMatch"("productId", "relatedProductId");

-- CreateIndex
CREATE INDEX "ProductMatchReport_productMatchId_idx" ON "ProductMatchReport"("productMatchId");

-- CreateIndex
CREATE INDEX "ShoppingList_userId_archived_idx" ON "ShoppingList"("userId", "archived");

-- CreateIndex
CREATE INDEX "ShoppingListItem_listId_sortOrder_idx" ON "ShoppingListItem"("listId", "sortOrder");

-- CreateIndex
CREATE INDEX "PriceAlert_userId_status_idx" ON "PriceAlert"("userId", "status");

-- CreateIndex
CREATE INDEX "PriceAlert_status_catalogProductId_idx" ON "PriceAlert"("status", "catalogProductId");

-- CreateIndex
CREATE INDEX "PriceAlert_status_categoryId_idx" ON "PriceAlert"("status", "categoryId");

-- CreateIndex
CREATE INDEX "PriceAlertStore_storeChainId_idx" ON "PriceAlertStore"("storeChainId");

-- CreateIndex
CREATE UNIQUE INDEX "PriceAlertStore_priceAlertId_storeChainId_storeLocationId_key" ON "PriceAlertStore"("priceAlertId", "storeChainId", "storeLocationId");

-- CreateIndex
CREATE UNIQUE INDEX "AlertNotification_idempotencyKey_key" ON "AlertNotification"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AlertNotification_userId_createdAt_idx" ON "AlertNotification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AlertNotification_status_digestKey_idx" ON "AlertNotification"("status", "digestKey");

-- CreateIndex
CREATE INDEX "ImportRun_adapterKey_startedAt_idx" ON "ImportRun"("adapterKey", "startedAt");

-- AddForeignKey
ALTER TABLE "StoreLocation" ADD CONSTRAINT "StoreLocation_storeChainId_fkey" FOREIGN KEY ("storeChainId") REFERENCES "StoreChain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogCategory" ADD CONSTRAINT "CatalogCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CatalogCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogProduct" ADD CONSTRAINT "CatalogProduct_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CatalogCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreProduct" ADD CONSTRAINT "StoreProduct_storeChainId_fkey" FOREIGN KEY ("storeChainId") REFERENCES "StoreChain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreProduct" ADD CONSTRAINT "StoreProduct_catalogProductId_fkey" FOREIGN KEY ("catalogProductId") REFERENCES "CatalogProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOffer" ADD CONSTRAINT "ProductOffer_storeProductId_fkey" FOREIGN KEY ("storeProductId") REFERENCES "StoreProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOffer" ADD CONSTRAINT "ProductOffer_storeChainId_fkey" FOREIGN KEY ("storeChainId") REFERENCES "StoreChain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOffer" ADD CONSTRAINT "ProductOffer_storeLocationId_fkey" FOREIGN KEY ("storeLocationId") REFERENCES "StoreLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_storeProductId_fkey" FOREIGN KEY ("storeProductId") REFERENCES "StoreProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_storeChainId_fkey" FOREIGN KEY ("storeChainId") REFERENCES "StoreChain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_storeLocationId_fkey" FOREIGN KEY ("storeLocationId") REFERENCES "StoreLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMatch" ADD CONSTRAINT "ProductMatch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CatalogProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMatch" ADD CONSTRAINT "ProductMatch_relatedProductId_fkey" FOREIGN KEY ("relatedProductId") REFERENCES "CatalogProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMatchReport" ADD CONSTRAINT "ProductMatchReport_productMatchId_fkey" FOREIGN KEY ("productMatchId") REFERENCES "ProductMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMatchReport" ADD CONSTRAINT "ProductMatchReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingList" ADD CONSTRAINT "ShoppingList_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingListItem" ADD CONSTRAINT "ShoppingListItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "ShoppingList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingListItem" ADD CONSTRAINT "ShoppingListItem_catalogProductId_fkey" FOREIGN KEY ("catalogProductId") REFERENCES "CatalogProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparePreference" ADD CONSTRAINT "ComparePreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserChainPreference" ADD CONSTRAINT "UserChainPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserChainPreference" ADD CONSTRAINT "UserChainPreference_storeChainId_fkey" FOREIGN KEY ("storeChainId") REFERENCES "StoreChain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFavoriteLocation" ADD CONSTRAINT "UserFavoriteLocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFavoriteLocation" ADD CONSTRAINT "UserFavoriteLocation_storeLocationId_fkey" FOREIGN KEY ("storeLocationId") REFERENCES "StoreLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceAlert" ADD CONSTRAINT "PriceAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceAlert" ADD CONSTRAINT "PriceAlert_catalogProductId_fkey" FOREIGN KEY ("catalogProductId") REFERENCES "CatalogProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceAlert" ADD CONSTRAINT "PriceAlert_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CatalogCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceAlertStore" ADD CONSTRAINT "PriceAlertStore_priceAlertId_fkey" FOREIGN KEY ("priceAlertId") REFERENCES "PriceAlert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceAlertStore" ADD CONSTRAINT "PriceAlertStore_storeChainId_fkey" FOREIGN KEY ("storeChainId") REFERENCES "StoreChain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceAlertStore" ADD CONSTRAINT "PriceAlertStore_storeLocationId_fkey" FOREIGN KEY ("storeLocationId") REFERENCES "StoreLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertNotification" ADD CONSTRAINT "AlertNotification_priceAlertId_fkey" FOREIGN KEY ("priceAlertId") REFERENCES "PriceAlert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertNotification" ADD CONSTRAINT "AlertNotification_productOfferId_fkey" FOREIGN KEY ("productOfferId") REFERENCES "ProductOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertNotification" ADD CONSTRAINT "AlertNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRun" ADD CONSTRAINT "ImportRun_storeChainId_fkey" FOREIGN KEY ("storeChainId") REFERENCES "StoreChain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

