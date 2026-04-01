-- CreateTable
CREATE TABLE "ramadan_challenges" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "year" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "price" REAL NOT NULL DEFAULT 14.99,
    "early_price" REAL NOT NULL DEFAULT 9.99,
    "start_date" DATETIME NOT NULL,
    "end_date" DATETIME NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "challenge_days" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "challenge_id" TEXT NOT NULL,
    "day_number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "title_ar" TEXT NOT NULL DEFAULT '',
    "theme" TEXT NOT NULL,
    "activity_type" TEXT NOT NULL,
    "dua_of_day" TEXT,
    "hadith_of_day" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "challenge_days_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "ramadan_challenges" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "challenge_enrollments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "challenge_id" TEXT NOT NULL,
    "child_name" TEXT NOT NULL,
    "child_age" INTEGER NOT NULL DEFAULT 6,
    "price_paid" REAL NOT NULL DEFAULT 0,
    "badges_earned" TEXT NOT NULL DEFAULT '',
    "streak_days" INTEGER NOT NULL DEFAULT 0,
    "share_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "challenge_enrollments_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "ramadan_challenges" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "day_completions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "enrollment_id" TEXT NOT NULL,
    "day_id" TEXT NOT NULL,
    "completed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "day_completions_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "challenge_enrollments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "day_completions_day_id_fkey" FOREIGN KEY ("day_id") REFERENCES "challenge_days" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ramadan_challenges_year_key" ON "ramadan_challenges"("year");

-- CreateIndex
CREATE UNIQUE INDEX "challenge_days_challenge_id_day_number_key" ON "challenge_days"("challenge_id", "day_number");

-- CreateIndex
CREATE UNIQUE INDEX "challenge_enrollments_user_id_challenge_id_key" ON "challenge_enrollments"("user_id", "challenge_id");

-- CreateIndex
CREATE UNIQUE INDEX "day_completions_enrollment_id_day_id_key" ON "day_completions"("enrollment_id", "day_id");
