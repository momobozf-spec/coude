# Layali — Oriental Lifestyle E-Commerce

> Breng de warmte van de Oriënt in huis.

Een production-ready oriental lifestyle webshop voor België en Nederland: theeglazen,
lantaarns, geurkaarsen, home fragrance, decoratie en sfeervolle cadeaus. Warm, elegant
en betaalbaar — **geen religieuze webshop**, maar oriental sfeer, geur, licht en beleving.

> **Repo-map:** de projectmap heet historisch `jamal-jamila/`. De merknaam is **Layali**;
> de mapnaam is met opzet niet hernoemd om paden/git-historie niet te breken.

## Functies

- **Productcatalogus** (38 voorbeeldproducten, 11 categorieën) met filters, zoeken, varianten (kleur/geur/materiaal), SKU, tags, voorraad, SEO-velden, featured/bestseller/nieuwe-collectie
- **Winkelmandje** (slide-in drawer) met kortingscodes, voorraadcontrole, gratis-verzendingsdrempel
- **Checkout + betaling via Mollie** — Bancontact, iDEAL, creditcard, PayPal, bankoverschrijving
- **Betaalprovider Stripe** blijft als alternatief geïntegreerd
- **Orderverwerking** met ordernummers (`LAYALI-2026-000001`), payment-/orderstatussen, voorraadafboeking, idempotente webhooks
- **Transactionele e-mails** (Resend) — orderbevestiging, admin-notificatie, verzendupdate
- **Gebruikersaccounts** (NextAuth: e-mail/wachtwoord + Google) met bestelhistoriek en favorieten
- **Admin dashboard** met producten-CRUD, ordersbeheer, CSV-import, role-based access
- **Meertalig** (NL + FR) via next-intl
- **SEO** — dynamische metadata, Open Graph, Product JSON-LD, sitemap.xml, robots.txt, canonical
- **Analytics-placeholders** (Google Analytics, Meta Pixel, TikTok Pixel) + events (add_to_cart, begin_checkout, purchase)
- **GDPR** cookie banner + cookiebeleid
- **Mobile-first** design met warm oriental thema

## Tech Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS v4, Playfair Display + Inter |
| Database | Prisma 7 — **SQLite lokaal**, **PostgreSQL in productie** |
| Auth | NextAuth (Credentials + Google), bcrypt, role-based |
| Betalingen | **Mollie** (primair) · Stripe (alternatief) |
| E-mail | Resend |
| State | Zustand (cart) |
| Animatie | Framer Motion |
| i18n | next-intl (nl/fr) |

## Lokale installatie

