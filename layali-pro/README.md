# Layali — Oriental Lifestyle webshop

Webshop voor België en Nederland: theeglazen, lantaarns, geurkaarsen, home
fragrance, decoratie en cadeaus. NL/FR, betalen via Mollie.

> De projectmap heet historisch `jamal-jamila/`; de merknaam is **Layali**.

## Wat erin zit

- Catalogus met categorieën, filters, varianten (kleur/geur/materiaal) en SEO
- Winkelmand, kortingscodes, verzendkosten (gratis vanaf € 75)
- Afrekenen via **Mollie**; de bestelling en de voorraadreservering ontstaan
  vóór de betaling, de webhook bevestigt
- Accounts (e-mail + wachtwoord, optioneel Google), wachtwoord vergeten en wijzigen
- Beheer: producten, bestellingen (status, track & trace), CSV-import
- Transactionele e-mails via Resend
- Marktplaatsmodule (verkopers en diensten) — zie de kanttekening onderaan

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 · Prisma 7 op
PostgreSQL (pg-driver) · NextAuth 4 · next-intl · Zod · Vitest

## Lokaal starten

```bash
npm install
cp .env.example .env          # DATABASE_URL en NEXTAUTH_SECRET invullen
npx prisma migrate deploy     # schema op een lege PostgreSQL
npm run db:reference          # categorieën
npm run db:seed:demo          # optioneel: demo-catalogus
BOOTSTRAP_ADMIN_EMAIL=jij@voorbeeld.be npm run bootstrap:admin
npm run dev
```

## Controleren

```bash
npm run typecheck && npm run lint
TEST_DATABASE_URL=postgresql://…/layali_test npm test   # unit + integratie
```

De integratietests draaien tegen een echte PostgreSQL met de migraties
toegepast; zonder `TEST_DATABASE_URL` worden ze overgeslagen.

## Hoe een bestelling loopt

1. `POST /api/checkout/mollie`: invoer gevalideerd (Zod), alles opnieuw geprijsd
   aan serverkant in centen, voorraad atomair gereserveerd
   (`stock >= gevraagd`), ordernummer uit een Postgres-sequence.
2. Mollie-betaling aangemaakt; mislukt dat, dan komt de voorraad meteen terug.
3. `POST /api/webhooks/mollie`: status opgevraagd bij Mollie (nooit uit het
   verzoek) → betaald, of geannuleerd met voorraad terug. Idempotent.
4. Vangnet: `POST /api/cron/reconcile` (elk uur via GitHub Actions) controleert
   openstaande bestellingen ouder dan een half uur.
5. Afwijkingen (ander bedrag betaald, betaald na verlopen terwijl de voorraad
   op is, geannuleerd na betaling) krijgen een notitie in `needsAttention`.

## Online zetten

Gratis testopstelling op Render + Neon: [docs/DEPLOY-RENDER-FREE.md](docs/DEPLOY-RENDER-FREE.md).

## Vóór je echt verkoopt

Zie [docs/LAUNCH-CHECKLIST.md](docs/LAUNCH-CHECKLIST.md).
