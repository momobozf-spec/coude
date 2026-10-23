# Muslim Life — Roadmap

## Build phases (MVP)

Each phase ends with a hard gate: `typecheck` + `lint` + `test` + `build` must all pass before
the next phase starts. No broken placeholders carried forward.

### Phase 1 — Foundation ✅ *complete*
Design system · landing page · auth · onboarding · database · app shell · dashboard

- Design tokens (colour, type, space, radius, shadow, motion) with light + dark
- UI primitives: Button, Card, Input, Select, Badge, Avatar, Sheet, Dialog, Tabs, Progress,
  Switch, Skeleton, Toast, Tooltip, DropdownMenu
- Landing page: hero, preview, features, planner, assistant, discovery, premium, testimonials,
  pricing, FAQ, CTA, footer
- Prisma schema + first migration + core seed (countries, cities, categories, daily content)
- Auth.js v5: credentials + OAuth-ready, register/login, protected middleware
- 5-step onboarding writing `UserPreference`
- App shell: desktop sidebar, mobile bottom tabs, topbar, theme toggle, command-K ready
- Prayer-time engine (`adhan`) + unit tests
- Dashboard: greeting, next prayer + countdown, prayer strip, progress, daily reminder,
  today's planner, deal card, weekly progress

**Gate:** clean typecheck/lint/build; dashboard renders live for a seeded user in both themes.

### Phase 2 — Daily loop ✅ *complete*
My Day · planner · habits · prayer tracking · reflection

- `getMyDay()` composition service — one call, no N+1
- Tasks: Inbox / Today / Upcoming, deterministic quick-add parsing (EN + NL)
- Daily priorities (max 3) as a flag on `Task`, not a second model
- Habits: DAILY / SPECIFIC_DAYS / TIMES_PER_WEEK, three measurement types, templates
- `HabitLog` with COMPLETED / PARTIAL / SKIPPED — and no "missed" state
- Prayer logging with `EXCUSED` treated as neutral, never as a shortfall
- Planner blocks with advisory prayer-conflict detection
- Daily timeline anchored on prayer times, grouped morning/afternoon/evening
- Daily reflection, weekly review, privacy-preserving analytics
- Free-tier habit cap (5) enforced server-side; prayers never count towards it

**Gate:** typecheck, lint, 101 unit tests, build all green; 60 DB-gated integration tests
written and skipping cleanly until `TEST_DATABASE_URL` exists.

### Phase 3 — Discovery ✅ *complete*
Explore · businesses · deals · favourites · redemption

- `/app/explore` composition service, mirroring `getMyDay()`
- Server-side browse, search, category/city filter, deterministic ranking, pagination
- All filters in the URL — refresh, deep links and back button behave
- Business detail with structured opening hours, `getBusinessOpenState()` and a
  keyless map abstraction (`MapProvider`)
- Haversine distance from the member's **city**, never their device
- One central active-deal rule; premium deals visible-but-locked
- Redemption with cryptographic codes, DB-enforced idempotency, server-side gate
- Favourites on dedicated FK-backed models with a shared free-tier cap
- 20 demo listings across Brussels, Amsterdam, London, Paris — all `verification: DEMO`

**Gate:** typecheck, lint, 160 unit tests, build all green; 110 DB-gated integration
tests written and skipping cleanly.

### Phase 4 — Assistant ✅ *complete*
AI chat · structured generators · safety · planner integration

- `AiProvider` contract with Anthropic, OpenAI-compatible and Mock adapters — over
  plain HTTP, so no vendor SDK enters the dependency tree or a bundle
- Real SSE streaming through `/api/assistant/stream`, with cancel
- Deterministic safety classifier (EN + NL) run **before** the provider; disclaimers
  applied **after** generation so a model cannot omit them
- Least-context assembly with a hard SAFE/SENSITIVE split — reflections, notes,
  task descriptions and worship logs never leave the database
- Four generators producing schema-validated `GeneratedPlan` + `GeneratedPlanItem`
- Deterministic post-processing: free windows, duplicate detection, prayer and
  block conflicts — the model never does arithmetic that matters
- Transactional `applyGeneratedPlan` with partial apply, per-item traceability
  and idempotency; nothing reaches the planner without confirmation
- Atomic quota reservation closing the concurrent-request race

**Gate:** typecheck, lint, 225 unit tests, build all green; 139 DB-gated integration
tests written and skipping cleanly.

### Phase 5 — Monetisation ✓

Stripe · entitlements · pricing · billing

- `PaymentProvider` contract with Stub and Stripe adapters over plain `fetch`
- Webhook is the source of truth: `(provider, externalEventId)` unique constraint for
  exactly-once, `providerUpdatedAt` for out-of-order rejection, `UNKNOWN_PRICE` fails closed
- Stable idempotency keys — a retried POST reuses the key rather than minting a new UUID,
  which Stripe would read as a second operation
- Pricing page, upgrade prompts, subscription management UI

**Gate:** typecheck, lint, 320 unit tests × 3 runs, build all green. The purchase flow is
proven against the stub, **not** against a live provider or a real database.

