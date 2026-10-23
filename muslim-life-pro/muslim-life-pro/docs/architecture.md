# Muslim Life — Architecture

## 1. Shape: modular monolith

One Next.js application, one PostgreSQL database, organised into **domain modules** with
enforced boundaries. Not microservices. Not a monorepo. A solo/small team ships far faster
against a well-layered monolith, and every module below could be extracted later if a real
scaling need appears (it will not, for a long time).

```
┌──────────────────────────────────────────────────────────────────┐
│                        CLIENT (browser / PWA)                    │
│   React Server Components · Client islands · Tailwind design sys │
└────────────────────────────┬─────────────────────────────────────┘
                             │  RSC payload + Server Actions + REST
┌────────────────────────────▼─────────────────────────────────────┐
│                      NEXT.JS APP ROUTER                          │
│  app/(marketing)  app/(auth)  app/(app)  app/(admin)  app/api    │
└────────────────────────────┬─────────────────────────────────────┘
                             │  never talks to Prisma directly
┌────────────────────────────▼─────────────────────────────────────┐
│                        SERVICE LAYER                             │
│  src/server/modules/{planner,habits,prayer,deals,assistant,...}  │
│  · business rules  · entitlement checks  · validation  · errors  │
└────────────────────────────┬─────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────┐
│                     DATA + INTEGRATION LAYER                     │
│  Prisma repositories │ AI provider │ Stripe │ Maps │ Analytics   │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │   PostgreSQL    │
                    └─────────────────┘
```

### The one rule
> **React components never import Prisma. Route handlers and Server Actions never import Prisma.
> Only `src/server/modules/*/​*.service.ts` and `*.repository.ts` touch the database.**

This is the rule that keeps the codebase extractable, testable and safe.

## 2. Directory structure

```
muslim-life/
├── docs/                          # this documentation
├── prisma/
│   ├── schema.prisma
│   └── seed/                      # split seeders: cities, categories, businesses, deals, content
├── messages/                      # i18n catalogues: en.json, nl.json, fr.json, ar.json
├── public/
├── tests/
│   ├── unit/                      # Vitest — services, pure logic
│   └── e2e/                       # Playwright — critical journeys
└── src/
    ├── app/
    │   ├── (marketing)/           # /, /pricing, /legal/*  — public, SEO
    │   ├── (auth)/                # /login, /register, /forgot-password
    │   ├── onboarding/            # authed, no app chrome
    │   ├── (app)/                 # /app/**  — authed, app shell
    │   ├── (admin)/               # /admin/** — role-gated
    │   └── api/                   # webhooks, AI streaming, auth handlers
    │
    ├── components/
    │   ├── ui/                    # shadcn primitives — zero business logic
    │   ├── layout/                # shell, sidebar, mobile nav, topbar
    │   ├── marketing/             # landing sections
    │   └── shared/                # empty states, page header, stat card
    │
    ├── modules/                   # CLIENT-side feature code (components + hooks)
    │   ├── dashboard/
    │   ├── planner/
    │   ├── habits/
    │   ├── prayer/
    │   ├── deals/
    │   ├── assistant/
    │   ├── profile/
    │   └── subscription/
    │
    ├── server/                    # SERVER-only. Never imported by client components.
    │   ├── auth/                  # Auth.js config, session helpers, guards
    │   ├── db/                    # Prisma singleton
    │   ├── modules/               # <domain>/{service,repository,schema,types}.ts
    │   ├── services/              # cross-cutting: entitlements, rate-limit, audit
    │   └── integrations/          # ai/, payments/, maps/, analytics/, email/
    │
    ├── lib/                       # isomorphic utilities: dates, format, cn, errors
    ├── config/                    # env (zod-validated), plans, navigation, site
    ├── i18n/                      # translation runtime + locale config
    └── styles/                    # globals.css + design tokens
```

**Why `modules/` and `server/modules/` are separate:** it makes the client/server boundary
physical rather than conventional. `src/server/**` is guarded by `import 'server-only'` so any
accidental client import is a build error, not a runtime secret leak.

## 3. Technology decisions

