-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'landing',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL DEFAULT '',
    "image" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "user_type" TEXT NOT NULL DEFAULT 'parent',
    "school_name" TEXT,
    "generations_count" INTEGER NOT NULL DEFAULT 0,
    "bonus_generations" INTEGER NOT NULL DEFAULT 0,
    "stripe_customer_id" TEXT,
    "stripe_subscription_id" TEXT,
    "referral_code" TEXT,
    "referred_by" TEXT,
    "referral_count" INTEGER NOT NULL DEFAULT 0,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_users" ("created_at", "email", "generations_count", "id", "image", "locale", "name", "password", "plan", "stripe_customer_id", "stripe_subscription_id", "updated_at") SELECT "created_at", "email", "generations_count", "id", "image", "locale", "name", "password", "plan", "stripe_customer_id", "stripe_subscription_id", "updated_at" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_referral_code_key" ON "users"("referral_code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "leads_email_key" ON "leads"("email");
