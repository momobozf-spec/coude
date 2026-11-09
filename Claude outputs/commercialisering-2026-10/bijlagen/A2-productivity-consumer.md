# A2 – Audit productiviteit & consumer-apps

Auditdatum: 2026-10-23. Basispad: `C:\Users\mo-bo\OneDrive\Documenten\coude\`.
Methode: strikt read-only via remote-device tools (directory listings, `Get-Content`, `Select-String`). Niets geïnstalleerd, gebuild of gewijzigd. **Niets is runtime getest**: alle "geverifieerd"-uitspraken zijn statische code-inspectie. `.env`-bestanden met mogelijk echte secrets zijn niet gelezen (alleen bestaan/grootte genoteerd).
Uitzondering op "alleen vermelden": van `rentguard-pro.zip` en `rentguard\src.zip` is enkel de **inhoudsopgave** (entry-namen/datums) gelezen via `ZipFile.OpenRead`; niets uitgepakt.

## Samenvattende tabel

| Project | Groep | Stack | Rijpheid 0-5 | Uren tot v1 (L/B/H) | Grootste blokkade |
|---|---|---|---|---|---|
| brainvoice | Persoonlijke assistent (overlapt Assitant, Orbit) | Expo 57 / RN 0.86, expo-router, SQLite; Node-server (SQLite/Postgres); Anthropic | 3 | 120 / 200 / 350 | Single-tenant (1 gedeeld bearer-token), geen IAP/abonnement, nooit op toestel getest |
| orbit | Taken/notities (overlapt brainvoice) | npm-monorepo: Next.js web+API, Expo mobile, Prisma/Postgres | 2 | 150 / 250 / 400 | Notities/kalender/projecten zijn lege schermen; geen betaling, geen deploy, geen EAS |
| Assitant (Hikmar AI) | Persoonlijke assistent | FastAPI + statische PWA, Claude/GPT-4o/Gemini | 1 | 80 / 150 / 250 | Smart home is in-memory mock; geen auth, open proxy naar betaalde API's |
| resume-roaster | Losse AI-tool | Vite/React + Express, Anthropic | 3 | 20 / 40 / 70 | Geen betaling/rate limit; CV's = persoonsgegevens zonder privacybeleid |
| railclaim | Belgische consumentenrechten | Next.js 16, Supabase, iRail, (Stripe/Resend alleen deps) | 1 | 120 / 180 / 280 | Alleen fundament: geen auth-UI, geen worker, geen claimflow, geen Stripe-code |
| parking-guard | Parking Brussel (overlapt helper) | Next.js, Prisma/Postgres, Auth.js beta | 1 | 150 / 250 / 400 | Alleen registry + healthcheck; wizard/upload/OCR/Mollie ontbreken; indienen namens klant bij 18/19 gemeenten onmogelijk |
| parking-brussel-helper | Parking Brussel | Statische HTML/JS, localStorage | 2 | 15 / 30 / 60 | Geen backend/betaling; verdienmodel zwak |
| rentguard (+ `rentguard-pro.zip`, `src.zip`) | Huurdersbescherming Brussel | Next.js, Supabase, Anthropic vision, pdf | 3 (map) | 80 / 140 / 220 | Brieftemplates `PLACEHOLDER`, juridische review nodig, Stripe niet in map (wel aanwijzingen in pro-zip) |
| brandstofprijzen.html (TankSlim) | Losse webtool | Eén HTML-bestand, Leaflet, Firebase, EmailJS | 2 | 40 / 80 / 150 | BE-prijzen via scraping carbu.com over corsproxy.io; LU-prijzen random gegenereerd; hardcoded API-keys |

Uren zijn ruwe schattingen op basis van de omvang van wat ontbreekt (zie per project), voor één ervaren ontwikkelaar met AI-assistentie, exclusief externe juridische review en store-goedkeuringstijd.

---

## Verificatie eerdere bevindingen (andere AI)

### BrainVoice
| Bewering | Oordeel | Onderbouwing |
|---|---|---|
| Mobiele code voor spraak, taken, agenda en administratie aanwezig | **Bevestigd** | Spraak: `src\platform\voice\VoiceInputService.ts` + `expo-speech-recognition` in `package.json`/`app.config.ts`. Taken: `src\core\services\TaskService.ts`, `src\app\task\[id].tsx`. Agenda: `src\platform\adapters\ExpoCalendarAdapter.ts`, `src\core\services\AgendaService.ts`. Administratie: `src\app\admin\*` (facturen, uitgaven, timesheet, klanten, documenten, e-mails), `src\core\services\admin\*`. |
| Werking op echte toestellen niet bewezen | **Bevestigd** | `README.md` r.56-62: geverifieerd alleen op "Windows, no Xcode/Android SDK" (typecheck/lint/177 Vitest-tests + `expo prebuild`); "on-device behaviour must be verified on a Mac / physical devices". `docs\DEPLOYMENT.md` r.30/34: "REQUIRES DEVICE TEST – the screens were not run on a phone here". Ook `server\push\ExpoPushSink.ts:17`, `src\runtime\ops.ts:35`. Geen EAS `projectId` in `app.config.ts` of `eas.json` → geen aanwijzing dat er ooit een EAS-build is gedaan. Wel een gegenereerde `android\`-map (23/09) van `expo prebuild`. |
| Volledige aankooproute (IAP/subscription) niet bewezen | **Bevestigd – sterker: ontbreekt volledig** | Zoektocht op `revenuecat|InAppPurchase|purchases|paywall|StoreKit|billing` over alle .ts/.tsx/.md/.json (excl. node_modules): geen enkele treffer voor IAP. Geen `react-native-purchases`/`expo-iap` in `package.json`. "subscription"-hits zijn documenttypes en event-listeners. |
| Welke spraak-/AI-API | Vastgesteld | Spraak = on-device Apple Speech / Android SpeechRecognizer via `expo-speech-recognition` (`app.config.ts`, `androidSpeechServicePackages: com.google.android.googlequicksearchbox`). AI = Anthropic: `src\core\ai\AnthropicProvider.ts`, optioneel via `proxy\server.mjs` (houdt API-key server-side, statische `PROXY_TOKENS`) of met een door de gebruiker zelf ingegeven `sk-ant-…` key (`src\app\settings\ai.tsx` r.26/36). Deterministische parser nl/en/fr als primaire route (`src\core\intent\DeterministicParser.ts`). |
| Backend | Vastgesteld | `server\` (Node/tsx): `http.ts`, `runtime.ts`, `worker.ts`, `scheduler.ts`, `db\PostgresDriver.ts`, Gmail-OAuth (`server\accounts.ts`), Expo push. `Dockerfile.alfred`, `docker-compose.alfred.yml`. `docs\DEPLOYMENT.md`: "ACTUALLY DEPLOYED – nothing". Auth = één `ALFRED_API_TOKEN` of `ALFRED_ALLOW_ANONYMOUS` (`server\env.ts` r.63-64, `server\http.ts` r.142) → **single-tenant**, geen gebruikersaccounts. |

### RailClaim
| Bewering | Oordeel | Onderbouwing |
|---|---|---|
| Voortgang en routes wijzen vooral op een fundament | **Bevestigd** | `PROGRESS.md`: alleen "Fase 0 – Onderzoek & fundament: Afgerond"; fase 1 (accounts & trajecten), 2 (detectie-engine), 3 (claimflow), 4 (betalingen/launch) "Nog te doen". |
| Complete gebruikersroutes ontbreken mogelijk | **Bevestigd** | Volledige route-lijst: `src\app\[locale]\page.tsx` (landing), `src\app\[locale]\layout.tsx`, `src\app\api\health\route.ts`. Dat is alles. De landing-CTA linkt naar `/${locale}/register` (page.tsx) – die route bestaat niet → 404. |
| Claimflow end-to-end | **Weerlegd dat die bestaat** – ontbreekt | Geen UI of API voor claims. Wél DB-kant: `supabase\migrations\20260829000100_initial_schema.sql` + `..._rls_policies.sql` (statusmachine-trigger, `confirm_claim()`-RPC), getest in `tests\integration\claim-guarantee.test.ts` en `rls.test.ts` (PGlite). |
| iRail-koppeling | **Gedeeltelijk** | Client + Zod-schemas + stations: `src\lib\irail\client.ts`, `schemas.ts`, `stations.ts`, met echte fixtures in `tests\fixtures\irail\`. Maar enige gebruiker is `src\lib\compensation\calculate.ts`; de detectie-worker (`package.json` script `worker: tsx src/worker/main.ts`) bestaat niet – `src\worker\` is een **lege map**. |
| Stripe | **Ontbreekt in code** | Alleen dependencies (`stripe`, `@stripe/stripe-js`), env-validatie (`src\lib\env.ts` r.48-50), CSP-hosts (`src\proxy.ts`) en kolommen `stripe_customer_id`/`stripe_events` (`src\server\database.types.ts`). Geen checkout- of webhook-route. |
| Supabase | **Gedeeltelijk** | Clients `src\server\supabase.ts`, `src\server\auth.ts`, schema+RLS op 13 tabellen. Geen project gekoppeld (README: "CONFIGURATION REQUIRED"); geen login/registratie-UI. |

---

## 1. brainvoice

**Stack:** Expo SDK 57, React Native 0.86, expo-router, zustand, expo-sqlite (FTS), luxon, zod; Node-server met SQLite of PostgreSQL; Anthropic. Mobiel: **ja (Expo dev-build, géén Expo Go)**. Tests: 17 `*.test.ts` (Vitest), README claimt 177 tests. Deploy-config: `eas.json` (development/preview/production), `Dockerfile.alfred`, `docker-compose.alfred.yml`, `scripts\staging\alfred-staging.sh`. Laatste wijziging: 07/10/2026. Bundle-id `com.brainvoice.app`.

**In code aanwezig**
- Tabs: `src\app\(tabs)\index|today|inbox|notes|admin|settings.tsx`; capture/history/search; detailschermen voor taak/notitie.
- Admin-module ("AI-Butler"): `src\app\admin\` (clients, documents, emails, expenses, invoices, projects, timesheet, suggestions, invoice/[id], project/[id], email/[id]); services in `src\core\services\admin\` (InvoiceService, ExpenseService, TimesheetService, …); factuur-PDF via expo-print (`src\core\finance\invoiceHtml.ts`).
- Ops/"Mission Control": `src\app\ops\*` + `src\core\ops\*` (tickets, approvals, briefing, schedules, workers).
- Native: AlarmKit/AlarmClock module `modules\brainvoice-native\`, config-plugins `plugins\withBrainVoiceIOS.js`/`withBrainVoiceAndroid.js`, iOS widget-bronnen `native\ios-widget\*.swift`.
- E-mail: Gmail-provider (`src\core\email\gmail\*`), OAuth op server.
- Privacy: `PRIVACY.md`, `PERMISSIONS.md`, `src\app\settings\privacy.tsx`.

**Door mij statisch geverifieerd**
- Geen IAP/abonnementscode (zie verificatietabel).
- Server-auth = één gedeeld token → geschikt voor één eigenaar, niet voor betalende klanten.
- UI-voorbeelden zijn persoonlijk ingevuld: `src\app\(tabs)\settings.tsx:29` placeholder "Mohamed", `src\app\admin\emails.tsx:76` "Fabrice Dupont", `src\app\admin\projects.tsx:49` "GO!". Het product is in feite Mohameds eigen Alfred (`.env.alfred.example`, `docs\MISSION-CONTROL.md`).
- AI-key: ofwel eigen proxy met statische tokens, ofwel de gebruiker plakt zelf een Anthropic-key – niet consumentvriendelijk.

**Alleen beloofd in documentatie**
- Werking van AlarmKit, Siri/App Shortcuts, widgets, push en PDF op toestel (README "What needs a physical device"; `IOS_INTEGRATION.md`, `ANDROID_INTEGRATION.md`).
- 24/7-werking van de server ("not true until the server runs somewhere", `docs\DEPLOYMENT.md`).

**Ontbreekt voor verkoopbare v1**
- Multi-user accounts en tenant-scheiding op server; IAP/RevenueCat + paywall; gehoste AI-proxy met per-gebruiker quota; device-tests iOS/Android; EAS-project/projectId, store-assets, privacy policy-URL; scope-reductie (de app is zeer breed: notities + taken + alarmen + facturatie + e-mailtriage + ops).
- Juridisch: Gmail-scopes vereisen Google OAuth-verificatie (restricted scopes → security assessment); mail- en factuurdata = persoonsgegevens (GDPR).

**Rijpheid: 3** – brede, geteste domeinlaag en schermen, maar nooit op toestel gedraaid, single-tenant en zonder betaalroute.
**Uren tot v1: 120 / 200 / 350** – laag = alleen spraak-capture-kern (notes/taken/reminders) + RevenueCat + device-tests; hoog = inclusief butler/admin multi-tenant en Gmail-verificatie.

## 2. orbit

**Stack:** npm-workspaces monorepo: `apps\web` (Next.js, web-UI + REST-API), `apps\mobile` (Expo, expo-router, react-query), `packages\{types,validation,utils,core,ui,db,auth,api-core,api-client}`; Prisma + PostgreSQL (embedded dev-DB in `packages\db\.pgdata`, ~1.400 bestanden – verklaart de 68 MB). Mobiel: **ja (Expo)**, geen `eas.json`. Tests: unit in `packages\{auth,core,utils}\tests`, integratie `packages\api-core\tests\items.integration.test.ts`, smoke `apps\web\scripts\smoke.mjs`; ROADMAP claimt 137 unit + 19 integratie + 29 e2e. Deploy: alleen `docker-compose.yml` (postgres). Laatste wijziging: 29/08/2026.

**In code aanwezig**
- Auth-API: `apps\web\src\app\api\auth\{login,logout,refresh,register}\route.ts`; Argon2id/tokenrotatie/OAuth-adapters in `packages\auth\src`.
- Items/taken-API: `api\items\*` (CRUD, bulk, quick-capture, complete, convert, reorder, checklist), `api\views\[view]`, `api\projects`, `api\tags`, `api\dashboard`.
- Web: dashboard `(app)\page.tsx`, inbox, taken + detail, command palette, quick capture.
- Mobiel: `app\login.tsx`, `capture.tsx`, tabs index/taken/notities/meer.

**Door mij statisch geverifieerd**
- Web-pagina's `notities`, `kalender`, `projecten`, `ideeen`, `tags`, `komend`, `zoeken` zijn ~500-600 bytes en tonen enkel `EmptyState` (bv. `apps\web\src\app\(app)\notities\page.tsx`, `kalender\page.tsx`).
- Mobiele tab `app\(tabs)\capture-placeholder.tsx` (399 bytes).
- `apps\mobile\app.json`: `extra.apiBaseUrl: "http://localhost:3000"` hardcoded.
- Geen Stripe/IAP-code (grep `stripe|revenuecat|subscription` zonder relevante treffers).

**Alleen beloofd in documentatie** (`docs\ROADMAP.md`): fase 5 notitie-editor, 9 kalender/reminders, 10 offline sync ("schema en klok liggen klaar"), 11 mobile polish, 14 production deployment – allemaal open.

**Ontbreekt voor v1:** notitie-editor, kalender, sync, betaalmodel, hosting/deploy, EAS-config, privacy/ToS. Seed-demo-account met wachtwoord in README (`demo@orbit.app`).
**Juridisch:** laag risico. Markt: verzadigd (Todoist, Things, Notion).
**Rijpheid: 2** – nette architectuur en werkende taken-kern, maar het grootste deel van de beloofde features zijn lege schermen.
**Uren tot v1: 150 / 250 / 400** – op basis van 9 van 14 roadmapfases die nog open of half zijn.

## 3. Assitant (Hikmar AI)

**Inhoud:** `BUSINESS\hikmar_ai_business_plan.docx`, `files (3)\hikmar_landing.html`, `hikmar_startup_kit.docx`, `railway\files\hikmar_deploy\backend\{main.py, Procfile, railway.toml, requirements.txt, pwa\index.html, manifest.json, sw.js}` + dubbele zips (`files (3).zip`, `railway\files.zip`, `hikmar_deploy.zip`). Alles van 12/03/2026. Stack: FastAPI + statische PWA. Mobiel: PWA (manifest + service worker). Tests: geen. Deploy: Railway-config aanwezig.

**Statisch geverifieerd** (`railway\files\hikmar_deploy\backend\main.py`)
- "Smart home" is een in-memory dict (r.~60: "in-memory mock — replace with real HA API later"), geen echte Home Assistant-koppeling.
- Keyword-routing naar Claude (`claude-sonnet-4-6`), GPT-4o of Gemini 1.5 Flash.
- `CORSMiddleware(allow_origins=["*"])`, geen authenticatie, geen rate limit → iedereen met de URL verbruikt je API-krediet. `/status` toont welke keys gezet zijn.
- Geen gebruikers, geen opslag, geen betaling.

**Alleen in docs:** business plan / startup kit (.docx, niet inhoudelijk gelezen).
**Rijpheid: 1** – demo-chatbot met mock-domotica. Functioneel overlapt met BrainVoice/Alfred; geen reden om dit apart door te zetten.
**Uren tot v1: 80 / 150 / 250** (in praktijk: archiveren).

## 4. resume-roaster

**Stack:** Vite + React 19 + Tailwind 4 frontend; Express 5 server (`server.js`) met multer + pdf-parse + Anthropic SDK (`claude-sonnet-4-20250514`). Mobiel: nee (responsive web). Tests: geen. Deploy-config: geen (wel `dist\` build aanwezig). Laatste wijziging 31/03/2026. `.env` (127 bytes) aanwezig en in `.gitignore` – niet gelezen.

**Statisch geverifieerd**
- Eén API-route `POST /api/roast`: tekst of bestand (PDF/tekst, max 5 MB) → prompt → `JSON.parse` van modeloutput → JSON naar client. SPA-fallback.
- Componenten `src\components\ResumeInput.jsx`, `RoastResult.jsx`, `LoadingState.jsx`.
- `cors()` open, geen rate limit, geen auth, geen betaling; `JSON.parse` zonder schema-validatie (faalt bij markdown-omhulde output → 500).

**Ontbreekt:** betaal-/credits-model (Stripe), rate limiting/abuse-bescherming, privacybeleid en bewaarbeleid voor CV's (persoonsgegevens, GDPR), hosting, outputvalidatie.
**Rijpheid: 3** – werkende kernroute met echte AI, verder kaal.
**Uren tot v1: 20 / 40 / 70** – klein oppervlak; Stripe Checkout + rate limit + privacy + deploy. Commercieel: sterk concurrerend nichetje.

## 5. railclaim

Zie verificatietabel hierboven. **Stack:** Next.js 16 (App Router), next-intl NL/FR, Tailwind 4, Supabase (Postgres/Auth/RLS), zod, pdf-lib, pino, Sentry; deps voor Stripe/Resend. Mobiel: README noemt "mobile-first PWA", maar geen manifest in `src\app`. Tests: 7 testbestanden (unit + PGlite-integratie), `PROGRESS.md` claimt 114 tests; `test:e2e` (Playwright) script zonder config of tests. CI: `.github\workflows\ci.yml`. Laatste wijziging 29/08/2026. `.env.local` (286 bytes) aanwezig, niet gelezen.

**In code aanwezig:** compensatie-engine `src\lib\compensation\{calculate,rules,verified-rules}.ts`, iRail-client, crypto (AES-256-GCM, `src\lib\crypto.ts`), honesty-guard (`src\lib\honesty-guard.ts`, voorkomt beloftes van automatisch indienen), seed-script `scripts\seed-rules.ts`, sterk onderbouwd onderzoek `docs\nmbs-regels.md`, `docs\irail.md`, 3 ADR's.
**Ontbreekt:** auth-UI, profiel/IBAN-invoer, trajecten-CRUD, worker, detectie, claim-UI/PDF, Stripe, e-mail, privacybeleid.
**Juridisch/ethisch:** goed doordacht (geen indiening namens klant, geen My-NMBS-credentials, geen rijksregisternummer); IBAN/MoBIB = gevoelige persoonsgegevens. Afhankelijk van iRail fair use (`docs\irail.md`: 2 requests/rit/dag). Verdienmodel beperkt: gebruiker moet zelf indienen.
**Rijpheid: 1** – solide fundament en regels, nul gebruikersroutes.
**Uren tot v1: 120 / 180 / 280** – fases 1-4 volgens `PROGRESS.md`.

## 6. parking-guard + parking-brussel-helper (groep "Parking Brussel")

### parking-guard (meest recent: 29/08/2026, maar minst bruikbaar)
**Stack:** Next.js, Prisma/PostgreSQL (embedded dev-DB `.devdb\` ~1.400 bestanden, verklaart 67 MB), next-auth beta, pino, zod. Mobiel: nee (mobile-first web). Tests: 1 bestand (`tests\unit\submission-policy.test.ts`, 16 tests volgens PROGRESS). `.env` (4,4 KB) aanwezig, niet gelezen. Er staat een `.next\`-map (eerdere build).
**In code:** `src\app\page.tsx` (registry-overzicht), `src\app\api\health\route.ts`, `src\domain\municipality\submission-policy.ts` (verzendblokkade), `src\server\municipalities.ts`, Prisma-schema (23 KB) + seed met 19 gemeenten. `src\domain\alerts\` en `appeals\` bevatten alleen README.
**Alleen beloofd:** Live Alerts (crowdsourced scanauto's), boete aanvechten, wizard, OCR, Mollie-betalingen, dossier-PDF, admin (`README.md` status-tabel: "nog te bouwen" / "NOT AVAILABLE").
**Juridisch:** eigen onderzoek (`PROGRESS.md`, ADR 0005) stelt vast dat bij **18 van 19 gemeenten niet namens de gebruiker ingediend kan worden**; Brussel-Stad vereist eID + pincode. Crowdsourced scanauto-alerts zijn juridisch/ethisch gevoelig (ontwijken van handhaving). Identiteitsdocumenten uploaden = zware GDPR-last.
**Rijpheid: 1.** **Uren tot v1: 150 / 250 / 400.**

### parking-brussel-helper (14/07/2026)
**Stack:** `index.html` + `app.js` (15 KB) + `styles.css`, alles in `localStorage`. Mobiel: nee. Tests/deploy: geen.
**Statisch geverifieerd:** dossiers aanmaken/bewaren (`createCase`, `loadCases`, `persistCases`), checklist, briefgeneratie voor bezwaar (`buildFineLetter`) en plaatwijziging (`buildPlateLetter`), scenario's (`applyScenario`), zone-info, links naar officiële parking.brussels-pagina's. Geen netwerkcalls.
**Ontbreekt:** alles rond verkoop (accounts, betaling, hosting); juridische check van de brieftekst ("geen juridisch advies" staat in README).
**Rijpheid: 2** – bruikbare lokale tool, geen product.
**Uren tot v1: 15 / 30 / 60** (als gratis lead-magnet/PWA); betaald model weinig geloofwaardig.

**Overlap:** beide richten zich op parking.brussels-dossiers (bewonerskaart/plaatwijziging). Helper werkt vandaag; parking-guard is de "grote" herstart zonder bruikbare flow.

## 7. rentguard (+ `rentguard\src.zip`, `coude\rentguard-pro.zip`)

**Versies**
| Variant | Datum | Omvang | Vaststelling |
|---|---|---|---|
| `rentguard\` (map) | bestanden 29/08/2026 | 126 bestanden, 1,3 MB | Fase 0-2 af volgens `PROGRESS.md` |
| `rentguard\src.zip` | 05/10/2026 | 148 entries, alleen `src/` | Snapshot van src; nieuwste entries 29/08 → vrijwel gelijk aan map |
| `coude\rentguard-pro.zip` | 06/10/2026 01:14 | 237 entries (374 KB) | **Waarschijnlijk meest recent/compleet**: bevat o.a. `src/lib/billing/plans.ts`, `fulfil.ts`, `fulfil.test.ts`, `Dockerfile`, `render.free.yaml`, `docs/DEPLOY-RENDER-FREE.md`, `docs/LAUNCH-CHECKLIST.md`, 8 migraties, `supabase/tests`, `tests/integration`, 84 bestanden onder `src/app` (map: 28). Niet uitgepakt → inhoud niet geverifieerd. |

**Stack (map):** Next.js (App Router, `src\middleware.ts`), Supabase (auth, storage, RLS op 25 tabellen), Anthropic vision (`src\lib\vision\anthropic.ts`), PDF-generatie (`src\lib\pdf\*`), e-mail (`src\lib\email\send.ts`), aangetekende zending-adapter (`src\lib\mail\digiconnect.ts`). Mobiel: PWA (`src\app\manifest.ts`). Tests: 11 testbestanden (PROGRESS claimt 159). CI: `.github\workflows\ci.yml`.

**In code aanwezig (map)**
- Auth: `src\app\[locale]\(auth)\login|register` + `actions.ts`, `src\app\auth\callback\route.ts`, `src\lib\auth\require-user.ts`.
- Woningen: `properties\` (lijst, nieuw, detail, edit, actions).
- Plaatsbeschrijving: `inspections\new`, `inspections\[id]`, wizard `src\components\inspections\inspection-wizard.tsx`, foto-upload met SHA-256/EXIF (`src\lib\evidence\hash.ts`, `api\inspections\[id]\photos`), PDF-rapport (`api\inspections\[id]\report`).
- Check-out & AI-vergelijking: `api\inspections\[id]\compare` (paart foto's, download uit storage, vision-analyse), `comparison\page.tsx`, `comparison-report` PDF.
- Verhuurder-medeondertekening via token: `src\app\[locale]\landlord\[token]\*`.
- Entitlements-laag `src\lib\billing\entitlements.ts` (FREE_TIER/SUBSCRIPTION/ONE_OFF) – toekenning "in de Stripe-webhook", maar **die webhook bestaat niet in de map** (geen Stripe-route; alleen env-status `src\lib\env.ts` en kolommen in `src\lib\supabase\types.ts`).

**Alleen beloofd/documentatie:** fase 3 (waarborg-engine & brieven), 4 (huurprijs/indexatie-auditor), 5 (contractscanner, assistent, betalingen, launch) – leeg in `PROGRESS.md`. `README.md` is verouderd ("UI nog niet gebouwd") t.o.v. PROGRESS en code.
**Ontbreekt (map):** Stripe checkout/webhook, wachtwoordherstel, brieven (templates staan op `PLACEHOLDER`, `src\lib\supabase\types.ts:32`), juridische review, privacy-DPIA (`docs\privacy.md` noemt 7 open vragen).
**Juridisch:** hoog – raakt huurrecht, waarborg en bewijswaarde; README eist juristreview vóór de eerste gebruiker; foto's van woningen + persoonsgegevens verhuurder (GDPR). Goede guardrails aanwezig (`src\lib\legal\forbidden-terms.ts`, disclaimer).
**Rijpheid: 3** (map) – werkende kernroute check-in → check-out → AI-vergelijking → PDF met auth; geen betaling. Pro-zip mogelijk 3-4, niet geverifieerd.
**Uren tot v1: 80 / 140 / 220** – laag als pro-zip billing/deploy echt af heeft; plus externe juristkosten.

## 8. brandstofprijzen.html (TankSlim)

**Stack:** één HTML-bestand (1.640 regels, 27/03/2026), Leaflet, Google Fonts, Firebase (auth + Firestore, dynamische import), EmailJS. Mobiel: nee (responsive). Tests/deploy: geen.
**Statisch geverifieerd**
- NL: ANWB-API met **hardcoded key** `ANWB_KEY` (r.1325), fallback via `corsproxy.io` (r.1457).
- BE: **scraping van carbu.com** `stationList` via `corsproxy.io` (r.1469-1471) – ToS-risico en breekbaar.
- LU: stations uit Overpass met **random gegenereerde prijzen** (`Math.random`, r.1498) – fictieve data getoond als prijs.
- FR: officiële open data `data.economie.gouv.fr` (r.1509) – legitiem.
- Fallback "Overpass + demo prices" (r.1438-1440).
- Hardcoded Firebase-config met apiKey (r.1041; Firebase web-keys zijn semipubliek, maar Firestore-rules onbekend).
- Gebruiker moet zelf Firebase/EmailJS-keys invullen in instellingen (r.977-1016) → niet consumentklaar.
**Rijpheid: 2** – werkt deels met echte data (NL/FR), BE via scraping, LU nep.
**Uren tot v1: 40 / 80 / 150** – vereist legitieme BE-bron (bv. officiële FOD Economie maximumprijzen of licentie), backend i.p.v. corsproxy, keys server-side. Verdienmodel (ads/affiliates) zwak t.o.v. gratis apps (Carbu, ANWB).

---

## Overkoepelende observaties
- Patroon: veel projecten (railclaim, parking-guard, rentguard, orbit) hebben uitstekende fase-0-documentatie, ADR's en tests, maar stoppen vóór de gebruikersroutes en de betaalroute. Geen enkel project in deze set heeft een werkende betaalintegratie in de uitgepakte code.
- Meest kansrijk binnen €10k / weinig handwerk: **rentguard** (kernflow staat, en de pro-zip lijkt billing/deploy toe te voegen – eerst uitpakken en verifiëren) en **resume-roaster** (klein, snel af, maar lage moat). BrainVoice is technisch het rijkst maar vraagt een grote scope-reductie + multi-tenant + IAP + device-tests.
- Archiveren-kandidaten: Assitant (mock), parking-guard (juridisch geblokkeerd kernbelofte), TankSlim (scraping + nepdata).