| Concern | Choice | Rationale |
| --- | --- | --- |
| Framework | **Next.js 16 (App Router)** | RSC keeps the dashboard fast; one deploy target |
| Language | **TypeScript strict** | `strict: true`, `noUncheckedIndexedAccess: true` |
| Styling | **Tailwind CSS v4** | CSS-first tokens via `@theme`; no JS config drift |
| Components | **shadcn/ui** (owned source) | We own the code; no upgrade lock-in |
| Icons | **Lucide** | Consistent, tree-shakeable |
| DB | **PostgreSQL** | Relational data with real constraints; JSONB where flexible |
| ORM | **Prisma 7** | Type-safe, great migrations, fits the repository pattern |
| Auth | **Auth.js v5** | Users stay in our DB; OAuth-ready; no per-MAU pricing |
| Payments | **Stripe** | Checkout + Portal + webhooks; test mode for MVP |
| AI | **Provider abstraction** | `AiProvider` interface; Anthropic/OpenAI-compatible adapters |
| Validation | **Zod** | Shared schemas between client forms and server boundaries |
| Forms | **React Hook Form** | Only where forms are genuinely complex |
| State | **Server state first** | RSC + Server Actions; no global store in MVP |
| Prayer times | **`adhan`** | Local astronomical calculation — no API, no keys, offline |
| Testing | **Vitest + Playwright** | Unit on services; e2e on the 5 critical journeys |
| Deploy | **Vercel + managed Postgres** | Zero-ops; Neon/Supabase for the database |

### Deliberate omissions
- **No Zustand/Redux in MVP.** Server state covers everything. Introduce only when a genuinely
  cross-page client state appears (likely: the assistant composer draft).
- **No tRPC.** Server Actions + a handful of typed route handlers cover it with less machinery.
- **No Redis in MVP.** Rate limiting is a Postgres-backed sliding window behind an interface;
  swap to Upstash when traffic requires it.

## 4. Key architectural patterns

### 4.1 Service layer

Every domain module exposes a service. Services take an **actor** (the authenticated user's id +
role + plan), never a raw request.

```ts
// src/server/modules/habits/habit.service.ts
export async function createHabit(actor: Actor, input: CreateHabitInput) {
  const data = createHabitSchema.parse(input)

  const count = await habitRepo.countActive(actor.userId)
  await requireEntitlement(actor, 'habits.unlimited', {
    // free tier: 3 habits
    unless: count < PLAN_LIMITS.free.maxHabits,
  })

  return habitRepo.create(actor.userId, data)
}
```

Benefits: unit-testable without HTTP, entitlements enforced in exactly one place per feature,
and the same service backs both a Server Action and a future public API.

### 4.2 Entitlements

A single source of truth maps features → plans. Nothing else may branch on plan.

```ts
// src/server/services/entitlements.ts
export const ENTITLEMENTS = {
  'habits.unlimited':     ['PREMIUM'],
  'planner.monthView':    ['PREMIUM'],
  'deals.premium':        ['PREMIUM'],
  'assistant.generators': ['PREMIUM'],
  'stats.fullHistory':    ['PREMIUM'],
  'data.export':          ['PREMIUM'],
} as const
```

`requireEntitlement()` throws a typed `EntitlementError` that the error boundary renders as an
upgrade prompt. The UI *also* shows locks, but the UI is never the gate.

### 4.3 Errors

One typed error hierarchy (`AppError` → `ValidationError`, `NotFoundError`, `ForbiddenError`,
`EntitlementError`, `RateLimitError`). A single `toErrorResponse()` maps them to HTTP status +
a safe client payload. Internal details are logged, never returned.

### 4.4 AI abstraction

```
assistant.service.ts
  → safety.ts        (pre-check: religious-ruling detection, prompt-injection scrub)
  → prompts.ts       (system prompt + guardrails + user context)
  → AiProvider       (interface: chat(), stream(), generateStructured<T>())
       ├── AnthropicProvider
       ├── OpenAiProvider
       └── MockProvider        ← used in tests and when no key is set
  → usage.ts         (quota check + increment, per plan)
  → safety.ts        (post-check: disclaimer injection)
```

`generateStructured<T>()` is schema-driven (Zod → JSON Schema → tool call), which is what makes
the plan generators reliable enough to write into the planner.

**RAG readiness:** the provider interface has an optional `retrieve(query)` hook and the schema
reserves a `ContentSource` table. When verified Islamic content is licensed, retrieval slots in
without touching the assistant service.

### 4.5 Prayer times

Pure function, no I/O:

```ts
computePrayerTimes({ lat, lng, date, method, madhab, offsets }) → PrayerTimes
```

Called on the server for the dashboard and on the client for the live countdown. Because it is
deterministic and pure, it is fully unit-testable against published tables.

### 4.6 Internationalisation

- Translation keys only — no hardcoded UI strings, enforced by lint rule.
- `messages/{locale}.json`, typed via a generated `TranslationKey` union.
- Locale from user preference → cookie → `Accept-Language` → `en`.
- `dir` computed from locale (`ar` → `rtl`); layout uses logical CSS properties (`ms-`, `me-`,
  `ps-`, `pe-`) throughout so enabling RTL is a config change, not a rewrite.
- MVP ships EN complete; NL/FR/AR catalogues exist with EN fallback.

