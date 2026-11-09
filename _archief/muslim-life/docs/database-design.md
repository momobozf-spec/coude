# Muslim Life — Database Design

PostgreSQL + Prisma 6. UUID primary keys (`@default(uuid())`) everywhere except Auth.js-owned
tables. `createdAt` / `updatedAt` on every business table. Soft delete (`deletedAt`) only where
undo has real user value — worship logs are hard-deleted so "delete my activity" means it.

## 1. Entity map

```
                          ┌────────────┐
              ┌───────────│    User    │───────────┐
              │           └──────┬─────┘           │
              │                  │                 │
      ┌───────▼──────┐   ┌───────▼───────┐  ┌──────▼──────┐
      │UserPreference│   │ Subscription  │  │  Favorite   │
      └──────────────┘   └───────────────┘  └──────┬──────┘
              │                                    │
   ┌──────────┼───────────┬─────────────┐          │
   ▼          ▼           ▼             ▼          │
┌──────┐ ┌────────┐ ┌───────────┐ ┌──────────┐     │
│ Task │ │ Habit  │ │PrayerLog  │ │   Goal   │     │
└──────┘ └───┬────┘ └───────────┘ └──────────┘     │
             │                                     │
      ┌──────▼─────────┐                           │
      │   HabitLog     │                           │
      └────────────────┘                           │
                                                   │
   ┌──────────────┐    ┌──────────┐    ┌──────────▼┐
   │AIConversation│    │  Country │───▶│    City   │
   └──────┬───────┘    └──────────┘    └─────┬─────┘
          │                                  │
   ┌──────▼───────┐   ┌──────────────────┐   │
   │  AIMessage   │   │ BusinessCategory │   │
   └──────────────┘   └────────┬─────────┘   │
                               │             │
                        ┌──────▼─────────────▼─┐
                        │      Business        │
                        └──────────┬───────────┘
                                   │
                             ┌─────▼─────┐
                             │   Deal    │
                             └───────────┘
```

## 2. Identity & preferences

### `User`
| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `email` | string unique | lowercased on write |
| `emailVerified` | datetime? | |
| `passwordHash` | string? | null for OAuth-only accounts |
| `name` | string? | |
| `image` | string? | |
| `role` | enum `UserRole` | `USER` \| `BUSINESS_OWNER` \| `ADMIN`, default `USER` |
| `onboardedAt` | datetime? | null ⇒ redirect to `/onboarding` |
| `locale` | string | default `en` |
| `timezone` | string | IANA, default `Europe/Brussels` |
| `deletedAt` | datetime? | soft delete → 30-day purge job |

Indexes: `email`, `deletedAt`.

### `UserPreference` (1:1 with User)
Prayer: `calculationMethod` (enum), `madhab` (`SHAFI` \| `HANAFI`), `highLatitudeRule`,
`prayerOffsets` (Json — `{fajr:-2, isha:+3, …}` minutes).

Location: `countryId?`, `cityId?`, `latitude?`, `longitude?` — coarse, city-centroid by default.

Personalisation: `interests` (string[] — `FAMILY`,`FITNESS`,`LEARNING`,`BUSINESS`,`TRAVEL`,
`MODEST_FASHION`,`FOOD`,`FINANCE`), `goals` (string[] — `PRAY_CONSISTENTLY`,`READ_QURAN`,
`PRODUCTIVITY`,`SAVE_MONEY`,`LEARN`,`BUILD_HABITS`,`RAMADAN_PREP`,`UMRAH_HAJJ`,`FAMILY_ORG`).

Targets: `dailyQuranPages` (int, default 5), `dailyDhikrTarget` (int, default 100),
`weekStartsOn` (0=Sun/1=Mon).

Display: `theme` (`LIGHT`\|`DARK`\|`SYSTEM`), `timeFormat` (`H24`\|`H12`).

Notifications: `notificationPrefs` (Json — per-channel, per-event flags).

