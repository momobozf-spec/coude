# Noor Printables — Complete Platform Description

## What Is It

Noor Printables is a full-stack SaaS platform for Islamic education targeting Muslim parents, teachers, and Islamic schools worldwide. It generates printable and digital educational activities (coloring pages, mazes, word searches) for children aged 4-8, with Islamic themes like Ramadan, Eid, Arabic letters, and Islamic values.

The platform has grown from a simple worksheet generator into an ecosystem with **8 revenue streams**, **104 routes**, **197 source files**, and **11 database migrations**.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, TypeScript) |
| Database | SQLite via Prisma ORM (v7) + LibSQL adapter |
| Auth | NextAuth v5 (Credentials + Google + Apple + Microsoft OAuth) |
| Payments | Stripe (subscriptions + one-time + Connect for marketplace) |
| Email | Resend + React Email templates |
| PDF | PDFKit (server-side A4 generation) |
| Video | Bunny.net Stream (signed URLs) |
| Community | Circle.so (SSO integration) |
| Print | Printful (print-on-demand books) |
| Styling | Tailwind CSS + custom design system |
| i18n | Custom context provider (EN, NL, FR, DE) |
| Analytics | Google Analytics 4 + custom event tracking |
| SEO | Sitemap, OG images, Schema.org, meta tags |

---

## Database Schema (Prisma — 20 models)

```
User                  — Core user with plan, referral, white-label fields
Account               — OAuth provider accounts (Google/Apple/Microsoft)
Generation            — Worksheet generation history
Lead                  — Email capture from landing pages

Course                — Video courses (Noor Academy)
Lesson                — Individual course lessons
Enrollment            — Course purchases
LessonProgress        — Video watch progress
CourseReview          — Star ratings on courses

RamadanChallenge      — Annual 30-day challenge config
ChallengeDay          — 30 daily activities with dua + hadith
ChallengeEnrollment   — Family enrollments with badges + streaks
DayCompletion         — Per-day completion tracking

MarketplaceProduct    — Teacher-uploaded worksheets
MarketplacePurchase   — 70/30 revenue split tracking
SellerProfile         — Teacher seller accounts (Stripe Connect)
MarketplaceReview     — Product reviews
SellerPayout          — Payout records

WhiteLabelAccount     — School branded platforms (subdomain, colors, logo)
WhiteLabelInvite      — Teacher invitation tokens
WhiteLabelDemo        — Sales demo links for prospects

ColoringBook          — Print-on-demand book builder
BookOrder             — Physical book orders with shipping
BookTemplate          — Pre-made book templates

Badge                 — 23 achievement badges with requirements
UserBadge             — Per-user badge tracking
Certificate           — Printable certificates (public shareable)
UserProgress          — XP, level, streak, completion counts

GameScore             — Individual game play scores
GameStats             — Per-user aggregated game statistics
```

---

## Revenue Streams (8)

| # | Stream | Price | Model |
|---|--------|-------|-------|
| 1 | **Worksheet Subscriptions** | Free / $12/mo Pro / $49/mo School | Recurring subscription |
| 2 | **Noor Academy** (video courses) | $19-34 per course | One-time purchase, Pro gets 1 free |
| 3 | **Ramadan Challenge** | $14.99/year (early bird $9.99) | Seasonal product |
| 4 | **Marketplace** | Teacher sets price, Noor takes 30% | Commission model |
| 5 | **Print-on-Demand Books** | €19.99-29.99 per book | Physical product, €8-16 margin |
| 6 | **White Label Schools** | $297-497/year | Annual license |
| 7 | **Referral System** | 5 free sheets per referral | Growth engine (indirect) |
| 8 | **Lead Capture** | Email collection for nurture | Marketing funnel (indirect) |

---

## All Modules

### 1. Worksheet Generator (core product)
- PDF generation server-side with PDFKit
- Activity types: coloring pages, mazes (DFS algorithm), word searches
- Islamic themes: Ramadan, Eid, mosque, Arabic letters, Quran, values
- Theme-aware word banks for word searches
- Islamic geometric patterns, crescent moons, 8-pointed stars in PDFs
- Free tier: 3 generations, Pro: unlimited
- Bonus generations via referral system

