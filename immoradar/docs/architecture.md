# Architecture

## Product principle

ImmoRadar is a **real estate acquisition intelligence engine**: it combines external
market signals with existing agency relationships to answer *"who should this agency
contact today to win the next seller mandate?"*. The intelligence engine comes first;
the UI is a window onto it.

## Layering

```
┌─────────────────────────────────────────────────────────┐
│ src/app            Next.js UI (server components,       │
│                    server actions) — no business logic  │
├─────────────────────────────────────────────────────────┤
│ src/services       DB-backed orchestration              │
│ src/ingestion      (opportunity, leadrevive, import,    │
│ src/jobs           alerts, digest, workflow, analytics) │
├─────────────────────────────────────────────────────────┤
│ src/repositories   TenantDb — tenant-scoped data access │
├─────────────────────────────────────────────────────────┤
│ src/domain         Pure intelligence engines:           │
│ src/normalization  no I/O, no framework imports,        │
│ src/matching       deterministic, unit-tested           │
│ src/classification                                      │
│ src/events                                              │
│ src/scoring                                             │
│ src/crm (pure parts)                                    │
├─────────────────────────────────────────────────────────┤
│ src/collectors     Collector framework + fixtures       │
│ src/notifications  Telegram client                      │
│ src/lib            db, auth, config, csv, logger        │
└─────────────────────────────────────────────────────────┘
```

Domain logic is deliberately independent from the UI and from Prisma: every engine
(normalizer, matcher, classifier, event detector, scorer, CRM matcher, dormant
detector) is a pure function operating on plain types, so it can be tested with
fixtures and reused by any orchestration layer.

## Data flow

1. **Collect** — `runCollectors` executes each `ListingCollector` with retries,
   exponential backoff, per-attempt timeouts and failure isolation. Results feed
   `CollectorRun` rows for source-health monitoring.
2. **Ingest** — `IngestionService` normalizes each `RawListing`, resolves the physical
   `Property` via the weighted matching engine, classifies the seller, stores a
   `ListingSnapshot` (with the original payload for audit) and runs event detection.
3. **Events** — price changes, seller-type flips, stale thresholds, confirmed removals
   and relists become `ListingEvent` rows. Removal requires confirmation across
   multiple successful runs — a collector outage never produces removal events.
4. **Opportunities** — per agency, `OpportunityService` filters events by territory,
   derives an opportunity type, searches the agency's own CRM for a matching contact,
   computes the score breakdown and upserts the `Opportunity` with signals + scores.
5. **LeadRevive** — `LeadReviveService` scans the agency's CRM for dormant leads and
   creates CRM-origin opportunities with explicit uncertainty statements.
6. **Notify** — `AlertService` turns qualifying opportunities into deduplicated,
   persisted alerts delivered via Telegram; `DigestService` builds the morning brief.
7. **Work** — `WorkflowService` drives the lightweight acquisition pipeline
   (NEW → … → MANDATE_WON) with an audited activity trail; `AnalyticsService`
   derives the funnel exclusively from recorded transitions.

## Tenancy model

- Shared platform data: `Source`, `CollectorRun`, `Property`, `Listing`,
  `ListingSnapshot`, `ListingEvent`, `SellerIdentity`, `AgencyIdentity`.
- Tenant-isolated data: everything carrying `agencyId` — CRM tables, opportunities,
  territories, alerts, imports, assignments, audit logs, settings.
- All tenant-table access flows through `TenantDb`, which injects the `agencyId`
  filter. Cross-tenant enrichment is impossible: CRM candidate queries are always
  executed through the tenant handle of the agency being processed.

## Extension points

- **Collectors** — implement `ListingCollector` (see `docs/adding-data-source.md`).
- **CRM adapters** — implement `CrmAdapter` (see `docs/adding-crm-adapter.md`).
- **AI seller classifier** — `classifySeller` is deterministic; an optional AI
  classifier can be layered behind the same `SellerClassification` return shape.
  LLM usage is never required.
- **Scoring** — all weights/points live in `src/scoring/config.ts`.