## 5. Security

| Layer | Control |
| --- | --- |
| Auth | Auth.js v5, httpOnly + secure + sameSite cookies, bcrypt (cost 12) |
| Authorization | Middleware protects route groups; **every service re-checks ownership** |
| RBAC | `USER` \| `BUSINESS_OWNER` \| `ADMIN`; admin routes double-gated (middleware + layout) |
| Input | Zod at every boundary; no unvalidated body reaches a service |
| Rate limiting | Sliding window behind `RateLimiter` interface: auth 5/15min, AI 20/hour, writes 100/min |
| Secrets | Zod-validated env at boot; only `NEXT_PUBLIC_*` reach the client; fail-fast on missing |
| Webhooks | Stripe signature verification + idempotency keys |
| AI abuse | Per-plan quotas, input length caps, injection scrubbing, output disclaimer enforcement |
| Headers | CSP, HSTS, X-Frame-Options, Referrer-Policy, COOP/CORP, Permissions-Policy via `next.config` |
| CSRF | Origin/Referer allow-list (`src/server/http/origin.ts`) on every mutating route, on top of the `SameSite=Lax` session cookie. Webhooks are exempt and prove themselves by signature |
| IDOR | Repository methods always take `userId` and scope the query — never `findUnique(id)` alone |

**Known CSP weakness.** `script-src` still carries `'unsafe-inline'`. Next injects inline
bootstrap and flight-data scripts on every page, and removing them requires per-request
nonces — which means the proxy rewriting every HTML response and every route becoming
dynamic. The trade was made knowingly: `object-src 'none'`, `base-uri 'self'` and
`frame-ancestors 'none'` close the injection routes that matter most, and no page renders
unsanitised HTML. Revisit when nonce support lands without the static-rendering cost.

## 6. Privacy (GDPR)

- **Worship data is private by default and has no public read path anywhere in the codebase.**
- Data minimisation: coarse location (city) only — never continuous GPS.
- Analytics events carry numbers, booleans and null only. Strings are rejected by type *and*
  at runtime (`assertSafeProperties`), and a set of property names is refused outright so
  `{ donationAmount: 5000 }` cannot slip through as a number.

### The retention policy is the specification

`src/server/modules/privacy/retention-policy.ts` is the single table that both the export
service and the deletion service read, and that the privacy settings page renders. "What we
hand over", "what we remove" and "what we tell people" cannot disagree, because they are the
same constant.

Three outcomes, each with a written motivation:

| Action | Meaning | Examples |
| --- | --- | --- |
| `DELETE` | Rows go. The default for everything the member created | Tasks, habits, habit logs, **prayer logs**, reflections, assistant conversations, preferences |
| `ANONYMIZE` | Row survives without the person | Analytics events (`userId → null`), redemptions and AI usage counters (reparented to a tombstone account), subscription (provider ids cleared) |
| `RETAIN` | Row survives intact, because a law requires it | `AuditLog` (proves the deletion was performed), `WebhookEvent` (the ledger that makes webhook processing exactly-once) |

Prayer logs are `DELETE` and are never anonymised. "Anonymous prayer records" is not
something this product should hold, at any scale, for any purpose.

### Three separate operations

- **Export** (`POST /api/privacy/export`) — one synchronous JSON document, streamed to an
  authenticated member and never stored. Carries `exportVersion`, `generatedAt` and a
  `notice` block listing what was excluded and why. Excludes password hashes, session and
  OAuth tokens, the audit log, provider customer/subscription ids, and anything belonging to
  another member. Rate-limited by a `User.lastExportAt` column rather than by querying the
  audit log — `writeAudit` is deliberately non-throwing, and a limit that stops applying
  when logging fails is not a limit.
- **Clear activity** (`POST /api/privacy/activity`) — removes tracked history, keeps the
  account, settings and subscription. Requires typing `CLEAR`.
- **Delete account** (`POST /api/privacy/account`) — staged, never immediate:

```
REQUESTED ──(billing settled)──► READY ──(grace window elapsed)──► COMPLETED
    │
    └─(paid subscription live)──► BLOCKED_BILLING
```

  Sessions are revoked the moment deletion is requested. The billing guard is checked both
  when asked and again when the policy runs, and `force` skips only the grace window — never
  the billing check. An account a provider can still charge is never deleted. Completion is
  idempotent, so a retry after a partial failure is safe. The account row itself is scrubbed
  rather than deleted (email replaced by a SHA-256 digest at `@deleted.invalid`), because
  deleting it would cascade into the retained records and orphan the audit trail.

Due deletions are executed by `POST /api/jobs/maintenance`, authenticated with
`HEALTH_CHECK_TOKEN` and returning 404 without it.

