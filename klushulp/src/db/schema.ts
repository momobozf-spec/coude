import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  uniqueIndex,
  index,
  doublePrecision,
  primaryKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------- conventies
// - Bedragen altijd in centen (integer), percentages in basispunten (1000 = 10 %).
// - Elke statuswijziging van aanvraag/voorstel/boeking wordt gelogd in `event`.
// - Een aanvraag is géén boeking. Pas bij `booking` is er een afspraak.

export type PlatformRole = "customer" | "provider" | "admin";
export type ProviderType = "professional" | "private";
export type ProviderStatus = "draft" | "pending" | "active" | "suspended";
export type VerificationKind = "identity" | "kbo" | "insurance" | "certificate";
export type VerificationStatus = "pending" | "approved" | "rejected";
export type RequestStatus = "open" | "booked" | "completed" | "cancelled" | "expired";
export type TimePreference = "any" | "morning" | "afternoon" | "evening";
export type PriceType = "fixed" | "hourly" | "estimate" | "inspection";
export type ProposalStatus = "sent" | "accepted" | "declined" | "withdrawn" | "expired";
export type BookingStatus = "confirmed" | "in_progress" | "completed" | "cancelled" | "disputed";
export type PaymentStatus = "not_applicable" | "simulated" | "pending" | "paid" | "failed";
export type ReportStatus = "open" | "in_review" | "resolved" | "dismissed";

const id = () => text("id").primaryKey().default(sql`gen_random_uuid()::text`);
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

