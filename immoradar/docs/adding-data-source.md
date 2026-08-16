# Adding a data source

## Compliance policy (non-negotiable)

Only integrate a source when automated access **and** reuse are permitted. Priority
order for the integration method:

1. **Official API** (with an agreement / API key)
2. **Authorised or public feed** (RSS, sitemap-based feeds offered for reuse)
3. **Structured data** the source intentionally exposes for machine consumption
4. **Permitted public HTML** (robots.txt allows it, terms of service permit reuse)

Never bypass CAPTCHAs, authentication, login walls, anti-bot systems, rate limits or
any access control. Respect robots.txt and the source's published rate limits. When
in doubt, do not build the collector — use fixtures until permission is established.
This is why the repository ships **fixture collectors only**: the entire pipeline is
demonstrable end-to-end without touching a real website.

## Implementation steps

1. **Create the Source row** (seed or admin): stable `code`, name, kind
   (`api`/`feed`/`structured`/`html`/`fixture`), and politeness config
   (`pollIntervalMinutes`, `rateLimitPerMinute`, `timeoutMs`, `maxRetries`).

2. **Implement `ListingCollector`** (`src/collectors/types.ts`):

   ```ts
   export class ExamplePortalCollector implements ListingCollector {
     readonly source = "example-portal";        // must equal Source.code
     async collect(): Promise<RawListing[]> {
       // fetch from the permitted endpoint, honoring the source's rate limit
       // map each item to RawListing — keep original values in `raw`
     }
   }
   ```

   Return `RawListing` objects — raw, untrusted values. Do **not** normalize inside
   the collector; the normalization engine owns that. Populate `raw` with the
   original payload for audit.

3. **Register it** in the job wiring (`src/jobs/run-collectors.ts` /
   `run-pipeline.ts`) alongside the fixture collectors.

4. The runner (`src/collectors/runner.ts`) provides retries with exponential
   backoff, per-attempt timeout, structured logs and failure isolation for free.
   Each run is recorded as a `CollectorRun` and surfaces on Admin → Collector
   Health.

5. **Test with fixtures**: record representative payloads and drive them through a
   `FixtureCollector`; assert normalization, matching, classification and event
   output. Automated tests must never hit the real source.

## Checklist before shipping a real collector

- [ ] Written confirmation (terms/robots/API docs) that this access is permitted
- [ ] Rate limit at or below the source's published/agreed budget
- [ ] Collector degrades gracefully (timeouts, retries) and never blocks others
- [ ] Fixture-based tests cover the mapping
- [ ] Source health visible in Admin → Collector Health
