# Muslim Life — Product Vision

> **Live with intention.**

## 1. What we are building

Muslim Life is a **daily-use lifestyle operating system for Muslims**: a single place where a
Muslim organises their worship, their week, their family, their money and their discovery of
halal life around them.

It is not a prayer-time app. Prayer times are the *hook*, not the product. There are hundreds of
free prayer-time apps and none of them are a business. The product is the **planner + habit engine
+ discovery + assistant**, with prayer times as the ambient layer that makes the whole thing feel
native to Muslim life.

## 2. The problem

A practising Muslim today runs their life across:

- a prayer app (times, qibla)
- a Quran app (reading, audio)
- a notes/todo app (Notion, Apple Reminders)
- a habit tracker (Streaks, Habitica)
- WhatsApp groups (family coordination, community events)
- Google Maps + word of mouth (finding halal food, butchers, modest fashion)
- a bank app (zakat, savings, charity)

None of these know about each other. None of them know it is Ramadan. None of them know that
Maghrib is at 21:04 so a 21:00 meeting is a bad idea. None of them know that "read Quran daily"
and "pray Fajr on time" are the same project.

**The insight:** Muslim life is already highly structured — five daily anchors, a lunar calendar,
an annual fast, a pilgrimage, a charity obligation. That structure is a *product surface* nobody
has built a premium tool on top of.

## 3. Who it is for

**Primary (MVP):** Muslims aged 22–45 in Western Europe and North America — Belgium, Netherlands,
France, UK, Germany, US, Canada. Digitally fluent, income-earning, already paying for Spotify /
Notion / a gym. They practise with intention but inconsistently, and they feel the gap between
who they want to be and what their week actually looks like.

