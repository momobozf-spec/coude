# Data ingestion

Package: `packages/ingestion`. It runs in the worker (BullMQ), or in the API process when there is no Redis.

```
StoreProvider ─► raw records ─► Zod validation ─► ProductNormalizer ─► ProductMatchingEngine
     │                                                               (link / review / create canonical)
     ├─► prices ─► PriceObservation (dedup) ─► current_prices (newer wins)
     └─► promotions ─► promotions + conditions + products
                         │
                         ▼
          cache invalidation (catalog version) ─► PriceAlert evaluation ─► notifications + push
```

## ProviderSync lifecycle

`QUEUED → RUNNING → SUCCESS | PARTIAL | FAILED`. Each sync stores its counters: read, created, updated, failed. The status is decided as follows:

- A bad record is written to `ingest.provider_errors` with its stage (`FETCH`, `VALIDATION`, `NORMALIZATION`, `MATCHING`, `PERSIST`, `ALERTS`) and the raw payload. The run continues, and the sync ends **PARTIAL**.
- A provider that throws (HTTP error, UNSUPPORTED, crash) marks only its own sync **FAILED**. Other providers' jobs are unaffected, and BullMQ retries with exponential backoff.
- A FULL sync runs only the stages the provider declares in `capabilities`.

## Idempotency

- Retailer products are upserted by `(retailer, SKU)`. A linked product with an unchanged title keeps its link. Human decisions (CONFIRMED/REJECTED) are always honoured.
- Price observations are deduplicated by `(retailer product, observed_at, source)`.
- `current_prices` only moves forward in time.
- Promotions are upserted by `(retailer, external id)`, and their product set is replaced.
- Alert triggers are deduplicated by a unique key `(alert, retailer product, price, promo)`.

## Queues and schedules (worker)

| Queue           | Job                             | Notes                                                                                         |
| --------------- | ------------------------------- | --------------------------------------------------------------------------------------------- |
| `provider-sync` | `{ syncId, providerKey, kind }` | API admin triggers, and scheduled jobs from `SYNC_SCHEDULES` (`upsertJobScheduler`, UTC cron) |
| `price-alerts`  | `{ variantIds }`                | Enqueued by the pipeline hook after price or promo changes                                    |

After CATALOG/FULL syncs, the worker refreshes equivalences (`EquivalenceIndexer`) and bumps the catalogue cache version in Redis.

## Development seed <a id="development-seed"></a>

`pnpm db:seed:dev [--reset]`:

1. Runs migrations and reference data.
2. Runs `DevelopmentSeedProvider` through the **same pipeline**. That means 40 canonical products, 86 listings over 7 retailers, 13 weeks of history (with sparse history for Lidl milk, to show "onvolledige geschiedenis"), and 10 promotions covering every mechanic, including loyalty-card and upcoming ones.
3. Refreshes equivalences.
4. Creates demo users (Mohamed with Plus, Sara with Free, Admin), preferences, a shared list and favourites.

Fixture GTINs are in the GS1 restricted-circulation range (`20…`), so they can never collide with real products. Every row is `DEVELOPMENT_SEED`. `resetDevelopmentData` removes them.

## Vertical slice 3 in development

`POST /v1/admin/dev/price-observations` (admin, non-production) imports one observation through `pipeline.recordPrice`. That runs alert evaluation, which creates a notification and a push. The integration test _"Vertical slice 3"_ covers this, including no duplicates, re-arming and the cooldown.
