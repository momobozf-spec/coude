-- CreateTable
CREATE TABLE "courses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "title_ar" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL,
    "thumbnail" TEXT NOT NULL DEFAULT '',
    "trailer_url" TEXT,
    "price" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "languages" TEXT NOT NULL DEFAULT 'EN',
    "age_range" TEXT NOT NULL DEFAULT '4-8',
    "level" TEXT NOT NULL DEFAULT 'beginner',
    "total_lessons" INTEGER NOT NULL DEFAULT 0,
    "total_minutes" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "category" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "lessons" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "course_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "video_url" TEXT NOT NULL DEFAULT '',
    "duration" INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_free" BOOLEAN NOT NULL DEFAULT false,
    "transcript" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lessons_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "stripe_session_id" TEXT,
    "price_paid" REAL NOT NULL DEFAULT 0,
    "completed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "enrollments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "enrollments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "lesson_progress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "watched_seconds" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" DATETIME,
    CONSTRAINT "lesson_progress_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "course_reviews" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "course_reviews_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "free_courses_redeemed" INTEGER NOT NULL DEFAULT 0,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_users" ("bonus_generations", "created_at", "email", "generations_count", "id", "image", "locale", "name", "password", "plan", "referral_code", "referral_count", "referred_by", "school_name", "stripe_customer_id", "stripe_subscription_id", "updated_at", "user_type") SELECT "bonus_generations", "created_at", "email", "generations_count", "id", "image", "locale", "name", "password", "plan", "referral_code", "referral_count", "referred_by", "school_name", "stripe_customer_id", "stripe_subscription_id", "updated_at", "user_type" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_referral_code_key" ON "users"("referral_code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "courses_slug_key" ON "courses"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_user_id_course_id_key" ON "enrollments"("user_id", "course_id");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_progress_user_id_lesson_id_key" ON "lesson_progress"("user_id", "lesson_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_reviews_user_id_course_id_key" ON "course_reviews"("user_id", "course_id");