### 2. Digital Coloring (/color)
- HTML5 Canvas coloring tool
- 6 Islamic SVG templates (mosque, lantern, crescent, geometric, Kaaba, Eid gifts)
- Tools: brush, fill (flood-fill algorithm), eraser
- 15 kid-friendly colors + custom color picker
- 4 brush sizes
- Undo (30 states), clear, save as PNG
- Touch support for tablet/phone
- SVG overlay for outlines

### 3. Noor Academy (/academy)
- 3 seed courses: Arabic Alphabet (12 lessons), Ramadan with Noor (8 lessons), 99 Names of Allah (20 lessons)
- Video player with auto-progress saving (every 10 seconds)
- Lesson progress tracking, auto-complete at 90% watched
- Course detail page with curriculum accordion
- Stripe one-time purchase checkout
- Pro users can redeem 1 free course
- Course reviews (1-5 stars)
- Completion certificates (canvas-generated)
- Bunny.net Stream integration with signed URLs for enrolled users
- Admin video upload with drag & drop

### 4. Ramadan Challenge (/ramadan-challenge)
- 30 daily activities (seed data with Dutch + Arabic titles, dua, hadith per day)
- Activity types: coloring, maze, wordsearch, tracing, special milestone days
- Calendar grid UI with daily unlock system
- Badge system: 9 badges (week milestones, streaks, ambassador)
- Streak tracking with consecutive day detection
- WhatsApp share button with pre-filled Arabic message
- Early bird pricing ($9.99 if >30 days before Ramadan, $14.99 after)
- Eid completion certificate (night sky design)
- Countdown timer to Ramadan
- Social proof counter
- Ramadan date utility (hardcoded 2025-2028)

### 5. Marketplace (/marketplace + /sell)
- Teachers upload PDF worksheets, set own price ($1.99-24.99)
- Noor takes 30% commission (Stripe Connect Express accounts)
- Product approval workflow (admin moderation)
- Seller dashboard: earnings, products table, payout tracking
- 4-step upload wizard: info → pricing → description → review
- Buyer: browse, filter, search, purchase, download (5x max)
- Signed download URLs
- Seller Stripe Connect onboarding
- Batch payout processing (min $25)

### 6. Print-on-Demand Books (/books)
- Printful API integration
- 3 variants: softcover 20p (€19.99), softcover 30p (€24.99), hardcover 20p (€29.99)
- 4-step book builder: personalize → cover design → select pages → review
- Cover styles: Classic Green, Ramadan Night, Eid Gold, Arabic Blue
- PDFKit book generator with Islamic cover design, Bismillah title page, dedication page
- Shipping rate calculator per country
- Order tracking with Printful webhook (shipped/failed events)
- Stripe checkout for payment

### 7. White Label Schools (/white-label + /school)
- Schools get branded subdomain: school-name.noorprintables.com
- Custom logo, colors, welcome message, footer
- 2 plans: Basic ($297/yr, 10 seats) / Advanced ($497/yr, 25 seats)
- 6-step setup wizard with live preview
- Teacher invitation system with tokens
- Branding editor with real-time preview
- Teacher management: invite, roles, activity tracking
- Subdomain availability checker with suggestions
- Sales demo link generator for prospects
- Domain verification support