> **Why arrays instead of join tables for interests/goals:** they are a closed enum owned by the
> product, never queried relationally, and read as a whole. A join table would be three tables of
> ceremony for zero benefit. If they ever need independent metadata, promotion is a simple
> migration.

### Auth.js tables
`Account`, `Session`, `VerificationToken` — standard adapter schema, unmodified so adapter
upgrades stay drop-in.

## 3. Subscription

### `Subscription` (1:1 with User)
`plan` (`FREE`\|`PREMIUM`), `status` (`ACTIVE`\|`TRIALING`\|`PAST_DUE`\|`CANCELED`\|`INCOMPLETE`),
`interval` (`MONTHLY`\|`YEARLY`), `stripeCustomerId`, `stripeSubscriptionId`, `stripePriceId`,
`currentPeriodEnd`, `cancelAtPeriodEnd`, `trialEndsAt`.

Every user gets a `FREE`/`ACTIVE` row at registration, so entitlement checks never handle null.

`WebhookEvent` (`stripeEventId` unique, `type`, `payload`, `processedAt`) gives idempotent
webhook processing — Stripe *will* redeliver.

## 4. Planner & habits

### `Task`
`userId`, `title`, `description?`, `scheduledDate?` (@db.Date), `scheduledTime?` ("HH:mm"),
`dueDate?` (@db.Date), `estimatedMinutes?`, `category?` (enum `TaskCategory`),
`priority` (`LOW`|`NORMAL`|`HIGH`), `status` (`TODO`|`IN_PROGRESS`|`COMPLETED`|`CANCELLED`),
`isDailyPriority`, `priorityOrder?`, `completedAt?`, `sortOrder`,
`source` (`MANUAL`|`AI`|`TEMPLATE`), `generatedPlanId?`, `deletedAt?`.

> **`scheduledDate` is nullable on purpose.** NULL is the Inbox. "Capture now, schedule
> later" is what makes capture fast enough to actually happen, and a planner that forces a
> date at capture time is a planner people stop capturing into.

> **`dueDate` is separate from `scheduledDate`.** When you plan to do something and when it
> is actually due are different facts; collapsing them loses the ability to say "due Friday,
> planned for Wednesday".

> **Daily priorities are a flag, not a model.** `isDailyPriority` + `priorityOrder` on the
> task itself means the priority and the task are one row, so completing one cannot
> desynchronise the other. A separate `DailyPriority` table would need a join, a cascade and
> a consistency rule for no benefit. The cap of three is enforced in the service.

Indexes: `@@index([userId, scheduledDate, status])` (Today/Upcoming),
`@@index([userId, status, deletedAt])` (Inbox), `@@index([userId, isDailyPriority, scheduledDate])`,
`@@index([userId, dueDate])`.

### `Habit`
`userId`, `name`, `description?`, `icon`, `color`, `category` (`WORSHIP`|`HEALTH`|`LEARNING`|
`FAMILY`|`WORK`|`CHARITY`|`PERSONAL`|`CUSTOM`), `type` (`BOOLEAN`|`COUNTER`|`DURATION`),
`targetValue`, `unit?`, `frequencyType` (`DAILY`|`SPECIFIC_DAYS`|`TIMES_PER_WEEK`),
`targetPerPeriod`, `daysOfWeek` (int[], 0=Sunday, local calendar),
`preferredTimeOfDay` (`MORNING`|`AFTERNOON`|`EVENING`|`ANY`), `active`, `isPreset?`,
`sortOrder`, `archivedAt?`, `deletedAt?`.

> **`active` is distinct from `deletedAt`.** Pausing keeps the history; deleting does not.
> The free-tier cap counts `active: true, deletedAt: null`, so pausing frees a slot.

> **`TIMES_PER_WEEK` habits are never "due" on a given day.** They are always *available*, and
> progress is measured against the weekly target. Marking a 4×/week habit as due every day
> would render three misses every week — precisely the guilt mechanic this product refuses.

