# Barakah — Zakat & Charity Platform

Bereken je Zakat transparant, houd je Sadaqah bij, en geef aan goede doelen waarvan je
weet waar de informatie vandaan komt.

**Status: productieklaar voor een lancering op het gratis plan.** Inloggen met
vergrendeling, wachtwoordherstel per e-mail, sessies intrekken, AVG-export en
-verwijdering, gepubliceerde marktprijzen met bron en datum, een worker voor
herinneringen (in-app + e-mail), health checks, Docker en CI.

- In productie zetten: [docs/DEPLOY.md](docs/DEPLOY.md)
- Wat er vóór de lancering nog buiten de code moet gebeuren: [docs/LAUNCH-CHECKLIST.md](docs/LAUNCH-CHECKLIST.md)
- Ontwerpkeuzes: [ARCHITECTURE.md](ARCHITECTURE.md)

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · PostgreSQL 17 ·
Prisma 7 (pg-driver) · Auth.js v5 · Zod 4 · Vitest 3 · Playwright

## Aan de slag

```bash
cp .env.example .env
# Zet AUTH_SECRET op iets willekeurigs van minstens 32 tekens:
npx auth secret

docker compose up -d          # PostgreSQL op localhost:5432
npm install
npm run db:deploy             # past prisma/migrations toe
npm run db:seed               # regelset, causes, demo-charities, kennisbank, 2 dev-users
ADMIN_EMAIL=dev@barakah.local npm run admin:grant   # beheerder voor /admin/prijzen
npm run dev
npm run worker                # optioneel, tweede terminal: herinneringen verwerken
```

Is poort 5432 al bezet (bv. door een andere Postgres)? Zet in `docker-compose.yml`
`'5435:5432'` en in `.env` `localhost:5435` in de `DATABASE_URL`.

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
| `npm run db:deploy`       | Migraties toepassen zonder nieuwe te maken (productie)|
| `npm run db:reference`    | Regelset + categorieën — veilig op productie          |
| `npm run worker`          | Herinneringen, ECB-koersen, opruimen (één instantie)  |
| `npm run admin:grant`     | `ADMIN_EMAIL=…` wordt beheerder (`ADMIN_REVOKE=1` om in te trekken) |
| `npm run unlock:user`     | `UNLOCK_EMAIL=…` heft een inlogvergrendeling op       |
| `npm run charity:import`  | Een goed doel uit een nagekeken JSON-bestand opnemen  |
| `npm run test:e2e`        | Playwright tegen een draaiende server (zie `playwright.config.ts`) |

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
  occurrence-sleutel. De worker (`npm run worker`) verwerkt ze elke minuut en
  stuurt ook een e-mailkopie (uit te zetten in Profiel).
- **Jaarrapporten** — live preview plus bevroren snapshots met echte PDF-uitvoer uit
  een eigen minimale writer. Privéopslag, ondertekende downloadlink.

## Bekende beperkingen

- **Betalingen** zijn niet geïmplementeerd. De lancering gebeurt op het gratis
  plan; betaalde plannen vragen eerst een betaalprovider (Mollie/Stripe),
  btw-facturatie en aangepaste voorwaarden.
- **Bestandsopslag** is lokaal (persistent volume). S3 is nog niet gebouwd; de
  app weigert in productie te starten met `STORAGE_PROVIDER=s3`.
- **Rate limiting** zit in het geheugen van één proces. Draai één webinstantie,
  of vervang `src/server/http/rate-limit.ts` door Redis voor meer.
- **Goede doelen** beheer je via `npm run charity:import` (JSON met bronnen) en
  de admin-API's; er is nog geen beheerscherm voor.
- **Turbopack** kan op een Windows-machine met application control geblokkeerd
  worden; gebruik dan `npm run build:webpack`. Op Linux/CI werkt `npm run build`.
- **AI** is niet in gebruik (`AI_PROVIDER=mock`).

## Religieus uitgangspunt

De applicatie rekent volgens een expliciet gekozen, geversioneerde regelset en toont
bij elke post waarom die meetelt. Ze doet geen uitspraken namens een madhhab en geeft
geen fatwa. AI wordt alleen gebruikt om een bestaande berekening uit te leggen —
nooit om bedragen te bepalen of regels te overrulen.
