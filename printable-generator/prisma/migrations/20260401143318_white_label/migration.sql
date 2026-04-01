-- AlterTable
ALTER TABLE "users" ADD COLUMN "white_label_id" TEXT;
ALTER TABLE "users" ADD COLUMN "white_label_role" TEXT;

-- CreateTable
CREATE TABLE "white_label_accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subdomain" TEXT NOT NULL,
    "custom_domain" TEXT,
    "admin_user_id" TEXT NOT NULL,
    "logo_url" TEXT,
    "primary_color" TEXT NOT NULL DEFAULT '#1a6b4a',
    "secondary_color" TEXT NOT NULL DEFAULT '#c9920a',
    "school_name" TEXT NOT NULL,
    "school_name_ar" TEXT,
    "welcome_message" TEXT,
    "footer_text" TEXT,
    "country" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "student_count" INTEGER NOT NULL DEFAULT 0,
    "plan" TEXT NOT NULL DEFAULT 'basic',
    "max_seats" INTEGER NOT NULL DEFAULT 10,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "stripe_sub_id" TEXT,
    "expires_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "white_label_invites" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "account_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'teacher',
    "accepted" BOOLEAN NOT NULL DEFAULT false,
    "token" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "white_label_invites_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "white_label_accounts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "white_label_demos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "school_name" TEXT NOT NULL,
    "contact_email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "viewed" BOOLEAN NOT NULL DEFAULT false,
    "converted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "white_label_accounts_subdomain_key" ON "white_label_accounts"("subdomain");

-- CreateIndex
CREATE UNIQUE INDEX "white_label_invites_token_key" ON "white_label_invites"("token");

-- CreateIndex
CREATE UNIQUE INDEX "white_label_invites_account_id_email_key" ON "white_label_invites"("account_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "white_label_demos_token_key" ON "white_label_demos"("token");
