-- Extensions required for fuzzy/typo-tolerant search.
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE SCHEMA "app";
--> statement-breakpoint
CREATE SCHEMA "catalog";
--> statement-breakpoint
CREATE SCHEMA "ingest";
--> statement-breakpoint
CREATE TYPE "catalog"."base_unit" AS ENUM('g', 'ml', 'piece');--> statement-breakpoint
CREATE TYPE "catalog"."data_origin" AS ENUM('RETAILER_API', 'AFFILIATE_FEED', 'CROWDSOURCED', 'OPEN_DATA', 'USER_SUBMITTED', 'DEVELOPMENT_SEED');--> statement-breakpoint
CREATE TYPE "catalog"."equivalence_status" AS ENUM('SUGGESTED', 'CONFIRMED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "ingest"."ingest_stage" AS ENUM('FETCH', 'VALIDATION', 'NORMALIZATION', 'MATCHING', 'PERSIST', 'ALERTS');--> statement-breakpoint
CREATE TYPE "app"."list_member_role" AS ENUM('OWNER', 'EDITOR', 'VIEWER');--> statement-breakpoint
CREATE TYPE "catalog"."match_confidence" AS ENUM('EXACT', 'HIGH', 'MEDIUM', 'LOW', 'UNMATCHED');--> statement-breakpoint
CREATE TYPE "catalog"."match_method" AS ENUM('GTIN', 'CONFIRMED_MAPPING', 'ATTRIBUTES', 'FUZZY', 'MANUAL');--> statement-breakpoint
CREATE TYPE "catalog"."match_status" AS ENUM('AUTO_ACCEPTED', 'PENDING_REVIEW', 'CONFIRMED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "app"."notification_type" AS ENUM('PRICE_ALERT', 'FAVORITE_DISCOUNTED', 'LIST_ACTIVITY', 'LIST_INVITE', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "catalog"."promotion_mechanic" AS ENUM('PRICE_CUT', 'PERCENT_OFF', 'AMOUNT_OFF', 'BUY_X_GET_Y_FREE', 'MULTI_BUY_FIXED_PRICE', 'NTH_ITEM_PERCENT_OFF');--> statement-breakpoint
CREATE TYPE "app"."push_platform" AS ENUM('ios', 'android', 'web');--> statement-breakpoint
CREATE TYPE "catalog"."retailer_type" AS ENUM('SUPERMARKET', 'DISCOUNTER', 'ONLINE_GROCER', 'CONVENIENCE', 'DRUGSTORE', 'ORGANIC');--> statement-breakpoint
CREATE TYPE "app"."subscription_status" AS ENUM('ACTIVE', 'IN_GRACE_PERIOD', 'EXPIRED', 'CANCELED', 'REVOKED');--> statement-breakpoint
CREATE TYPE "app"."subscription_store" AS ENUM('APPLE_APP_STORE', 'GOOGLE_PLAY', 'MANUAL');--> statement-breakpoint
CREATE TYPE "ingest"."sync_kind" AS ENUM('CATALOG', 'PRICES', 'PROMOTIONS', 'FULL');--> statement-breakpoint
CREATE TYPE "ingest"."sync_status" AS ENUM('QUEUED', 'RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');--> statement-breakpoint
CREATE TYPE "catalog"."unit" AS ENUM('g', 'kg', 'ml', 'l', 'piece');--> statement-breakpoint
CREATE TYPE "app"."user_role" AS ENUM('USER', 'ADMIN');--> statement-breakpoint
CREATE TABLE "catalog"."brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL,
	"implies_tokens" text[] DEFAULT '{}'::text[] NOT NULL,
	"private_label_retailer_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brands_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "catalog"."categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"parent_id" uuid,
	"name" jsonb NOT NULL,
	"icon" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "catalog"."countries" (
	"code" char(2) PRIMARY KEY NOT NULL,
	"name" jsonb NOT NULL,
	"currency" char(3) NOT NULL,
	"languages" text[] NOT NULL,
	"default_locale" text NOT NULL,
	"regions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog"."current_prices" (
	"retailer_product_id" uuid PRIMARY KEY NOT NULL,
	"regular_price_cents" integer NOT NULL,
	"promo_price_cents" integer,
	"currency" char(3) DEFAULT 'EUR' NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"data_origin" "catalog"."data_origin" NOT NULL,
	"source_provider" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog"."price_observations" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"retailer_product_id" uuid NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"regular_price_cents" integer NOT NULL,
	"promo_price_cents" integer,
	"currency" char(3) DEFAULT 'EUR' NOT NULL,
	"labelled_unit_price_cents" integer,
	"store_location_id" uuid,
	"data_origin" "catalog"."data_origin" NOT NULL,
	"source_provider" text NOT NULL,
	"sync_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog"."product_barcodes" (
	"gtin" text PRIMARY KEY NOT NULL,
	"variant_id" uuid NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog"."product_equivalences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_variant_id" uuid NOT NULL,
	"target_variant_id" uuid NOT NULL,
	"confidence" numeric(4, 2) NOT NULL,
	"status" "catalog"."equivalence_status" DEFAULT 'SUGGESTED' NOT NULL,
	"reasons" text[] DEFAULT '{}'::text[] NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog"."product_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"retailer_product_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"confidence" "catalog"."match_confidence" NOT NULL,
	"method" "catalog"."match_method" NOT NULL,
	"score" numeric(5, 3) NOT NULL,
	"status" "catalog"."match_status" NOT NULL,
	"reasons" text[] DEFAULT '{}'::text[] NOT NULL,
	"alternatives" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog"."product_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"quantity_amount" numeric,
	"quantity_unit" "catalog"."unit",
	"pack_count" integer DEFAULT 1 NOT NULL,
	"net_content_amount" numeric,
	"net_content_unit" "catalog"."base_unit",
	"sold_by_weight" boolean DEFAULT false NOT NULL,
	"size_label" text,
	"tokens" text[] DEFAULT '{}'::text[] NOT NULL,
	"search_text" text NOT NULL,
	"signature" text NOT NULL,
	"normalized" jsonb NOT NULL,
	"needs_review" boolean DEFAULT false NOT NULL,
	"image_url" text,
	"data_origin" "catalog"."data_origin" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog"."products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"brand_id" uuid,
	"category_id" uuid,
	"product_type" text,
	"variant_tokens" text[] DEFAULT '{}'::text[] NOT NULL,
	"flavours" text[] DEFAULT '{}'::text[] NOT NULL,
	"dietary" text[] DEFAULT '{}'::text[] NOT NULL,
	"description" text,
	"image_url" text,
	"data_origin" "catalog"."data_origin" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog"."promotion_conditions" (
	"promotion_id" uuid PRIMARY KEY NOT NULL,
	"loyalty_card_required" boolean DEFAULT false NOT NULL,
	"loyalty_program" text,
	"min_quantity" integer,
	"max_quantity_per_customer" integer,
	"online_only" boolean DEFAULT false NOT NULL,
	"region_codes" text[] DEFAULT '{}'::text[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog"."promotion_products" (
	"promotion_id" uuid NOT NULL,
	"retailer_product_id" uuid NOT NULL,
	CONSTRAINT "promotion_products_promotion_id_retailer_product_id_pk" PRIMARY KEY("promotion_id","retailer_product_id")
);
--> statement-breakpoint
CREATE TABLE "catalog"."promotions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"retailer_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"mechanic" "catalog"."promotion_mechanic" NOT NULL,
	"params" jsonb NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"data_origin" "catalog"."data_origin" NOT NULL,
	"source_provider" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog"."retailer_countries" (
	"retailer_id" uuid NOT NULL,
	"country_code" char(2) NOT NULL,
	CONSTRAINT "retailer_countries_retailer_id_country_code_pk" PRIMARY KEY("retailer_id","country_code")
);
--> statement-breakpoint
CREATE TABLE "catalog"."retailer_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"retailer_id" uuid NOT NULL,
	"retailer_sku" text NOT NULL,
	"variant_id" uuid,
	"title" text NOT NULL,
	"brand_text" text,
	"quantity_text" text,
	"category_text" text,
	"gtins" text[] DEFAULT '{}'::text[] NOT NULL,
	"image_url" text,
	"product_url" text,
	"is_available" boolean DEFAULT true NOT NULL,
	"normalized" jsonb,
	"data_origin" "catalog"."data_origin" NOT NULL,
	"source_provider" text NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog"."retailers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"type" "catalog"."retailer_type" NOT NULL,
	"provider_key" text NOT NULL,
	"brand_color" text NOT NULL,
	"loyalty_program" text,
	"loyalty_program_name" text,
	"website_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "retailers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "catalog"."search_stats" (
	"query" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"last_searched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog"."store_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"retailer_id" uuid NOT NULL,
	"country_code" char(2) NOT NULL,
	"region_code" text,
	"name" text NOT NULL,
	"street" text,
	"postal_code" text,
	"city" text,
	"latitude" double precision,
	"longitude" double precision,
	"osm_id" text,
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog"."synonyms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phrase" text NOT NULL,
	"token" text NOT NULL,
	"locale" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingest"."import_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sync_id" uuid,
	"queue" text NOT NULL,
	"job_name" text NOT NULL,
	"external_job_id" text,
	"status" "ingest"."sync_status" DEFAULT 'QUEUED' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ingest"."provider_errors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sync_id" uuid,
	"provider_key" text NOT NULL,
	"stage" "ingest"."ingest_stage" NOT NULL,
	"external_id" text,
	"message" text NOT NULL,
	"raw" jsonb,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingest"."provider_syncs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_key" text NOT NULL,
	"kind" "ingest"."sync_kind" NOT NULL,
	"status" "ingest"."sync_status" DEFAULT 'QUEUED' NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"read_count" integer DEFAULT 0 NOT NULL,
	"created_count" integer DEFAULT 0 NOT NULL,
	"updated_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"error_summary" text,
	"triggered_by" text DEFAULT 'schedule' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."favorites" (
	"user_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorites_user_id_variant_id_pk" PRIMARY KEY("user_id","variant_id")
);
--> statement-breakpoint
CREATE TABLE "app"."list_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" uuid NOT NULL,
	"user_id" uuid,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."list_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"role" "app"."list_member_role" DEFAULT 'EDITOR' NOT NULL,
	"created_by" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_by" uuid,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "list_invites_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "app"."list_item_selections" (
	"item_id" uuid NOT NULL,
	"retailer_id" uuid NOT NULL,
	"retailer_product_id" uuid NOT NULL,
	"selected_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "list_item_selections_item_id_retailer_id_pk" PRIMARY KEY("item_id","retailer_id")
);
--> statement-breakpoint
CREATE TABLE "app"."list_members" (
	"list_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "app"."list_member_role" NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "list_members_list_id_user_id_pk" PRIMARY KEY("list_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "app"."notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "app"."notification_type" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"pushed_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."plan_entitlements" (
	"plan_key" text NOT NULL,
	"entitlement_key" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"limit_value" integer,
	CONSTRAINT "plan_entitlements_plan_key_entitlement_key_pk" PRIMARY KEY("plan_key","entitlement_key")
);
--> statement-breakpoint
CREATE TABLE "app"."plans" (
	"key" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"apple_product_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"google_product_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."price_alert_triggers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alert_id" uuid NOT NULL,
	"dedupe_key" text NOT NULL,
	"retailer_product_id" uuid,
	"price_cents" integer NOT NULL,
	"reason" text NOT NULL,
	"notification_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_alert_triggers_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "app"."price_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"retailer_id" uuid,
	"target_price_cents" integer,
	"promotion_only" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"armed" boolean DEFAULT true NOT NULL,
	"last_triggered_at" timestamp with time zone,
	"last_triggered_price_cents" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."push_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"platform" "app"."push_platform" NOT NULL,
	"disabled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	CONSTRAINT "push_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "app"."search_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"query" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"refresh_token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_refresh_token_hash_unique" UNIQUE("refresh_token_hash")
);
--> statement-breakpoint
CREATE TABLE "app"."shopping_list_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" uuid NOT NULL,
	"title" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"preferred_variant_id" uuid,
	"preferred_brand" text,
	"notes" text,
	"category_slug" text,
	"checked" boolean DEFAULT false NOT NULL,
	"checked_by" uuid,
	"checked_at" timestamp with time zone,
	"position" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."shopping_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'custom' NOT NULL,
	"icon" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_key" text NOT NULL,
	"store" "app"."subscription_store" NOT NULL,
	"status" "app"."subscription_status" NOT NULL,
	"store_product_id" text,
	"original_transaction_id" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."user_retailer_preferences" (
	"user_id" uuid NOT NULL,
	"retailer_id" uuid NOT NULL,
	"has_loyalty_card" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_retailer_preferences_user_id_retailer_id_pk" PRIMARY KEY("user_id","retailer_id")
);
--> statement-breakpoint
CREATE TABLE "app"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"role" "app"."user_role" DEFAULT 'USER' NOT NULL,
	"locale" text DEFAULT 'nl' NOT NULL,
	"country_code" char(2),
	"onboarding_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "catalog"."brands" ADD CONSTRAINT "brands_private_label_retailer_id_retailers_id_fk" FOREIGN KEY ("private_label_retailer_id") REFERENCES "catalog"."retailers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "catalog"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."current_prices" ADD CONSTRAINT "current_prices_retailer_product_id_retailer_products_id_fk" FOREIGN KEY ("retailer_product_id") REFERENCES "catalog"."retailer_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."price_observations" ADD CONSTRAINT "price_observations_retailer_product_id_retailer_products_id_fk" FOREIGN KEY ("retailer_product_id") REFERENCES "catalog"."retailer_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."price_observations" ADD CONSTRAINT "price_observations_store_location_id_store_locations_id_fk" FOREIGN KEY ("store_location_id") REFERENCES "catalog"."store_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."product_barcodes" ADD CONSTRAINT "product_barcodes_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "catalog"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."product_equivalences" ADD CONSTRAINT "product_equivalences_source_variant_id_product_variants_id_fk" FOREIGN KEY ("source_variant_id") REFERENCES "catalog"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."product_equivalences" ADD CONSTRAINT "product_equivalences_target_variant_id_product_variants_id_fk" FOREIGN KEY ("target_variant_id") REFERENCES "catalog"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."product_matches" ADD CONSTRAINT "product_matches_retailer_product_id_retailer_products_id_fk" FOREIGN KEY ("retailer_product_id") REFERENCES "catalog"."retailer_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."product_matches" ADD CONSTRAINT "product_matches_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "catalog"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "catalog"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."products" ADD CONSTRAINT "products_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "catalog"."brands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "catalog"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."promotion_conditions" ADD CONSTRAINT "promotion_conditions_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "catalog"."promotions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."promotion_products" ADD CONSTRAINT "promotion_products_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "catalog"."promotions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."promotion_products" ADD CONSTRAINT "promotion_products_retailer_product_id_retailer_products_id_fk" FOREIGN KEY ("retailer_product_id") REFERENCES "catalog"."retailer_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."promotions" ADD CONSTRAINT "promotions_retailer_id_retailers_id_fk" FOREIGN KEY ("retailer_id") REFERENCES "catalog"."retailers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."retailer_countries" ADD CONSTRAINT "retailer_countries_retailer_id_retailers_id_fk" FOREIGN KEY ("retailer_id") REFERENCES "catalog"."retailers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."retailer_countries" ADD CONSTRAINT "retailer_countries_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "catalog"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."retailer_products" ADD CONSTRAINT "retailer_products_retailer_id_retailers_id_fk" FOREIGN KEY ("retailer_id") REFERENCES "catalog"."retailers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."retailer_products" ADD CONSTRAINT "retailer_products_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "catalog"."product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."store_locations" ADD CONSTRAINT "store_locations_retailer_id_retailers_id_fk" FOREIGN KEY ("retailer_id") REFERENCES "catalog"."retailers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."store_locations" ADD CONSTRAINT "store_locations_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "catalog"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingest"."import_jobs" ADD CONSTRAINT "import_jobs_sync_id_provider_syncs_id_fk" FOREIGN KEY ("sync_id") REFERENCES "ingest"."provider_syncs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingest"."provider_errors" ADD CONSTRAINT "provider_errors_sync_id_provider_syncs_id_fk" FOREIGN KEY ("sync_id") REFERENCES "ingest"."provider_syncs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."favorites" ADD CONSTRAINT "favorites_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "catalog"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."list_activity" ADD CONSTRAINT "list_activity_list_id_shopping_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "app"."shopping_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."list_activity" ADD CONSTRAINT "list_activity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."list_invites" ADD CONSTRAINT "list_invites_list_id_shopping_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "app"."shopping_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."list_invites" ADD CONSTRAINT "list_invites_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."list_invites" ADD CONSTRAINT "list_invites_accepted_by_users_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."list_item_selections" ADD CONSTRAINT "list_item_selections_item_id_shopping_list_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "app"."shopping_list_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."list_item_selections" ADD CONSTRAINT "list_item_selections_retailer_id_retailers_id_fk" FOREIGN KEY ("retailer_id") REFERENCES "catalog"."retailers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."list_item_selections" ADD CONSTRAINT "list_item_selections_retailer_product_id_retailer_products_id_fk" FOREIGN KEY ("retailer_product_id") REFERENCES "catalog"."retailer_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."list_item_selections" ADD CONSTRAINT "list_item_selections_selected_by_users_id_fk" FOREIGN KEY ("selected_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."list_members" ADD CONSTRAINT "list_members_list_id_shopping_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "app"."shopping_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."list_members" ADD CONSTRAINT "list_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."plan_entitlements" ADD CONSTRAINT "plan_entitlements_plan_key_plans_key_fk" FOREIGN KEY ("plan_key") REFERENCES "app"."plans"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."price_alert_triggers" ADD CONSTRAINT "price_alert_triggers_alert_id_price_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "app"."price_alerts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."price_alert_triggers" ADD CONSTRAINT "price_alert_triggers_retailer_product_id_retailer_products_id_fk" FOREIGN KEY ("retailer_product_id") REFERENCES "catalog"."retailer_products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."price_alerts" ADD CONSTRAINT "price_alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."price_alerts" ADD CONSTRAINT "price_alerts_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "catalog"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."price_alerts" ADD CONSTRAINT "price_alerts_retailer_id_retailers_id_fk" FOREIGN KEY ("retailer_id") REFERENCES "catalog"."retailers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."push_tokens" ADD CONSTRAINT "push_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."search_history" ADD CONSTRAINT "search_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."shopping_list_items" ADD CONSTRAINT "shopping_list_items_list_id_shopping_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "app"."shopping_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."shopping_list_items" ADD CONSTRAINT "shopping_list_items_preferred_variant_id_product_variants_id_fk" FOREIGN KEY ("preferred_variant_id") REFERENCES "catalog"."product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."shopping_list_items" ADD CONSTRAINT "shopping_list_items_checked_by_users_id_fk" FOREIGN KEY ("checked_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."shopping_list_items" ADD CONSTRAINT "shopping_list_items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."shopping_list_items" ADD CONSTRAINT "shopping_list_items_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."shopping_lists" ADD CONSTRAINT "shopping_lists_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."subscriptions" ADD CONSTRAINT "subscriptions_plan_key_plans_key_fk" FOREIGN KEY ("plan_key") REFERENCES "app"."plans"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."user_retailer_preferences" ADD CONSTRAINT "user_retailer_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."user_retailer_preferences" ADD CONSTRAINT "user_retailer_preferences_retailer_id_retailers_id_fk" FOREIGN KEY ("retailer_id") REFERENCES "catalog"."retailers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "price_observations_rp_time_idx" ON "catalog"."price_observations" USING btree ("retailer_product_id","observed_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "price_observations_dedupe_idx" ON "catalog"."price_observations" USING btree ("retailer_product_id","observed_at","source_provider");--> statement-breakpoint
CREATE INDEX "product_barcodes_variant_idx" ON "catalog"."product_barcodes" USING btree ("variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_equivalences_pair_idx" ON "catalog"."product_equivalences" USING btree ("source_variant_id","target_variant_id");--> statement-breakpoint
CREATE INDEX "product_equivalences_target_idx" ON "catalog"."product_equivalences" USING btree ("target_variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_matches_pair_idx" ON "catalog"."product_matches" USING btree ("retailer_product_id","variant_id");--> statement-breakpoint
CREATE INDEX "product_matches_status_idx" ON "catalog"."product_matches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "product_variants_product_idx" ON "catalog"."product_variants" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_variants_signature_idx" ON "catalog"."product_variants" USING btree ("signature");--> statement-breakpoint
CREATE INDEX "product_variants_search_trgm_idx" ON "catalog"."product_variants" USING gin ("search_text" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "product_variants_tokens_idx" ON "catalog"."product_variants" USING gin ("tokens");--> statement-breakpoint
CREATE INDEX "products_brand_idx" ON "catalog"."products" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "products_type_idx" ON "catalog"."products" USING btree ("product_type");--> statement-breakpoint
CREATE INDEX "promotion_products_rp_idx" ON "catalog"."promotion_products" USING btree ("retailer_product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "promotions_external_idx" ON "catalog"."promotions" USING btree ("retailer_id","external_id");--> statement-breakpoint
CREATE INDEX "promotions_window_idx" ON "catalog"."promotions" USING btree ("starts_at","ends_at");--> statement-breakpoint
CREATE UNIQUE INDEX "retailer_products_sku_idx" ON "catalog"."retailer_products" USING btree ("retailer_id","retailer_sku");--> statement-breakpoint
CREATE INDEX "retailer_products_variant_idx" ON "catalog"."retailer_products" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "store_locations_retailer_idx" ON "catalog"."store_locations" USING btree ("retailer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "store_locations_osm_idx" ON "catalog"."store_locations" USING btree ("osm_id");--> statement-breakpoint
CREATE UNIQUE INDEX "synonyms_phrase_idx" ON "catalog"."synonyms" USING btree ("phrase");--> statement-breakpoint
CREATE INDEX "import_jobs_sync_idx" ON "ingest"."import_jobs" USING btree ("sync_id");--> statement-breakpoint
CREATE INDEX "provider_errors_sync_idx" ON "ingest"."provider_errors" USING btree ("sync_id");--> statement-breakpoint
CREATE INDEX "provider_errors_open_idx" ON "ingest"."provider_errors" USING btree ("provider_key","resolved_at");--> statement-breakpoint
CREATE INDEX "provider_syncs_provider_idx" ON "ingest"."provider_syncs" USING btree ("provider_key","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "list_activity_list_idx" ON "app"."list_activity" USING btree ("list_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "list_members_user_idx" ON "app"."list_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "app"."notifications" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "price_alert_triggers_alert_idx" ON "app"."price_alert_triggers" USING btree ("alert_id");--> statement-breakpoint
CREATE INDEX "price_alerts_variant_idx" ON "app"."price_alerts" USING btree ("variant_id","enabled");--> statement-breakpoint
CREATE INDEX "price_alerts_user_idx" ON "app"."price_alerts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "push_tokens_user_idx" ON "app"."push_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "search_history_user_idx" ON "app"."search_history" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "app"."sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "shopping_list_items_list_idx" ON "app"."shopping_list_items" USING btree ("list_id","position");--> statement-breakpoint
CREATE INDEX "shopping_lists_owner_idx" ON "app"."shopping_lists" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "subscriptions_user_idx" ON "app"."subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_store_tx_idx" ON "app"."subscriptions" USING btree ("store","original_transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "app"."users" USING btree (lower("email"));