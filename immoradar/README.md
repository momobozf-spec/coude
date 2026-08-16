# ImmoRadar

**Real Estate Acquisition Intelligence for Belgian agencies.**

ImmoRadar answers one question for a real-estate agent every morning:

> *"Which potential sellers should I contact today?"*

It combines two intelligence engines on top of an agency's existing systems:

- **ImmoRadar** — detects seller opportunities from lawfully accessible, external
  property-market data (FSBO listings, price drops, stale listings, removals, relists).
- **LeadRevive** — surfaces dormant, high-potential relationships inside the agency's
  own CRM database (dormant valuation leads, former clients, old buyers…).

The competitive edge is the combination: an external market signal **plus** an existing
CRM relationship produces a high-priority, explainable opportunity.

ImmoRadar is **not** a CRM replacement — it is an acquisition intelligence layer.

---

## Quick start

### With Docker

```bash
cp .env.example .env          # adjust SESSION_SECRET (and TELEGRAM_BOT_TOKEN if used)
docker compose up --build
```

The app container runs migrations on boot. Seed the demo data once:

```bash
docker compose exec app npx prisma db seed
```

Open http://localhost:3000 and log in.

### Local development

Requirements: Node.js 20+, PostgreSQL 16 (or `docker compose up db`).

```bash
npm install
cp .env.example .env                  # set DATABASE_URL
npx prisma migrate dev                # create schema
npm run db:seed                       # demo data (5 agencies, full market history)
npm run dev                           # http://localhost:3000
```

### Demo logins (all passwords: `demo1234`)

| Role | Email |
| --- | --- |
| Agent (hero agency, Gent) | `thomas@immo-vandenberghe.be` |
| Agency admin | `an@immo-vandenberghe.be` |
| Platform admin | `admin@immoradar.be` |

### The complete demo scenario

```bash
npm run demo:e2e
```

Runs the full 20-step flagship flow: a private listing is ingested → normalized →
property-matched → classified PRIVATE → FSBO event → opportunity created → CRM match
found (previous buyer, 2019) → relationship/intent/combined scores → territory match →
assignment → Telegram alert → Today's Opportunities → marked CONTACTED → analytics.

Other jobs:

```bash
npm run jobs:collect -- --scene=0     # run fixture collectors + ingestion
npm run jobs:pipeline -- --scene=1    # full pipeline (advance the market a scene)
npm run jobs:digest -- --force        # morning opportunity brief
```

---

## Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `TEST_DATABASE_URL` | Separate DB for DB-backed tests (tenant isolation). Tests are skipped when unset |
| `SESSION_SECRET` | HMAC key for session cookies — generate with `openssl rand -hex 32` |
| `TELEGRAM_BOT_TOKEN` | Optional. Without it, Telegram runs in log-only mode; alerts are still persisted and shown in-app |
| `LOG_LEVEL` | `debug` \| `info` \| `warn` \| `error` |

## Architecture at a glance

```
collectors  →  ingestion  →  normalization  →  matching  →  classification
                                   │
                              snapshots + events (shared market data)
                                   │
                    ┌──────────────┴───────────────┐
             OpportunityService              LeadReviveService
             (market → per-agency            (CRM → dormant
              opportunities, CRM ↔            opportunities)
              market matching)                       │
                    └──────────────┬───────────────┘
                             scoring engine
                    (intent + relationship + timing +
                     territory + confidence → 0-100)
                                   │
                    workflow · alerts/Telegram · digest · analytics
```

- `src/domain` — pure domain types and logic (no I/O, no UI)
- `src/collectors` — collector framework + fixture collectors (see compliance note below)
- `src/normalization`, `src/matching`, `src/classification`, `src/events`, `src/scoring`,
  `src/crm` — the pure intelligence engines, fully unit-tested
- `src/ingestion`, `src/services` — DB-backed orchestration
- `src/repositories` — **tenant-scoped** data access (`TenantDb`)
- `src/jobs` — CLI jobs (collect, pipeline, digest, demo)
- `src/app` — Next.js App Router UI (server components + server actions)

Full documentation lives in [`docs/`](docs):

