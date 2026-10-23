# Muslim Life — MVP Scope

The MVP exists to validate one question:

> **Will a Muslim open this app every day, and will enough of them pay €7.99/month for depth?**

Everything below is scoped to answer that. Anything that does not contribute to the daily loop or
to the paywall is deferred.

## 1. The daily loop

This is the core mechanic the MVP must nail. Everything else is supporting cast.

```
  Open app  →  See next prayer + today's plan  →  Tick prayers / habits
      ↑                                                     │
      └──────  Notification / prayer time  ←  Progress  ←───┘
```

If a user does not complete this loop by day 3, they churn. Onboarding, dashboard and the
tick-interaction get disproportionate polish budget.

## 2. In scope — module by module

### 2.1 Dashboard (`/app`)
- Time-aware greeting with name (`Assalamu Alaikum, Mohamed`)
- **Next prayer** card: name, time, live countdown, progress arc through the current window
- Today's five prayers with inline tick state (tap to log)
- **Today's progress**: prayers `4/5`, Quran pages `3/5`, habits `2/4`
- **Daily reminder**: rotating Quran verse / hadith / dua, deterministic per user per day
- **Today's planner**: up to 5 tasks, tickable inline, link to full planner
- **Halal deal nearby**: one card, based on the user's city
- **Weekly progress**: single percentage + 7-day sparkline
- Dashboard **adapts to onboarding preferences** (interests reorder cards; goals decide which
  metrics are surfaced)

### 2.2 Planner (`/app/planner`)
- Daily task list with date navigation
- Create / edit / complete / delete task
- Priority (low/normal/high), optional time, optional notes
- Week view (7-day grid, task counts, move tasks between days)
- Month view (calendar heat grid of completion)
- Free tier: unlimited tasks (tasks are cheap and drive retention — do not gate this)

### 2.3 Habits (`/app/habits`)
- Habit library with Islamic presets (Quran, morning/evening adhkar, dhikr count, fasting,
  charity) and lifestyle presets (exercise, water, reading, sleep before 23:00)
- Fully custom habits: name, icon, colour, cadence, target unit + amount
- Three habit types: **boolean** (done/not done), **counter** (pages, dhikr count, glasses),
  **duration** (minutes)
- Daily tick grid, current streak, best streak, 30-day heatmap, completion %
- **Free tier: 3 active habits. Premium: unlimited.** ← primary paywall trigger
- Prayer tracking is a first-class separate entity, never counted as a "habit" and never
  streak-shamed

### 2.4 Deals & Discovery (`/app/deals`, `/app/deals/[id]`, `/app/businesses/[id]`)
- Browse businesses: card grid with photo, category, city, rating, distance-free for MVP
- Search by name, filter by category and city
- Business detail page: description, hours, contact, address, map embed, active deals
- Deal detail page: discount, terms, validity, redeem button (reveal code)
- Favourites (save business / save deal)
- **Premium-only deals** are visible but locked with an upgrade prompt (visible-but-locked
  converts far better than hidden)
- Seeded demo data: Brussels, Amsterdam, London, Paris — clearly labelled as demo

### 2.5 AI Assistant (`/app/assistant`)
- Conversation UI with streaming responses, persisted history
- **Structured generators** as the headline feature — these produce *artifacts*, not just text:
  - Travel plan (destination, dates → checklist + prayer notes + food + duas)
  - Ramadan schedule (worship + Quran + meals + sleep)
  - Life-event plan (wedding, new baby, moving, Umrah prep)
  - Weekly plan from goals
- Generated plans can be **pushed into the planner as real tasks/habits** (this is the moat)
- Safety layer: religious-question detection → scholarly-difference disclaimer, no rulings,
  never framed as an imam
- Free: 10 messages/month, no generators. Premium: 500 messages/month + all generators.

### 2.6 Profile & Onboarding (`/onboarding`, `/app/profile`, `/app/settings`)
- 5-step onboarding: name → location (country/city) → prayer settings (method + madhab) →
  interests → goals
- Profile: name, avatar initials, city, language, member since
- Settings: appearance (light/dark/system), language, prayer calculation, per-prayer manual
  offsets, notifications (preferences stored; delivery is Phase 6+), privacy (export data,
  delete activity, delete account)

### 2.7 Subscription (`/pricing`, `/app/settings/subscription`)
- Free vs Premium comparison, monthly €7.99 / yearly €79 toggle
- Stripe Checkout (test mode) + Customer Portal
- Webhook handler keeping `Subscription` in sync
- **Entitlement service** — a single server-side gate every premium feature calls. No feature
  checks `user.plan === 'premium'` directly.

