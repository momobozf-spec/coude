# Store providers

Package: `packages/store-providers`. The full research, with sources, is in [research/RETAILER_DATA_RESEARCH.md](research/RETAILER_DATA_RESEARCH.md) (researched 2026-09-23).

## Contract

```ts
interface StoreProvider {
  info: ProviderInfo; // key, retailers, supportStatus, reason, dataOrigin, capabilities
  searchProducts(query, opts?);
  getProduct(externalId);
  getPrices(request); // AsyncIterable<ProviderPrice>
  getPromotions(request?); // AsyncIterable<ProviderPromotion>
  getCategories();
  getAvailability(externalIds, opts?);
  listCatalog(); // AsyncIterable<ProviderProduct>
}
```

Every record is validated by Zod schemas (`providerProductSchema`, `providerPriceSchema`, `providerPromotionSchema`) in the ingestion pipeline. Unsupported operations throw `ProviderUnsupportedError` or `ProviderCapabilityError`. **A provider never returns fake data.**

## Rules we follow

1. Research official APIs, affiliate APIs and permitted feeds first.
2. Review the terms of use.
3. Document the integration (this file).
4. Never circumvent authentication or bot protection. Never scrape where prohibited. Never use reverse-engineered mobile or web APIs.
5. Never present mock data as live prices.

## Status per provider

| Provider                                                                                     | Retailers              | Status                       | Reason / path to support                                                                                                                                                                                                                             |
| -------------------------------------------------------------------------------------------- | ---------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `colruyt` (**ColruytProvider**) <a id="colruyt"></a>                                         | Colruyt, Okay          | UNSUPPORTED                  | No public API. The app/site terms prohibit reproduction and storing content in a database. Path: data licence from Colruyt Group.                                                                                                                    |
| `delhaize` (**DelhaizeProvider**) <a id="delhaize"></a>                                      | Delhaize               | UNSUPPORTED                  | No public API or affiliate feed found. The terms allow personal use only. Path: data licence.                                                                                                                                                        |
| `carrefour` (**CarrefourProvider**) <a id="carrefour"></a>                                   | Carrefour BE           | UNSUPPORTED                  | No public API. The affiliate programmes found are French. Path: data licence.                                                                                                                                                                        |
| `albert-heijn` (**AlbertHeijnProvider**) <a id="albert-heijn"></a>                           | Albert Heijn (NL/BE)   | UNSUPPORTED                  | Terms forbid reproduction (except personal use) and reverse engineering the AH app. **Partnerize affiliate programme with a product feed and weekly bonus feed exists.** Usable via `PartnerFeedProvider` after written approval for comparison use. |
| `jumbo` (**JumboProvider**) <a id="jumbo"></a>                                               | Jumbo                  | UNSUPPORTED                  | Terms explicitly forbid scraping and systematic reuse. There is a TradeTracker affiliate programme, but a feed is not verified.                                                                                                                      |
| `lidl` <a id="lidl"></a>                                                                     | Lidl                   | UNSUPPORTED                  | Written permission required, and bot protection is in place. The Lidl-shop datafeed covers non-food only.                                                                                                                                            |
| `plus` <a id="plus"></a>                                                                     | PLUS                   | UNSUPPORTED                  | Awin affiliate programme exists; a product feed is not confirmed.                                                                                                                                                                                    |
| `aldi`, `intermarche`, `dirk`, `spar`, `dekamarkt`, `vomar`, `hoogvliet`, `ekoplaza`, `etos` | …                      | UNSUPPORTED                  | No API or feed found.                                                                                                                                                                                                                                |
| `picnic` <a id="picnic"></a>                                                                 | Picnic                 | UNSUPPORTED                  | Terms explicitly forbid scraping.                                                                                                                                                                                                                    |
| `kruidvat` <a id="kruidvat"></a>                                                             | Kruidvat               | UNSUPPORTED                  | The BE affiliate programme is closed; the NL feed is not verified.                                                                                                                                                                                   |
| `open-prices` <a id="open-prices"></a>                                                       | any BE/NL store in OSM | **SUPPORTED** (crowdsourced) | Open Prices API (ODbL). Prices reported by shoppers from receipts and price tags. Coverage is partial. Off by default (`OPEN_PRICES_ENABLED`).                                                                                                       |
| `development-seed`                                                                           | 7 retailers            | SUPPORTED (dev only)         | Fictitious data. Disabled in production.                                                                                                                                                                                                             |
| `PartnerFeedProvider` <a id="partner-feeds"></a>                                             | configurable           | EXPERIMENTAL                 | Generic licensed JSON feed. **Requires a `licenseReference`** documenting written permission. Credentials come from the environment.                                                                                                                 |

The API exposes this per retailer as `dataSupport` (`/v1/retailers`), and the app shows it under _Profiel → Gegevensbronnen_.

## Open Prices

- Endpoint: `GET https://prices.openfoodfacts.org/api/v1/prices?product_code=<gtin>&date__gte=…&order_by=-date&size=100`.
- A User-Agent `MijnSuperrette/<version> (<contact>)` is required; the constructor refuses anything else. There is a 1 request/second throttle.
- Only `type=PRODUCT` items are used, with valid GTIN, EUR currency, and a BE or NL location whose OSM brand maps to a known retailer (`retailerSlugForOsmBrand`).
- `price_is_discounted` + `price_without_discount` map to regular and promo price.
- Each (retailer, GTIN) becomes a retailer product `off:<gtin>`, which matches the canonical product via GTIN (EXACT).
- Data origin is `CROWDSOURCED`, and the UI labels it "Gemeld door shoppers (Open Prices)". **Attribution is required** (ODbL): "Prices: Open Prices by Open Food Facts".
- Tested with mocked HTTP responses in the documented live format. A live BE/NL sync has **not** been validated in this repository (development GTINs are fictitious).

## Open Food Facts (metadata only)

`OpenFoodFactsClient.lookup(gtin)` calls API v3 `/api/v3/product/{code}.json`. It is used only for context on unknown barcodes in the scanner ("Volgens Open Food Facts: …"). It never creates prices or canonical products. It is off by default (`OPEN_FOOD_FACTS_ENABLED`). Note the rate limit of 15 product reads per minute per IP.

## Adding a licensed feed

1. Obtain written permission and record the contract or ticket number.
2. Configure a `PartnerFeedConfig` (key, retailer slugs, URL, headers from env, `dataOrigin`, `licenseReference`) in `createDefaultRegistry`. It replaces the UNSUPPORTED placeholder with the same key.
3. Add a schedule: `SYNC_SCHEDULES="albert-heijn:PROMOTIONS:0 6 * * 1"`.
4. Validate data quality in the admin (syncs, errors, match review) before promoting the provider to SUPPORTED.