**Secondary (post-MVP):** Families (shared calendar, children's habits), Muslim business owners
(directory + deals), and Gulf/SEA markets (Arabic, Malay, Indonesian).

**Explicitly not for (yet):** scholars, students of knowledge seeking deep Islamic sciences, or
users looking for fatwa. We are a *lifestyle* product, not a religious authority.

## 4. Positioning

| Reference | What we take | What we reject |
| --- | --- | --- |
| **Notion** | Structure, calm density, blocks that compose | Blank-page paralysis |
| **Linear** | Speed, keyboard-first, opinionated defaults | Engineering-only aesthetic |
| **Headspace** | Warmth, non-judgemental tone, streaks that forgive | Infantilising illustration |
| **Revolut** | Premium tiering, "membership" feeling | Aggressive upsell |
| **Airbnb** | Discovery, trust signals, photography-led cards | Marketplace complexity |
| **Muslim Pro** | Distribution proof (150M+ downloads) | Ad-riddled, cluttered, dated |

**One-line positioning:** *Notion for Muslim life* — but opinionated, so it works on day one.

## 5. Product principles

1. **Faith is private by default.** Prayer and habit data is never public, never social, never
   leaderboarded against other users. This is a hard product constraint, not a setting.
2. **Support, never shame.** A broken streak is a fact, not a failure. Copy is warm and adult.
   No red angry states on worship data, no "you missed Fajr again" notifications.
3. **We do not issue rulings.** The assistant helps you *organise* your life. On anything
   involving religious interpretation it presents that scholars differ, cites where it can, and
   points to qualified people. It is never framed as an imam, mufti, sheikh, or scholar.
4. **Earn the daily open.** Every module must answer: *why would someone open this today?*
   Prayer + planner + habits do. A Quran reader alone does not.
5. **Subtle Islamic influence.** Warm ivory, deep green, muted gold, geometric rhythm. Arabic
   appears only where it carries meaning (a dua, a surah name) — never as decoration.
6. **Free tier must be genuinely good.** A crippled free tier kills the word-of-mouth that this
   category runs on. Free is a complete daily tool; Premium is depth, automation and AI.

## 6. Why this can be a real business

- **Willingness to pay exists and is proven** in adjacent categories (Muslim Pro premium, Quran
  Pro, halal travel booking). What has not been tried is a *premium productivity* framing.
- **Recurring by nature.** Prayer is five times a day. Habits are daily. Ramadan is annual and is
  the single biggest acquisition moment in the calendar.
- **Multi-sided from day one architecturally.** Consumers pay for Premium; businesses eventually
  pay for listings and deals; travel and marketplace are commission surfaces. We build the
  consumer side first because it creates the audience the other sides need.
- **Underserved, not unserved.** The incumbents are ad-funded and dated. A premium, design-led,
  privacy-respecting product has clear air.

## 7. Long-term shape (3 years)

```
                        ┌────────────────────────────┐
                        │      MUSLIM LIFE CORE      │
                        │  identity · prefs · plan   │
                        └─────────────┬──────────────┘
        ┌──────────────┬──────────────┼──────────────┬──────────────┐
        ▼              ▼              ▼              ▼              ▼
   ┌─────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
   │ WORSHIP │   │ PLANNER  │   │DISCOVERY │   │ ASSISTANT│   │  FAMILY  │
   │ prayer  │   │ tasks    │   │ business │   │ chat     │   │ shared   │
   │ quran   │   │ habits   │   │ deals    │   │ generate │   │ calendar │
   │ fasting │   │ goals    │   │ events   │   │ plan     │   │ children │
   └─────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘
        │              │              │              │              │
        └──────────────┴──────────────┴──────────────┴──────────────┘
                                      │
                    ┌─────────────────┼──────────────────┐
                    ▼                 ▼                  ▼
              ┌──────────┐      ┌──────────┐      ┌───────────┐
              │  TRAVEL  │      │ FINANCE  │      │MARKETPLACE│
              │ umrah    │      │ zakat    │      │ modest    │
              │ hotels   │      │ budget   │      │ books     │
              └──────────┘      └──────────┘      └───────────┘
```

Revenue matures from a single consumer subscription into a **membership** — where Premium also
unlocks real-world value (deals, travel rates, marketplace pricing). That is the endgame: the
subscription pays for itself, which is the strongest retention mechanic in consumer SaaS.

## 8. What success looks like

| Horizon | Signal |
| --- | --- |
| **Month 1** | 500 signups, D7 retention > 25%, onboarding completion > 60% |
| **Month 3** | 2,000 MAU, 4% free→paid, D30 retention > 15% |
| **Month 6** | 8,000 MAU, 6% paid conversion, ~€3.5k MRR, first 25 business listings |
| **Month 12** | 40k MAU, €25k MRR, Ramadan cohort retained, family tier shipped |

**The metric that matters most is D30 retention.** A Muslim lifestyle app with weak D30 is a
prayer-time widget with extra steps. If D30 is strong, everything else is a distribution problem.

## 9. Explicit non-goals

- We are **not** building a social network. No feeds, no follower counts, no public profiles.
- We are **not** a matrimonial service.
- We are **not** a fatwa service or an Islamic Q&A site.
- We are **not** building our own Quran text/audio infrastructure — we will license or use
  established open APIs when the Quran module ships.
- We are **not** doing prayer-time *crowd-sourcing* or mosque check-ins (privacy hazard).

## 10. Risks and how we address them

| Risk | Mitigation |
| --- | --- |
| **Religious sensitivity / backlash** | Conservative assistant guardrails, no rulings, no gamified worship, advisory review before scale |
| **"Just another Muslim app"** | Design quality is the wedge. The landing page and first 60 seconds must feel like Linear, not like a free app |
| **AI cost per free user** | Hard message caps, cheap model for routing, structured generation over open chat, server-side rate limiting |
| **Prayer-time accuracy disputes** | Local astronomical calculation with user-selectable madhab + method, and manual offset per prayer |
| **Cold-start on discovery** | Seed with clearly-labelled demo data in 4 cities; do not fake verification; recruit real businesses city-by-city |
| **Solo/small team overreach** | Modular monolith, six phases, ship the daily loop before anything else |
