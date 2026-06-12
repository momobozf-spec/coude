# Noor Printables — Developer & Handoff Documentation

> Dit document beschrijft elk onderdeel van het platform in detail zodat een andere developer (of AI) het project kan overnemen, uitbreiden, of debuggen.

---

## DEEL 1: ARCHITECTUUR

### Project Structuur
```
printable-generator/
├── prisma/                    ← Database schema + migraties + seed
│   ├── schema.prisma          ← 576 regels, 20+ modellen
│   ├── seed.ts                ← Seed data (courses, badges, ramadan challenge)
│   ├── dev.db                 ← SQLite database bestand
│   └── migrations/            ← 11 migraties
├── src/
│   ├── app/                   ← Next.js App Router pagina's + API routes
│   ├── lib/                   ← Gedeelde business logic + integraties
│   ├── components/            ← React UI componenten
│   ├── i18n/                  ← Vertalingen (EN/NL/FR/DE)
│   ├── generated/prisma/      ← Auto-gegenereerde Prisma client
│   ├── middleware.ts          ← Route protection
│   └── types/                 ← TypeScript type declaraties
├── docs/                      ← Setup guides
├── noor-printables.html       ← Standalone HTML kleurplatform
├── PLATFORM.md                ← High-level platform overzicht
├── BUSINESS.md                ← Marketing & business plan
└── .env.local                 ← Environment variables (NIET committen)
```

### Data Flow
```
Browser → Next.js Middleware (auth check)
       → App Router Page (React, client-side)
       → API Route (server-side)
       → Prisma ORM → SQLite Database
       → External APIs (Stripe, Resend, Circle.so, Bunny.net, Printful)
```

### Auth Flow
```
User → /login of /register
     → NextAuth Credentials (email+password) OF OAuth (Google/Apple/Microsoft)
     → JWT token opgeslagen als httpOnly cookie
     → Middleware checkt cookie bij beschermde routes
     → API routes checken sessie via auth()
```

---

## DEEL 2: DATABASE MODELLEN (20 stuks)

### Core Modellen

**User** — Centrale gebruiker
- `plan`: "free" | "pro" | "school" — bepaalt toegang tot features
- `generationsCount` + `bonusGenerations`: worksheet limieten
- `stripeCustomerId` + `stripeSubscriptionId`: betalingskoppeling
- `referralCode` + `referredBy` + `referralCount`: referral systeem
- `freeCoursesRedeemed`: Pro users krijgen 1 gratis cursus
- `whiteLabelId` + `whiteLabelRole`: school platform koppeling
- Relaties: generations, accounts, enrollments, badges, certificates, gameScores, etc.

**Generation** — Elke gegenereerde worksheet
- `activityType`: "coloring" | "maze" | "wordsearch"
- `theme`: vrije tekst (bijv. "Ramadan", "Mosque", "Arabic Letters")
- Gekoppeld aan userId

**Lead** — Email capture van landing pages
- `email` (uniek) + `source` (landing/pricing/popup/invoice_request)

### Academy Modellen

**Course** → `Lesson` → `Enrollment` → `LessonProgress` → `CourseReview`

- Course: slug, title(+AR), prijs, talen (comma-separated), categorie, featured flag
- Lesson: videoUrl (Bunny.net embed), duration (seconden), order, isFree (preview)
- Enrollment: userId + courseId, pricePaid (0 = gratis via Pro), completedAt
- LessonProgress: watchedSeconds, completed (auto bij 90%)
- CourseReview: 1-5 rating + comment

### Ramadan Challenge Modellen

**RamadanChallenge** → `ChallengeDay` → `ChallengeEnrollment` → `DayCompletion`

- Challenge: per jaar, early bird + normaal prijs, start/end dates, isActive
- Day: dayNumber (1-30), title(+AR), theme, activityType, duaOfDay, hadithOfDay
- Enrollment: childName, childAge, badgesEarned (comma-separated), streakDays, shareCount
- Completion: enrollmentId + dayId

### Marketplace Modellen

**MarketplaceProduct** → `MarketplacePurchase` → `MarketplaceReview`
**SellerProfile** → `SellerPayout`

