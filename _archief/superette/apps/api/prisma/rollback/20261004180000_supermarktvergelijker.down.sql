-- DropForeignKey
ALTER TABLE "StoreLocation" DROP CONSTRAINT "StoreLocation_storeChainId_fkey";

-- DropForeignKey
ALTER TABLE "CatalogCategory" DROP CONSTRAINT "CatalogCategory_parentId_fkey";

-- DropForeignKey
ALTER TABLE "CatalogProduct" DROP CONSTRAINT "CatalogProduct_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "StoreProduct" DROP CONSTRAINT "StoreProduct_storeChainId_fkey";

-- DropForeignKey
ALTER TABLE "StoreProduct" DROP CONSTRAINT "StoreProduct_catalogProductId_fkey";

-- DropForeignKey
ALTER TABLE "ProductOffer" DROP CONSTRAINT "ProductOffer_storeProductId_fkey";

-- DropForeignKey
ALTER TABLE "ProductOffer" DROP CONSTRAINT "ProductOffer_storeChainId_fkey";

-- DropForeignKey
ALTER TABLE "ProductOffer" DROP CONSTRAINT "ProductOffer_storeLocationId_fkey";

-- DropForeignKey
ALTER TABLE "PriceHistory" DROP CONSTRAINT "PriceHistory_storeProductId_fkey";

-- DropForeignKey
ALTER TABLE "PriceHistory" DROP CONSTRAINT "PriceHistory_storeChainId_fkey";

-- DropForeignKey
ALTER TABLE "PriceHistory" DROP CONSTRAINT "PriceHistory_storeLocationId_fkey";

-- DropForeignKey
ALTER TABLE "ProductMatch" DROP CONSTRAINT "ProductMatch_productId_fkey";

-- DropForeignKey
ALTER TABLE "ProductMatch" DROP CONSTRAINT "ProductMatch_relatedProductId_fkey";

-- DropForeignKey
ALTER TABLE "ProductMatchReport" DROP CONSTRAINT "ProductMatchReport_productMatchId_fkey";

-- DropForeignKey
ALTER TABLE "ProductMatchReport" DROP CONSTRAINT "ProductMatchReport_userId_fkey";

-- DropForeignKey
ALTER TABLE "ShoppingList" DROP CONSTRAINT "ShoppingList_userId_fkey";

-- DropForeignKey
ALTER TABLE "ShoppingListItem" DROP CONSTRAINT "ShoppingListItem_listId_fkey";

-- DropForeignKey
ALTER TABLE "ShoppingListItem" DROP CONSTRAINT "ShoppingListItem_catalogProductId_fkey";

-- DropForeignKey
ALTER TABLE "ComparePreference" DROP CONSTRAINT "ComparePreference_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserChainPreference" DROP CONSTRAINT "UserChainPreference_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserChainPreference" DROP CONSTRAINT "UserChainPreference_storeChainId_fkey";

-- DropForeignKey
ALTER TABLE "UserFavoriteLocation" DROP CONSTRAINT "UserFavoriteLocation_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserFavoriteLocation" DROP CONSTRAINT "UserFavoriteLocation_storeLocationId_fkey";

-- DropForeignKey
ALTER TABLE "PriceAlert" DROP CONSTRAINT "PriceAlert_userId_fkey";

-- DropForeignKey
ALTER TABLE "PriceAlert" DROP CONSTRAINT "PriceAlert_catalogProductId_fkey";

-- DropForeignKey
ALTER TABLE "PriceAlert" DROP CONSTRAINT "PriceAlert_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "PriceAlertStore" DROP CONSTRAINT "PriceAlertStore_priceAlertId_fkey";

-- DropForeignKey
ALTER TABLE "PriceAlertStore" DROP CONSTRAINT "PriceAlertStore_storeChainId_fkey";

-- DropForeignKey
ALTER TABLE "PriceAlertStore" DROP CONSTRAINT "PriceAlertStore_storeLocationId_fkey";

-- DropForeignKey
ALTER TABLE "AlertNotification" DROP CONSTRAINT "AlertNotification_priceAlertId_fkey";

-- DropForeignKey
ALTER TABLE "AlertNotification" DROP CONSTRAINT "AlertNotification_productOfferId_fkey";

-- DropForeignKey
ALTER TABLE "AlertNotification" DROP CONSTRAINT "AlertNotification_userId_fkey";

-- DropForeignKey
ALTER TABLE "ImportRun" DROP CONSTRAINT "ImportRun_storeChainId_fkey";

-- DropTable
DROP TABLE "StoreChain";

-- DropTable
DROP TABLE "StoreLocation";

-- DropTable
DROP TABLE "CatalogCategory";

-- DropTable
DROP TABLE "CatalogProduct";

-- DropTable
DROP TABLE "StoreProduct";

-- DropTable
DROP TABLE "ProductOffer";

-- DropTable
DROP TABLE "PriceHistory";

-- DropTable
DROP TABLE "ProductMatch";

-- DropTable
DROP TABLE "ProductMatchReport";

-- DropTable
DROP TABLE "ShoppingList";

-- DropTable
DROP TABLE "ShoppingListItem";

-- DropTable
DROP TABLE "ComparePreference";

-- DropTable
DROP TABLE "UserChainPreference";

-- DropTable
DROP TABLE "UserFavoriteLocation";

-- DropTable
DROP TABLE "PriceAlert";

-- DropTable
DROP TABLE "PriceAlertStore";

-- DropTable
DROP TABLE "AlertNotification";

-- DropTable
DROP TABLE "ImportRun";

-- DropEnum
DROP TYPE "PackageUnit";

-- DropEnum
DROP TYPE "NormalizedUnit";

-- DropEnum
DROP TYPE "PromotionType";

-- DropEnum
DROP TYPE "OfferChannel";

-- DropEnum
DROP TYPE "DataSourceKind";

-- DropEnum
DROP TYPE "BrandType";

-- DropEnum
DROP TYPE "Availability";

-- DropEnum
DROP TYPE "ProductMatchType";

-- DropEnum
DROP TYPE "ProductMatchStatus";

-- DropEnum
DROP TYPE "AlertComparisonType";

-- DropEnum
DROP TYPE "AlertMatchPreference";

-- DropEnum
DROP TYPE "NotificationChannel";

-- DropEnum
DROP TYPE "PriceAlertStatus";

-- DropEnum
DROP TYPE "NotificationStatus";

-- DropEnum
DROP TYPE "ImportRunStatus";

