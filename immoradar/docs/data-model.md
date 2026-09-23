# Data model

Prisma schema: `prisma/schema.prisma`. This page explains intent; the schema is the source of truth.

## Tenancy & identity

- **Agency** — the tenant. Holds configuration: `alertMinScore`, `telegramChatId`, `digestEnabled`, `digestHourLocal`, `timezone`, `crmRetentionDays`, `dormantMonths`, `autoAssignByAgent`.
- **User** — belongs to an agency (except platform admins). `role`: `PLATFORM_ADMIN | AGENCY_ADMIN | AGENT`. Optional personal `telegramChatId`.
- **Session** — DB-backed sessions (`tokenHash`, `expiresAt`).
- **Territory** — `(agencyId, type, normalizedValue)` unique; `type`: `POSTAL_CODE | MUNICIPALITY | PROVINCE`.

## Data collection

- **Source** — one row per collector: kind, permitted-access note, polling/rate-limit/timeout/retry config, health, failure counters.
- **CollectorRun** — one row per execution: status, attempts, duration, listings collected/new/updated/unchanged, events generated, errors, metrics JSON.

## Property intelligence (shared)

- **Property** — the physical property: address parts, `normalizedAddressKey` (`street|number|postalcode`), municipality, province, coordinates, type, bedrooms, surface. Indexed on address key and postal code.
- **Listing** — an advertisement: `(sourceId, sourceListingId)` unique; `listingType` (SALE/RENT); `sellerType` + `sellerConfidence` + `sellerReasons`; `currentPrice`/`initialPrice`; `firstSeenAt`/`lastSeenAt`/`removedAt`/`relistedAt`; `status` `ACTIVE | MISSING | REMOVED`; `missingCount` (removal confirmation); `priceDropCount`; match `confidence`/`decision`/`reasons`.
- **ListingSnapshot** — historical state per change: price, title, description, seller name/phone/email, seller type, status, `contentHash`, `rawData`. The lifecycle of a listing can be fully reconstructed from its snapshots.
- **ListingEvent** — derived facts: type, `occurredAt`, old/new price, difference, percentage, `dedupeKey` (unique), payload, `processedAt` (null until the opportunity engine consumed it).
- **SellerIdentity** — cross-listing seller identity by normalized phone/email; carries active `listingCount` (a professional signal).
- **AgencyIdentity** — known professional agency brands (helps classification).

## LeadRevive (tenant-isolated)

- **CrmImport** — one per import run: adapter, file, status, counters (created/updated/duplicate/conflict/invalid).
- **CrmImportRow** — per-row outcome with `rawData` and recorded `conflicts` (never silently overwritten).
- **CrmContact** — normalized contact with original `sourceValues`, `dedupeKey` unique per agency, `externalContactId`, `contactType`, `status`, `assignedUserId`, `lastContactAt`, `deletedAt` (soft delete after erasure). Indexed on normalized phone/email/name/address key, postal code, type/status and last contact.
- **CrmInteraction** — CRM history (call, email, meeting, valuation, viewing, note, import).
- **ContactPropertyRelationship** — the graph edge person → property: `relationshipType` (`BOUGHT`, `SOLD`, `VALUATION_REQUESTED`, `OWNER`, …), `year`, `addressKey` (works even before a Property row exists), optional `propertyId` (linked when the property enters the market data).

## Intelligence graph in PostgreSQL

```
CrmContact ──CrmInteraction
    │
    └─ContactPropertyRelationship ──► Property ──► Listing ──► ListingSnapshot
                                                     │
                                                     └──► ListingEvent ──► OpportunitySignal ──► Opportunity ──► CrmContact
```

No graph database is needed: every edge is a foreign key with an index in the direction the engines traverse it.

## Opportunities

- **Opportunity** — `(agencyId, dedupeKey)` unique; `engine` `IMMORADAR | LEADREVIVE`; `type`; `status` (lifecycle); links to property/listing/contact; `crmMatched` + confidence + reasons; the five component scores + `score` + `scoreReasons`; `detectedAt`, `lastSignalAt`, `assignedUserId`, `snoozedUntil`, `contactedAt`, `closedAt`. Indexed for the main screen: `(agencyId, status, score desc)`.
- **OpportunitySignal** — one row per reason code with weight, kind and optional `listingEventId` for traceability.
- **OpportunityScore** — score history with the scoring config version.
- **OpportunityAssignment** — assignment history.
- **OpportunityActivity** — every lifecycle change (`CREATED`, `ASSIGNED`, `STATUS_CHANGED`, `CONTACTED`, `SNOOZED`, `DISMISSED`, `NOTE`, `ALERT_SENT`, `RESCORED`, `CRM_MATCHED`) — the sole basis for analytics.

## Alerts & audit

- **AlertRule** — per agency and type (`HOT_OPPORTUNITY`, `CRM_MARKET_MATCH`, `MORNING_DIGEST`): enabled, min score.
- **Alert** — persisted history with `dedupeKey` unique, status (`PENDING/SENT/FAILED/SKIPPED`), recipient, error.
- **AuditLog** — who did what to which entity; metadata contains ids, never personal data.
