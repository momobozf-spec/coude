# Opportunity engine

`src/services/opportunity-service.ts` converts market events into per-agency
commercial opportunities.

## Pipeline per agency

1. Load the agency's territories; skip agencies without any.
2. Load active sale listings that have at least one `ListingEvent`.
3. Territory-match each listing's property (postal code > municipality > province).
4. Derive the opportunity type from the listing's event history (priority order):

   | Condition (private seller unless noted) | Type |
   | --- | --- |
   | `AGENCY_TO_PRIVATE` event (any seller) | `AGENCY_TO_PRIVATE` |
   | `RELISTED` event | `PRIVATE_RELIST` |
   | ≥ 2 price drops | `PRIVATE_MULTIPLE_PRICE_DROP` |
   | `STALE_60`/`STALE_90` | `STALE_FSBO` |
   | exactly 1 price drop | `PRIVATE_PRICE_DROP` |
   | `STALE_30` | `STALE_FSBO` |
   | `FSBO_DETECTED` | `NEW_FSBO` |

5. Run CRM ↔ market matching **within this agency's contacts only**
   (see `crm-matching.md`). A match upgrades the origin to `CROSS`.
6. Compute the full score breakdown (see `scoring.md`) and upsert:
   - new opportunity → created with signals (linked to events) + score snapshot
   - existing opportunity → re-scored only when something changed; terminal
     statuses (`DISMISSED`, `LOST`, `MANDATE_WON`) are never reopened.

## Event engine guarantees

`src/events/event-detector.ts`:

- **Price events** carry `{ oldPrice, newPrice, difference, percentage }` and ignore
  sub-0.5% noise.
- **Stale events** fire exactly once per threshold (30/60/90 days observed).
- **Removal confirmation**: a listing missing from a successful collector run enters
  `PENDING_REMOVAL`; `LISTING_REMOVED` is only confirmed after ≥ 2 consecutive
  missing successful runs **and** ≥ 24h missing (both configurable). Failed or
  partial collector runs never advance removal state — no false removals from
  collector outages.
- **Relist detection**: a new listing on a property whose previous listing was
  removed within the 120-day window emits `RELISTED` with `daysOffMarket`.
- **FSBO detection** requires `PRIVATE` classification at ≥ 0.6 confidence on a sale
  listing, and fires once per listing.

Configuration: `DEFAULT_EVENT_CONFIG` in the same module.
