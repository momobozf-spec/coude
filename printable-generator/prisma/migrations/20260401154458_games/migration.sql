-- CreateTable
CREATE TABLE "game_scores" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "game_slug" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "played_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "game_scores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "game_stats" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "memory_plays" INTEGER NOT NULL DEFAULT 0,
    "memory_best" INTEGER NOT NULL DEFAULT 0,
    "arabic_plays" INTEGER NOT NULL DEFAULT 0,
    "arabic_best" INTEGER NOT NULL DEFAULT 0,
    "kaaba_plays" INTEGER NOT NULL DEFAULT 0,
    "kaaba_best" INTEGER NOT NULL DEFAULT 0,
    "total_game_xp" INTEGER NOT NULL DEFAULT 0,
    "total_plays" INTEGER NOT NULL DEFAULT 0,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "game_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "game_stats_user_id_key" ON "game_stats"("user_id");
