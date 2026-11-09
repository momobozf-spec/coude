# Barakah — Zakat & Charity Platform

Bereken je Zakat transparant, houd je Sadaqah bij, en geef aan goede doelen waarvan je
weet waar de informatie vandaan komt.

**Status: fase 5 (kalender, herinneringen, meldingen, jaarrapporten) afgerond.** Zie
[ARCHITECTURE.md](ARCHITECTURE.md) voor de ontwerpkeuzes en de faseplanning.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · PostgreSQL 17 ·
Prisma 6 · Auth.js v5 · Zod 4 · Vitest 3

## Aan de slag

```bash
cp .env.example .env
# Zet AUTH_SECRET op iets willekeurigs van minstens 32 tekens:
npx auth secret

docker compose up -d          # PostgreSQL op localhost:5432
npm install
npm run db:migrate            # past prisma/migrations toe
npm run db:seed               # regelset, causes, demo-charities, kennisbank, 2 dev-users
npm run dev
```

Ontwikkelaccounts na `db:seed`:

| E-mail                 | Wachtwoord         | Plan     |
| ---------------------- | ------------------ | -------- |
| `dev@barakah.local`    | `barakah-dev-2026` | Familie  |
| `other@barakah.local`  | `barakah-dev-2026` | Gratis   |

De tweede gebruiker bestaat om user-isolation te controleren: die gegevens mogen
nergens bij de eerste gebruiker opduiken.

## Scripts

| Commando                | Doet                                                    |
| ----------------------- | ------------------------------------------------------- |
| `npm run dev`             | Development server                                    |
| `npm run build`           | Productiebuild                                        |
| `npm run build:webpack`   | Idem, zonder Turbopack (zie *Bekende beperkingen*)    |
| `npm run verify`          | `db:validate` + `typecheck` + `lint` + `test`         |
| `npm run test`            | Unit- en servicetests (DB-suite wordt overgeslagen)   |
| `npm run test:integration`| Databasetests — vereist `TEST_DATABASE_URL`           |
| `npm run db:migrate`      | Migratie maken/toepassen                              |
| `npm run db:seed`         | Seed-data laden (idempotent)                          |
| `npm run db:studio`       | Prisma Studio                                         |

### Databasetests

De integratiesuite draait alleen met een echte PostgreSQL en **slaat zichzelf luid
over** wanneer die ontbreekt — hij wordt nooit uitgezet om groen te worden:

```bash
createdb barakah_test
TEST_DATABASE_URL=postgresql://barakah:barakah@localhost:5432/barakah_test \
  npx prisma migrate deploy
TEST_DATABASE_URL=postgresql://barakah:barakah@localhost:5432/barakah_test \
  npm run test:integration
```

De opgegeven database wordt tussen tests volledig geleegd — gebruik een wegwerpbare.

## Wat er staat

**Fase 1 — foundation**

- **Datamodel** — 35 modellen, 31 enums. Schema in `prisma/schema.prisma`, migraties in
  `prisma/migrations/`.
- **Auth & user isolation** — Auth.js v5. Elke query loopt via
  `src/server/auth/scope.ts`; schrijven kan alleen de eigenaar, en een niet-eigenaar
  krijgt 404 in plaats van 403.
- **Entitlements** — één centrale abstractie (`canUseFeature`, `assertWithinLimit`).
  Nergens `if (plan === …)`.
- **Charity directory** — publiek, met bronvermelding per claim.

**Fase 2 — Zakat-engine + wizard**

- **Onboarding** — vier vragen, per stap opgeslagen en hervatbaar. Vraagt geen bedragen
  en maakt geen posten aan.
- **Assets & liabilities** — volledige CRUD met entitlement-limieten. Goud en zilver
  kunnen in gram of in waarde.
- **Providers** — `MetalPriceProvider` en `ExchangeRateProvider` met werkende
  `fixture`- en `manual`-implementaties. Betaalde bronnen falen luid zonder
  credentials in plaats van stilletjes fixture-data te serveren.
- **Nisab-engine** — goud, zilver en handmatig. Pure functie; prijzen gaan erin, niet
  eruit gehaald.
- **Calculation pipeline** — deterministisch, zonder AI. Levert gestructureerde
  uitlegregels, geen samengestelde tekst.