### Phase 6 — Production readiness, admin, i18n, privacy & notifications ✓

One production-hardening layer rather than a set of features.

- **Privacy.** A single retention policy read by export, deletion and the settings page:
  `DELETE` / `ANONYMIZE` / `RETAIN`, each with a written motivation. Export excludes
  credentials and other members' data; account deletion is staged, refuses while billing is
  live, revokes sessions on request and is idempotent
- **Notifications.** `NotificationProvider` contract with a Stub adapter; a nine-entry
  catalogue with every optional reminder off by default; preferences and quiet hours resolved
  *before* any provider call; per-notification idempotency key enforced by a unique constraint
- **Analytics.** `noop` / `console` / `database` / `posthog` sinks behind one interface,
  defaulting to our own Postgres; string properties rejected by type and at runtime
- **i18n.** NL/FR/AR catalogues with a key- and placeholder-parity test, RTL via logical
  properties, and a machine-translation notice that code refuses to clear without a named
  reviewer
- **Operations.** Admin panel of counts and statuses with no member content; reconciliation
  through the same service the job uses; `/api/health` and `/api/ready`; scheduled maintenance
  job; origin checks, rate limits and deep log redaction

**Gate:** typecheck, lint, 475 unit tests × 3 runs, build (41 routes) all green.
187 DB-gated integration tests written and skipping cleanly.

### Phase 7 — MVP definition of done ✦ *next*

- Run the integration suite against a real PostgreSQL instance — the single largest
  outstanding risk, unchanged since Phase 5
- Accessibility audit against WCAG 2.2 AA with a real assistive-technology pass
- Lighthouse run on a deployed build (no score has been measured; none is claimed)
- Native-speaker review of the NL, FR and AR catalogues

**Gate:** MVP definition-of-done in `mvp-scope.md` fully checked.

---

## Post-MVP sequencing

Ordered by **retention impact per unit of effort**, not by excitement.

| # | Module | Why this order | Effort |
| --- | --- | --- | --- |
| 1 | **Notifications** (web push + email) | Biggest single retention lever; the daily loop currently depends on the user remembering | S |
| 2 | **PWA + install prompt** | Home-screen presence is what makes it feel like an app | S |
| 3 | **Quran module** | Highest-demand missing feature; converts "planner user" into "daily user" | M |
| 4 | **Family** | Highest ARPU expansion — family tier at €14.99 | L |
| 5 | **Business self-service portal** | Opens revenue stream #2; needs the consumer audience first | M |
| 6 | **Finance / zakat** | Strong seasonal hook (Ramadan zakat), low competition | M |
| 7 | **Travel / Umrah** | Highest commission value, but needs partners | L |
| 8 | **Events** | Community moat; needs local operations | M |
| 9 | **Marketplace** | Highest complexity, lowest certainty — last | XL |
| 10 | **Native apps (RN/Expo)** | Only once PWA retention proves the loop | L |

## Revenue stream activation

| Stream | Activates | Prerequisite |
| --- | --- | --- |
| Consumer subscription | MVP | — |
| Sponsored/featured listings | Post-MVP 5 | 5k MAU in a city |
| Business subscriptions | Post-MVP 5 | Self-service portal |
| Deal affiliate commission | Post-MVP 5 | Redemption tracking at volume |
| Travel commission | Post-MVP 7 | Partner agreements |
| Marketplace commission | Post-MVP 9 | Seller onboarding + Connect |
| Premium content | Opportunistic | Licensed content partners |

## Calendar strategy

Ramadan is the single largest acquisition and re-activation window in this category. Everything
should be timed against it.

- **T-8 weeks:** Ramadan preparation content + templates shipped
- **T-4 weeks:** Ramadan campaign, yearly-plan discount, "Ramadan Ready" onboarding variant
- **During:** Ramadan mode (suhoor/iftar countdowns, Quran khatm tracker, taraweeh log)
- **T+2 weeks:** the retention cliff — this is where a generic prayer app loses everyone and a
  *planner* keeps them. Post-Ramadan habit-continuity campaign is the most important
  lifecycle moment of the year.

Secondary moments: Dhul Hijjah / Hajj season, Muharram, back-to-school (September), New Year
(January goal-setting).

## Key risks on the roadmap

| Risk | Trigger to watch | Response |
| --- | --- | --- |
| Weak D30 retention | < 12% at month 2 | Stop feature work; fix the loop and ship notifications |
| Low paid conversion | < 2% at month 3 | Re-cut the free/premium line; test annual-first pricing |
| AI cost per user | > €0.40 / free MAU | Tighten caps, route to a cheaper model, generators-only |
| Discovery cold start | < 20 real businesses/city by month 6 | Go city-by-city with manual sales, not global seeding |
| Religious criticism | Any credible complaint | Advisory review of assistant + copy; act immediately, publicly |

## Definition of "ready to raise / scale"

- 10k MAU with D30 > 20%
- 5%+ free→paid conversion, < 5% monthly churn
- Two cities with 50+ real (non-demo) business listings
- Ramadan cohort retained at 40%+ post-Ramadan
- CAC payback under 6 months on at least one channel
