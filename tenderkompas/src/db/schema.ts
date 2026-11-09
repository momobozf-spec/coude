import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  jsonb,
  uniqueIndex,
  index,
  pgEnum,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date());

/* ------------------------------------------------------------------ */
/* Auth (better-auth tabellen; veldnamen volgens better-auth core)     */
/* ------------------------------------------------------------------ */
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  platformRole: text("platform_role").notNull().default("client"), // 'admin' | 'client'
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Organisaties, lidmaatschappen, leads                                */
/* ------------------------------------------------------------------ */
export const subscriptionStatus = pgEnum("subscription_status", [
  "lead",
  "pilot",
  "active",
  "paused",
  "ended",
]);

export const organization = pgTable("organization", {
  id: id(),
  name: text("name").notNull(),
  subscriptionStatus: subscriptionStatus("subscription_status").notNull().default("pilot"),
  subscriptionNotes: text("subscription_notes"),
  /** Herkenbaar fictieve demo-organisatie; mag uitsluitend demo-procedures zien. */
  isDemo: boolean("is_demo").notNull().default(false),
  notificationSettings: jsonb("notification_settings")
    .$type<{ weeklyDigest: boolean; changeAlerts: boolean; recipients: string[] }>()
    .notNull()
    .default({ weeklyDigest: true, changeAlerts: true, recipients: [] }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const membership = pgTable(
  "membership",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"), // 'owner' | 'member'
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("membership_org_user_uq").on(t.organizationId, t.userId)],
);

export const leadRequest = pgTable("lead_request", {
  id: id(),
  companyName: text("company_name").notNull(),
  contactName: text("contact_name").notNull(),
  email: text("email").notNull(),
  website: text("website"),
  teamSize: text("team_size"),
  focus: text("focus"),
  message: text("message"),
  consent: boolean("consent").notNull(),
  status: text("status").notNull().default("new"), // new | contacted | converted | rejected
  createdAt: createdAt(),
});

/* ------------------------------------------------------------------ */
/* Bedrijfsprofiel (klantvertrouwelijk)                                */
/* ------------------------------------------------------------------ */
export type TriState = "yes" | "no" | "unknown";
export type ProfileReference = {
  id: string;
  /** company = bedrijfsreferentie; individual = ervaring van een medewerker */
  holder: "company" | "individual";
  title: string;
  clientName?: string | null;
  year?: number | null;
  valueEur?: number | null;
  publicSector: TriState;
  technologies: string[];
  description?: string | null;
};
export type ProfileCertification = {
  id: string;
  holder: "company" | "individual";
  name: string;
  validUntil?: string | null;
};

export const companyProfile = pgTable("company_profile", {
  id: id(),
  organizationId: uuid("organization_id")
    .notNull()
    .unique()
    .references(() => organization.id, { onDelete: "cascade" }),
  companyName: text("company_name").notNull(),
  website: text("website"),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  services: jsonb("services").$type<string[]>().notNull().default([]),
  expertise: text("expertise"),
  technologies: jsonb("technologies").$type<string[]>().notNull().default([]),
  excludedWork: jsonb("excluded_work").$type<string[]>().notNull().default([]),
  languages: jsonb("languages").$type<string[]>().notNull().default([]),
  regions: jsonb("regions").$type<string[]>().notNull().default([]),
  teamSize: integer("team_size"),
  availableCapacityFte: numeric("available_capacity_fte", { precision: 6, scale: 1 }),
  contractValueMinEur: numeric("contract_value_min_eur", { precision: 14, scale: 2 }),
  contractValueMaxEur: numeric("contract_value_max_eur", { precision: 14, scale: 2 }),
  publicSectorExperience: text("public_sector_experience").$type<TriState>().notNull().default("unknown"),
  openToConsortium: text("open_to_consortium").$type<TriState>().notNull().default("unknown"),
  openToSubcontracting: text("open_to_subcontracting").$type<TriState>().notNull().default("unknown"),
  references: jsonb("references").$type<ProfileReference[]>().notNull().default([]),
  certifications: jsonb("certifications").$type<ProfileCertification[]>().notNull().default([]),
  /** Optioneel; enkel invullen als het nodig is voor financiële selectievoorwaarden. */
  annualRevenueEur: numeric("annual_revenue_eur", { precision: 14, scale: 2 }),
  version: integer("version").notNull().default(1),
  lastConfirmedByClientAt: timestamp("last_confirmed_by_client_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/* ------------------------------------------------------------------ */
/* Bronnen en importtaken                                              */
/* ------------------------------------------------------------------ */
export const source = pgTable("source", {
  id: text("id").primaryKey(), // 'ted' | 'be-eprocurement' | 'manual'
  name: text("name").notNull(),
  automation: text("automation").notNull(), // 'api' | 'manual'
  coverageNote: text("coverage_note").notNull(),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  lastRunStatus: text("last_run_status"),
  lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
  /** Hoogwatermerk voor incrementele import (publicatiedatum yyyymmdd). */
  cursor: text("cursor"),
});

export const importRun = pgTable(
  "import_run",
  {
    id: id(),
    sourceId: text("source_id")
      .notNull()
      .references(() => source.id),
    idempotencyKey: text("idempotency_key").notNull(),
    status: text("status").notNull().default("running"), // running | success | partial | failed
    trigger: text("trigger").notNull().default("manual"), // manual | schedule | sample
    query: text("query"),
    params: jsonb("params").$type<Record<string, unknown>>().notNull().default({}),
    totalReported: integer("total_reported"),
    fetchedCount: integer("fetched_count").notNull().default(0),
    newProcedures: integer("new_procedures").notNull().default(0),
    newNotices: integer("new_notices").notNull().default(0),
    changedProcedures: integer("changed_procedures").notNull().default(0),
    duplicateNotices: integer("duplicate_notices").notNull().default(0),
    errorCount: integer("error_count").notNull().default(0),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("import_run_idem_uq").on(t.sourceId, t.idempotencyKey)],
);

/* ------------------------------------------------------------------ */
/* Publieke aanbestedingsdata (gedeeld)                                */
/* ------------------------------------------------------------------ */
export type ProcedureLifecycle =
  | "prior_information" // vooraankondiging: nooit een open inschrijvingskans
  | "open" // oproep tot mededinging gepubliceerd
  | "awarded" // gunning/resultaat gepubliceerd
  | "cancelled" // ingetrokken/stopgezet
  | "unknown";

export const procedure = pgTable(
  "procedure",
  {
    id: id(),
    sourceId: text("source_id")
      .notNull()
      .references(() => source.id),
    /** Officiële procedure-identifier (TED BT-04 / procedure-identifier) of interne sleutel voor handmatige invoer. */
    externalId: text("external_id").notNull(),
    title: text("title").notNull(),
    titleLanguage: text("title_language"),
    buyerName: text("buyer_name"),
    buyerCountry: text("buyer_country"),
    performanceCountries: jsonb("performance_countries").$type<string[]>().notNull().default([]),
    performanceNuts: jsonb("performance_nuts").$type<string[]>().notNull().default([]),
    officialLanguages: jsonb("official_languages").$type<string[]>().notNull().default([]),
    procedureType: text("procedure_type"),
    contractNature: text("contract_nature"),
    cpvCodes: jsonb("cpv_codes").$type<string[]>().notNull().default([]),
    description: text("description"),
    lifecycle: text("lifecycle").$type<ProcedureLifecycle>().notNull().default("unknown"),
    /** Handmatige statuscorrectie door beheerder (bv. intrekking gemeld buiten TED). */
    lifecycleOverride: text("lifecycle_override").$type<ProcedureLifecycle | null>(),
    lifecycleOverrideNote: text("lifecycle_override_note"),
    summaryNl: text("summary_nl"),
    summaryIsTranslation: boolean("summary_is_translation").notNull().default(false),
    summaryMethod: text("summary_method"), // 'ai' | 'manual'
    summaryVerified: boolean("summary_verified").notNull().default(false),
    /** Vingerafdruk van alle beoordelingsrelevante gegevens. Wijziging ⇒ hercontrole. */
    fingerprint: text("fingerprint").notNull().default(""),
    fingerprintChangedAt: timestamp("fingerprint_changed_at", { withTimezone: true }),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("procedure_source_ext_uq").on(t.sourceId, t.externalId),
    index("procedure_lifecycle_idx").on(t.lifecycle),
  ],
);

export const notice = pgTable(
  "notice",
  {
    id: id(),
    procedureId: uuid("procedure_id")
      .notNull()
      .references(() => procedure.id, { onDelete: "cascade" }),
    sourceId: text("source_id")
      .notNull()
      .references(() => source.id),
    /** TED publicatienummer (bv. 123456-2026) of handmatige referentie. */
    publicationNumber: text("publication_number").notNull(),
    noticeIdentifier: text("notice_identifier"),
    noticeVersion: text("notice_version"),
    noticeType: text("notice_type"),
    formType: text("form_type"),
    publicationDateRaw: text("publication_date_raw"),
    publicationDate: timestamp("publication_date", { withTimezone: true }),
    url: text("url"),
    language: text("language"),
    changeDescription: text("change_description"),
    rawPayload: jsonb("raw_payload"),
    contentHash: text("content_hash").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    importRunId: uuid("import_run_id").references(() => importRun.id),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("notice_source_pub_uq").on(t.sourceId, t.publicationNumber)],
);

export const lot = pgTable(
  "lot",
  {
    id: id(),
    procedureId: uuid("procedure_id")
      .notNull()
      .references(() => procedure.id, { onDelete: "cascade" }),
    lotKey: text("lot_key").notNull(), // bv. LOT-0001 of "1"
    title: text("title"),
    description: text("description"),
    cpvCodes: jsonb("cpv_codes").$type<string[]>().notNull().default([]),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("lot_proc_key_uq").on(t.procedureId, t.lotKey)],
);

export const document = pgTable("document", {
  id: id(),
  procedureId: uuid("procedure_id")
    .notNull()
    .references(() => procedure.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  sourceUrl: text("source_url"),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  sha256: text("sha256").notNull(),
  storagePath: text("storage_path").notNull(),
  version: integer("version").notNull().default(1),
  /** ok | low_coverage | failed | pending */
  textStatus: text("text_status").notNull().default("pending"),
  textStatusDetail: text("text_status_detail"),
  pageCount: integer("page_count"),
  textChars: integer("text_chars"),
  /** Per pagina geëxtraheerde tekst; wordt behandeld als onbetrouwbare invoer. */
  pages: jsonb("pages").$type<string[]>(),
  uploadedByUserId: text("uploaded_by_user_id").references(() => user.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

export type FactKey =
  | "submission_deadline"
  | "participation_deadline"
  | "questions_deadline"
  | "estimated_value"
  | "framework_max_value"
  | "lot_value"
  | "published_budget"
  | "contract_duration"
  | "place_of_performance";

/** Gemeenschappelijk bronbewijs voor feiten en voorwaarden. */
const evidenceColumns = {
  sourceNoticeId: uuid("source_notice_id").references(() => notice.id, { onDelete: "set null" }),
  documentId: uuid("document_id").references(() => document.id, { onDelete: "set null" }),
  documentVersion: integer("document_version"),
  /** Gestructureerd bronveld (bv. TED veldnaam), of pagina/sectie in een document. */
  locator: text("locator"),
  evidenceSnippet: text("evidence_snippet"),
  /** structured_field | ai | manual */
  extractionMethod: text("extraction_method").notNull(),
  /** unverified | verified | rejected | evidence_not_found */
  verificationStatus: text("verification_status").notNull().default("unverified"),
  extractionRunId: uuid("extraction_run_id"),
};

export const fact = pgTable(
  "fact",
  {
    id: id(),
    procedureId: uuid("procedure_id")
      .notNull()
      .references(() => procedure.id, { onDelete: "cascade" }),
    lotId: uuid("lot_id").references(() => lot.id, { onDelete: "cascade" }),
    key: text("key").$type<FactKey>().notNull(),
    /** Oorspronkelijke waarde zoals in de bron. */
    rawValue: text("raw_value").notNull(),
    valueNumber: numeric("value_number", { precision: 16, scale: 2 }),
    unit: text("unit"), // valuta (EUR) of eenheid (MONTH)
    /** Alleen ingevuld als datum + tijd + tijdzone expliciet bekend zijn. */
    valueInstant: timestamp("value_instant", { withTimezone: true }),
    /** Alleen datum bekend (yyyy-mm-dd), tijdstip of tijdzone ontbreekt. */
    valueDate: text("value_date"),
    timeKnown: boolean("time_known").notNull().default(false),
    timezoneKnown: boolean("timezone_known").notNull().default(false),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    ...evidenceColumns,
    createdAt: createdAt(),
  },
  (t) => [index("fact_proc_idx").on(t.procedureId, t.key)],
);

export type RequirementKind = "exclusion" | "selection" | "award_criterion" | "other";
export type RequirementCategory =
  | "reference"
  | "certification"
  | "financial"
  | "language"
  | "security_clearance"
  | "staffing"
  | "legal"
  | "other";

export const requirement = pgTable(
  "requirement",
  {
    id: id(),
    procedureId: uuid("procedure_id")
      .notNull()
      .references(() => procedure.id, { onDelete: "cascade" }),
    lotId: uuid("lot_id").references(() => lot.id, { onDelete: "cascade" }),
    kind: text("kind").$type<RequirementKind>().notNull(),
    category: text("category").$type<RequirementCategory>().notNull().default("other"),
    /** Tekst in de oorspronkelijke taal van de bron. */
    text: text("text").notNull(),
    language: text("language"),
    /** true = expliciet verplicht in bron; null = niet duidelijk. */
    mandatory: boolean("mandatory"),
    /** Gewicht bij gunningscriteria, zoals gepubliceerd. */
    weight: text("weight"),
    /** Laat de bron samenwerking/beroep op derden expliciet toe? documented | not_allowed | unknown */
    consortiumBasis: text("consortium_basis").notNull().default("unknown"),
    consortiumEvidence: text("consortium_evidence"),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    ...evidenceColumns,
    createdAt: createdAt(),
  },
  (t) => [index("req_proc_idx").on(t.procedureId)],
);

/** Eén AI-extractie per (procedure, documentset); hergebruikt voor alle klanten. */
export const extractionRun = pgTable("extraction_run", {
  id: id(),
  procedureId: uuid("procedure_id")
    .notNull()
    .references(() => procedure.id, { onDelete: "cascade" }),
  inputHash: text("input_hash").notNull(),
  model: text("model").notNull(),
  schemaVersion: text("schema_version").notNull(),
  status: text("status").notNull(), // success | invalid_output | failed
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  costEur: numeric("cost_eur", { precision: 10, scale: 4 }),
  durationMs: integer("duration_ms"),
  output: jsonb("output"),
  validationIssues: jsonb("validation_issues").$type<string[]>().notNull().default([]),
  errorMessage: text("error_message"),
  createdByUserId: text("created_by_user_id"),
  createdAt: createdAt(),
});

/* ------------------------------------------------------------------ */
/* Beoordeling (klantgebonden, geversioneerd)                          */
/* ------------------------------------------------------------------ */
export type ConditionStatus = "met" | "not_met" | "unknown" | "not_applicable";
export type ConditionAssessment = {
  requirementId: string;
  status: ConditionStatus;
  /** explicit_source = rechtstreeks uit bron vs. profiel; interpretation = onze lezing */
  basis: "explicit_source" | "interpretation";
  note?: string | null;
  /** Automatische suggestie (nooit automatisch toegepast). */
  suggestedStatus?: ConditionStatus | null;
  suggestionReason?: string | null;
};

export type AssessmentStatus =
  | "draft"
  | "to_review"
  | "approved"
  | "published"
  | "superseded"
  | "rejected";

export type Advice = "investigate" | "check_missing" | "not_suitable";

export const scoringConfig = pgTable("scoring_config", {
  id: id(),
  version: integer("version").notNull().unique(),
  config: jsonb("config").notNull(),
  active: boolean("active").notNull().default(false),
  note: text("note"),
  createdAt: createdAt(),
});

export const assessment = pgTable(
  "assessment",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    procedureId: uuid("procedure_id")
      .notNull()
      .references(() => procedure.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    status: text("status").$type<AssessmentStatus>().notNull().default("draft"),
    isCurrent: boolean("is_current").notNull().default(true),
    scoringConfigVersion: integer("scoring_config_version").notNull(),
    profileVersion: integer("profile_version").notNull(),
    procedureFingerprint: text("procedure_fingerprint").notNull(),
    /** Bronwijziging na goedkeuring/publicatie: zichtbaar maken, niet verbergen. */
    stale: boolean("stale").notNull().default(false),
    staleReason: text("stale_reason"),
    relevanceScore: integer("relevance_score"),
    relevance: jsonb("relevance").notNull(),
    conditions: jsonb("conditions").$type<ConditionAssessment[]>().notNull().default([]),
    feasibility: jsonb("feasibility").notNull(),
    blockers: jsonb("blockers").$type<{ code: string; label: string; hard: boolean }[]>().notNull().default([]),
    missingInfo: jsonb("missing_info").$type<string[]>().notNull().default([]),
    advice: text("advice").$type<Advice>().notNull(),
    /** Redactionele teksten van de beheerder (interpretatie, visueel gescheiden van feiten). */
    fitExplanation: text("fit_explanation"),
    obstaclesNote: text("obstacles_note"),
    nextAction: text("next_action"),
    createdByUserId: text("created_by_user_id"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedByUserId: text("approved_by_user_id"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("assessment_org_proc_version_uq").on(t.organizationId, t.procedureId, t.version),
    index("assessment_org_status_idx").on(t.organizationId, t.status),
  ],
);

export const reviewDecision = pgTable("review_decision", {
  id: id(),
  assessmentId: uuid("assessment_id")
    .notNull()
    .references(() => assessment.id, { onDelete: "cascade" }),
  reviewerUserId: text("reviewer_user_id").notNull(),
  decision: text("decision").notNull(), // submit | approve | reject | publish | unpublish | invalidate
  comment: text("comment"),
  createdAt: createdAt(),
});

/* ------------------------------------------------------------------ */
/* Klantinteractie                                                     */
/* ------------------------------------------------------------------ */
export const trackedOpportunity = pgTable(
  "tracked_opportunity",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    procedureId: uuid("procedure_id")
      .notNull()
      .references(() => procedure.id, { onDelete: "cascade" }),
    followedByUserId: text("followed_by_user_id"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("tracked_org_proc_uq").on(t.organizationId, t.procedureId)],
);

export type FeedbackKind =
  | "interesting"
  | "not_relevant"
  | "investigating"
  | "bid_submitted"
  | "won"
  | "lost";

export const feedback = pgTable(
  "feedback",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    procedureId: uuid("procedure_id")
      .notNull()
      .references(() => procedure.id, { onDelete: "cascade" }),
    assessmentId: uuid("assessment_id").references(() => assessment.id, { onDelete: "set null" }),
    userId: text("user_id"),
    kind: text("kind").$type<FeedbackKind>().notNull(),
    reason: text("reason"),
    createdAt: createdAt(),
  },
  (t) => [index("feedback_org_proc_idx").on(t.organizationId, t.procedureId)],
);

/* ------------------------------------------------------------------ */
/* Digest en verzending                                                */
/* ------------------------------------------------------------------ */
export const digest = pgTable("digest", {
  id: id(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // weekly | change_alert
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
  /** draft | approved | sending | handed_to_smtp | partially_handed | failed | not_configured
   *  handed_to_smtp = door de SMTP-server aanvaard; dat is GEEN bevestigde aflevering in de mailbox. */
  status: text("status").notNull().default("draft"),
  subject: text("subject").notNull(),
  intro: text("intro"),
  items: jsonb("items").$type<{ assessmentId: string; procedureId: string }[]>().notNull().default([]),
  html: text("html").notNull(),
  textBody: text("text_body").notNull(),
  approvedByUserId: text("approved_by_user_id"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const emailDelivery = pgTable(
  "email_delivery",
  {
    id: id(),
    digestId: uuid("digest_id")
      .notNull()
      .references(() => digest.id, { onDelete: "cascade" }),
    /** client = echte verzending naar de klant; test = testverzending naar de beheerder (telt nooit als klantverzending). */
    kind: text("kind").notNull().default("client"),
    recipient: text("recipient").notNull(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    /** pending | sending | handed_to_smtp | failed | not_configured */
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    providerMessageId: text("provider_message_id"),
    /** Laatste SMTP-antwoordregel (bv. "250 2.0.0 queued as ..."). */
    smtpResponse: text("smtp_response"),
    lastError: text("last_error"),
    /** Tijdstip waarop de SMTP-server het bericht aanvaardde. */
    handedOffAt: timestamp("handed_off_at", { withTimezone: true }),
    /** unknown | delivered | bounced — enkel te bevestigen via provider-webhook of bounce; in de pilot altijd "unknown". */
    deliveryState: text("delivery_state").notNull().default("unknown"),
    deliveryStateAt: timestamp("delivery_state_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("delivery_digest_idx").on(t.digestId)],
);

/* ------------------------------------------------------------------ */
/* Audit                                                               */
/* ------------------------------------------------------------------ */
export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    actorUserId: text("actor_user_id"),
    organizationId: uuid("organization_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    /** Nooit documentinhoud of onnodige persoonsgegevens. */
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  },
  (t) => [index("audit_at_idx").on(t.at)],
);