- Product: title, description, price, fileUrl (private), previewUrl (public), isApproved + isPublished
- Purchase: 70/30 split (sellerAmount + noorAmount), downloadCount (max 5)
- SellerProfile: Stripe Connect accountId, payoutsPending, payoutsPaid

### White Label Modellen

**WhiteLabelAccount** → `WhiteLabelInvite`
**WhiteLabelDemo**

- Account: subdomain (uniek), customDomain, logo, kleuren, schoolName(+AR), plan, maxSeats, expiresAt
- Invite: email + role + token (uniek), accepted flag

### Book Modellen

**ColoringBook** → `BookOrder`
**BookTemplate**

- Book: childName, coverStyle/Color, variant (softcover_20/30, hardcover_20), worksheetIds (comma-separated), status (draft→generating→ready→ordered→printing→shipped→delivered), printfulFileUrl
- Order: volledig shipping address, printfulOrderId, trackingUrl, trackingNumber

### Achievement Modellen

**Badge** → `UserBadge`
**Certificate**
**UserProgress**

- Badge: slug (uniek), requirement (JSON string), tier (bronze/silver/gold/platinum), xpReward, isSecret
- UserBadge: userId + badgeId (uniek samen)
- Certificate: publicToken (uniek, deelbaar zonder login), type, childName
- UserProgress: totalXp, level, currentStreak, longestStreak, per-userId (uniek)

### Game Modellen

**GameScore** + **GameStats**

- Score: gameSlug + score + metadata (JSON), per play
- Stats: per-game best scores + totals, per userId (uniek)

---

## DEEL 3: API ROUTES (50+)

### Auth
| Route | Method | Functie |
|-------|--------|---------|
| `/api/auth/[...nextauth]` | GET/POST | NextAuth handler (login, callback, session) |
| `/api/auth/register` | POST | Email+password registratie + welcome email + referral |

### Worksheets
| Route | Method | Functie |
|-------|--------|---------|
| `/api/generate` | POST | PDF generatie (auth required, plan limit check) |
| `/api/user` | GET | Huidige user data |

### Stripe
| Route | Method | Functie |
|-------|--------|---------|
| `/api/stripe/checkout` | POST | Multi-tier checkout (pro/school, monthly/yearly) |
| `/api/stripe/portal` | POST | Stripe Customer Portal URL |
| `/api/stripe/invoice-request` | POST | School factuur aanvraag |
| `/api/stripe/webhook` | POST | Backward-compat redirect |
| `/api/webhooks/stripe` | POST | Hoofd webhook handler (6 event types) |

### Webhook Event Handling
De Stripe webhook (`/api/webhooks/stripe`) handelt deze checkout types af via `metadata.type`:
1. `book_order` → BookOrder status naar "paid"
2. `white_label` → Log (setup via aparte flow)
3. `marketplace_purchase` → MarketplacePurchase aanmaken + seller earnings updaten
4. `ramadan_challenge` → ChallengeEnrollment aanmaken
5. `course_purchase` → Enrollment aanmaken
6. (geen type) → Subscription activatie (pro/school)

Plus: subscription.updated, subscription.deleted, invoice.payment_failed.

### Academy
| Route | Method | Functie |
|-------|--------|---------|
| `/api/academy/courses` | GET | Alle published courses + enrollment status |
| `/api/academy/courses/[slug]` | GET | Course detail + lessons + signed video URLs |
| `/api/academy/enroll` | POST | Stripe Checkout voor course |
| `/api/academy/redeem-pro-course` | POST | Pro user claimt gratis cursus |
| `/api/academy/progress` | POST | Video watch progress opslaan |
| `/api/academy/review` | POST | Course review (1-5 sterren) |

### Ramadan
| Route | Method | Functie |
|-------|--------|---------|
| `/api/ramadan/enroll` | POST | Stripe Checkout voor challenge |
| `/api/ramadan/dashboard` | GET | Enrollment + alle dagen + unlock status |
| `/api/ramadan/complete-day` | POST | Dag markeren + streak + badges checken |
| `/api/ramadan/share` | POST | Share tellen + Ambassador badge |

