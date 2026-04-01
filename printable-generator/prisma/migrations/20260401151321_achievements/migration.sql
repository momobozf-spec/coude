-- CreateTable
CREATE TABLE "badges" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_nl" TEXT,
    "description" TEXT NOT NULL,
    "icon_emoji" TEXT NOT NULL DEFAULT '⭐',
    "color" TEXT NOT NULL DEFAULT '#c9920a',
    "category" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "requirement" TEXT NOT NULL DEFAULT '{}',
    "xp_reward" INTEGER NOT NULL DEFAULT 10,
    "is_secret" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "user_badges" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "badge_id" TEXT NOT NULL,
    "earned_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_badges_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "badges" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "certificates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "child_name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "badge_id" TEXT,
    "public_token" TEXT NOT NULL,
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "share_count" INTEGER NOT NULL DEFAULT 0,
    "issued_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "certificates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_progress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "total_xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "worksheets_completed" INTEGER NOT NULL DEFAULT 0,
    "courses_completed" INTEGER NOT NULL DEFAULT 0,
    "ramadan_days_complete" INTEGER NOT NULL DEFAULT 0,
    "current_streak" INTEGER NOT NULL DEFAULT 0,
    "longest_streak" INTEGER NOT NULL DEFAULT 0,
    "last_activity_date" DATETIME,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "user_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "badges_slug_key" ON "badges"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "user_badges_user_id_badge_id_key" ON "user_badges"("user_id", "badge_id");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_public_token_key" ON "certificates"("public_token");

-- CreateIndex
CREATE UNIQUE INDEX "user_progress_user_id_key" ON "user_progress"("user_id");
