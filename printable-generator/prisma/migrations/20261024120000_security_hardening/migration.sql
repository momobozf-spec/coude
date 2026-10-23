-- Platform role for admin checks (replaces shared x-admin-password header)
ALTER TABLE "users" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'user';
-- Registration consent (terms + privacy, adult/guardian confirmation)
ALTER TABLE "users" ADD COLUMN "terms_accepted_at" DATETIME;

-- Webhook idempotency log
CREATE TABLE "processed_webhook_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