```bash
# 1. Dependencies
npm install

# 2. Environment
cp .env.example .env          # vul minimaal NEXTAUTH_SECRET in; Mollie/Resend optioneel voor eerste run

# 3. Database (SQLite lokaal — geen externe DB nodig)
npm run db:push               # schema naar dev.db
npm run db:seed               # 38 producten, 11 categorieën, coupons, admin

# 4. Dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (redirect naar `/nl`).

## Admin & demo-toegang

Na seeden:

| Rol | E-mail | Wachtwoord |
|---|---|---|
| **Admin** | `admin@layali.shop` | `admin123456` |
| Klant (demo) | `klant@layali.shop` | `klant123456` |

Admin dashboard: [`/admin`](http://localhost:3000/admin) (vereist ADMIN-rol).

## Database

### Models
`User` · `Address` · `Category` · `Product` · `CartItem` · `WishlistItem` ·
`Order` · `OrderItem` · `Review` · `CouponCode` (+ NextAuth `Account`/`Session`).

`Order` bevat o.a. `orderNumber`, `paymentStatus`, `paymentProvider`,
`molliePaymentId`, `stripePaymentId`, `trackingNumber`, `trackingUrl`.

### Commando's
| Commando | Beschrijving |
|----------|-------------|
| `npm run db:generate` | Prisma client genereren |
| `npm run db:push` | Schema naar database pushen |
| `npm run db:seed` | Database vullen met voorbeelddata |
| `npm run db:studio` | Prisma Studio openen |

### Productie: PostgreSQL
Zet in productie `DATABASE_URL` naar een Postgres-connectiestring (Supabase / Neon /
Railway), bv:
```
DATABASE_URL="postgresql://user:pass@host:5432/layali?schema=public&sslmode=require"
```
De Prisma-client gebruikt lokaal de libsql/SQLite-adapter (zie `src/lib/prisma.ts`).
Voor een Postgres-productie-build: vervang in `schema.prisma` `provider = "sqlite"`
door `provider = "postgresql"` en de libsql-adapter in `prisma.ts`/`seed.ts` door de
standaard Postgres-client, draai dan `prisma migrate deploy` + `db:seed`.

## Mollie betalingen testen

1. Maak een account op [mollie.com](https://www.mollie.com) en pak je **test API key** (`test_...`).
2. Zet in `.env`: `MOLLIE_API_KEY="test_..."`.
3. Start de app, leg producten in je mandje en reken af.
4. Je wordt doorgestuurd naar de Mollie-testcheckout; kies daar de gewenste status (paid/failed/...).
5. Na terugkeer toont `/checkout/success` de uitkomst. De success-pagina **reconcilieert
   zelf met Mollie**, dus betaalstatus wordt ook lokaal (zonder publieke webhook) correct
   bijgewerkt.

### Webhook (productie)
Mollie roept `POST /api/webhooks/mollie` aan bij elke statuswijziging. De handler
haalt de échte status op bij Mollie, werkt order + betaling bij, boekt voorraad af en
verstuurt e-mails — **idempotent** (dubbele events veroorzaken geen dubbele verwerking).
Op `localhost` kan Mollie de webhook niet bereiken; gebruik een tunnel (bv. `cloudflared`
of `ngrok`) of vertrouw op de reconcile op de success-pagina tijdens dev.

### Stripe (alternatief)
Stripe blijft beschikbaar via `/api/checkout` + `/api/webhooks/stripe`. Lokaal testen:
`stripe listen --forward-to localhost:3000/api/webhooks/stripe`.

## E-mail (Resend)

Zet `RESEND_API_KEY` en `RESEND_FROM`. Zonder key worden e-mails **netjes overgeslagen**
(geen crash). Templates: orderbevestiging (klant), nieuwe-bestelling (admin),
verzendupdate — alle in warme oriental stijl (`src/lib/resend.ts`).

## Analytics

Vul de gewenste IDs in `.env`:
`NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_META_PIXEL_ID`, `NEXT_PUBLIC_TIKTOK_PIXEL_ID`.
Leeg = niet geladen. Events: `add_to_cart`, `begin_checkout`, `purchase`
(`src/lib/analytics.ts`). **Let op:** koppel deze aan cookie-consent vóór livegang.

## Productie-build

```bash
npm run build
npm run start
```

## Deployen naar Vercel

1. Push naar GitHub, importeer in [Vercel](https://vercel.com).
2. Voeg alle env-variabelen toe (zie `.env.example`) — met **PostgreSQL** `DATABASE_URL`.
3. Build command `next build`, install command voert automatisch `prisma generate` uit (postinstall).
4. Na deploy:
   - `NEXTAUTH_URL` en `NEXT_PUBLIC_APP_URL` op je domein zetten (https).
   - Mollie webhook URL = `https://<domein>/api/webhooks/mollie` (geen aparte registratie nodig — wordt per betaling meegegeven).
   - Stripe webhook endpoint (optioneel): `https://<domein>/api/webhooks/stripe`.
   - Database migreren/seeden (eenmalig).

## Productafbeeldingen

De seed gebruikt deterministische placeholder-foto's (`picsum.photos`) zodat er **nooit
gebroken afbeeldingen** zijn. Vervang ze door echte productfotografie (eigen CDN /
Cloudinary) vóór livegang; voeg het domein toe aan `next.config.ts` → `images.remotePatterns`.

## Kortingscodes (test)

| Code | Korting | Voorwaarde |
|---|---|---|
| `WELKOM10` | 10% | vanaf €30 |
| `ORIENT15` | 15% | vanaf €75 |
| `GIFT5` | €5 | vanaf €25 |

## Bekende beperkingen / toekomstige verbeteringen

- Lokaal SQLite, productie PostgreSQL — schema-provider handmatig omzetten voor Postgres-build (zie boven).
- Admin productformulier dekt de kernvelden; nieuwe velden (geur, tags, gewicht, SEO) hebben defaults en kunnen later in het formulier worden ontsloten.
- Cookie-consent koppelen aan analytics-loading voor volledige GDPR-naleving.
- Verzendkoppeling (Bpost/PostNL/Sendcloud) is voorbereid via tracking-velden; live API-koppeling is een vervolgstap.
- Echte productfotografie en domeinconfiguratie.