// ---------------------------------------------------------------- better-auth
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  platformRole: text("platform_role").$type<PlatformRole>().notNull().default("customer"),
  locale: text("locale").notNull().default("nl"),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
}, (t) => [index("session_user_idx").on(t.userId)]);

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("account_user_idx").on(t.userId)]);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ---------------------------------------------------------------- regio's en categorieën
export const region = pgTable("region", {
  id: id(),
  slug: text("slug").notNull().unique(),
  nameNl: text("name_nl").notNull(),
  nameFr: text("name_fr").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

export const municipality = pgTable("municipality", {
  postcode: text("postcode").notNull(),
  nameNl: text("name_nl").notNull(),
  nameFr: text("name_fr").notNull(),
  regionId: text("region_id").notNull().references(() => region.id),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
}, (t) => [primaryKey({ columns: [t.postcode, t.nameNl] }), index("municipality_region_idx").on(t.regionId), index("municipality_postcode_idx").on(t.postcode)]);

export type FollowupQuestion = {
  key: string;
  type: "choice" | "text";
  labelNl: string;
  labelFr: string;
  options?: { value: string; nl: string; fr: string }[];
};

export const category = pgTable("category", {
  id: id(),
  slug: text("slug").notNull().unique(),
  nameNl: text("name_nl").notNull(),
  nameFr: text("name_fr").notNull(),
  descriptionNl: text("description_nl").notNull().default(""),
  descriptionFr: text("description_fr").notNull().default(""),
  // Welke dienstverlenertypes deze categorie mogen aanbieden. Loodgieter/elektricien: enkel professional.
  allowedProviderTypes: jsonb("allowed_provider_types").$type<ProviderType[]>().notNull().default(["professional"]),
  // Verificaties die goedgekeurd moeten zijn voor een actief profiel in deze categorie.
  requiredVerifications: jsonb("required_verifications").$type<VerificationKind[]>().notNull().default([]),
  followupQuestions: jsonb("followup_questions").$type<FollowupQuestion[]>().notNull().default([]),
  keywords: jsonb("keywords").$type<string[]>().notNull().default([]),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

// ---------------------------------------------------------------- dienstverleners
export const provider = pgTable("provider", {
  id: id(),
  userId: text("user_id").notNull().unique().references(() => user.id, { onDelete: "cascade" }),
  type: text("type").$type<ProviderType>().notNull().default("professional"),
  displayName: text("display_name").notNull(),
  businessName: text("business_name"),
  kboNumber: text("kbo_number"),
  bio: text("bio").notNull().default(""),
  photoPath: text("photo_path"),
  phone: text("phone"),
  basePostcode: text("base_postcode"),
  baseMunicipality: text("base_municipality"),
  baseLat: doublePrecision("base_lat"),
  baseLng: doublePrecision("base_lng"),
  radiusKm: integer("radius_km").notNull().default(15),
  hourlyRateCents: integer("hourly_rate_cents"),
  travelFeeCents: integer("travel_fee_cents").notNull().default(0),
  yearsExperience: integer("years_experience"),
  status: text("status").$type<ProviderStatus>().notNull().default("draft"),
  suspendedReason: text("suspended_reason"),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("provider_status_idx").on(t.status)]);

export const providerCategory = pgTable("provider_category", {
  providerId: text("provider_id").notNull().references(() => provider.id, { onDelete: "cascade" }),
  categoryId: text("category_id").notNull().references(() => category.id, { onDelete: "cascade" }),
  // Vrij veld: concrete diensten binnen de categorie ("kraan vervangen, ontstoppen").
  services: text("services").notNull().default(""),
}, (t) => [primaryKey({ columns: [t.providerId, t.categoryId] })]);

// Wekelijkse beschikbaarheid; minuten sinds middernacht.
export const availabilitySlot = pgTable("availability_slot", {
  id: id(),
  providerId: text("provider_id").notNull().references(() => provider.id, { onDelete: "cascade" }),
  weekday: integer("weekday").notNull(), // 0 = zondag ... 6 = zaterdag
  startMin: integer("start_min").notNull(),
  endMin: integer("end_min").notNull(),
}, (t) => [index("availability_provider_idx").on(t.providerId)]);

export const timeOff = pgTable("time_off", {
  id: id(),
  providerId: text("provider_id").notNull().references(() => provider.id, { onDelete: "cascade" }),
  dateFrom: text("date_from").notNull(), // YYYY-MM-DD
  dateTo: text("date_to").notNull(),
  note: text("note"),
});

export const providerVerification = pgTable("provider_verification", {
  id: id(),
  providerId: text("provider_id").notNull().references(() => provider.id, { onDelete: "cascade" }),
  kind: text("kind").$type<VerificationKind>().notNull(),
  status: text("status").$type<VerificationStatus>().notNull().default("pending"),
  // Wat de dienstverlener opgaf (bv. KBO-nummer, verzekeraar + polisnummer).
  reference: text("reference"),
  documentPath: text("document_path"),
  note: text("note"),
  reviewedBy: text("reviewed_by").references(() => user.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("provider_verification_kind_uq").on(t.providerId, t.kind)]);

// ---------------------------------------------------------------- aanvragen
export const jobRequest = pgTable("job_request", {
  id: id(),
  // Toegangstoken voor de klant zonder account (32 bytes, base64url). Nooit tonen aan dienstverleners.
  accessToken: text("access_token").notNull().unique(),
  customerUserId: text("customer_user_id").references(() => user.id),
  categoryId: text("category_id").notNull().references(() => category.id),
  regionId: text("region_id").references(() => region.id),
  description: text("description").notNull(),
  answers: jsonb("answers").$type<Record<string, string>>().notNull().default({}),
  postcode: text("postcode").notNull(),
  municipality: text("municipality").notNull(),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  // Exact adres: enkel zichtbaar voor de dienstverlener ná acceptatie en voor beheer.
  streetAddress: text("street_address"),
  dateFrom: text("date_from"), // YYYY-MM-DD, leeg = zo snel mogelijk
  dateTo: text("date_to"),
  timePreference: text("time_preference").$type<TimePreference>().notNull().default("any"),
  urgent: boolean("urgent").notNull().default(false),
  contactName: text("contact_name").notNull(),
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone"),
  locale: text("locale").notNull().default("nl"),
  status: text("status").$type<RequestStatus>().notNull().default("open"),
  matchCount: integer("match_count").notNull().default(0),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (t) => [index("job_request_status_idx").on(t.status), index("job_request_customer_idx").on(t.customerUserId)]);

export const jobPhoto = pgTable("job_photo", {
  id: id(),
  requestId: text("request_id").notNull().references(() => jobRequest.id, { onDelete: "cascade" }),
  path: text("path").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  createdAt: createdAt(),
});

// Wie mag deze aanvraag zien: enkel gematchte dienstverleners. Autorisatie steunt hierop.
export const requestMatch = pgTable("request_match", {
  requestId: text("request_id").notNull().references(() => jobRequest.id, { onDelete: "cascade" }),
  providerId: text("provider_id").notNull().references(() => provider.id, { onDelete: "cascade" }),
  distanceKm: doublePrecision("distance_km").notNull(),
  availableInWindow: boolean("available_in_window").notNull(),
  // 'auto' = bij indienen; 'customer' = klant stuurde zelf een aanvraag naar dit profiel; 'expanded' = na uitbreiding.
  source: text("source").notNull().default("auto"),
  createdAt: createdAt(),
}, (t) => [primaryKey({ columns: [t.requestId, t.providerId] }), index("request_match_provider_idx").on(t.providerId)]);

// ---------------------------------------------------------------- voorstellen
export const proposal = pgTable("proposal", {
  id: id(),
  requestId: text("request_id").notNull().references(() => jobRequest.id, { onDelete: "cascade" }),
  providerId: text("provider_id").notNull().references(() => provider.id, { onDelete: "cascade" }),
  priceType: text("price_type").$type<PriceType>().notNull(),
  // fixed: amountCents; hourly: hourlyRateCents + geschatte uren; estimate: amountMinCents..amountMaxCents; inspection: amountCents = diagnosekost.
  amountCents: integer("amount_cents"),
  amountMinCents: integer("amount_min_cents"),
  amountMaxCents: integer("amount_max_cents"),
  hourlyRateCents: integer("hourly_rate_cents"),
  estimatedHoursMin: integer("estimated_hours_min"),
  estimatedHoursMax: integer("estimated_hours_max"),
  travelFeeCents: integer("travel_fee_cents").notNull().default(0),
  materialsIncluded: boolean("materials_included").notNull().default(false),
  materialsNote: text("materials_note"),
  included: text("included").notNull().default(""),
  excluded: text("excluded").notNull().default(""),
  // Btw: prijzen voor particulieren tonen we inclusief btw. De dienstverlener geeft het inclusief-bedrag op.
  vatIncluded: boolean("vat_included").notNull().default(true),
  proposedStart: timestamp("proposed_start", { withTimezone: true }).notNull(),
  proposedEnd: timestamp("proposed_end", { withTimezone: true }).notNull(),
  message: text("message").notNull().default(""),
  // Snapshot van de platformkosten (aangerekend aan de dienstverlener) op moment van verzenden.
  platformFeeCents: integer("platform_fee_cents").notNull().default(0),
  status: text("status").$type<ProposalStatus>().notNull().default("sent"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [uniqueIndex("proposal_request_provider_uq").on(t.requestId, t.providerId), index("proposal_provider_idx").on(t.providerId)]);

// ---------------------------------------------------------------- boekingen
export const booking = pgTable("booking", {
  id: id(),
  // Eén boeking per aanvraag: harde garantie tegen dubbele boeking.
  requestId: text("request_id").notNull().unique().references(() => jobRequest.id),
  proposalId: text("proposal_id").notNull().unique().references(() => proposal.id),
  providerId: text("provider_id").notNull().references(() => provider.id),
  customerUserId: text("customer_user_id").references(() => user.id),
  scheduledStart: timestamp("scheduled_start", { withTimezone: true }).notNull(),
  scheduledEnd: timestamp("scheduled_end", { withTimezone: true }).notNull(),
  status: text("status").$type<BookingStatus>().notNull().default("confirmed"),
  platformFeeCents: integer("platform_fee_cents").notNull(),
  paymentStatus: text("payment_status").$type<PaymentStatus>().notNull().default("not_applicable"),
  paymentProvider: text("payment_provider").notNull().default("none"), // none | simulated | stripe_test | stripe
  paymentReference: text("payment_reference"),
  cancelledBy: text("cancelled_by"), // customer | provider | admin
  cancelReason: text("cancel_reason"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("booking_provider_idx").on(t.providerId), index("booking_status_idx").on(t.status)]);

// ---------------------------------------------------------------- berichten (thread = aanvraag × dienstverlener)
export const message = pgTable("message", {
  id: id(),
  requestId: text("request_id").notNull().references(() => jobRequest.id, { onDelete: "cascade" }),
  providerId: text("provider_id").notNull().references(() => provider.id, { onDelete: "cascade" }),
  senderRole: text("sender_role").$type<"customer" | "provider" | "admin">().notNull(),
  senderUserId: text("sender_user_id").references(() => user.id),
  body: text("body").notNull(),
  createdAt: createdAt(),
}, (t) => [index("message_thread_idx").on(t.requestId, t.providerId, t.createdAt)]);

// ---------------------------------------------------------------- beoordelingen (enkel na afgeronde boeking)
export const review = pgTable("review", {
  id: id(),
  bookingId: text("booking_id").notNull().unique().references(() => booking.id),
  providerId: text("provider_id").notNull().references(() => provider.id),
  rating: integer("rating").notNull(),
  body: text("body").notNull().default(""),
  authorName: text("author_name").notNull(),
  visible: boolean("visible").notNull().default(true),
  moderationNote: text("moderation_note"),
  createdAt: createdAt(),
}, (t) => [index("review_provider_idx").on(t.providerId)]);

// ---------------------------------------------------------------- meldingen en geschillen
export const report = pgTable("report", {
  id: id(),
  requestId: text("request_id").references(() => jobRequest.id, { onDelete: "set null" }),
  bookingId: text("booking_id").references(() => booking.id, { onDelete: "set null" }),
  providerId: text("provider_id").references(() => provider.id, { onDelete: "set null" }),
  reporterRole: text("reporter_role").$type<"customer" | "provider">().notNull(),
  reporterUserId: text("reporter_user_id").references(() => user.id),
  reporterContact: text("reporter_contact"),
  reason: text("reason").notNull(),
  details: text("details").notNull().default(""),
  status: text("status").$type<ReportStatus>().notNull().default("open"),
  adminNote: text("admin_note"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ---------------------------------------------------------------- instellingen en audit
export const platformSetting = pgTable("platform_setting", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: updatedAt(),
});

export const event = pgTable("event", {
  id: id(),
  entityType: text("entity_type").notNull(), // request | proposal | booking | provider | review | report
  entityId: text("entity_id").notNull(),
  type: text("type").notNull(),
  actorRole: text("actor_role"),
  actorUserId: text("actor_user_id"),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: createdAt(),
}, (t) => [index("event_entity_idx").on(t.entityType, t.entityId)]);

// Spam-bescherming voor anonieme aanvragen: aantal inzendingen per IP-hash per uur.
export const submissionLog = pgTable("submission_log", {
  id: id(),
  ipHash: text("ip_hash").notNull(),
  kind: text("kind").notNull(), // request | message | report
  createdAt: createdAt(),
}, (t) => [index("submission_log_ip_idx").on(t.ipHash, t.createdAt)]);