| Doc | Contents |
| --- | --- |
| [architecture.md](docs/architecture.md) | System design, module boundaries, data flow |
| [data-model.md](docs/data-model.md) | Prisma schema walkthrough |
| [opportunity-engine.md](docs/opportunity-engine.md) | Events → opportunities |
| [leadrevive.md](docs/leadrevive.md) | CRM import + dormant detection |
| [crm-matching.md](docs/crm-matching.md) | CRM ↔ market matching rules |
| [scoring.md](docs/scoring.md) | Scoring model and configuration |
| [privacy.md](docs/privacy.md) | Tenant isolation, retention, GDPR posture |
| [adding-data-source.md](docs/adding-data-source.md) | Compliance-first collector guide |
| [adding-crm-adapter.md](docs/adding-crm-adapter.md) | Building Whise/Omnicasa adapters |

## Multi-tenancy

Each real-estate office is an **Agency**. Users hold one of three roles:
`PLATFORM_ADMIN`, `AGENCY_ADMIN`, `AGENT`.

CRM contacts, imports, opportunities, territories, alerts, assignments and settings are
strictly tenant-isolated: all access goes through `TenantDb` (`src/repositories/tenant-db.ts`),
which injects the `agencyId` filter into every query. Market data (properties, listings,
snapshots, events) is shared platform infrastructure — but one tenant's CRM data is
**never** used to enrich another tenant's intelligence. This guarantee is covered by
dedicated automated tests (`tests/tenant-isolation.test.ts`).

## Data collection compliance

Only sources with a permitted integration method may be implemented, in priority order:
**official API → authorised/public feed → structured data → permitted public HTML**.
Collectors never bypass CAPTCHAs, logins, anti-bot systems, rate limits or access
controls. Until a real source's permitted method is established, **fixture collectors**
(`src/collectors/fixtures`) drive the entire pipeline end-to-end — the whole product is
demonstrable without touching any real website. See
[docs/adding-data-source.md](docs/adding-data-source.md).

## Database & migrations

```bash
npx prisma migrate dev        # dev migration
npx prisma migrate deploy     # production
npm run db:seed               # demo data (idempotent: wipes + reseeds)
```

The seed builds market history by running backdated listing timelines through the
**real ingestion pipeline**, so snapshots, price-drop/stale/removal/relist events and
property matches are authentic engine output — not fabricated rows.

## Authentication & security

- scrypt password hashing (Node crypto, no external deps)
- Stateless HMAC-SHA256-signed session cookies (httpOnly, SameSite=Lax, 7-day expiry)
- All mutations via Next.js server actions (origin-checked) with Zod validation
- Role-based guards (`requireUser` / `requireAgencyUser` / `requirePlatformAdmin`)
- Prisma parameterized queries only; structured JSON logging with PII redaction
- Audit log for logins, imports, status changes and settings changes

## Telegram notifications

Configure per agency in **Settings**: chat ID, minimum score for instant alerts, morning
brief hour, and per-channel toggles. Alert kinds: instant hot opportunity, CRM + market
match, morning digest. Every alert is persisted with a dedupe key —
duplicates are structurally impossible (`(agencyId, dedupeKey)` unique constraint).

## Testing

```bash
npm run typecheck
npm run lint
npm test                      # unit suites always run
TEST_DATABASE_URL=postgresql://... npm test   # + DB-backed tenant isolation suites
npm run build
```

130+ tests cover normalization, property matching, seller classification, event
detection (incl. removal confirmation), CRM import/dedupe, CRM ↔ market matching,
dormant detection, scoring, territory matching, collector retries/failure isolation,
auth, permissions, alert dedupe and tenant isolation. No test depends on an external
website.

## Production deployment considerations

- Run `next build` + `next start` behind TLS; set a strong `SESSION_SECRET`
- Use managed PostgreSQL with backups; run `prisma migrate deploy` on release
- Schedule `jobs:pipeline` (e.g. every 30 min) and `jobs:digest` (hourly) via cron
- Set `TELEGRAM_BOT_TOKEN` and per-agency chat IDs for real notifications
- Review [docs/privacy.md](docs/privacy.md) before importing production CRM data