Index: `@@index([userId, active, deletedAt])`.

### `HabitLog`
`habitId`, `userId` (denormalised), `localDate` (@db.Date), `status`
(`COMPLETED`|`PARTIAL`|`SKIPPED`), `quantity?`, `note?`.

`@@unique([habitId, localDate])` — one log per habit per local day, upserted, so a double tap
on a poor connection cannot create two rows. Index: `@@index([userId, localDate])`.

> **There is no "missed" status.** Un-ticking deletes the row. A day with no row is simply a
> day with no row; the product never writes a record asserting that someone failed.
> `SKIPPED` exists for a deliberate, legitimate choice and is never rendered as a failure.

### `PrayerLog`
`userId`, `date` (@db.Date), `prayer` (enum `FAJR`…`ISHA`),
`status` (`ON_TIME`\|`LATE`\|`JAMAAH`\|`MISSED`\|`EXCUSED`), `loggedAt`.

`@@unique([userId, date, prayer])`.

> **Design note:** prayer is a separate entity, not a `Habit`. It has its own status vocabulary
> (`JAMAAH`, `EXCUSED`), it must never be archived or deleted like a habit, it is never counted
> toward the free-tier habit limit, and it must never be rendered with the "broken streak"
> treatment. Modelling it separately makes the respectful-tone principle structural rather than
> a UI convention. `EXCUSED` exists deliberately so menstruating users and travellers are never
> shown a "missed" state.

### `Goal`
`userId`, `title`, `type` (`HABIT`\|`QURAN`\|`CHARITY`\|`SAVINGS`\|`CUSTOM`), `targetValue`,
`currentValue`, `unit?`, `period` (`WEEKLY`\|`MONTHLY`\|`YEARLY`\|`ONCE`), `startDate`,
`endDate?`, `status`. `SAVINGS` + `currency` is the Finance-module hook.

### `DailySummary` (denormalised cache)
`userId`, `date` unique-together, `prayersLogged`, `prayersExcused`, `habitsCompleted`,
`habitsDue`, `tasksCompleted`, `tasksPlanned`, `hasReflection`.

Written on each tick so the weekly review is one indexed read rather than an aggregation over
thousands of rows. Rebuildable from source tables — it is a cache, never the source of truth.

> **There is deliberately no `score` column.** Collapsing prayer, habits and tasks into a single
> number would be a faith score, which this product does not produce under any name. Every
> figure is reported per domain. This is a schema-level guarantee, not a UI convention: there is
> no column for a combined score to be stored in.

### `PlannerBlock`
`userId`, `title`, `note?`, `localDate` (@db.Date), `startTime`/`endTime` ("HH:mm"),
`type` (`FOCUS`|`TASK`|`APPOINTMENT`|`PERSONAL`|`CUSTOM`), `taskId?`, `deletedAt?`.
Index: `@@index([userId, localDate])`.

> **Prayers are NOT stored as blocks.** They are derived from the calculated prayer times and
> injected into the timeline at read time. Persisting them would create a second source of
> truth that silently drifts the moment a user changes calculation method or city.

> **Blocks may not cross midnight.** An overnight period is two blocks on two local days.
> Allowing a single row to span days would break every per-day query and the timeline ordering,
> for a case that is rare and better modelled explicitly.

> **Overlapping blocks are permitted.** People double-book. `findOverlappingBlocks` reports it;
> the service does not refuse the save.

### `DailyReflection`
`userId`, `localDate` (@db.Date), `gratitude?`, `wentWell?`, `improveTomorrow?`, `notes?`.
`@@unique([userId, localDate])` — exactly one per local day, upserted.

An entirely empty reflection deletes the row rather than storing a blank one. The text is never
read by analytics, never sent to an AI provider, and never leaves the user's own rows.

### `AnalyticsEvent`
`userId?`, `name`, `properties` (Json), `occurredAt`.
Indexes: `@@index([name, occurredAt])`, `@@index([userId, occurredAt])`.