### 2.8 Landing page (`/`)
Hero, dashboard preview, features, planner, assistant, discovery, premium, testimonial
placeholders (clearly marked), pricing, FAQ, CTA, footer.

### 2.9 Admin (`/admin`)
- Role-gated (`ADMIN`)
- Metrics overview (users, subs, MRR estimate, AI usage)
- Users list, businesses CRUD, deals CRUD, categories, cities
- Read-only AI usage log

### 2.10 Cross-cutting
- i18n with translation keys (EN shipped; NL/FR/AR keys structured, RTL-ready)
- Light / dark / system theme
- Fully responsive: bottom tab bar on mobile, sidebar on desktop
- Zod validation at every API boundary
- Rate limiting on auth, AI and write endpoints

## 3. Out of scope for MVP (architected for, not built)

| Deferred | Why | Architectural hook already in place |
| --- | --- | --- |
| Quran reader / audio / memorisation | Large; licensing needed | `QuranProgress` tracked via habits; module slot reserved |
| Family / shared spaces | Needs multi-tenant permissions | `Household` model designed, not migrated |
| Finance / zakat | Regulatory care needed | Interests + goals already capture demand |
| Travel booking | Commission deals need partners | Assistant travel generator seeds behaviour |
| Marketplace | Inventory + logistics | `Business` model extensible to `Product` |
| Push notifications | Needs mobile shell / web push infra | `NotificationPreference` stored in MVP |
| Native mobile apps | PWA first | Mobile-first responsive + installable PWA |
| Real business self-service portal | No businesses yet | `Business.ownerId` + `BusinessRole` in schema |
| Events | Needs local partnerships | `BusinessCategory` type enum includes `EVENT` |
| Reviews / ratings | Moderation cost | `rating` field seeded, write path deferred |

## 4. Explicit MVP anti-scope

These are things I am deliberately **not** doing even though they are tempting:

- **No qibla compass.** Requires device sensors, low daily value, high support cost.
- **No mosque database.** Cannot be maintained accurately at MVP scale; wrong data on a mosque is
  worse than no data.
- **No social features of any kind.** See privacy principle.
- **No streak-freeze / gamified worship rewards.** Violates product principle 2.
- **No offline sync engine.** PWA caching only. A real sync layer is months of work.
- **No multi-timezone travel mode.** City-based only in MVP.

## 5. Free vs Premium

| Capability | Free | Premium |
| --- | --- | --- |
| Prayer times + tracking | ✓ | ✓ |
| Daily planner (tasks) | ✓ unlimited | ✓ |
| Week / month planner views | Week only | ✓ Week + Month |
| Habits | 3 active | Unlimited |
| Habit statistics | 7 days | Full history + trends |
| Deals | Standard only | + Premium-only deals |
| Favourites | 10 | Unlimited |
| AI Assistant | 10 msgs / month | 500 msgs / month |
| AI plan generators | — | ✓ |
| Templates (Ramadan, Umrah, 40-day) | 1 | All |
| Data export | — | ✓ |
| Cloud sync across devices | ✓ | ✓ |

**Pricing:** €7.99/month, €79/year (18% saving). 7-day trial on yearly only.

## 6. Definition of done for the MVP

- [ ] `npm run typecheck` clean, `npm run lint` clean, `npm run test` green, `npm run build` succeeds
- [ ] Every MVP route renders with seeded data, no placeholder/lorem content
- [ ] Auth works end-to-end: register → onboarding → dashboard → logout → login
- [ ] Premium gate provably blocks server-side, not just in the UI
- [ ] Stripe test checkout completes and flips the account to Premium via webhook
- [ ] Lighthouse mobile performance ≥ 85, accessibility ≥ 95
- [ ] Dark mode correct on every page
- [ ] No secrets in client bundles

## 7. Phasing

| Phase | Content | Gate |
| --- | --- | --- |
| **1** | Design system, landing, auth, onboarding, DB, app shell, dashboard | Typecheck + lint + build green |
| **2** | Planner + habits + prayer tracking | Daily loop complete end-to-end |
| **3** | Businesses, deals, favourites, seed data | Discovery browsable |
| **4** | AI assistant + generators + safety | Guardrail tests pass |
| **5** | Stripe, entitlements, pricing, billing portal | Test-mode purchase flips plan |
| **6** | Admin, analytics, i18n completion, polish, a11y | Definition-of-done met |