### Marketplace
| Route | Method | Functie |
|-------|--------|---------|
| `/api/marketplace/products` | GET | Browse + filter + search + paginatie |
| `/api/marketplace/products/[id]` | GET | Product detail + seller + reviews |
| `/api/marketplace/purchase` | POST | Stripe Checkout (70/30 split) |
| `/api/marketplace/download/[purchaseId]` | GET | Signed download URL |
| `/api/seller/register` | POST | Seller account aanmaken |
| `/api/seller/products` | GET/POST | Seller producten lijst + nieuw product |
| `/api/seller/stripe-connect` | GET | Stripe Connect onboarding |

### White Label
| Route | Method | Functie |
|-------|--------|---------|
| `/api/white-label/check-subdomain` | GET | Beschikbaarheid + suggesties |
| `/api/white-label/setup` | POST | School platform aanmaken |
| `/api/white-label/branding` | GET/PUT | Branding ophalen/updaten |
| `/api/white-label/purchase` | POST | Stripe Checkout |
| `/api/white-label/invite` | GET/POST | Teachers lijst + uitnodigen |
| `/api/white-label/create-demo` | POST | Admin: demo link maken |

### Books
| Route | Method | Functie |
|-------|--------|---------|
| `/api/books/create` | POST | Boek aanmaken (10-30 pagina's) |
| `/api/books/order` | POST | Stripe Checkout voor boek |
| `/api/books/shipping-rates` | POST | Printful verzendtarieven |
| `/api/webhooks/printful` | POST | Printful shipping/failure events |

### Community
| Route | Method | Functie |
|-------|--------|---------|
| `/api/community/join-url` | GET | Circle.so SSO URL genereren |
| `/api/community/status` | GET | Community access status |
| `/api/admin/community/events` | GET/POST | Stats + event aanmaken |

### Achievements
| Route | Method | Functie |
|-------|--------|---------|
| `/api/achievements/check` | POST | Badge engine trigger |
| `/api/achievements/badges` | GET | Alle badges + earned status |
| `/api/achievements/progress` | GET | XP, level, streak, certificates |

### Games
| Route | Method | Functie |
|-------|--------|---------|
| `/api/games/score` | POST | Score opslaan + anti-cheat |
| `/api/games/stats` | GET | Persoonlijke game stats |
| `/api/games/leaderboard` | GET | Top scores per game |

### Overige
| Route | Method | Functie |
|-------|--------|---------|
| `/api/leads` | POST | Email capture |
| `/api/referral` | GET | Referral code ophalen/genereren |
| `/api/referral/claim` | POST | Referral verwerken + bonus |
| `/api/prayer` | GET | Gebedstijden berekenen |
| `/api/prayer/calendar` | GET | ICS kalender export |
| `/api/og` | GET | Dynamic OG image (Edge runtime) |
| `/api/admin/stats` | GET | Admin dashboard data |
| `/api/admin/academy/upload` | POST | Video upload naar Bunny.net |
| `/api/admin/academy/videos` | GET/DELETE | Bunny video management |
| `/api/admin/marketplace/approve` | POST | Product goedkeuren/afwijzen |
| `/api/admin/marketplace/payouts` | GET/POST | Payout stats + batch processing |

---

## DEEL 4: EXTERNE INTEGRATIES

### Stripe
- **Doel**: Alle betalingen (subscriptions, one-time, marketplace payouts)
- **Lib**: `/lib/stripe.ts` (client init + price mapping), `/lib/stripe-connect.ts` (payouts)
- **Webhook**: `/api/webhooks/stripe` handelt 6+ event types af
- **Config**: 4 subscription price IDs + webhook secret in .env
- **Features**: Promotion codes, iDEAL/Bancontact/SEPA, Customer Portal

### Resend + React Email
- **Doel**: Transactionele emails
- **Lib**: `/lib/emails/send.ts` (Resend wrapper), `/lib/emails/index.ts` (convenience functions)
- **Templates**: 7 React Email templates in `/lib/emails/templates/`
- **Mock mode**: Als API key niet geconfigureerd → console.log (geen errors)
- **Pattern**: Non-blocking sends: `sendWelcomeEmail(...).catch(() => {})`

### Circle.so
- **Doel**: Private community voor Pro/School subscribers
- **Lib**: `/lib/circle.ts` (member management, SSO, stats, events)
- **SSO**: HMAC-SHA256 signed JWT token → auto-login in Circle
- **Lifecycle**: Stripe webhook → add/remove community member automatisch
- **Mock mode**: Retourneert demo data als niet geconfigureerd

### Bunny.net Stream
- **Doel**: Video hosting voor Noor Academy
- **Lib**: `/lib/bunny.ts` (upload, embed URLs, signed URLs, stats)
- **Security**: Enrolled users krijgen SHA-256 signed URLs (4 uur geldig)
- **Admin**: Upload via drag & drop op `/admin/academy/upload`

### Printful
- **Doel**: Print-on-demand boeken
- **Lib**: `/lib/printful.ts` (order create, confirm, status, webhook parse)
- **Flow**: Stripe betaling → boek PDF genereren → Printful order → ship → track
- **Webhook**: `/api/webhooks/printful` voor shipping/failure events

---

## DEEL 5: BUSINESS LOGIC

### Plan Limieten (`/lib/plans.ts`)
| Plan | Generaties | Features |
|------|-----------|----------|
| Free | 3 + bonusGenerations | Watermark, beperkt digitaal kleuren |
| Pro ($12/mo) | Onbeperkt | Alles + 1 gratis cursus + community |
| School ($49/mo) | Onbeperkt | + 25 teacher accounts + branding |

### Badge Engine (`/lib/badge-engine.ts`)
- `checkAndAwardBadges(userId, trigger)` → roep aan na ELKE user actie
- Checkt alle un-earned badges tegen requirements (JSON in DB)
- Requirement types: total_count, theme_count, streak, ramadan_days, courses_completed, referrals
- Auto-genereert certificates bij gold/platinum badges
- Berekent XP + level up

### Referral Systeem (`/lib/referral.ts`)
- Elke user krijgt unieke code (4 chars userId + 4 random)
- 5 bonus worksheets per referral (REFERRAL_BONUS constant)
- Code meegestuurd bij registratie via `?ref=` URL parameter
- Referrer krijgt email notificatie

### Ramadan Datum Utility (`/lib/ramadan.ts`)
- Hardcoded dates 2025-2028 (astronomische benadering)
- `getCurrentChallengeDay(startDate)` → dag 1-30 of null
- `isDayUnlocked(dayNumber, startDate)` → auto unlock per dag
- `isEarlyBird(startDate)` → >30 dagen = goedkopere prijs

### Gebedstijden (`/lib/prayer.ts`)
- Pure astronomische berekening (geen externe API)
- 7 methodes (MWL, ISNA, Egypt, Makkah, Karachi, Tehran, Turkey)
- Qibla richting via arctan formule
- Afstand tot Makkah via Haversine formule
- ICS kalender export met 15-min reminders

### PDF Generatie (`/lib/pdf.ts`)
- PDFKit server-side A4 generatie
- 3 activiteit types met unieke generatie:
  - Coloring: 8-pointed star, crescent moon, geometric rosette, border frame
  - Maze: DFS algoritme (15x15 grid), seeded random
  - Word Search: theme-aware woord banken (Islamitische vocabulaire)
- Islamitische header (Bismillah + Noor Printables + gouden ster divider)

### Boek PDF Generatie (`/lib/book-generator.ts`)
- Print-ready 8.5x8.5 inch met bleed (636pt)
- Cover: Islamitisch design + kind naam + titel
- Title page: Bismillah + naam veld
- Dedication page (optioneel)
- Back cover: hadith quote + branding

---

## DEEL 6: FRONTEND PATRONEN

### Middleware (`/src/middleware.ts`)
- Checkt `authjs.session-token` cookie
- Beschermde routes: /dashboard, /color, /academy/learn, /sell/dashboard, /school, etc.
- Auth routes (/login, /register): redirect naar /dashboard als al ingelogd
- Geen Prisma import (edge compatible)

### i18n (`/src/i18n/`)
- Client-side React Context provider
- Auto-detect browser taal
- Persist in localStorage
- `useI18n()` hook → `t("key")` functie
- 100+ keys per taal (EN/NL/FR/DE)

### Game Engines (`/src/lib/games/`)
- Class-based (MemoryGame, ArabicGame, KaabaGame)
- Constructor: canvas + callbacks (onScore, onGameOver)
- Methods: init(), update(dt), draw(), handleClick(), handleTouch(), destroy()
- requestAnimationFrame loop
- Retina canvas (2x scaling)
- Web Audio API sounds (tone generator, geen bestanden)

### Design System (`/src/app/globals.css`)
- CSS custom properties: --primary (#0d9488), --accent (#d4a843)
- Component classes: .btn-primary, .btn-secondary, .btn-gold, .btn-outline
- .card, .input-field, .theme-chip
- Smooth animations (translateY, box-shadow transitions)
- Focus-visible voor accessibility
- Custom scrollbar
- Print stylesheet
- Page fade-in animation

---

## DEEL 7: DEPLOYMENT CHECKLIST

### Verplicht voor productie
1. ☐ Domein kopen (noorprintables.com)
2. ☐ Deploy naar Vercel (`vercel deploy`)
3. ☐ Database switchen naar Turso of Supabase Postgres
4. ☐ Stripe producten aanmaken (4 subscriptions) + webhook instellen
5. ☐ Google OAuth instellen (console.cloud.google.com)
6. ☐ `NEXTAUTH_SECRET` genereren (`openssl rand -base64 32`)
7. ☐ Resend API key instellen (resend.com)
8. ☐ Alle .env.local variabelen in Vercel Environment Variables zetten

### Optioneel (kan later)
- ☐ Apple + Microsoft OAuth
- ☐ Bunny.net (als je video courses live zet)
- ☐ Printful (als je boeken wilt verkopen)
- ☐ Circle.so (als je 50+ Pro users hebt)
- ☐ Google Analytics ID instellen
- ☐ Stripe promotion codes aanmaken (RAMADAN50, etc.)

### Seed commando's
```bash
npx prisma migrate deploy                          # migraties toepassen
DATABASE_URL="file:./dev.db" npx tsx prisma/seed.ts # data seeden
```

---

## DEEL 8: BEKENDE LIMITATIES

1. **SQLite**: Prima voor MVP, maar switch naar Postgres voor productie (concurrent writes)
2. **Video player**: Placeholder mode als Bunny.net niet geconfigureerd (toont demo UI)
3. **Printful**: Mock mode als API key ontbreekt (order wordt gelogd, niet verstuurd)
4. **Circle.so**: Mock data als niet geconfigureerd (community widget toont demo data)
5. **Marketplace file upload**: Producten worden als URL opgeslagen — in productie Supabase Storage gebruiken
6. **White Label subdomain routing**: Middleware detecteert subdomains maar is nog niet productie-getest met Vercel custom domains
7. **Book PDF**: Worksheet pagina's zijn placeholder frames — in productie SVG→PNG conversie toevoegen
8. **OG images**: Edge runtime, sommige fonts werken niet op alle platforms

---

## DEEL 9: HOE VERDER TE BOUWEN

### Nieuwe feature toevoegen
1. Schema model toevoegen in `prisma/schema.prisma`
2. `npx prisma migrate dev --name feature-name`
3. `npx prisma generate`
4. API route in `src/app/api/feature/route.ts`
5. Pagina in `src/app/feature/page.tsx`
6. Componenten in `src/components/feature/`
7. Business logic in `src/lib/feature.ts`
8. Route protection toevoegen in `src/middleware.ts`
9. Sitemap updaten in `src/app/sitemap.ts`
10. Build testen: `npm run build`

### Nieuwe taal toevoegen
1. Open `src/i18n/translations.ts`
2. Voeg nieuwe locale toe aan `Locale` type
3. Voeg vertaalblok toe
4. Update `LOCALE_LABELS`
5. Update `LanguageSwitcher.tsx` met vlag

### Nieuwe badge toevoegen
1. Voeg toe in `prisma/seed.ts` badgeData array
2. Voeg requirement type toe in `src/lib/badge-engine.ts` checkBadgeRequirement()
3. Run seed: `DATABASE_URL="file:./dev.db" npx tsx prisma/seed.ts`