- **Wizard** — acht stappen, server-side autosave, hervatbaar op een ander apparaat.
- **Immutable snapshots** — finaliseren legt prijs, koersen, regelversie en
  engineversie vast. Bewezen met integratietests: goudprijs bewegen, asset wijzigen,
  asset verwijderen of een nieuwe regelset activeren laat een afgeronde berekening
  ongemoeid.

**Fase 3 — donaties, betaling en Sadaqah**

- **Donaties** — volledige CRUD met idempotente registratie. Intrekken in plaats van
  verwijderen: de rij blijft auditbaar maar telt nergens meer mee.
- **Zakat-betaling volgen** — betaald/resterend wordt altijd uit de geregistreerde
  donaties afgeleid, nooit uit een teller. Meerdere betalingen per jaar,
  `UNPAID / PARTIALLY_PAID / FULLY_PAID / OVERPAID`.
- **Sadaqah** — doelen per dag, week, maand of jaar met voortgang als eenvoudige
  breuk. Geen streaks, geen faalmeldingen.
- **Bewijsstukken** — private opslag, MIME-allowlist met magic-byte-controle,
  gegenereerde opslagsleutel en een ondertekende downloadlink van tien minuten.
- **Historie & jaaroverzicht** — per maand, type en ontvanger. Bij meerdere valuta
  blijven de totalen apart in plaats van met de koers van vandaag opgeteld.

**Fase 4 — goede-doelengids en transparantie**

- **Bewijs per claim** — elke uitspraak over een organisatie heeft een eigen bron met
  uitgever, publicatiedatum en raadpleegdatum. Claims worden gesupersedeerd, niet
  overschreven.
- **Transparantiescore** — deterministisch, geversioneerd, en per factor uitgelegd.
  Onbekend telt niet als negatief; in plaats daarvan toont de score hoeveel er
  onderzocht is.
- **Zakat-ladder** — vijf niveaus van "onbekend" tot "onafhankelijk bevestigd". Een
  organisatie die op de eigen site zegt Zakat te accepteren komt nooit hoger dan
  "zegt Zakat te accepteren".
- **Directory** — server-side filteren op land, doel, Zakat-status, verificatie en
  favorieten, met zoeken, sorteren en paginering via één gedeelde query builder.
- **Favorieten** — user-owned, idempotent toevoegen en verwijderen.
- **Beheerlaag** — `upsertSource`, `upsertClaim`, `verifyClaim`, `expireClaim`,
  `setCharityVerification`, `recalculateTransparency`. Admin-only, met audit trail.

**Fase 5 — kalender, herinneringen, meldingen, jaarrapporten**

- **Kalender** — Hijri ↔ Gregoriaans (Umm al-Qura), altijd gelabeld als geschat en
  handmatig corrigeerbaar tot drie dagen.
- **Herinneringen** — eenmalig, dagelijks, wekelijks, maandelijks, jaarlijks en
  Hijri-jaarlijks. IANA-tijdzones, DST-vast, met gedocumenteerd clamp-beleid voor
  maandeinde en schrikkeldag.
- **Meldingen** — in-app notificatiecentrum met ongelezen-teller. Bezorging loopt via
  een adapter; e-mail, push en Telegram zijn gedeclareerd maar falen luid.
- **Due-processor** — `processDueReminders(now)`, idempotent via een unieke
  occurrence-sleutel. **Er draait geen scheduler**; het endpoint staat klaar achter
  `CRON_SECRET`.
- **Jaarrapporten** — live preview plus bevroren snapshots met echte PDF-uitvoer uit
  een eigen minimale writer. Privéopslag, ondertekende downloadlink.

## Bekende beperkingen

- **Betalingen** zijn niet geïmplementeerd. Abonnementen worden in de database
  gezet; er is geen betaalprovider aangesloten.
- **Turbopack** kan op deze machine niet gebruikt worden: de native SWC-binary
  wordt geblokkeerd door een Windows application-control policy. Gebruik dan
  `npm run build:webpack`. Op Linux/CI werkt `npm run build` gewoon.
- **AI, prijs- en wisselkoersproviders** staan standaard op `mock` / `fixture` en
  doen geen externe calls.

## Religieus uitgangspunt

De applicatie rekent volgens een expliciet gekozen, geversioneerde regelset en toont
bij elke post waarom die meetelt. Ze doet geen uitspraken namens een madhhab en geeft
geen fatwa. AI wordt alleen gebruikt om een bestaande berekening uit te leggen —
nooit om bedragen te bepalen of regels te overrulen.
