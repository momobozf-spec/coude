-- CreateTable
CREATE TABLE "marketplace_products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seller_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "thumbnail" TEXT NOT NULL DEFAULT '',
    "file_url" TEXT NOT NULL DEFAULT '',
    "preview_url" TEXT NOT NULL DEFAULT '',
    "price" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "category" TEXT NOT NULL,
    "age_range" TEXT NOT NULL DEFAULT '4-8',
    "languages" TEXT NOT NULL DEFAULT 'EN',
    "tags" TEXT NOT NULL DEFAULT '',
    "page_count" INTEGER NOT NULL DEFAULT 1,
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "rating" REAL NOT NULL DEFAULT 0,
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "is_approved" BOOLEAN NOT NULL DEFAULT false,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "marketplace_products_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "marketplace_purchases" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "buyer_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "price_paid" REAL NOT NULL,
    "seller_amount" REAL NOT NULL,
    "noor_amount" REAL NOT NULL,
    "stripe_session_id" TEXT NOT NULL DEFAULT '',
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "max_downloads" INTEGER NOT NULL DEFAULT 5,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "marketplace_purchases_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "marketplace_products" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "seller_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "bio" TEXT NOT NULL DEFAULT '',
    "avatar" TEXT,
    "country" TEXT NOT NULL DEFAULT '',
    "stripe_account_id" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "total_sales" INTEGER NOT NULL DEFAULT 0,
    "total_earnings" REAL NOT NULL DEFAULT 0,
    "payouts_pending" REAL NOT NULL DEFAULT 0,
    "payouts_paid" REAL NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "seller_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "marketplace_reviews" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "buyer_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "marketplace_reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "marketplace_products" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "seller_payouts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seller_id" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "stripe_transfer_id" TEXT,
    "period_start" DATETIME NOT NULL,
    "period_end" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_purchases_buyer_id_product_id_key" ON "marketplace_purchases"("buyer_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "seller_profiles_user_id_key" ON "seller_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_reviews_buyer_id_product_id_key" ON "marketplace_reviews"("buyer_id", "product_id");
