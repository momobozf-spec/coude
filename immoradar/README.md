# ImmoRadar — Real Estate Acquisition Intelligence

ImmoRadar helps Belgian real-estate agencies discover potential **seller mandates** before competitors do. It is not a CRM: it is an acquisition-intelligence layer that answers one question every morning:

> **“Which potential sellers should I contact today?”**

Two engines feed one ranked list, *Today's Opportunities*:

| Engine | Source of signal | Example |
| --- | --- | --- |
| **ImmoRadar** | Lawfully accessible property-market data | A private (FSBO) listing appears in your territory, drops its price twice, gets relisted |
| **LeadRevive** | The agency's own CRM export | A valuation lead from 2024 that never became a mandate, a buyer from 2019 |

The competitive edge is the combination: a market signal **plus** an existing relationship becomes a 97–100/100 opportunity, alerted instantly on Telegram and auto-assigned to the agent who knows the contact.

```
External property signal  +  Existing CRM relationship  →  High-priority seller opportunity
```

---

## Contents

1. [Architecture](#architecture)
2. [Local setup](#local-setup)
3. [Environment variables](#environment-variables)
4. [Docker](#docker)
5. [Database, migrations, seeds](#database-migrations-seeds)
6. [Authentication & multi-tenancy](#authentication--multi-tenancy)
7. [Collector framework](#collector-framework)
8. [CRM import (LeadRevive)](#crm-import-leadrevive)
9. [Event engine](#event-engine)
10. [Matching](#matching)
11. [Scoring](#scoring)
12. [Telegram](#telegram)
13. [Jobs & scheduling](#jobs--scheduling)
14. [Tests](#tests)
15. [The end-to-end demonstration](#the-end-to-end-demonstration)
16. [Production deployment considerations](#production-deployment-considerations)
17. [Further documentation](#further-documentation)

---

## Architecture

**Stack:** Next.js 16 (App Router, server components, server actions) · React 19 · TypeScript strict · PostgreSQL 16 · Prisma 7 · Tailwind CSS 4 · Zod · Vitest · Docker Compose · Telegram Bot API · Node 20+.

Domain logic is independent from the UI and from the database. Pure engines (normalization, matching, classification, events, scoring, CRM matching, dormant detection) take plain inputs and return plain results; services orchestrate them against Prisma; pages and server actions only call repositories and services.

```
src/
  app/              Next.js routes (UI + API)          ── presentation
  actions/          server actions (Zod-validated)      ── presentation
  components/       UI building blocks
  domain/           pure types per aggregate: property, listing, contact, opportunity, territory, agency
  normalization/    Belgian address / price / phone / … normalizers
  matching/         property matcher + text similarity
  classification/   seller classifier (rules; AI pluggable)
  events/           snapshot → event engine, removal confirmation, stale, relist
  scoring/          intent, relationship, timing, confidence, territory, combined
  crm/              CSV parser, CrmAdapter interface, CsvCrmAdapter, dedup, CRM↔market matcher, dormant detector
  collectors/       ListingCollector interface, runner (retry/backoff/timeout/rate limit/health), fixtures
  ingestion/        collector output → normalized listing → property → snapshot → events
  services/         opportunity engine, LeadRevive, workflow, scoring persistence, audit
  notifications/    Telegram transport, alert dedupe, morning digest
  repositories/     tenant-scoped read models
  jobs/             pipeline orchestration + CLI
  lib/              env, db, logger, errors, auth, permissions, formatting
prisma/             schema, migrations, seed
tests/integration/  Postgres-backed tests (end-to-end scenario, tenant isolation, …)
docs/               architecture, data model, engines, privacy, extension guides
```

See [docs/architecture.md](docs/architecture.md) for the full data flow.

## Local setup

Prerequisites: Node 20+, PostgreSQL 16 (or Docker).

```bash
cd immoradar
cp .env.example .env            # adjust DATABASE_URL / secrets if needed
npm install                     # runs `prisma generate` (postinstall)
docker compose up -d db         # or use a local PostgreSQL and create databases `immoradar` and `immoradar_test`
npm run db:migrate              # apply migrations (creates the schema)
npm run db:seed                 # demo data + runs the pipeline once
npm run dev                     # http://localhost:3000
```

Sign in with any demo account (password **`immoradar`**), e.g.

| Account | Role |
| --- | --- |
| `thomas.peeters@immo-gent.be` | Agent, Immo Gent — owner of the Scenario B relationship |
| `sofie.claes@immo-gent.be` | Agency admin, Immo Gent |
| `bart.jacobs@antwerp-vastgoed.be` | Agency admin, Antwerp Vastgoed |
| `admin@immoradar.be` | Platform admin (Sources, Collector Health, Agencies, System Health) |

All 15 accounts are printed at the end of `npm run db:seed`.

Advance the fixture “market” to see new events (price drops → removal → relist):

```bash
FIXTURE_TICK=1 npm run jobs:collect   # first price drop on Brusselsesteenweg 210
FIXTURE_TICK=2 npm run jobs:collect   # second drop
FIXTURE_TICK=3 npm run jobs:collect   # listing missing (not yet removed)
FIXTURE_TICK=4 npm run jobs:collect   # removal confirmed (after 24h + 2 misses)
FIXTURE_TICK=5 npm run jobs:collect   # relisted at a lower price
```

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `TEST_DATABASE_URL` | for integration tests | Separate database, truncated between tests |
| `AUTH_SECRET` | yes (prod) | ≥ 32 random chars; signs session tokens |
| `CRON_SECRET` | yes (prod) | Bearer token for `/api/jobs/*` |
| `APP_URL` | yes | Public URL used in Telegram links |
| `TELEGRAM_BOT_TOKEN` | optional | Empty → console transport (messages are logged, never sent) |
| `COLLECTORS_ENABLED` | optional | Comma-separated collector keys (default: both fixtures) |
| `LOG_LEVEL` | optional | `debug` · `info` · `warn` · `error` · `silent` |
| `SESSION_TTL_HOURS` | optional | Session lifetime (default 168) |
| `FIXTURE_TICK` | dev only | Advances the fixture collectors' timelines |

Environment is validated with Zod at startup (`src/lib/env.ts`); secrets are never logged.

## Docker

```bash
docker compose up --build       # Postgres + app; runs migrations + seed on start
```

The compose file starts PostgreSQL 16 (with a `immoradar_test` database for tests) and the app on port 3000. The `Dockerfile` is a multi-stage build (deps → build → runner).

## Database, migrations, seeds

- Schema: `prisma/schema.prisma` (25 models, documented in [docs/data-model.md](docs/data-model.md)).
- `npm run db:migrate` — create/apply migrations in development; `npm run db:deploy` — apply in production.
- `npm run db:seed` — deterministic demo data: 5 agencies, 15 users, 25 territories, 500 CRM contacts, 150 properties, 250 listings, ~750 snapshots, ~1 300 events, then runs collectors + engines. Includes Scenarios A–E (see [The end-to-end demonstration](#the-end-to-end-demonstration)).
- `npm run db:reset` — drop, migrate, seed.

## Authentication & multi-tenancy

- Email + password (bcrypt), **DB-backed sessions** in an HttpOnly, SameSite=Lax cookie (token hashed with `AUTH_SECRET` before storage). `src/proxy.ts` redirects anonymous requests; real validation happens server-side in `requireTenant()`.
- Roles: `PLATFORM_ADMIN`, `AGENCY_ADMIN`, `AGENT` with a permission matrix (`src/lib/auth/permissions.ts`).
- Every tenant-specific query goes through a `TenantContext` whose `agencyId` is **derived from the session**, never from user input. Agency users are bound to their own agency; platform admins explicitly select one. Cross-tenant reads return 403/404, writes throw `ForbiddenError`.
- Market/property data (properties, listings, snapshots, events, seller identities) is shared platform data. CRM contacts, imports, relationships, opportunities, alerts, territories, assignments and configuration are strictly per agency. CRM data from one tenant is never used to enrich another.
- Tenant isolation is covered by `tests/integration/tenant-isolation.test.ts`.

## Collector framework

`src/collectors/`. A `ListingCollector` has a `source` key and `collect(ctx): Promise<RawListing[]>`. The runner adds retries with exponential backoff + jitter, per-attempt timeout (AbortSignal), per-source rate limiting, structured logs, `CollectorRun` metrics and `Source` health (`HEALTHY → DEGRADED → DOWN`). Failures are isolated per source.

Only sources whose automated access and reuse are **permitted** may be integrated (official API > authorised feed > structured data > permitted public HTML). No CAPTCHA / login / anti-bot / rate-limit bypass, ever. The MVP ships two **fixture collectors** with evolving timelines so the whole pipeline is demonstrable without touching a real website. See [docs/adding-data-source.md](docs/adding-data-source.md).

## CRM import (LeadRevive)

Upload a CSV under *Imports*. Headers are auto-mapped (NL/FR/EN). Contacts are normalized (E.164 phones, lower-cased emails, folded names, Belgian postal codes) and deduplicated by CRM id → phone → email → name+postcode. Existing data is **never silently overwritten**: empty fields are filled, differing fields are recorded as conflicts on the import row for review. Import history and original values are kept. API adapters (WHISE, Omnicasa, …) implement the same `CrmAdapter` interface — see [docs/adding-crm-adapter.md](docs/adding-crm-adapter.md) and [docs/leadrevive.md](docs/leadrevive.md).

## Event engine

Every ingestion stores a `ListingSnapshot` when content changed and diffs it against the previous one: `NEW_LISTING`, `FSBO_DETECTED`, `PRICE_DROP`/`PRICE_INCREASE` (with difference and percentage), `AGENCY_TO_PRIVATE`/`PRIVATE_TO_AGENCY`, `STALE_30/60/90`, `LISTING_REMOVED`, `RELISTED`. Removal requires **N consecutive misses and a minimum delay** so collector hiccups never produce false removals. Every event carries a deterministic `dedupeKey`, so re-runs are idempotent. See [docs/opportunity-engine.md](docs/opportunity-engine.md).

## Matching

- **Property matching** (`src/matching/property-matcher.ts`): weighted signals (normalized address key, street + postal code, house-number conflict penalty, surface, bedrooms, price proximity, description Jaccard similarity, seller phone, coordinates) → confidence 0–1 → `AUTO_MATCH` (≥ 0.85), `REVIEW` (≥ 0.55) or `NO_MATCH`. Low-confidence matches are never merged automatically; a new property is created and flagged for review.
- **CRM ↔ market matching** (`src/crm/crm-matcher.ts`): phone, email, historical property relationship, contact address, name, postcode. A name alone (even with the same postcode) can **never** produce a match. See [docs/crm-matching.md](docs/crm-matching.md).

## Scoring

Five components, all 0–100 with reasons: **Intent** (FSBO +40, price drop +15, multiple drops +20, >30 days +10, >60 days +15, relisted +20, agency→private +20), **Relationship** (previous buyer +20, previous seller +25, valuation +30, former client +15, known property relationship +15, recent interaction +15, same agent +5), **Timing**, **Territory** (postal code 100 / municipality 75 / province 40), **Data confidence**. The combined score is a normalised weighted mean plus a relationship *lift* and a cross-intelligence bonus — never a plain sum. All weights live in `src/scoring/config.ts` and are unit-tested against the scenarios (A ≈ 88, B ≈ 99, C ≈ 94, D relationship ≈ 82). See [docs/scoring.md](docs/scoring.md).

## Telegram

Set `TELEGRAM_BOT_TOKEN`; agencies configure a channel chat id and a minimum score under *Settings*; agents can add a personal chat id. Alerts: **instant hot opportunity** (score ≥ threshold), **CRM + market match** (always, high priority) and the **morning opportunity brief** (per agent, at the agency's configured local hour). Every alert is persisted with a dedupe key; a given opportunity is alerted at most once (plus once more if a CRM relationship is discovered later). Without a token the console transport logs messages instead.

## Jobs & scheduling

| Command | What it does |
| --- | --- |
| `npm run jobs:collect` | run all enabled collectors → ingest → events → opportunities → alerts |
| `npm run jobs:leadrevive` | scan every agency's CRM for dormant opportunities |
| `npm run jobs:digest` | send morning briefs for agencies whose hour matches (`-- --force` to send now) |
| `npm run jobs:retention` | apply CRM retention windows, purge expired sessions |
| `npm run jobs:all` | collect + leadrevive + digest |

HTTP equivalents for cron: `POST /api/jobs/{collect|leadrevive|digest|retention|all}` with `Authorization: Bearer $CRON_SECRET` (`?force=1` for the digest). Suggested cron: collect every 30 min, leadrevive nightly, digest hourly (it sends only at each agency's hour), retention daily. Platform admins can also trigger jobs from *System Health*.

## Tests

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

- **Unit** (`src/**/*.test.ts`): normalization, property matching, seller classification, snapshot events, price/stale/removal/relist detection, CSV parsing, CRM adapter, deduplication, CRM↔market matching, relationship/intent/timing/confidence/opportunity scoring, territory matching, collector retry/backoff/throttle/health, permissions, log redaction.
- **Integration** (`tests/integration/*.test.ts`, needs `TEST_DATABASE_URL`): the complete end-to-end scenario, price drops → confirmed removal → relist over successive runs, agency→private transitions, collector failure isolation, tenant isolation, CRM import (idempotency, conflicts, invalid rows), LeadRevive dormant detection, alert dedupe / rules / digest.

No test touches an external website. Use `npm run test:unit` / `npm run test:integration` to run one project.

## The end-to-end demonstration

`tests/integration/pipeline.test.ts` executes the full 20-step scenario automatically; the seed makes it visible in the UI:

1. The fixture portal returns a listing for *Kortrijksesteenweg 123, 9000 Gent*, € 625 000, “verkoop door particulier, zonder makelaar”.
2. It is normalized (price, address key `kortrijksesteenweg|123|9000`, phone `+32478123456`).
3. Property matching links the second source's advertisement of the same house to one `Property`.
4. The seller is classified `PRIVATE` (confidence 0.99, reasons listed).
5. A `ListingSnapshot` is stored (raw data kept).
6. Events `NEW_LISTING` + `FSBO_DETECTED` are emitted.
7. An opportunity is created for every agency whose territory contains 9000.
8. LeadRevive searches Immo Gent's CRM…
9. …and finds **Pieter Janssens — previous buyer, 2019** (phone + historical property relationship).
10. Relationship score 67 (previous buyer, known property relationship, agent still available).
11. Intent score 73 (FSBO).
12. Combined **Opportunity Score 99/100**.
13. Territory: exact postal-code match.
14. Auto-assigned to Thomas (the contact's agent).
15. A `CRM_MARKET_MATCH` Telegram alert is generated for Thomas, exactly once.
16. Thomas opens *Today's Opportunities*…
17. …and sees **EXISTING CONTACT + NEW FSBO** at the top.
18. The detail page shows the property timeline, CRM relationship, market signals and the scoring explanation.
19. Thomas clicks **Mark contacted**.
20. *Analytics* now counts one contacted opportunity in the *CRM + Market Match* category and for Thomas.

## Production deployment considerations

- Set a strong `AUTH_SECRET` and `CRON_SECRET`; run behind TLS (cookies are `secure` in production).
- Run `prisma migrate deploy` on release; never `db push` in production.
- Schedule the jobs (cron/K8s CronJob) against `/api/jobs/*`; keep collectors' poll intervals and rate limits within each source's terms.
- Logs are JSON lines with sensitive keys redacted (`src/lib/logger.ts`); ship them to your aggregator. Set `LOG_LEVEL=info`.
- Configure CRM retention per agency (*Settings*) and run `jobs:retention` daily; deletion workflows erase personal data in place.
- Use a dedicated DB role with least privilege; enable connection pooling (the pg adapter pool is 10 per instance).
- Back up PostgreSQL; the audit log and import provenance are part of the compliance record.
- Add real collectors only after the source's permitted integration method is established ([docs/adding-data-source.md](docs/adding-data-source.md)).

## Further documentation

- [docs/architecture.md](docs/architecture.md)
- [docs/data-model.md](docs/data-model.md)
- [docs/opportunity-engine.md](docs/opportunity-engine.md)
- [docs/leadrevive.md](docs/leadrevive.md)
- [docs/crm-matching.md](docs/crm-matching.md)
- [docs/scoring.md](docs/scoring.md)
- [docs/privacy.md](docs/privacy.md)
- [docs/adding-data-source.md](docs/adding-data-source.md)
- [docs/adding-crm-adapter.md](docs/adding-crm-adapter.md)
