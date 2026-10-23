# Muslim Life

> **Live with intention.**

An all-in-one lifestyle platform for Muslims: prayer times and tracking, a planner built
around the day, habits, halal discovery, and an assistant that turns intentions into plans.

**Phases 1–6 are complete.** Phase 1 delivered the design system, landing page, auth,
onboarding, database and app shell. Phase 2 delivered **My Day** — the daily loop of prayer,
priorities, tasks, habits, timeline and reflection. Phase 3 delivered **Explore** — business
discovery, deals, favourites and redemption. Phase 4 delivered the **Assistant** — streaming
chat, plan generators, and the reviewed hand-off into the real planner. Phase 5 delivered
**billing** — a payment abstraction, a complete stub provider, a Stripe adapter,
webhook-driven subscription sync and the billing UI. Phase 6 delivered the
**production-hardening layer** — data export, staged account deletion against a written
retention policy, a notification abstraction, analytics sinks, NL/FR/AR with RTL, an
operations panel, health and readiness endpoints, origin checks and log redaction.
See [docs/roadmap.md](docs/roadmap.md).

**Production hardening (October 2026).** The full integration suite now runs against a
real PostgreSQL database (193 tests green), the migrations are checked against the schema
(`npm run db:drift`), and the app runs on Prisma 7 with the `pg` driver adapter. Fixed on
the way: a migration that would have broken `prisma migrate deploy`, a webhook retry that
was silently dropped, Stripe period dates under the current API version, a race in deal
redemption, an open redirect after login, a spoofable rate-limit IP, and pricing that sold
features which do not exist. Added: password reset and change with session revocation,
explicit GDPR art. 9 consent, privacy policy and terms, runtime `APP_URL`, a start-up
configuration check, self-hosted fonts and a free Render deployment.

- Deploy for free: [docs/DEPLOY-RENDER-FREE.md](docs/DEPLOY-RENDER-FREE.md)
- Before real members: [docs/LAUNCH-CHECKLIST.md](docs/LAUNCH-CHECKLIST.md)

> **Still open.** No Lighthouse or assistive-technology audit has been run, and the
> NL/FR/AR translations and the religious content have not been reviewed by a person.

---

## Documentation

| Document | Contents |
| --- | --- |
| [docs/product-vision.md](docs/product-vision.md) | What we're building, for whom, and why it can be a business |
| [docs/mvp-scope.md](docs/mvp-scope.md) | Exactly what is in and out of the MVP, and the free/premium line |
| [docs/architecture.md](docs/architecture.md) | Layering, technology decisions, security, privacy |
| [docs/database-design.md](docs/database-design.md) | Every model, with the reasoning behind the modelling choices |
| [docs/roadmap.md](docs/roadmap.md) | Build phases, post-MVP sequencing, calendar strategy |

---

## Getting started

### 1. Requirements

- Node.js 20 or newer (developed on 24)
- A PostgreSQL 14+ database

For a local database, either run Postgres in Docker:

```bash
docker run --name muslimlife-db -e POSTGRES_USER=muslimlife \
  -e POSTGRES_PASSWORD=muslimlife -e POSTGRES_DB=muslimlife \
  -p 5432:5432 -d postgres:17
```

