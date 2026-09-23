# Architecture

## Goals

1. Answer one question well: _where is my shopping cheapest today?_
2. Never mislead. Sample, crowdsourced and live prices are always labelled, and missing products are never hidden.
3. Keep domain, infrastructure, ingestion, providers and UI strictly separate, so retailers, countries and data sources can be added without rewriting the core.

## System overview

```
 ┌───────────── Mobile (Expo) ─────────────┐   ┌──── Admin (Vite/React) ────┐
 │ screens → React Query → typed endpoints │   │ match review, syncs, errors │
 └──────────────┬──────────────────────────┘   └─────────────┬──────────────┘
                │ HTTPS (JSON, Zod-validated) + Socket.IO      │
        ┌───────▼───────────────────────────────────────────────▼───────┐
        │ API (NestJS)                                                   │
        │  auth · search · products · lists · basket · alerts · admin   │
        │  CatalogService / ShopperContext → pure engines                │
        └──────┬───────────────┬──────────────────┬──────────────────────┘
               │ Drizzle        │ BullMQ            │ Redis (cache version,
        ┌──────▼─────┐   ┌──────▼──────────┐       │  rate limits, WS fan-out)
        │ PostgreSQL │◄──│ Worker          │───────┘
        │ catalog    │   │ provider sync → ingestion pipeline → alerts → push
        │ ingest     │   └──────┬──────────┘
        │ app        │          │ StoreProvider contract
        └────────────┘   ┌──────▼──────────────────────────────────────┐
                         │ Retailer providers (UNSUPPORTED), Open Prices, │
                         │ PartnerFeedProvider, DevelopmentSeedProvider   │
                         └───────────────────────────────────────────────┘
```

## Layering rules

| Layer                                 | Packages                                                              | May depend on                                  |
| ------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------- |
| Primitives                            | `shared`                                                              | nothing                                        |
| Domain                                | `domain`, `i18n`, `validation`                                        | primitives                                     |
| Engines (pure, deterministic, no I/O) | `pricing-engine`, `product-matching`, `basket-engine`, `alert-engine` | domain, primitives                             |
| Infrastructure                        | `database`, `store-providers`                                         | domain, engines (types only)                   |
| Application                           | `ingestion`, `apps/api`, `apps/worker`                                | everything above                               |
| UI                                    | `ui`, `apps/mobile`, `apps/admin`                                     | `shared`, `domain`, `i18n`, `validation`, `ui` |

ESLint enforces the UI rule: mobile, admin and `ui` cannot import the engines, database, providers or ingestion. UI never computes prices or matches; it formats what the API returns.

## Key decisions

| Decision          | Choice                                              | Why                                                                                                                                       |
| ----------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Backend framework | **NestJS 12**                                       | DI, modules, guards and gateways give structure for a growing team. It works with ESM and Express 5.                                      |
| ORM               | **Drizzle**                                         | SQL-first and typed. First-class PostgreSQL features (pg schemas, GIN/trgm indexes, `ON CONFLICT … WHERE`). No binary engine to download. |
| Search            | **PostgreSQL `pg_trgm` + canonical tokens**         | Handles typos, partial words and NL/FR/EN synonyms with GIN indexes. No extra search cluster until scale demands one.                     |
| Money             | **Integer cents**                                   | No floating-point drift. Rounding is half-up per line, as on BE/NL receipts.                                                              |
| Queue             | **BullMQ (Redis)**                                  | Retries, backoff, cron-style job schedulers. Without Redis, jobs run in-process so development only needs PostgreSQL.                     |
| Realtime          | **Socket.IO** (+ Redis adapter)                     | Rooms per list, membership-checked joins, horizontal fan-out.                                                                             |
| Mobile            | **Expo + expo-router**                              | One codebase for iOS/Android, OTA-friendly, typed routes, managed native modules (camera, push, secure store).                            |
| Monorepo          | **pnpm workspaces**, hoisted                        | Metro needs a hoisted `node_modules`. Workspace packages ship TypeScript sources through the `@superrette/source` export condition.       |
| Entitlements      | **Database-driven** (`plans`, `plan_entitlements`)  | Free/Plus rules change without an app release.                                                                                            |
| Data provenance   | `data_origin` on every price, promotion and product | The UI can always tell users what kind of data they are looking at. Production excludes `DEVELOPMENT_SEED` at query level.                |

## Canonical product model

- **Product**: a canonical, retailer-independent product line (brand, type, variant, dietary attributes). Example: "Coca-Cola Zero Sugar".
- **ProductVariant**: the concrete comparable item (size/pack, net content, GTINs). Example: "Coca-Cola Zero Sugar 1,5 l". Prices, favourites, alerts, list items and matches reference variants.
- **RetailerProduct**: a retailer's listing (title, SKU, GTINs), linked to one variant through a **ProductMatch** with confidence and review status.
- **PriceObservation**: append-only price history. `current_prices` is the read model.

Every supermarket entry is linked to a canonical product, so entries are never treated as unrelated products. See [PRODUCT_MATCHING.md](PRODUCT_MATCHING.md).

## Request flow example: basket comparison

1. `POST /v1/lists/:id/compare`: membership check, then plan limit on compared retailers.
2. For each list item, find candidates:
   - exact preferred variant, plus stored equivalences; or
   - free-text search ranked by canonical tokens and trigram similarity.
3. `loadOffers` returns current prices and active promotions for the candidate variants at the chosen retailers.
4. `BasketComparisonEngine` (pure) prices every line with the `PricingEngine`, honours user selections, and reports missing items and confidence.
5. The response DTO is returned. The app renders it without further calculation.

## Error handling

Every error response has the shape `{statusCode, code, message, details?}`. Codes include `VALIDATION_FAILED`, `ENTITLEMENT_REQUIRED`, `LIMIT_REACHED`, `VERSION_CONFLICT`, `PROVIDER_UNSUPPORTED` and `INVALID_CREDENTIALS`. Stack traces never leave the server.