### 8. Community — Circle.so Integration
- "Noor Families" private community for Pro/School subscribers
- SSO (HMAC-SHA256 signed tokens) — one-click login to Circle
- 7 spaces: Welcome, Worksheets, Ramadan, Q&A, Teachers Lounge, Requests, Celebrations
- Automatic lifecycle: upgrade → add to community, cancel → remove
- Plan-based space access (School gets Teachers Lounge, Pro doesn't)
- Community stats API
- Weekly Q&A event creation
- Recent posts widget
- Dashboard integration with upsell for free users

### 9. Achievement System (/achievements)
- 23 badges across 8 categories: completion, alphabet, streak, ramadan, theme, course, sharing, special
- 4 tiers: bronze (10 XP), silver (30-50 XP), gold (80-200 XP), platinum (300-500 XP)
- 10 levels: Seeker → Student → Learner → Explorer → Achiever → Scholar → Guardian → Champion → Legend → Noor Master
- Badge engine: `checkAndAwardBadges()` called after every user action
- Streak tracking with consecutive day detection
- Auto-generated certificates for gold/platinum badges
- Public shareable certificate URLs (viral loop)
- Badge popup animation (bounce + glow)
- XP progress bar widget
- Secret/hidden badges (discovered on earn)
- Canvas-rendered certificates with Islamic geometric border

### 10. Noor Games (/games)
- 3 HTML5 Canvas mini-games:
  - **Moskee Memory**: flip matching Islamic symbol pairs (16 cards)
  - **Arabische Letter Vangen**: tap falling Arabic letter bubbles, combo system
  - **Bouw de Kaaba**: block stacker with night sky, perfect placement bonus
- Class-based game engines with requestAnimationFrame loop
- Touch + mouse input, retina canvas
- Web Audio API sound effects (no audio files needed)
- Score submission with anti-cheat validation
- Leaderboard per game (anonymized)
- Islamic facts shown during gameplay (30 facts across 3 games)
- Game text in 4 languages (EN/NL/FR/AR)
- Free/Pro gating (Memory free, others Pro only)
- XP earned from game scores

### 11. Prayer Times & Qibla (/prayer)
- Astronomical calculation (no external API needed)
- 7 calculation methods: MWL, ISNA, Egypt, Makkah, Karachi, Tehran, Turkey
- 6 prayer times: Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha
- Qibla compass with SVG + device orientation (live compass on mobile)
- Distance to Makkah calculation
- Next prayer countdown (live ticker)
- Reverse geocoding for location name
- Calendar sync: ICS file export for Outlook/Apple Calendar + Google Calendar link
- 30 days of prayer events with 15-min reminders
- Night blue design theme

### 12. SEO & Content Marketing
- 5 SEO landing pages (500+ words each):
  - /islamic-coloring-pages
  - /ramadan-worksheets
  - /arabic-letters-coloring
  - /eid-printables
  - /islamic-school-worksheets
- Blog with 3 full articles (800-1200 words each):
  - 15 Fun Ramadan Activities for Kids
  - Complete Guide to Islamic Homeschool Printables
  - 5 Proven Methods to Teach Arabic Alphabet
- Auto-generated sitemap.xml
- OG image generator API (Edge runtime)
- Schema.org: SoftwareApplication, FAQPage, Article, BreadcrumbList
- Full OpenGraph + Twitter Card meta

### 13. Email Marketing (Resend + React Email)
- 7 email templates:
  - Welcome (Islamic themed, feature overview)
  - Upgrade confirmation (receipt, unlocked features)
  - Referral bonus (friend joined, +5 sheets)
  - Monthly digest (stats, top themes, upsell)
  - Ramadan campaign (discount code box, seasonal themes)
  - Re-engagement (14 days inactive)
  - Community welcome (SSO link, spaces overview)
- Mock mode when API key not configured (console log, no errors)
- Non-blocking sends (fire-and-forget)

### 14. Auth System
- NextAuth v5 with JWT strategy
- Credentials provider (email + password, bcrypt)
- Google OAuth
- Apple OAuth
- Microsoft Entra ID OAuth
- Automatic user creation on first OAuth login
- Account linking (same email = linked)
- Middleware route protection
- Session-aware navigation (logged in/out states)

### 15. Payment System (Stripe)
- 4 subscription tiers: Pro Monthly, Pro Yearly, School Monthly, School Yearly
- Course one-time purchases
- Ramadan Challenge purchase
- Book orders
- Marketplace purchases (30% commission)
- White Label annual purchase
- Stripe Connect for marketplace seller payouts
- Webhook handler at /api/webhooks/stripe handling:
  - checkout.session.completed (subscriptions, courses, challenges, books, marketplace, white-label)
  - customer.subscription.updated (plan changes)
  - customer.subscription.deleted (downgrades)
  - invoice.payment_failed (grace period + downgrade after 3 failures)
- Customer portal for self-service billing management
- Promotion codes enabled on all checkouts
- iDEAL, Bancontact, SEPA, credit card support

### 16. Referral System
- Unique referral codes per user
- 5 bonus worksheets per successful referral
- Referral tracking (count + bonus earned)
- WhatsApp, email, native share buttons
- Share analytics tracking
- Ambassador badge at 3+ referrals

### 17. Admin Dashboard (/admin)
- No password required (direct access)
- KPI overview: total users, MRR, ARR, signups (today/week/month)
- Plan breakdown: Free vs Pro vs School with percentages
- Conversion funnel: Signups → Activated → Paid
- Generation stats: total, today, this week
- Email leads: total, this week
- Top themes (most generated)
- Top referrers
- Recent signups table
- Academy video upload (/admin/academy/upload)

### 18. Internationalization (4 languages)
- English, Dutch (Nederlands), French (Français), German (Deutsch)
- Client-side i18n context provider
- Auto-detect browser language
- Persist selection in localStorage
- Language switcher dropdown on every page
- 100+ translation keys per language

### 19. Standalone HTML Coloring App
- `noor-printables.html` — single-file digital coloring platform
- 12 Islamic SVG templates
- Freemium gate: 3 free, 9 premium (locked with blur + overlay)
- Upgrade modal with Gumroad payment links
- Access code system (NOOR2025 unlocks all)
- Watermark on free exports
- localStorage persistence
- Works offline, no server needed

---

## File Structure Summary

```
printable-generator/
├── prisma/
│   ├── schema.prisma          (576 lines, 20 models)
│   ├── seed.ts                (badges, courses, ramadan challenge)
│   └── migrations/            (11 migrations)
├── src/
│   ├── app/                   (all pages + API routes)
│   │   ├── page.tsx           (conversion-optimized landing page)
│   │   ├── login/             (social login + email)
│   │   ├── register/          (with referral tracking)
│   │   ├── dashboard/         (worksheet generator + upsells)
│   │   ├── color/             (digital coloring canvas)
│   │   ├── academy/           (courses, learn, my-courses, certificate)
│   │   ├── achievements/      (badges, certificates)
│   │   ├── games/             (hub, individual games, leaderboard)
│   │   ├── prayer/            (prayer times + qibla compass)
│   │   ├── ramadan-challenge/ (sales, dashboard, daily, certificate)
│   │   ├── marketplace/       (browse, product detail)
│   │   ├── sell/              (landing, dashboard, upload wizard)
│   │   ├── books/             (landing, create wizard, my-books, orders)
│   │   ├── white-label/       (sales, setup wizard)
│   │   ├── school/            (branding editor, teacher management)
│   │   ├── blog/              (index + 3 articles)
│   │   ├── admin/             (dashboard, academy upload)
│   │   ├── 5 SEO pages/       (islamic-coloring-pages, ramadan-worksheets, etc.)
│   │   └── api/               (50+ API routes)
│   ├── lib/
│   │   ├── prisma.ts          (singleton client)
│   │   ├── auth.ts            (NextAuth config)
│   │   ├── stripe.ts          (multi-tier pricing)
│   │   ├── stripe-connect.ts  (marketplace payouts)
│   │   ├── pdf.ts             (worksheet PDF generator)
│   │   ├── book-generator.ts  (print-ready book PDF)
│   │   ├── printful.ts        (print-on-demand API)
│   │   ├── bunny.ts           (video hosting + signed URLs)
│   │   ├── circle.ts          (community SSO + member management)
│   │   ├── prayer.ts          (astronomical prayer calculation + qibla)
│   │   ├── badge-engine.ts    (achievement system core)
│   │   ├── ramadan.ts         (dates, unlock logic, badges)
│   │   ├── plans.ts           (pricing tiers + limits)
│   │   ├── analytics.ts       (event tracking)
│   │   ├── referral.ts        (code generation + bonus)
│   │   ├── templates.ts       (coloring SVG templates)
│   │   ├── blog.ts            (article content)
│   │   ├── white-label.ts     (subdomain + branding)
│   │   ├── watermark.ts       (preview PDF watermarking)
│   │   ├── validations.ts     (Zod schemas)
│   │   ├── seo/               (schemas, landing page template, samples)
│   │   ├── emails/            (send service + 7 React Email templates)
│   │   └── games/             (3 game engines + sounds + facts + i18n)
│   ├── components/
│   │   ├── Providers.tsx      (SessionProvider + I18nProvider)
│   │   ├── LanguageSwitcher.tsx
│   │   ├── SocialLoginButtons.tsx
│   │   ├── ColoringCanvas.tsx
│   │   ├── academy/           (VideoPlayer, BunnyEmbed)
│   │   ├── community/         (CommunityCard, EventBanner, RecentActivity)
│   │   ├── achievements/      (BadgePopup, AchievementsWidget)
│   │   └── prayer/            (PrayerWidget)
│   ├── i18n/
│   │   ├── context.tsx        (provider + useI18n hook)
│   │   └── translations.ts   (EN/NL/FR/DE, 100+ keys per language)
│   ├── middleware.ts          (route protection)
│   └── types/                 (next-auth.d.ts)
├── docs/
│   ├── circle-setup.md        (Circle.so setup guide)
│   └── community-calendar.md  (weekly content calendar)
├── noor-printables.html       (standalone coloring app)
├── BUSINESS.md                (business & marketing guide)
├── PLATFORM.md                (this file)
└── .env.local                 (all environment variables)
```

---

## Environment Variables Required

```
DATABASE_URL                    — SQLite/LibSQL connection
NEXTAUTH_SECRET                 — JWT signing key
NEXTAUTH_URL                    — App URL
GOOGLE_CLIENT_ID/SECRET         — Google OAuth
APPLE_CLIENT_ID/SECRET          — Apple OAuth
MICROSOFT_CLIENT_ID/SECRET      — Microsoft OAuth
STRIPE_SECRET_KEY               — Stripe API key
STRIPE_WEBHOOK_SECRET           — Webhook signing
STRIPE_PRO_MONTHLY_PRICE_ID     — 4 subscription price IDs
STRIPE_PRO_YEARLY_PRICE_ID
STRIPE_SCHOOL_MONTHLY_PRICE_ID
STRIPE_SCHOOL_YEARLY_PRICE_ID
RESEND_API_KEY                  — Email sending
EMAIL_FROM                      — Sender address
ADMIN_EMAIL                     — Admin notifications
BUNNY_STREAM_LIBRARY_ID         — Video hosting
BUNNY_STREAM_API_KEY
CIRCLE_API_KEY                  — Community platform
CIRCLE_COMMUNITY_ID
CIRCLE_SSO_SECRET
CIRCLE_SUBDOMAIN
7x CIRCLE_SPACE_*               — Space IDs
PRINTFUL_API_KEY                — Print-on-demand
PRINTFUL_STORE_ID
NEXT_PUBLIC_APP_URL             — Public app URL
NEXT_PUBLIC_GA_ID               — Google Analytics
```

---

## Commands

```bash
# Install
npm install

# Run locally
npm run dev

# Build for production
npm run build

# Database
npx prisma migrate dev          # apply migrations
npx prisma generate             # regenerate client
DATABASE_URL="file:./dev.db" npx tsx prisma/seed.ts  # seed data

# Deploy
vercel deploy
```

---

## Current Build Stats

- **104 routes** (pages + API endpoints)
- **197 TypeScript source files**
- **576 lines** Prisma schema (20 models)
- **11 database migrations**
- **90 statically generated pages**
- **0 build errors**
- **4 languages** supported
- **8 revenue streams**
