# Architecture

ImmoRadar is a multi-tenant Next.js application with a clear split between **pure intelligence engines**, **services** that orchestrate them against PostgreSQL, and a **thin presentation layer**.

## Data flow

```
Collector (fixture / permitted source)
   │  RawListing[]                      ── src/collectors
   ▼
Ingestion                               ── src/ingestion/ingest-listings.ts
   ├─ normalizeListing()                ── src/normalization
   ├─ SellerClassifier.classify()       ── src/classification
   ├─ matchProperty()  → Property       ── src/matching
   ├─ ListingSnapshot (only when content changed)
   ├─ detectSnapshotEvents()            ── src/events
   ├─ evaluateMissingListing()          (removal needs confirmation)
   └─ detectStaleEvents() / detectPropertyRelist()
   │  ListingEvent (dedupeKey, processedAt = null)
   ▼
Opportunity engine                      ── src/services/opportunity-engine.ts
   for each unprocessed event × each active agency:
   ├─ matchTerritory()                  (gate: only inside territories)
   ├─ findCrmMatch()  (tenant-scoped)   ── src/services/crm-match-service.ts + src/crm/crm-matcher.ts
   ├─ computeMarketScore()              ── src/services/scoring-service.ts + src/scoring
   ├─ upsert Opportunity (+ signals, score history, activities)
   ├─ auto-assign to the contact's agent
   └─ evaluateOpportunityAlerts()       ── src/notifications/alert-service.ts
   ▼
LeadRevive engine                       ── src/services/leadrevive-engine.ts
   for each agency: detectDormantLead() per contact → LEADREVIVE opportunities
   ▼
UI: Today's Opportunities · Detail · LeadRevive · Properties/Timeline · Pipeline · Analytics
Workflow actions → OpportunityActivity → analytics funnel
Morning digest                           ── src/notifications/digest-service.ts
```

## Layers

| Layer | Folder | Rules |
| --- | --- | --- |
| Domain | `src/domain` | Types only; no I/O |
| Engines | `normalization`, `matching`, `classification`, `events`, `scoring`, `crm` | Pure functions, fully unit-tested, no Prisma imports |
| Services | `src/services`, `src/ingestion`, `src/notifications`, `src/collectors/runner.ts` | Orchestrate engines with Prisma; take `TenantContext` for tenant data |
| Repositories | `src/repositories` | Read models; every tenant query filters by `ctx.agencyId` |
| Presentation | `src/app`, `src/actions`, `src/components` | Server components + server actions; Zod-validate all input; never build tenant scope from user input |
| Jobs | `src/jobs` | Pipeline orchestration for CLI, cron API and admin UI |

## Multi-tenancy

- `Agency` is the tenant. `User.agencyId` binds users; `PLATFORM_ADMIN` users have none and choose an agency context (cookie).
- `tenantContextFor(actor, requestedAgencyId)` ignores the request for non-platform roles.
- Shared platform data: `Source`, `CollectorRun`, `Property`, `Listing`, `ListingSnapshot`, `ListingEvent`, `SellerIdentity`, `AgencyIdentity`.
- Tenant data (all carry `agencyId` and are indexed on it): `Territory`, `CrmContact`, `CrmInteraction`, `CrmImport`, `CrmImportRow`, `ContactPropertyRelationship`, `Opportunity`, `OpportunitySignal`/`OpportunityScore` (via opportunity), `OpportunityAssignment`, `OpportunityActivity`, `AlertRule`, `Alert`, `AuditLog`.

## Idempotency

Everything the pipeline writes has a natural key: listings by `(sourceId, sourceListingId)`, snapshots by content hash, events by `dedupeKey`, opportunities by `(agencyId, dedupeKey)` plus a one-open-opportunity-per-property rule, signals by `(opportunityId, code)`, alerts by `dedupeKey`. Re-running any job with the same input changes nothing.

## Configuration

Centralised and testable: `src/scoring/config.ts` (all weights), `src/events/config.ts` (price threshold, removal confirmations, relist window, stale days), `src/domain/property/match-result.ts` (match thresholds), `src/crm/crm-matcher.ts` (CRM match weights/threshold), `src/lib/env.ts` (environment).

## Security posture

Session cookies (HttpOnly, SameSite=Lax, secure in prod, hashed server-side), bcrypt passwords, uniform-timing login, RBAC, tenant scoping in every query, Zod validation in every action/route, safe error messages, JSON logs with redaction, audit log for sensitive actions, security headers in `next.config.ts`, Prisma parameterised queries only.
