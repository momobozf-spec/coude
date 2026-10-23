DROP INDEX "delivery_digest_recipient_uq";--> statement-breakpoint
ALTER TABLE "email_delivery" ADD COLUMN "kind" text DEFAULT 'client' NOT NULL;--> statement-breakpoint
ALTER TABLE "email_delivery" ADD COLUMN "smtp_response" text;--> statement-breakpoint
ALTER TABLE "email_delivery" ADD COLUMN "handed_off_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_delivery" ADD COLUMN "delivery_state" text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "email_delivery" ADD COLUMN "delivery_state_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "delivery_digest_idx" ON "email_delivery" USING btree ("digest_id");--> statement-breakpoint
-- Datamigratie: "sent" betekende altijd "aanvaard door SMTP", nooit bevestigde aflevering.
UPDATE "email_delivery" SET "status" = 'handed_to_smtp', "handed_off_at" = "sent_at" WHERE "status" = 'sent';--> statement-breakpoint
UPDATE "email_delivery" SET "idempotency_key" = "digest_id"::text || ':client:' || "recipient" WHERE "kind" = 'client' AND "idempotency_key" = "digest_id"::text || ':' || "recipient";--> statement-breakpoint
UPDATE "digest" SET "status" = 'handed_to_smtp' WHERE "status" = 'sent';--> statement-breakpoint
UPDATE "digest" SET "status" = 'partially_handed' WHERE "status" = 'partially_sent';