> **Properties carry no strings.** The only writer is `src/server/services/analytics.ts`, whose
> types admit numbers, booleans and null exclusively. That is what makes "which habits does a
> retained user track" unanswerable while "how many" stays answerable — and it is enforced by
> the type system, not by reviewer discipline.

## 5. Discovery

### `Country` / `City`
`Country`: `code` (ISO-2, unique), `name`, `currency`, `defaultLocale`.
`City`: `countryId`, `name`, `slug`, `latitude`, `longitude`, `timezone`, `isActive`.
`@@unique([countryId, slug])`. Cities carry coordinates so prayer times work from the city
selection alone — no GPS permission required.

### `BusinessCategory`
`slug` unique, `name`, `icon`, `type` (`FOOD`\|`RETAIL`\|`SERVICE`\|`TRAVEL`\|`EVENT`),
`sortOrder`, `isActive`.

### `Business`
`name`, `slug` unique, `description`, `categoryId`, `cityId`, `address`, `postalCode`,
`latitude?`, `longitude?`, `phone?`, `email?`, `website?`, `instagram?`,
`openingHours` (Json — `{mon:[["09:00","18:00"]], …}`), `images` (string[]), `coverImage?`,
`rating?`, `reviewCount`, `priceLevel?` (1–4),
`tier` (`BASIC`\|`VERIFIED`\|`FEATURED`) ← sponsored-listing hook,
`isDemo` (bool) ← **honesty flag, rendered in the UI as a "Demo listing" badge**,
`ownerId?` → User ← business self-service hook,
`stripeAccountId?` ← marketplace/Connect hook,
`status` (`DRAFT`\|`PUBLISHED`\|`SUSPENDED`), `publishedAt?`, `deletedAt?`.

Indexes: `@@index([cityId, categoryId, status])`, `@@index([status, tier])`.

### `Deal`
`businessId`, `title`, `description`, `discountType` (`PERCENTAGE`\|`FIXED`\|`BOGO`\|`FREEBIE`),
`discountValue`, `code?`, `terms?`, `startsAt`, `endsAt`, `isPremiumOnly` (bool),
`maxRedemptions?`, `redemptionCount`, `priority` (int — sponsored ordering), `image?`,
`status` (`DRAFT`\|`ACTIVE`\|`EXPIRED`\|`SUSPENDED`), `isDemo`.

Index: `@@index([status, endsAt, isPremiumOnly])`.

`DealRedemption` (`dealId`, `userId`, `redeemedAt`, `@@unique([dealId, userId])`) — proves value
to businesses and is the foundation of affiliate/commission reporting later.

### `Favorite`
`userId`, `targetType` (`BUSINESS`\|`DEAL`), `targetId`, `@@unique([userId, targetType, targetId])`.

> **Why polymorphic instead of two tables:** the favourites list is always read as one mixed
> list, and future favouritable types (events, products, articles) then need zero schema change.
> The trade-off is no FK integrity on `targetId`; acceptable because deletes are soft and a
> nightly job prunes orphans.

## 6. AI

### `AIConversation`
`userId`, `title` (auto-generated from first message), `kind` (`CHAT`\|`GENERATOR`),
`generatorType?` (`TRAVEL`\|`RAMADAN`\|`WEDDING`\|`WEEKLY_PLAN`\|`UMRAH`), `archivedAt?`.

### `AIMessage`
`conversationId`, `role` (`USER`\|`ASSISTANT`\|`SYSTEM`), `content`,
`tokensIn?`, `tokensOut?`, `model?`, `flagged` (bool), `flagReason?`,
`disclaimerShown` (bool) ← auditable proof the religious disclaimer was rendered.

### `AIUsage`
`userId`, `period` (`YYYY-MM`), `messageCount`, `tokensIn`, `tokensOut`, `generatorCount`,
`@@unique([userId, period])`. Quota enforcement reads exactly one row.