…or create a free database at [Neon](https://neon.tech) or [Supabase](https://supabase.com)
and paste the connection string into `.env`.

### 2. Configure

```bash
cp .env.example .env
npx auth secret          # writes a real AUTH_SECRET
```

Only `DATABASE_URL` and `AUTH_SECRET` are required. Everything else (AI, Stripe, maps,
analytics) is optional and degrades gracefully — the AI provider defaults to `mock`, and
maps render a static placeholder when no key is set.

### 3. Install, migrate, seed

```bash
npm install
npm run db:migrate       # creates the schema
npm run db:seed          # cities, categories, demo listings, daily content
npm run dev
```

Open <http://localhost:3000>.

### 4. Sign in

The seed creates two development accounts (never seeded when `NODE_ENV=production`):

| Account | Email | Password |
| --- | --- | --- |
| Member (Premium, populated day) | `demo@muslimlife.app` | `MuslimLife2026!` |
| Administrator | `admin@muslimlife.app` | `MuslimLife2026!` |

---

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run verify` | Typecheck + lint + unit tests — run before every commit |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run test` | Vitest unit tests (no database needed) |
| `npm run test:integration` | Service tests against a real database — see below |
| `npm run test:e2e` | Playwright end-to-end tests |
| `npm run db:migrate` | Create/apply a migration |
| `npm run db:seed` | Seed reference and demo data |
| `npm run db:studio` | Prisma Studio |
| `npm run db:reset` | Drop, recreate, migrate and reseed |

### Integration tests

The unit suite runs anywhere. The integration suite exercises the real services against
PostgreSQL and is **skipped, loudly**, when `TEST_DATABASE_URL` is absent — so a missing
environment reports itself rather than quietly passing zero assertions.

```bash
createdb muslimlife_test

# Apply the real migrations (not `db push`, so the migrations themselves are tested)
DATABASE_URL="postgresql://…/muslimlife_test" npx prisma migrate deploy
DATABASE_URL="postgresql://…/muslimlife_test" npm run db:drift

# Run them
TEST_DATABASE_URL="postgresql://…/muslimlife_test" npm run test:integration
```

These cover task views (Inbox/Today/Upcoming), habit frequencies and logging, the free-tier
cap, planner block validation, reflection uniqueness, and — most importantly — **cross-user
isolation**: that member B cannot read or mutate any of member A's tasks, habits, blocks,
reflections or prayer logs.

### If the build fails with "Turbopack is not supported on this platform"

Some Windows machines block Next's native SWC binary via an application-control policy.
The build then falls back to WASM, which Turbopack cannot use. Use the Webpack builds
instead — they produce the same output:

```bash
npm run dev:webpack
npm run build:webpack
```

This is a local environment constraint only. CI and Vercel load the native binary normally,
so the default `npm run build` is correct for deployment.

---

## Architecture at a glance

```
src/
├── app/              Routes.  (marketing) (auth) onboarding (app) (admin) api
├── components/       ui/ primitives · layout/ shell · marketing/ · shared/
├── modules/          Client-side feature code (components, hooks, actions)
├── server/           Server-only. auth/ db/ modules/ services/ integrations/
├── lib/              Isomorphic utilities: dates, prayer, errors, logger
├── config/           Validated env, plans, navigation, site metadata
├── i18n/             Translation runtime
└── styles/           Design tokens
```

**The rule that holds it together:** React components never import Prisma. Only
`src/server/modules/**` touches the database, and every service takes an `Actor` rather
than a request. This is enforced by an ESLint rule and by `import 'server-only'`.

### Things worth knowing before you change something

- **Prayer times are computed locally** with `adhan` — no API, no keys, works offline.
  `src/lib/prayer/calculate.ts` is a pure function and is covered by unit tests against
  published timetables.
- **Days are ISO date strings, not timestamps.** See the comment at the top of
  `src/lib/dates.ts`. This is what stops a 23:50 Isha tick landing on the wrong day.
- **Entitlements are decided in exactly one place**: `src/server/services/entitlements.ts`.
  Nothing else may branch on `plan === 'PREMIUM'`. The UI shows locks; the server is the gate.
- **Prayer tracking is a separate model from habits**, deliberately — it has its own status
  vocabulary (including `EXCUSED`), never counts toward the free habit limit, and is never
  given the "broken streak" treatment.
- **There is no combined score, anywhere.** Prayer, habits and tasks are always reported per
  domain. `DailySummary` has no `score` column, so a faith score cannot even be stored.
- **`My Day` is one service call.** `getMyDay()` composes prayer, tasks, habits, blocks and
  reflection in a single parallel batch. Pages must not reach into repositories directly.
- **Isha can fall after local midnight.** At the solstice in Brussels it lands around 01:45 the
  next calendar day. The timeline sorts on minutes-from-day-start, not on the clock string,
  so it renders at the end of the day rather than above Fajr.
- **Analytics can never record content.** `track()` accepts numbers and booleans only — no
  task titles, habit names, reflection text, search queries or prayer detail. Enforced by types.
- **`BusinessTier` is not a trust signal.** `BASIC | ENHANCED | FEATURED` is what a business
  pays for. Trust lives in `BusinessVerification` (`DEMO | UNVERIFIED | SELF_REPORTED |
  VERIFIED`), and seed data can only ever be `DEMO` — a test enforces it.
- **Redemption codes are per-member and cryptographic.** Generated with `randomInt`, unique
  per `(deal, user)` at the database level, and only ever readable through a user-scoped
  query. `Deal.code` — the business-wide promo code — is never selected into any response.
- **Discovery filters live in the URL**, not component state, so every view is shareable.
- **AI never writes to the database.** A generator produces a `GeneratedPlan` in `READY`;
  only `applyGeneratedPlan()` — with an explicit member selection — creates a task or block.
- **Safety is deterministic and runs before the provider.** `classifyQuery()` decides whether
  a message is a ruling request; the disclaimer is appended *after* generation, so a model
  that ignores its instructions still cannot omit it.
- **Sensitive context never leaves the database.** Reflections, task descriptions, notes and
  worship logs are not queried by `buildAssistantContext()` at all — there is deliberately no
  flag that can turn the guarantee off.
- **No AI SDK dependency.** The Anthropic and OpenAI adapters talk to the REST APIs over
  `fetch`, so nothing large is installed for a key nobody configured, and no vendor code can
  reach a client bundle.
- **Naming a provider without its credentials is a hard error**, never a silent
  fallback. `AI_PROVIDER=anthropic` with no key gives `AI_NOT_CONFIGURED`; the same
  applies to payments. Mock/stub in production is refused unless explicitly opted in
  via `ALLOW_MOCK_AI_IN_PRODUCTION` / `ALLOW_STUB_PAYMENTS_IN_PRODUCTION`.
- **The webhook is the only thing that makes someone Premium.** The checkout redirect
  proves a browser followed a link and nothing more, so the success page polls for
  server-synchronised state instead of trusting the URL.
- **An unknown price grants nothing.** `resolvePriceId()` fails closed, so no other
  price on the provider account can confer a plan.
- **`AI_PROVIDER=mock` is the default** and is genuinely useful — every generator, the whole
  chat flow and all tests work with no API key and no spend. Mock replies are labelled.
- **Demo listings are flagged `isDemo`** and badged everywhere they render. We never present
  unverified listings as real businesses.

---

## Live zetten

Operator: **Marhaba Data & AI Agent BV** (BE 1003.552.102, Zaventem) — see
`src/config/legal.ts`. The app needs PostgreSQL and a daily maintenance call, so it runs
as a Docker web service on **Render (Frankfurt)** with **Neon Postgres (Frankfurt)**.
Free test setup: [docs/DEPLOY-RENDER-FREE.md](docs/DEPLOY-RENDER-FREE.md). For real members:

1. **Neon** — project in *AWS Europe Central 1 (Frankfurt)*, Postgres 17, a paid plan with
   point-in-time restore. Copy the connection string (pooling off).
2. **Stripe** (account on the BV) — create product **"Muslim Life Premium"** with two
   recurring prices, **€7.99/month** and **€79/year**, *tax-inclusive* (as shown on the
   site; amounts live in `src/config/plans.ts`). Enable the **Customer Portal**
   (cancel, update card). Add a webhook endpoint `https://<domain>/api/webhooks/stripe`
   with events `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`,
   `invoice.payment_failed`; copy its signing secret.
3. **Resend** — add your domain and set the SPF/DKIM records.
4. **Render** — New → Blueprint with `render.free.yaml` as a base, but on a paid plan,
   **without `STAGING`**, without `SEED_DEMO_LISTINGS` and without the `ALLOW_*` flags, and
   with the variables below. Attach the custom domain (https is automatic).
5. Register your own account, set `BOOTSTRAP_ADMIN_EMAIL` to it once, restart, then clear it.
6. **GitHub Actions** — copy `deploy/github-cron.yml` to `.github/workflows/cron.yml`,
   secrets `APP_URL` and `HEALTH_CHECK_TOKEN` (daily maintenance: due account deletions).
7. Uptime monitor on `/api/health` (liveness) and `/api/ready` (database).

| Variable | Required | Value |
| --- | --- | --- |
| `DATABASE_URL` | yes | Neon connection string |
| `APP_URL`, `AUTH_URL`, `NEXT_PUBLIC_APP_URL` | yes | `https://<domain>` (identical) |
| `AUTH_SECRET` | yes | `openssl rand -base64 32` (the `.env.example` value is refused) |
| `TRUSTED_PROXY_HOPS` | yes | `1` on Render |
| `PAYMENTS_PROVIDER` | yes | `stripe` |
| `STRIPE_SECRET_KEY` | yes | `sk_live_…` (`sk_test_…` only with `STAGING=1`) |
| `STRIPE_WEBHOOK_SECRET` | yes | `whsec_…` from the webhook endpoint |
| `STRIPE_PRICE_PREMIUM_MONTHLY`, `STRIPE_PRICE_PREMIUM_YEARLY` | yes | the two `price_…` ids |
| `RESEND_API_KEY`, `EMAIL_FROM` | yes | `Muslim Life <noreply@<domain>>` |
| `HEALTH_CHECK_TOKEN` | yes | ≥ 32 random characters |
| `LEGAL_ENTITY_ADDRESS` | yes | street, number, postcode of the registered office (TODO) |
| `LEGAL_ENTITY_NAME`, `LEGAL_ENTITY_VAT`, `LEGAL_CONTACT_EMAIL` | no | default to the BV |
| `AI_PROVIDER` + `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | no | without a key the assistant is unavailable |
| `ANALYTICS_PROVIDER` | no | `database` (default) |
| `LEGAL_TEXTS_REVIEWED`, `RELIGIOUS_CONTENT_REVIEWED` | no | `1` only after the reviews |

The server **refuses to start** in production on: missing database, short or placeholder
`AUTH_SECRET`, non-https or mismatched URLs, Stripe without webhook secret, and — unless
`STAGING=1` — mock AI, stub payments, demo listings or a Stripe test key. It also refuses to
boot while a seed demo account (`demo@`/`admin@muslimlife.app`) still accepts the published
demo password.

---

## Privacy

Prayer and habit data is private by default and has no public read path anywhere in the
codebase. There is no feed, no public profile and no leaderboard — this is a structural
constraint, not a setting. See [docs/architecture.md](docs/architecture.md) §6.

---

## Disclaimer

Muslim Life is a lifestyle and productivity product. It does not issue religious rulings and
does not provide medical, legal or financial advice. The assistant is not a scholar and is
never presented as one.
