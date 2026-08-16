# Data model

Schema: `prisma/schema.prisma`. Groups:

## Tenancy & identity

- **Agency** — the tenant. Carries notification config (Telegram chat, min alert
  score, digest hour) and optional CRM retention policy.
- **User** — belongs to an agency (nullable for platform admins). Roles:
  `PLATFORM_ADMIN`, `AGENCY_ADMIN`, `AGENT`. scrypt password hash.
- **Territory** — agency commercial area: `POSTAL_CODE`, `MUNICIPALITY` or
  `PROVINCE`, with normalized `value` (unique per agency+kind+value).

## Collection infrastructure (shared)

- **Source** — a data source with politeness config (poll interval, rate limit,
  timeout, retries) and status.
- **CollectorRun** — one execution: counts, status (`SUCCESS`/`PARTIAL`/`FAILED`),
  duration, error. Feeds the Collector Health screen.

## Property intelligence (shared)

- **Property** — the physical property: normalized address parts, geo, type,
  bedrooms, surface. Indexed on `(postalCode, street, houseNumber)`.
- **Listing** — an advertisement of a property at a source
  (`@@unique([sourceId, sourceListingId])`). Carries the seller classification
  (`sellerType` + `sellerConfidence`), current price, `firstSeenAt`/`lastSeenAt`,
  and removal-confirmation state (`status`, `missingSince`).
- **ListingSnapshot** — point-in-time state including the raw source payload
  (`rawData`) for audit; enables full lifecycle reconstruction.
- **ListingEvent** — detected market events (`NEW_LISTING`, `FSBO_DETECTED`,
  `PRICE_DROP`, `PRICE_INCREASE`, `STALE_30/60/90`, `LISTING_REMOVED`, `RELISTED`,
  `AGENCY_TO_PRIVATE`, `PRIVATE_TO_AGENCY`) with structured payloads.
- **SellerIdentity / AgencyIdentity** — extracted seller/agency identity per listing
  (normalized phone is a key CRM-matching signal).

## CRM (tenant-isolated)

- **CrmContact** — imported contact with both original and normalized match keys
  (`normalizedName`, `normalizedEmail`, `normalizedPhone`), contact type, status,
  assigned agent (mapped to a user when possible), timestamps.
  `@@unique([agencyId, externalContactId])` plus match-key indexes.
- **CrmInteraction** — historical interactions (calls, visits, valuations…).
- **CrmImport / CrmImportRow** — full import provenance: every row with its raw
  data and outcome (`CREATED`, `UPDATED`, `SKIPPED_DUPLICATE`, `SKIPPED_CONFLICT`,
  `ERROR`) and message.
- **ContactPropertyRelationship** — the intelligence-graph edge between a contact
  and a physical property (`BOUGHT`, `SOLD`, `VALUATION_REQUESTED`, `OWNER`…).

## Opportunities (tenant-isolated)

- **Opportunity** — typed (`NEW_FSBO`, `STALE_FSBO`, `PRIVATE_PRICE_DROP`,
  `PRIVATE_MULTIPLE_PRICE_DROP`, `PRIVATE_RELIST`, `AGENCY_TO_PRIVATE` + LeadRevive
  types), with origin (`MARKET`/`CRM`/`CROSS`), lifecycle status, optional property,
  listing and contact links, and CRM match metadata.
- **OpportunitySignal** — the evidence trail (linked to `ListingEvent` where
  applicable).
- **OpportunityScore** — versioned score snapshots: total + the five component
  scores + reasons + full breakdown JSON for the explanation UI.
- **OpportunityAssignment / OpportunityActivity** — who works it and everything
  that happened (status changes, notes, assignments), driving analytics.

## Alerts & audit (tenant-isolated)

- **AlertRule** — per-agency alert configuration by kind/channel.
- **Alert** — persisted notification with `@@unique([agencyId, dedupeKey])` making
  duplicate alerts structurally impossible; delivery status and error retained.
- **AuditLog** — logins, imports, status/settings changes with metadata.

## The intelligence graph

PERSON → CRM CONTACT → INTERACTION and PERSON → PROPERTY RELATIONSHIP → PROPERTY →
LISTING → LISTING HISTORY → MARKET SIGNAL → OPPORTUNITY are all modeled as relational
edges above — deliberately in PostgreSQL, no graph database needed at this scale.
