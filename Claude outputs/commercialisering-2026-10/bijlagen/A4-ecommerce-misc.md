# A4 – E-commerce & overige mappen (audit, read-only)

Basis: `C:\Users\mo-bo\OneDrive\Documenten\coude\` (hierna `coude\`). Alles is statisch gelezen via PowerShell (Get-ChildItem / Select-String / Get-Content). **Niets is runtime getest, gebuild of geïnstalleerd.** Bestandsaantallen en grootte zijn exclusief node_modules/.next/.git/dist.

## Samenvatting

| project | groep | stack | rijpheid 0-5 | uren-tot-v1 (L/B/H) | grootste blokkade |
|---|---|---|---|---|---|
| **layali-pro** | Layali-webshop | Next.js 16, Prisma 7/Postgres, NextAuth, Mollie, Resend, Vitest | **4** | 15 / 30 / 50 (technisch) | Fysieke voorraad + verzending; echte catalogus, domein, juridische gegevens |
| jamal-jamila | Layali-webshop (oudere versie) | Next.js 16, Prisma/SQLite, Mollie+Stripe | 3 | n.v.t. (vervangen door layali-pro) | Achterhaald; `.env` + `dev.db` in map |
| eid-luxe-shop | losse shop-frontends | Next.js 14, Zustand, mockdata | 2 | 60 / 100 / 160 | Geen backend/betaling; checkout = redirect |
| luxe-store | losse shop-frontends | Next.js, Prisma/SQLite, Stripe | 3 | 40 / 70 / 110 | Generieke shop zonder product/niche |
| webshop | losse shop-frontends | Vite + React (JS), Zustand | 2 | 60 / 100 / 160 | Checkout-knop zonder handler; mockdata |
| superette (boetiek) | Superette | NestJS + Prisma/PG, Next PWA, MQTT-sim | 3 | 200+ (plus hardware) | Fysieke onbemande winkel: hardware, voorraad, ter plaatse |
| **superette-pro (supermarktvergelijker)** | Superette (meest recent) | idem + `apps/superette-web`, scrapers | **3** | 40 / 80 / 150 | Datarechten (scraping Aldi/Lidl/Delhaize), geen verdienmodel in code |
| codex | starter | vinext/Cloudflare, Drizzle | 1 | n.v.t. | Starter met één landingspagina (Muslim Kids Club) |
| simple-webapp | demo | HTML/JS, localStorage | 0-1 | n.v.t. | Tutorial-taken-app |
| sites/brandstofprijzen (TankSlim) | statisch | 1 HTML-bestand, Leaflet, Firebase | 2 | 40 / 80 / 120 | Scrapet carbu.com via corsproxy.io (ToS) |
| onprem online | leeg/restant | – | 0 | – | Alleen Claude-worktree-kopie van marktonderzoek |
| lokaal | dev-tooling | Node launcher + embedded Postgres | n.v.t. | – | Geen product; bevat tar.gz-backups |
| Claude outputs | los bestand | GitHub Actions YAML | n.v.t. | – | CI voor ImmoRadar, hoort elders |
| Nieuw | leeg | – | 0 | – | Lege map |

**Fysieke logistiek/voorraad vereist:** layali-pro, jamal-jamila, eid-luxe-shop, luxe-store en webshop (allemaal webshops voor fysieke goederen), plus superette-boetiek (onbemande fysieke winkel met deurhardware). **Geen logistiek:** superette-web (vergelijker), brandstofprijzen, codex, simple-webapp.

**Al deploy-geconfigureerd (root `render.yaml` + `DEPLOY-RENDER.md`):** brandstofprijzen (static, `./sites/brandstofprijzen`), noor-growth-funnel, simple-webapp, webshop (Vite-build), marktonderzoek, resume-roaster, jamal-jamila, luxe-store, noor-tracker en printable-generator (alle 10 op het gratis Render-plan; de Next.js-apps op SQLite op een tijdelijke schijf, dus data reset bij herstart; DEPLOY-RENDER.md zegt dat zelf). Daarnaast heeft **layali-pro** een eigen `render.free.yaml` (Docker, Neon Postgres, healthcheck `/api/ready`) en heeft superette(-pro) Dockerfiles en `docker-compose.prod.yml`, maar die zitten **niet** in de root-blueprint. eid-luxe-shop, superette en codex staan niet in `render.yaml`. Uit niets blijkt dat iets daadwerkelijk gedeployd is: `DEPLOY-RENDER.md` noemt een vastgelopen `.git\index.lock` en "nog geen GitHub-repo"; `superette-pro\docs\PRODUCTION-READINESS.md` zegt letterlijk "Niets is gedeployd".

**Belangrijkste bevinding:** layali-pro is technisch het meest verkoopklare project in deze groep (Mollie-flow met server-side herprijzing, voorraadreservering, idempotente webhook, reconcile-cron en 32 tests). Het is wel een klassieke webshop met fysieke voorraad en verzending, en dat botst rechtstreeks met de eis "geen logistiek". Het enige project zonder logistiek dat hier iets waard is, is de supermarktvergelijker in superette-pro, maar die draait op gescrapete data waarvoor geen licentie is.

---

## 1. Groep Layali: layali-pro (meest recent) en jamal-jamila (ouder)

Merknaam Layali (oriental lifestyle: theeglazen, lantaarns, geurkaarsen). Beide READMEs zeggen dat de map historisch `jamal-jamila` heet. **layali-pro is de opvolger**: laatst gewijzigd 2026-10-05 (`tests\security.test.ts`), tegenover 2026-06-11 voor jamal-jamila. layali-pro is Postgres-only, heeft Zod, tests en ops-routes; jamal-jamila draait op SQLite met Stripe naast Mollie.

### layali-pro
**In code aanwezig**
- Shop: `src\app\[locale]\` (home, products, products/[slug], checkout, checkout/success, account/{dashboard,orders,wishlist,settings}, login, register, forgot-password, reset-password, privacy, terms, cookies, shipping-returns, faq, contact), NL/FR via next-intl (`src\i18n\`).
- Betaling: `src\app\api\checkout\mollie\route.ts`, `src\app\api\webhooks\mollie\route.ts`, `src\lib\mollie.ts`, `src\lib\orders.ts`, `src\lib\money.ts`. Cron: `src\app\api\cron\reconcile\route.ts` en de template `deploy\github-cron.yml`.
- Auth: NextAuth (credentials en optioneel Google), wachtwoordherstel (`api\auth\password-reset\*`), `lib\rateLimit.ts`, `lib\passwords.ts`.
- Admin: `src\app\admin\` (producten-CRUD, orders, CSV-import).
- E-mail via Resend (`lib\resend.ts`). Juridische gegevens uit env (`lib\legal.ts`, `components\legal\LegalEntityBlock.tsx`). Health/ready-routes.
- Marktplaatsmodule (vendors/services/sell) achter de feature-flag `MARKETPLACE_ENABLED` (`lib\features.ts`), standaard uit.
- DB: `prisma\schema.prisma`, één migratie `20261005160000_init`, seeds (demo, marketplace, reference) en `scripts\bootstrap-admin.ts`.
- Tests: `tests\checkout.test.ts`, `money.test.ts`, `security.test.ts`, `orders.integration.test.ts` (32 `it/test`-aanroepen; de integratietest heeft `TEST_DATABASE_URL` nodig).
- Deploy: `Dockerfile`, `render.free.yaml`, `docs\DEPLOY-RENDER-FREE.md`.

**Statisch geverifieerd**
- De Mollie-webhook valideert het id met een regex, haalt de status zelf op bij Mollie (vertrouwt de request niet), controleert `metadata.orderId` en is idempotent via `applyMollieStatus`. Bij een fout geeft hij 500 terug zodat Mollie opnieuw probeert.
- `legal.ts` haalt naam, btw-nummer en adres uit env en verzint niets.
- `about\page.tsx:16` gebruikt nog een picsum-placeholderfoto. `AtmosphereTile.tsx` zegt "The shop ships without real photos".
- Er staat geen `.github`-map in het project: de cron-workflow bestaat alleen als template in `deploy\`.

**Alleen in docs**: "elk uur via GitHub Actions" (README) is pas waar als de workflow geplaatst wordt.

**Ontbreekt voor v1** (volgens `docs\LAUNCH-CHECKLIST.md`, en klopt met de code): echte producten, foto's en voorraad (de demo-seed gebruikt placeholders); btw-nummer en adres van de verkoper; een eigen domein met Resend SPF/DKIM; een live Mollie-account; betaalde hosting met back-ups; voorwaarden die een jurist heeft nagelezen; de retourkostenregel; een end-to-end testbestelling.

- Stack: Next.js 16 / React 19 / TS / Tailwind 4 / Prisma 7 + pg / NextAuth 4 / Zod / Vitest. **Mobiel:** nee (mobile-first web, geen PWA-manifest gezien). **Tests:** ja.
- **Risico's:** consumentenrecht (herroeping, retour), GDPR (accounts, nieuwsbrief, analytics-placeholders). De `LEGAL_ENTITY_NAME` in `render.free.yaml` is "Marhaba Cooperation BV": controleer of dat de juiste entiteit is.
- **Logistiek: JA.** Fysieke voorraad, verpakken, verzenden en retouren.
- **Rijpheid 4**: de complete betaalflow met tests bestaat, alleen inhoud, accounts en juridische gegevens ontbreken.
- **Uren** 15/30/50: alleen deploy, configuratie, catalogusimport en een e2e-test. Dat is gebaseerd op de checklist, want de code zelf is af. Inkoop en fotografie van producten vallen hierbuiten.

### jamal-jamila
- Zelfde routeset als layali-pro maar zonder wachtwoordherstel, cron, health en tests. Heeft wel `api\checkout\route.ts` en `api\webhooks\stripe\route.ts` naast Mollie, plus `vercel.json` en `DEPLOY.md`.
- De map bevat **`.env` en `dev.db`** (lokale database met geseede admin `admin@layali.shop` / `admin123456` volgens de README) en vreemde lege bestanden `@unique` en `String` in de root (restanten van shell-redirects).
- Staat in de root-`render.yaml` op SQLite (data reset).
- **Rijpheid 3**, logistiek JA. **Advies:** archiveren, layali-pro is de bron.

---

## 2. Losse shop-frontends: eid-luxe-shop, luxe-store, webshop

Drie losse, oudere pogingen (laatste mtime 2026-03-29 t/m 2026-05-06) die inhoudelijk overlappen met Layali (Eid/Ramadan-cadeaus, luxe). Alle drie vereisen **fysieke voorraad en logistiek**.

### eid-luxe-shop ("Noor·Luxe", 61 bestanden, mtime 2026-05-06)
- **Code:** 15 pagina's in `src\app\` (shop, product/[slug], gift-boxes, cart, checkout, order-confirmation, account, wishlist, ...). Data hardcoded in `src\data\products.ts` (650+ regels) en `reviews.ts`. Wisselkoersen zijn mock (`lib\currency.ts:3`). Productafbeeldingen zijn SVG-mocks (`components\ui\ProductImage.tsx:3`). Dependencies zijn alleen next/react/zustand/lucide/clsx.
- **Geverifieerd:** `checkout\page.tsx` doet bij `onSubmit` alleen `router.push("/order-confirmation")`, dus er wordt niet betaald en er wordt geen order opgeslagen. In `terms`/`privacy` staat dat er via Stripe/Mollie betaald wordt, maar dat is **alleen tekst**.
- **README** zegt zelf "Mock-data alleen". Niet in `render.yaml`, wel in `launch.mjs` (poort 3001).
- **Rijpheid 2**, uren 60/100/160 (backend, betaling, auth en admin moeten nog gebouwd worden; kan beter in layali-pro opgaan). Tekst rond Eid vraagt een religieuze inhoudscontrole.

### luxe-store (79 bestanden, mtime 2026-05-02)
- **Code:** `(shop)`, `(auth)`, `admin` (incl. analytics), API-routes, Stripe Checkout (`api\checkout\route.ts`) en webhook (`api\webhooks\stripe\route.ts`), NextAuth, Prisma/SQLite, `prisma\seed.ts`. Bevat `.env` en `dev.db`.
- **Geverifieerd:** de webhook controleert de `stripe-signature` en verwerkt `checkout.session.completed` (prijzen opnieuw uit de DB). Items worden als JSON in de Stripe-metadata doorgegeven. De README is de standaard create-next-app-tekst. Geen tests.
- Staat in `render.yaml` (SQLite, reset). **Rijpheid 3**: de kernflow met Stripe bestaat, maar het is een generieke shop zonder merk of product. Uren 40/70/110. **Advies:** archiveren (layali-pro is beter).

### webshop (Vite/React, 44 bestanden, mtime 2026-03-29)
- **Code:** Ramadan/Eid-boxen (`src\data\products.js`, bv. "Ramadan Kareem Box", tiers €64,95/€79,95, emoji als afbeeldingen), pagina's in `src\pages\`, i18n nl/fr/de/en, WhatsApp-knop.
- **Geverifieerd:** de checkout-knop in `components\CartDrawer.jsx` (~regel 233) is een `<button>` **zonder onClick**. De FAQ (nl.js:244) zegt zelf "Mollie-integratie is voorzien" (de en-versie beweert dat er al via Mollie betaald wordt; dat is alleen tekst). README is de standaard Vite-template. Geen backend.
- In `render.yaml` als static build. **Rijpheid 2**, uren 60/100/160. Religieuze inhoud. **Advies:** archiveren.

---

## 3. Groep Superette: superette (ouder) en superette-pro (meest recent)

Monorepo met twee domeinen (README): (a) de **Jamal & Jamila onbemande boetiek** (toegangscontrole, self-scanning, Belgische kasbonnen) en (b) de **Superette supermarktvergelijker** (7 ketens). superette-pro is een kopie van superette met extra's: 621 tegenover 317 bestanden, laatste wijziging 2026-10-19. Alles wat superette heeft, zit ook in pro. Pro voegt toe: echte scrapers en scrape-runs, `scripts\weekly-update.mjs`, een Jumbo-folder-PDF, opgeslagen SPAR-HTML-pagina's en `.superette-backups`. **superette-pro is de bron.**

### In code aanwezig (superette-pro)
- `apps\api` (NestJS + Prisma/PG): checkout en payments met `payments\mollie.gateway.ts` en `stub.gateway.ts`, deur-tokens, kasbonnen, btw (`packages\vat`).
- `apps\pwa` (boetiek): scannen, mandje, betaling/simulatie, bonnen, sleutel, simulator/deur.
- `sim\gate`: MQTT-broker en een simulator voor de deurcontroller.
- `apps\superette-web` (vergelijker): zoeken, producten/[id], lijsten, alerts, meldingen, promoties, profiel/voorkeuren, privacy, over-de-gegevens.
- `apps\api\src\compare\`: adapters per keten, `matching\product-matcher.ts`, `basket\basket-optimizer.ts`, `alerts\`, `notifications\email\`, `jobs\` (lease, job-key), `scrapers\{aldi,lidl,delhaize,ah,carrefour,jumbo,spar}`, `scrapers\robots.ts` (RFC 9309, respecteert Crawl-delay).
- Data: `apps\api\data\scrape-runs\2026101x-*\{aldi,lidl,delhaize}\*.json` (bv. `aldi.json` 384 kB op 2026-10-18), `data\feeds\aldi.json` en `lidl.json`, een gedownloade `Jumbo-BE-Instore-Folder-2026-Week-41.pdf` (9,7 MB) en opgeslagen Spar-pagina's.
- Docs: PRODUCTION-READINESS, SECURITY, PRIVACY, DEPLOYMENT, DATABASE, MONITORING, RUNBOOK, COMPARE. Dockerfiles en `docker-compose.prod.yml`.

### Statisch geverifieerd
- Er zijn veel testbestanden (*.test.ts per scraper, matcher, basket, alerts). README en PRODUCTION-READINESS claimen "244/244 tests" en meerdere smoke-suites. Dat is **een claim uit de docs van 4 okt**, ik heb het niet zelf gedraaid.
- **Tegenstrijdigheid:** `docs\PRODUCTION-READINESS.md` (4 okt) zegt "Demo/live-scheiding: PASS … **geen scraping**". Maar vanaf 7-19 okt staan er scrapers en echte scrape-runs in pro (`weekly-update.mjs`: "scrape:delhaize, scrape:aldi, scrape:lidl"). De doc is dus achterhaald.
- `docs\COMPARE.md` zegt zelf dat elke keten een "overeenkomst of gelicentieerde feed" vereist en dat de "juridische verificatie per keten nog" moet gebeuren.
- Ik vond geen verdienmodel in `superette-web` of de compare-API: geen abonnement, affiliate of advertenties (grep).
- PRODUCTION-READINESS meldt: CI-workflow nooit gedraaid, geen e-mailprovider, geen foutmonitoring, back-up niet geoefend, privacyverklaring nog niet juridisch nagekeken (fr/en ontbreken).

### Ontbreekt voor v1 (vergelijker)
Een legale databron per keten (licentie of feed), een verdienmodel, een echte deploy (staging), een e-mailprovider, een juridisch nagekeken privacyverklaring en een geautomatiseerde scrape-planning in de cloud (nu draait `weekly-update` lokaal en handmatig). Carrefour, Jumbo en Spar zijn handmatige imports, dus er is terugkerend handwerk.

- **Mobiel:** PWA (Next.js) ja, geen Expo/Capacitor. **Tests:** ja (veel).
- **Risico's:** scraping van Aldi/Lidl/Delhaize/AH tegen hun ToS en databankrecht (ook met robots.txt-respect). GDPR bij accounts en prijsalerts per e-mail. De boetiek verwerkt camera- en toegangsgegevens en valt onder kassa- en GKS-regels (Belgische kasbonnen).
- **Logistiek:** de boetiek **JA** (fysieke winkel, deurhardware, voorraad, bijvullen). De vergelijker **NEE**, wel wekelijks onderhoud aan de data.
- **Rijpheid:** boetiek 3 (simulator, geen echte hardware). Vergelijker 3: de kernroutes werken met demodata en de echte feeds voor 3 ketens zijn deels binnen, maar er is geen legale bron en geen verdienmodel.
- **Uren:** vergelijker 40/80/150. Deploy plus cloud-scheduler zijn ongeveer 20-40 uur. Verdienmodel en betaling (bv. Mollie-abonnement, of affiliate) ongeveer 20-40 uur. Juridisch en licenties zijn een onbekende factor. Boetiek: 200+ uur plus hardware en een fysieke locatie, niet realistisch binnen €10k en minimaal handwerk.

---

## 4. Overige mappen

### codex (mtime 2026-08-09)
Cloudflare **vinext-starter** (README "vinext-starter"; `.openai\hosting.json`, `.wrangler`, Drizzle met een lege `db\schema.ts`). `app\page.tsx` rendert alleen `MuslimKidsClub.tsx` (92 regels landingspagina). Er staat ook een `work\muslim-kids-club.tar.gz`. Geen betaling, auth of data. **Rijpheid 1.** Het hoort bij de muslim-kids-club-groep van een andere agent: niet als apart product beschouwen.

### simple-webapp
4 bestanden: een taken-app in HTML/JS met localStorage (README: "starter-webapp ... met Claude Code verder uitbouwen"). Staat in `render.yaml` als static. **Rijpheid 0-1**, geen commerciële waarde. Archiveren.

### sites/brandstofprijzen ("TankSlim")
- Eén `index.html` van 84 kB, identiek aan `coude\brandstofprijzen.html` (zelfde SHA256). Stack: Leaflet/OSM, Firebase Auth/Firestore (config hardcoded, regel 1040-1044; Firebase-web-keys zijn publiek, maar dan moeten de Firestore-rules kloppen), EmailJS, WhatsApp-deeplink.
- **Databronnen (geverifieerd, regel 1438-1509):** BE haalt **carbu.com** op via `corsproxy.io` (regel 1469-1471), NL de ANWB-API (`ANWB_KEY`, ook via corsproxy), FR de open data van data.economie.gouv.fr, LU/fallback Overpass met **demoprijzen** ("indicatief").
- **Risico:** het scrapen van carbu.com via een publieke CORS-proxy schendt waarschijnlijk hun ToS en is fragiel. De ANWB-key zou in de client-side code staan.
- In `render.yaml` (static). **Rijpheid 2.** Uren 40/80/120 (een legale BE-bron zoeken, een backend in plaats van corsproxy, en een verdienmodel). Geen logistiek.

### onprem online
Bevat alleen `.claude\worktrees\suspicious-ramanujan\` (een Claude-Code-worktree met een kopie van `brandstofprijzen.html` en `marktonderzoek` incl. node_modules en `data\responses.json`). HOW-TO-RUN.md en DEPLOY-RENDER.md noemen de map leeg en verwijderbaar. **Rijpheid 0.** Let op: `responses.json` kan enquête-antwoorden (persoonsgegevens) bevatten.

### lokaal
Dev-tooling, geen product. `README.md` en `start.mjs` starten een startpagina (:4000) plus Ritna, TenderKompas, KetelCheck en Overnamemarkt met embedded Postgres (`.pgdata`). `lokaal\bron\` bevat **43 tar.gz-snapshots van bijna alle projecten** (allemaal van 2026-10-23, ~170 MB samen, o.a. `superette-pro.tar.gz` 11,5 MB en `immoradar-belgium.tar.gz` 15 MB). Dat zijn backups en bronnen voor het lokaal testen. Niet uitgepakt.

### Claude outputs
Eén bestand `ci.yml` (2026-10-04): een GitHub Actions-CI voor **ImmoRadar** (Postgres 17-service, typecheck, test, build, e2e). Hoort in het ImmoRadar-project (`.github\workflows\`), niet hier.

### Nieuw
Lege map (0 bestanden).

---

## 5. Root-bestanden
- **render.yaml** (2026-06-12): een Render-blueprint met 10 services (zie de samenvatting). Alle web services op `plan: free`. De Next.js-apps op SQLite `file:./dev.db` met `prisma db push` in de build, dus data verdwijnt bij elke herstart. `NEXTAUTH_URL`/`ANTHROPIC_API_KEY` staan op `sync: false` (moeten handmatig ingevuld worden).
- **DEPLOY-RENDER.md**: stappenplan (git-lock opruimen, GitHub-repo aanmaken, Blueprint koppelen). Uit de tekst blijkt dat er nog geen remote was. Waarschuwt dat de SQLite-opzet "niet voor echte gebruikers" is.
- **LAUNCH.md / launch.mjs** (2026-07-14): een dependency-vrije Node-launcher met vaste poorten per app (eid-luxe-shop 3001, jamal-jamila 3002, luxe-store 3003, ..., noor-app 3017). Ook superette (monorepo, 4 processen) en Hikmar (`Assitant\files (3)`).
- **HOW-TO-RUN.md** (2026-05-02): beschrijft `run.bat` en de "no setup"-patch. De Next.js-apps zijn van Postgres naar SQLite omgezet, Stripe kreeg een dummy-key-fallback en `.env` heeft dummy-keys. Noemt de demo-admin-wachtwoorden (`admin123456`).
- **Zip-bestanden in de root (niet uitgepakt):** `muslim-kids-club-site.zip` (2,9 MB), `muslim-life-pro.zip` (1,0 MB), `rentguard-pro.zip` (0,37 MB), `superette-src.zip` (44,5 MB), `superette.zip` (0,5 MB). Ook in de root: `push-to-github.ps1`, `run.bat`, `start-all.bat`, `start-lokaal.cmd`, `terminal-aldi-sync.png`, `brandstofprijzen.html` (duplicaat van `sites\`).

## 6. Opruimadvies (geen actie uitgevoerd)
Archiveren: jamal-jamila, eid-luxe-shop, luxe-store, webshop, simple-webapp, onprem online, Nieuw, superette (ouder dan -pro). Verplaatsen: `Claude outputs\ci.yml` naar het ImmoRadar-project. Duplicaat verwijderen: `coude\brandstofprijzen.html`. Gevoelig: diverse `.env`- en `dev.db`-bestanden (jamal-jamila, luxe-store, superette(-pro)) mogen niet in een publieke repo komen; controleer `.gitignore` voordat `push-to-github.ps1` gedraaid wordt.
