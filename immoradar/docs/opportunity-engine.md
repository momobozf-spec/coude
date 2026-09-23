# Property history, event engine and the ImmoRadar opportunity engine

## Snapshots

Every ingestion of a listing computes a content hash over price, title, description, seller name/phone/email, seller type and status. A new `ListingSnapshot` is stored only when the hash changed (the listing's `lastSeenAt` is always updated). The first snapshot and each subsequent change give a complete, replayable lifecycle.

## Events (`src/events/event-engine.ts`)

| Event | Trigger |
| --- | --- |
| `NEW_LISTING` | first snapshot |
| `FSBO_DETECTED` | first snapshot with seller `PRIVATE`, or a later transition to `PRIVATE` |
| `PRICE_DROP` / `PRICE_INCREASE` | price changed by ≥ `minPriceChangePct` (0.5 %); carries old/new price, difference, percentage |
| `AGENCY_TO_PRIVATE` / `PRIVATE_TO_AGENCY` | seller type transition between snapshots |
| `STALE_30` / `STALE_60` / `STALE_90` | active listing observed ≥ N days (`dedupeKey` `…:once` → emitted once) |
| `LISTING_REMOVED` | source reports removal, **or** the listing was missing from `removalConfirmations` (2) consecutive successful runs **and** ≥ `removalMinHours` (24) passed since last seen |
| `RELISTED` | a removed listing reappears, or a new listing appears on a property whose previous listing was removed within `relistWindowDays` (180) |

Missing listings are evaluated only after a **successful** run of the same source, so a failed or partial collector run can never mark anything as removed.

Config: `src/events/config.ts`.

## Opportunity types

| Event | Opportunity (private sale listings only) |
| --- | --- |
| `FSBO_DETECTED` | `NEW_FSBO` |
| `STALE_*` | `STALE_FSBO` |
| `PRICE_DROP` (1) | `PRIVATE_PRICE_DROP` |
| `PRICE_DROP` (≥ 2) | `PRIVATE_MULTIPLE_PRICE_DROP` |
| `RELISTED` | `PRIVATE_RELIST` |
| `AGENCY_TO_PRIVATE` | `AGENCY_TO_PRIVATE` |

Professional listings and rentals never become seller opportunities. `LISTING_REMOVED` / `PRIVATE_TO_AGENCY` add a note to open opportunities.

## Engine loop (`src/services/opportunity-engine.ts`)

For each unprocessed event and each active agency:

1. **Territory gate** — the property must match a territory (postal code, municipality or province).
2. **CRM ↔ market match** inside that agency's CRM only (see `crm-matching.md`).
3. **Scoring** (see `scoring.md`).
4. **Upsert** — one open ImmoRadar opportunity per (agency, property). New signals *upgrade* the type by priority (`PRIVATE_RELIST` > `AGENCY_TO_PRIVATE` > multiple drops > drop > stale > new FSBO) and re-score. A property closed (dismissed/lost/won) within 90 days is not re-opened unless a `RELISTED` or `AGENCY_TO_PRIVATE` signal arrives.
5. **Auto-assignment** to the CRM contact's agent when the agency enables it.
6. **Alerts** — see the Telegram section of the README.
7. Mark the event `processedAt`.

Every reason is stored as an `OpportunitySignal` (event signals link back to the `ListingEvent`) so the detail page can explain *why*.