### `GeneratedPlan`
`userId`, `conversationId?`, `type`, `title`, `payload` (Json — validated by a Zod schema per
type), `appliedAt?`. This is the artifact the assistant produces; `Task.generatedPlanId` links
tasks created from it, so "undo this plan" is one query.

### `ContentSource` *(reserved, not in MVP migration)*
`type` (`QURAN`\|`HADITH`\|`ARTICLE`), `reference`, `text`, `translation`, `language`,
`grading?`, `embedding` (vector) — the RAG slot.

## 7. Content & system

### `DailyContent`
`type` (`VERSE`\|`HADITH`\|`DUA`), `arabic?`, `transliteration?`, `translation`, `reference`,
`source`, `locale`, `tags` (string[]), `isActive`.

Selected deterministically: `index = hash(userId + dateISO) % activeCount`. Same content all day
per user, varies between users, no scheduling table needed.

### `Notification`
`userId`, `type`, `title`, `body`, `data` (Json), `readAt?`, `sentAt?`, `channel`
(`IN_APP`\|`PUSH`\|`EMAIL`). Stored in MVP; delivery in a later phase.

### `AuditLog`
`actorId?`, `action`, `entityType`, `entityId?`, `metadata` (Json), `ip?`, `userAgent?`.
Written for admin actions, plan changes, deletions.

### `RateLimitEntry`
`key`, `windowStart`, `count`, `@@unique([key, windowStart])` — Postgres-backed sliding window;
swapped for Redis behind the same interface when needed.

## 8. Conventions

- **UUID v4** primary keys — safe to expose in URLs, no enumeration.
- **`@db.Date` for calendar days.** Habit and prayer logs are about *the user's local day*, not
  an instant. Storing them as timestamps is the classic bug that makes a 23:50 Isha tick land on
  the wrong day. The day is computed in the user's timezone and stored as a date.
- **Denormalised `userId`** on `HabitLog` — enables `deleteMany({ userId })` for GDPR
  erasure and user-scoped indexes without joins.
- **Soft delete** on `User`, `Task`, `Business` (undo/recovery matters). **Hard delete** on
  `HabitLog`, `PrayerLog`, `AIMessage` (privacy matters more than undo).
- **Cascades:** `onDelete: Cascade` from User to all owned rows, so account deletion is one
  transaction and cannot leave orphaned worship data.
- **Money** as integer minor units + currency code. Never floats.
- **Enums in Postgres**, not strings — the DB rejects invalid states.

## 9. Migration order

1. Auth + identity: `User`, `Account`, `Session`, `VerificationToken`, `UserPreference`
2. Geography: `Country`, `City`
3. Subscription: `Subscription`, `WebhookEvent`
4. Planner: `Task`, `Habit`, `HabitLog`, `PrayerLog`, `Goal`, `DailySummary`,
   `PlannerBlock`, `DailyReflection`
5. Discovery: `BusinessCategory`, `Business`, `Deal`, `DealRedemption`, `Favorite`
6. AI: `AIConversation`, `AIMessage`, `AIUsage`, `GeneratedPlan`
7. System: `DailyContent`, `Notification`, `AuditLog`, `RateLimitEntry`, `AnalyticsEvent`

## 10. Reserved for future modules (designed, not migrated)

| Model | Purpose |
| --- | --- |
| `Household`, `HouseholdMember` | Family module — all user-scoped services take a scope param |
| `SharedList`, `SharedListItem` | Family shopping/tasks |
| `QuranBookmark`, `QuranSession`, `MemorizationEntry` | Quran module |
| `Transaction`, `Budget`, `ZakatCalculation` | Finance module |
| `Trip`, `TripItem` | Travel module |
| `Product`, `Order`, `OrderItem` | Marketplace |
| `Review`, `BusinessClaim` | Directory maturity |
| `Event`, `EventAttendee` | Events |
