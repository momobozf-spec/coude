# Mijn Superrette

> **"Waar doe ik vandaag het voordeligst mijn boodschappen?"**

Mijn Superrette is a grocery price comparison and shopping assistant for Belgium and the Netherlands. It helps consumers search products, compare prices (including €/kg, €/l, €/piece), follow promotions, keep shared shopping lists, compare a whole basket between supermarkets, and get price alerts.

This folder is a self-contained pnpm monorepo.

|          |                                                                    |
| -------- | ------------------------------------------------------------------ |
| Mobile   | Expo SDK 57 / React Native 0.86 (iOS + Android), expo-router       |
| API      | NestJS 12 (ESM), REST + Socket.IO realtime                         |
| Worker   | BullMQ on Redis: provider syncs, price-alert evaluation, schedules |
| Admin    | Vite + React web app                                               |
| Data     | PostgreSQL 16 (Drizzle ORM, `pg_trgm`), Redis 7                    |
| Language | Strict TypeScript everywhere, Zod for all input validation         |

## ⚠️ About the data

**No supermarket in scope offers a permitted public API** for products or prices (research: [`docs/research/RETAILER_DATA_RESEARCH.md`](docs/research/RETAILER_DATA_RESEARCH.md)). All retailer providers are therefore marked **UNSUPPORTED**, with the reason documented. Mijn Superrette does not scrape and does not use reverse-engineered apps.

- **Development data** is fictitious. It is loaded through the real ingestion pipeline, tagged `DEVELOPMENT_SEED`, and shown in the apps with a _VOORBEELDDATA_ banner. It can never be served when `APP_ENV=production`.
- **Open Prices** (crowdsourced, ODbL) is the one real price integration. It is disabled by default.
- **Licensed feeds** plug in through `PartnerFeedProvider` once a retailer or affiliate programme gives written permission.

See [`docs/STORE_PROVIDERS.md`](docs/STORE_PROVIDERS.md).

## Quick start

```bash
# Prerequisites: Node 22+, pnpm 10, PostgreSQL 16 with pg_trgm, Redis 7 (optional)
docker compose up -d                 # or use local postgres/redis
cp .env.example .env
pnpm install
pnpm build:packages
pnpm db:seed:dev                     # migrations + DEVELOPMENT DATA via the ingestion pipeline
pnpm dev:api                         # http://localhost:3000
pnpm dev:worker                      # only needed with REDIS_URL (otherwise jobs run in the API)
pnpm dev:admin                       # http://localhost:5173
pnpm dev:mobile                      # Expo; press i / a / w
pnpm dev:web                         # web version in the browser
```

Demo accounts (development only; password `superrette-dev` or `DEV_SEED_PASSWORD`):

| E-mail                   | Role                                                 |
| ------------------------ | ---------------------------------------------------- |
| `demo@superrette.local`  | Mohamed: Plus plan (manual), shares a list with Sara |
| `sara@superrette.local`  | Sara: Free plan                                      |
| `admin@superrette.local` | Admin                                                |

## Quality gates

```bash
pnpm lint            # ESLint (typescript-eslint, react-hooks, architecture import rules)
pnpm typecheck       # tsc for every workspace
pnpm test            # unit tests (engines, normaliser, providers, i18n, API client, worker config)
pnpm test:integration  # API + ingestion against a real PostgreSQL (TEST_DATABASE_URL)
pnpm build           # packages, API, worker, admin, mobile (Android + iOS Hermes bundles)
```

## Repository layout

```
apps/
  api/        NestJS API (+ Socket.IO gateway)       → docs/ARCHITECTURE.md
  worker/     BullMQ worker and schedules            → docs/DATA_INGESTION.md
  admin/      admin web app (match review, syncs)
  mobile/     Expo app for iOS, Android and web      → docs/MOBILE.md, docs/WEB.md
packages/
  shared/            money (integer cents), quantities, GTIN, text utils
  domain/            enums, entities, entitlement keys
  i18n/              nl / fr / en catalogues, locale-aware formatters
  validation/        Zod request schemas + response DTO types (API ⇄ apps contract)
  database/          Drizzle schema (catalog / ingest / app), migrations, read models
  store-providers/   StoreProvider contract, retailer providers, Open Prices, dev seed
  product-matching/  ProductNormalizer, ProductMatchingEngine, ProductEquivalenceEngine
  pricing-engine/    UnitPriceCalculator, PromotionCalculator, PricingEngine, history
  basket-engine/     BasketComparisonEngine, Smart Basket optimiser
  alert-engine/      PriceAlertEngine
  ingestion/         ingestion pipeline, equivalence indexer, alert delivery, dev seed
  ui/                design system (tokens + React Native components)
docs/                architecture and operations documentation
```

## Documentation

[ARCHITECTURE](docs/ARCHITECTURE.md) · [DATABASE](docs/DATABASE.md) · [PRODUCT_MATCHING](docs/PRODUCT_MATCHING.md) · [PRICING_ENGINE](docs/PRICING_ENGINE.md) · [BASKET_COMPARISON](docs/BASKET_COMPARISON.md) · [STORE_PROVIDERS](docs/STORE_PROVIDERS.md) · [DATA_INGESTION](docs/DATA_INGESTION.md) · [MOBILE](docs/MOBILE.md) · [WEB](docs/WEB.md) · [SECURITY](docs/SECURITY.md) · [PRIVACY_ARCHITECTURE](docs/PRIVACY_ARCHITECTURE.md) · [DEPLOYMENT](docs/DEPLOYMENT.md) · [STATUS](docs/STATUS.md)