## 7. Observability

- Structured JSON logger. Redaction is a safety net, not the primary control: key fragments
  (`secret`, `token`, `apikey`, `authorization`, `cookie`, `email`, `prompt`, …) are matched
  after stripping separators, so `x-api-key` and `stripeSecretKey` are both caught; nesting
  past three levels is replaced wholesale so an accidental `{ ...user }` cannot leak through
  a key name nobody listed; values over 512 characters are truncated.
- `GET /api/health` — liveness. Touches no dependency: a probe that fails because Postgres
  blinked turns a degraded system into an outage.
- `GET /api/ready` — readiness. Runs `SELECT 1` with a 3s timeout and returns 503 when it
  fails. Anonymous callers get `ok` or `degraded` and nothing else; supplying
  `HEALTH_CHECK_TOKEN` (compared with `timingSafeEqual`) adds provider *names* and booleans —
  never a key, never a connection string.
- Analytics sinks live behind `AnalyticsSink` (`noop` / `console` / `database` / `posthog`),
  selected by `ANALYTICS_PROVIDER` and defaulting to `database` — our own table, our own
  region, no third party contacted unless deliberately configured. A sink failure is logged
  and swallowed; it never fails a habit tick.
- Notification delivery lives behind `NotificationProvider` (`stub` / `console`). Neither
  sends anything externally, and the UI says so rather than showing a toggle that does
  nothing.

## 7b. Internationalisation

Four catalogues in `messages/*.json`, all structurally identical — a unit test compares every
leaf key and every `{placeholder}` against English and fails on drift, because a missing key
falls back to English silently at runtime and that is a terrible thing to discover in
production.

- **Locale resolution** (`src/i18n/server.ts`): account preference → `ml_locale` cookie →
  `Accept-Language` (q-values honoured) → English. Regional tags resolve to their base
  language, so `nl-BE` is served Dutch.
- **Locale is not timezone and not currency.** Changing the interface language writes exactly
  one field. Someone reading Arabic in Antwerp keeps Brussels prayer times and euros.
- **Direction** is set on `<html>` from the resolved locale. New surfaces use logical CSS
  properties (`ms-*`, `text-start`, `inset-inline-start`) so RTL needs no second rule; a test
  asserts the physical equivalents do not appear.
- **Translation honesty.** NL, FR and AR are machine-translated and reviewed by nobody. Each
  catalogue declares `status: "machine-unreviewed"` in `_meta`, the language picker shows a
  notice, and a `reviewed` claim with an empty `reviewedBy` is downgraded in code — so the
  notice cannot be removed by editing one word in a JSON file. Arabic carries this product's
  religious vocabulary, so the claim matters more there than anywhere else.

**Cost, stated plainly:** because `<html lang/dir>` depends on the request, every route is now
dynamically rendered, including the marketing pages that were previously static. That is a
real CDN-caching loss, accepted so that a signed-out visitor's browser language is honoured.

## 8. Extension points for future modules

| Future module | Prepared hook |
| --- | --- |
| Family | `Household` + `HouseholdMember` designed; all user-scoped queries take a scope param |
| Quran | `Habit` supports counter type with `unit='pages'`; `QuranBookmark` slot reserved |
| Finance | `Goal` supports `type='SAVINGS'` with amount + currency |
| Travel | Assistant `TravelPlan` artifact persists as `GeneratedPlan` |
| Marketplace | `Business` → `Product` relation reserved; Stripe Connect account field on Business |
| Business self-service | `Business.ownerId`, `BusinessClaim`, listing tiers already modelled |
| Sponsored listings | `Business.tier` + `Deal.priority` fields drive ordering today |
| Events | `BusinessCategory.type = 'EVENT'`, `Deal.eventDate` nullable |

## 9. Testing strategy

| Level | Target | Tool |
| --- | --- | --- |
| Unit | Prayer calculation, streak logic, entitlements, AI safety classifier, date utils | Vitest |
| Integration | Services against a test database | Vitest + test schema |
| E2E | register → onboard → dashboard; create habit → tick → streak; browse deal → paywall; assistant guardrail; checkout (test mode) | Playwright |

Coverage target is **not** a percentage. The rule: *every service function with a branch on
entitlement, ownership or safety must have a test.*

## 10. Deployment

- **Vercel** for the app; **Neon** (or Supabase) for Postgres with connection pooling.
- Migrations via `prisma migrate deploy` in the build step.
- Environments: `development` (local), `preview` (per-PR, seeded), `production`.
- Stripe test keys in dev/preview, live keys in production only.
- Rollback = redeploy previous Vercel build; migrations written to be backward-compatible for
  one release (expand → migrate → contract).
