# Database

PostgreSQL 16 with the `pg_trgm` extension. The schema is defined in TypeScript with Drizzle (`packages/database/src/schema`). Migrations are generated into `packages/database/drizzle` (`pnpm db:generate`) and applied with `pnpm db:migrate`. The migration journal lives in the `drizzle` schema.

## Three PostgreSQL schemas

| Schema    | Contains                                                                                                                                                                                                                                             | Personal data? |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `catalog` | countries, retailers, store locations, brands, categories, synonyms, products, variants, barcodes, retailer products, price observations, current prices, promotions (+ conditions, products), product matches, equivalences, anonymous search stats | **No**         |
| `ingest`  | provider syncs, import jobs, provider errors                                                                                                                                                                                                         | No             |
| `app`     | users, sessions, retailer preferences, favourites, shopping lists, members, invites, items, item selections, list activity, price alerts, alert triggers, notifications, push tokens, search history, plans, plan entitlements, subscriptions        | **Yes**        |

Catalogue tables never hold a foreign key to users. Admin review columns (`reviewed_by`) store an id without an FK, so catalogue data can be exported, shared or rebuilt independently of personal data. See [PRIVACY_ARCHITECTURE.md](PRIVACY_ARCHITECTURE.md).

## Entity map (spec → table)

| Domain entity                            | Table                                                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------------------ |
| User                                     | `app.users` (+ `app.sessions`)                                                             |
| Country                                  | `catalog.countries` (currency, languages, default locale, regions)                         |
| Retailer                                 | `catalog.retailers` + `catalog.retailer_countries` (type, provider key, loyalty programme) |
| StoreLocation                            | `catalog.store_locations` (incl. OSM id, used to map Open Prices locations)                |
| Brand                                    | `catalog.brands` (aliases, implied tokens, private-label retailer)                         |
| Category                                 | `catalog.categories` (localised names, hierarchy)                                          |
| Product                                  | `catalog.products` (canonical product line)                                                |
| ProductVariant                           | `catalog.product_variants` (comparable size/pack, normalised snapshot, search text)        |
| ProductBarcode                           | `catalog.product_barcodes` (GTIN primary key → exactly one variant)                        |
| RetailerProduct                          | `catalog.retailer_products` (unique per retailer + SKU)                                    |
| PriceObservation                         | `catalog.price_observations` (append-only, deduplicated per rp + time + source)            |
| Promotion / PromotionCondition           | `catalog.promotions`, `catalog.promotion_conditions`, `catalog.promotion_products`         |
| ProductMatch                             | `catalog.product_matches` (confidence, method, score, status, reasons, alternatives)       |
| Equivalence                              | `catalog.product_equivalences` (SUGGESTED / CONFIRMED / REJECTED)                          |
| ShoppingList / ShoppingListItem          | `app.shopping_lists`, `app.shopping_list_items` (versioned)                                |
| SharedList                               | `app.list_members` + `app.list_invites` (hashed single-use tokens)                         |
| Favorite                                 | `app.favorites`                                                                            |
| PriceAlert / PriceAlertTrigger           | `app.price_alerts`, `app.price_alert_triggers` (unique `dedupe_key`)                       |
| UserRetailerPreference                   | `app.user_retailer_preferences` (incl. loyalty card)                                       |
| Notification                             | `app.notifications` (+ `app.push_tokens`)                                                  |
| Subscription                             | `app.subscriptions`, `app.plans`, `app.plan_entitlements`                                  |
| ProviderSync / ImportJob / ProviderError | `ingest.provider_syncs`, `ingest.import_jobs`, `ingest.provider_errors`                    |

## Important constraints and indexes

- `retailer_products (retailer_id, retailer_sku)` is unique, so an import is idempotent.
- `price_observations (retailer_product_id, observed_at, source_provider)` is unique, so re-imports never duplicate history. There is also an index on `(retailer_product_id, observed_at DESC)`.
- `current_prices` is upserted with `WHERE current.observed_at <= excluded.observed_at`, so a late, older observation never overwrites a newer price.
- `product_barcodes.gtin` is the primary key. A GTIN belongs to exactly one canonical variant.
- `product_variants.search_text` has a GIN `gin_trgm_ops` index, and `product_variants.tokens` has a GIN index. Together they power search.
- `product_matches (retailer_product_id, variant_id)` is unique. The upsert never overwrites CONFIRMED or REJECTED rows.
- `price_alert_triggers.dedupe_key` is unique. The database itself guarantees an alert never fires twice for the same offer and price.
- `users` has a unique index on `lower(email)`.
- `shopping_list_items.version` supports optimistic concurrency.

## Money and quantities

Prices are `integer` cents. Quantities are stored per item (`quantity_amount`, `quantity_unit`) and as a normalised total (`net_content_amount` in g / ml / piece), which is what unit prices use.

## Data origin

`data_origin` (`RETAILER_API`, `AFFILIATE_FEED`, `CROWDSOURCED`, `OPEN_DATA`, `USER_SUBMITTED`, `DEVELOPMENT_SEED`) is stored on products, variants, retailer products, observations, current prices and promotions. The API filters by the origins allowed in the current environment. Production never includes `DEVELOPMENT_SEED`, and `/health` reports `developmentData: PRESENT` if such rows ever exist there.

## Seeding

- `seedReferenceData` covers countries, retailers, categories and plans. It is idempotent and safe in every environment.
- `pnpm db:seed:dev [--reset]` loads fictitious development data through the ingestion pipeline, then adds demo users. It refuses to run when `APP_ENV=production` or when the database URL looks like production.
