-- Feeds die via POST /api/v1/compare/internal/feeds/:chain worden aangeleverd.
-- Additief: geen wijziging aan bestaande tabellen.

-- CreateTable
CREATE TABLE "CompareFeed" (
    "adapterKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "sha256" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "productCount" INTEGER NOT NULL,
    "offerCount" INTEGER NOT NULL,
    "termsReviewed" BOOLEAN NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompareFeed_pkey" PRIMARY KEY ("adapterKey")
);
