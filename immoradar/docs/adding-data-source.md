# Adding a data source (collector)

**Before writing code**, establish the source's permitted integration method, in this order of preference:

1. Official API (with credentials and documented terms).
2. Authorised / public feed (RSS, XML, JSON feed explicitly offered for reuse).
3. Structured data the site publishes for reuse (e.g. schema.org markup where terms allow).
4. Public HTML only where the terms of use and robots policy explicitly permit automated access.

Never bypass CAPTCHAs, authentication, login walls, anti-bot systems, rate limits or access controls, and never scrape a source whose terms forbid it. Record the terms URL and an access note on the `Source` row (`termsUrl`, `accessNote`).

## Implement the collector

```ts
// src/collectors/sources/example-portal.ts
import type { CollectContext, CollectorConfig, ListingCollector } from "../types";
import { DEFAULT_COLLECTOR_CONFIG } from "../types";
import type { RawListing } from "@/domain/listing/raw-listing";

export class ExamplePortalCollector implements ListingCollector {
  readonly source = "example-portal";
  readonly name = "Example Portal (official API)";
  readonly kind = "API" as const;
  readonly config: CollectorConfig = { ...DEFAULT_COLLECTOR_CONFIG, pollIntervalMinutes: 30, rateLimitPerMinute: 20, termsUrl: "https://example.be/api/terms", accessNote: "API key issued 2026-09 under partner agreement" };

  async collect(ctx: CollectContext): Promise<RawListing[]> {
    const out: RawListing[] = [];
    for (let page = 1; page <= 10; page++) {
      await ctx.throttle();                       // per-source rate limit
      const res = await fetch(`https://api.example.be/listings?page=${page}`, { headers: { authorization: `Bearer ${process.env.EXAMPLE_API_KEY}` }, signal: ctx.signal });
      if (!res.ok) throw new Error(`Example API ${res.status}`);   // the runner retries with backoff
      const json = await res.json();
      for (const item of json.items) out.push({ sourceListingId: String(item.id), sourceUrl: item.url, listingType: item.transaction, title: item.title, description: item.description, price: item.price, address: item.address, postalCode: item.zip, city: item.city, propertyType: item.type, bedrooms: item.bedrooms, surfaceArea: item.livingArea, sellerName: item.contact?.name, sellerPhone: item.contact?.phone, sellerType: item.contact?.kind, publishedAt: item.publishedAt, extra: { raw: item } });
      if (!json.next) break;
    }
    return out;
  }
}
```

Return everything as found (strings are fine); normalization handles Belgian formats. Keep `extra` for anything you may need later — it is stored in `ListingSnapshot.rawData`.

## Register and enable

1. `src/collectors/registry.ts`: `registerCollector("example-portal", () => new ExamplePortalCollector());`
2. Add the key to `COLLECTORS_ENABLED`.
3. Add a fixture-based test: never call the real API from tests.

The runner (`src/collectors/runner.ts`) provides retries with exponential backoff and jitter, timeouts through `ctx.signal`, per-source throttling, `CollectorRun` metrics, `Source` health and failure isolation. Ingestion, matching, classification, events and opportunities need no changes.
