# Audit A3 — B2B, vastgoed, lead-gen, marktplaatsen (coude)

Datum: 2026-10-23. Bron: `C:\Users\mo-bo\OneDrive\Documenten\coude\<project>` (alle paden hieronder relatief tegenover die map).
Methode: alleen statisch lezen en zoeken via remote-device tools (PowerShell `Get-ChildItem`/`Select-String`, `read_file`). **Niets is gebouwd, gestart of runtime getest.** Testresultaten die hieronder vermeld worden, komen uit de documentatie van het project zelf, niet uit een eigen run.

## Samenvatting

| project | groep | stack | rijpheid 0-5 | uren-tot-v1 (L/B/H) | grootste blokkade |
|---|---|---|---|---|---|
| tenderkompas | B2B-tenders | Next.js 16, Drizzle/Postgres, better-auth, Anthropic SDK, nodemailer | 3 | 40 / 80 / 140 | Live TED-import nooit geslaagd; aanbod-volume voor BE-data/BI onbewezen (1 match, afgesloten) |
| immoradar-pro | Vastgoed-leadgen (meest recent) | Next.js, Prisma 7/Postgres, Telegram, Docker, Render | 3 (LeadRevive-deel: 4) | 30 / 60 / 120 (code) + juridisch | Geen toegestane databron; GDPR-risico op contactgegevens particuliere verkopers |
| immoradar-belgium | Vastgoed-leadgen (oud) | idem | 2 | n.v.t. (archiveren) | Vervangen door immoradar-pro |
| fsbo-lead-radar | Vastgoed-leadgen (oud) | Next.js, Prisma, cheerio, Telegram | 2 | n.v.t. (archiveren) | Volgens README opgegaan in immoradar-pro |
| woningalert | B2C-woningzoeker | Next.js, next-intl, Prisma 7, Auth.js, BullMQ/Redis, Resend | 2 | 150 / 250 / 400 | Fase 3–6 (bronnen, matching, notificaties, betaling) niet gebouwd; geen legitieme bron |
| huiszoeker | B2C-woningzoeker (backend) | Fastify, Prisma, cheerio, Anthropic/OpenAI, node-cron | 2 | 120 / 200 / 320 | Afhankelijk van scrapen Immoweb/Zimmo (ToS); geen UI, geen betaling |
| ketelcheck | Warmte-leadgen | Statische site + Google Apps Script (Sheet als DB) | 3 | 8 / 15 / 30 | Nooit in echte Apps Script gedeployed; deployment-ID placeholder; geen partners getekend |
| pompkompas | Warmte-leadgen | 1 statisch HTML-bestand (demo) | 1 | 20 / 40 / 70 | Puur klikbare demo, fictieve installateurs, sms-code "1234" |
| ritna | Taxi-marktplaats | Fastify + Postgres monorepo, vanilla-JS webclient | 2 | 250 / 400 / 650 | FakePaymentProvider + StraightLineRouting; erkenning als bemiddelaar Brussel nodig |
| overnamemarkt | Overname-marktplaats | Next.js 16, Supabase (RLS, magic link), Vercel | 3 | 10 / 20 / 40 | Geen verdienmodel/betaling in app; FSMA-vraag open |
| saas-overdracht | Overname-introductiedienst | Markdown-plan + 2 statische HTML-demo's | 1 | 0 (plan zegt: geen app bouwen) | Commissie pas na closing (6–12 mnd); eigen plan noemt het "zwak" als inkomstenbron |
| marhaba-consulting | Eigen consultingsite | Statische HTML/CSS/JS + mini Node-server | 3 | 2 / 4 / 8 | Contactformulier verstuurt niets (maakt lokaal tekstbestand) |
| marktonderzoek | Interne survey-tool | Express + express-session + pg/JSON | 3 (als interne tool) | n.v.t. commercieel | Hardcoded fallback-adminwachtwoord; geen product |
| platformideeen | Onderzoeksdocument | 1 Markdown-bestand | 0 | n.v.t. | Idee; aanbeveling: test beëdigde vertalingen |

**Verificatie eerdere bevinding — TenderKompas "live TED-import nog niet bewezen": BEVESTIGD.** Zie sectie 1.

---

## 1. TenderKompas (`tenderkompas`)

Laatste wijziging 2026-10-23, 138 bestanden (excl. node_modules/.next), alles gebouwd in één nacht (mtimes 01:59–03:36 + 20:28).

### Verificatie eerdere bevinding: **bevestigd**
- `docs/VALIDATIE.md` §1: "**Geen enkele TED-call is live geslaagd.** Tests met fixtures ≠ geslaagde live import." Reden: `api.ted.europa.eu` geblokkeerd door netwerk-allowlist van de bouwomgeving. Velden zijn gecontroleerd tegen officiële OP-TED GitHub-bronnen (status "GEDOCUMENTEERD"), 6 velden blijven "ONZEKER" (o.a. `framework-maximum-value-lot`, `deadline-receipt-answers-*-lot`, `duration-period-*-lot`), deadline-offsetformaat "live te bevestigen".
- `docs/STATUS.md`: "TED-import ... tests met fixtures — **niet live**" en onder "Nog niet aangesloten": "Live TED-import | Netwerktoegang tot api.ted.europa.eu; eerst node scripts/ted-live-check.mjs".
- `docs/TESTRESULTATEN.md` r.31: "Alle TED-tests gebruiken herkenbare TESTFIXTURE-antwoorden ... Er is nog geen enkele live TED-import geslaagd."
- Er bestaat geen `ted-live-report.json` in de projectmap (gezocht met `Get-ChildItem -Recurse -Filter ted-live-report*`: geen resultaat) → het live-checkscript is (in deze map) nooit uitgevoerd.
- De TED-importcode bestaat wél: `src/lib/ted/client.ts` (POST `${base}/v3/notices/search`, base default `https://api.ted.europa.eu`, ITERATION-paginering via `iterationNextToken`, `scope: "ALL"`), `src/lib/ted/importer.ts` (`runTedImport`, `ingestTedNotice`), `src/lib/ted/map.ts`, `fields.ts`, `query.ts`, `sample.ts`; CLI `scripts/ted.ts` (`ted:import`, `ted:sample`, `ted:verify-fields`); losse check `scripts/ted-live-check.mjs`.
- **Wat wel bewezen is (volgens de eigen docs):** mapping, dedup, wijzigingen/intrekkingen, geweigerde velden en cursor tegen fixtures (6 integratietests in `tests/integration/critical-chain.test.ts`, unit in `tests/unit/time-ted-ai-net.test.ts`). **Wat niet:** één echte API-respons, werkelijk veldtype, paginering live, aantal relevante BE-aankondigingen (90-dagensteekproef "Niet uitgevoerd — geen aantallen gerapporteerd").

### In code aanwezig
- Routes: landingpage + aanvraagformulier `src/app/page.tsx`; login `src/app/login`; beheer `src/app/admin/{beoordelingen,bronnen,digests,instellingen,klanten,leads,procedures}`; klantportaal `src/app/portal/{kansen/[id],bronnen,instellingen,profiel}`; API `src/app/api/{auth/[...all],documents/[id],admin/digests/[id]/export}`.
- Auth: better-auth (`src/lib/auth.ts`), DAL/rollen (`src/lib/dal.ts`).
- DB: Drizzle/Postgres, 3 migraties (`drizzle/0000_init.sql` … `0002`), schema `src/db/schema.ts` (25 tabellen volgens STATUS.md).
- AI: Anthropic-extractie met Zod-schema + citaatverificatie `src/lib/ai/{extract,schema,verify}.ts`.
- Domein: beoordelingsengine `src/lib/domain/assessment-engine.ts`, digest-rendering, lifecycle.
- E-mail: nodemailer `src/lib/mailer.ts`; SSRF-veilige fetch `src/lib/net/safe-fetch.ts`; PDF-tekst via `unpdf`.
- Tests: 5 testbestanden (unit + integratie), `scripts/security-check.ts`, `scripts/demo-e2e.ts`.

### Door mij geverifieerd (statisch)
- TED-client gebruikt het echte endpoint en ITERATION-modus (client.ts r.43, 51, 104–118).
- Geen betaal-dependency in `package.json` (geen stripe/mollie).
- Geen Dockerfile of render/vercel-config in de map; `docs/OVERDRACHT.md` beschrijft hosting generiek ("1 kleine container/VM").
- Niets runtime getest door mij.

### Alleen beloofd in documentatie
- "18/18 security-checks geslaagd", "integratietest met echte SMTP-server" (`docs/VALIDATIE.md` §3, `demo-output/security-check-report.json`) — resultaatbestanden bestaan, niet door mij herhaald.
- Werkhypothese €299/maand (`docs/KOSTEN.md` r.24) — onbewezen.

### Ontbreekt voor verkoopbare v1
- Live TED-run + 90-dagensteekproef (bepaalt of er überhaupt genoeg aanbod is).
- Belgische e-Procurement: "Geen gedocumenteerde en toegestane publieke API of export gevonden" (`docs/BRONNEN.md` r.19) → handmatige invoer = terugkerend handwerk.
- Betaling (bewust niet gebouwd), wachtwoordreset per e-mail, .docx-ondersteuning, SMTP-provider, deploy-config, scheduler (geen interne cron).
- Doelgroepvalidatie: 1 echte BE-match (Zorgband Leie & Schelde), deadline verstreken.

### Stack / mobiel / tests / deploy / risico's
Next.js 16 + React 19, geen mobiel. Tests aanwezig. Geen deploy-config. Risico's: AI-samenvattingen van aanbestedingen (aansprakelijkheid bij fout advies, door workflow met verplichte menselijke review gemitigeerd); hoog handwerk per kans (review verplicht).

**Rijpheid 3** — kernroute (profiel → beoordeling → review → digest) werkt met handmatige/fixture-data, maar de automatische bron is niet live bewezen.
**Uren tot v1: 40 / 80 / 140** — live TED + fixes op onzekere velden (8–20u), deploy+SMTP+cron (8–16u), betaling/abonnement (16–40u), polish/wachtwoordreset (8–24u); hoog als TED-velden of volume tegenvallen.

---

## 2. Groep vastgoed-leadgen: ImmoRadar-pro / ImmoRadar-belgium / FSBO Lead Radar

**Meest recent en compleet: `immoradar-pro`** (laatste mtime 2026-10-05, 136 src/test-bestanden, 10 testbestanden incl. Playwright `e2e/accounts.spec.ts`, git-repo met commits "ImmoRadar pilot", "Gratis testopstelling Render", "Fix startcommando Render", `.github`, `render.yaml`, `render.free.yaml`, `Dockerfile`).
`immoradar-belgium` (mtime 2026-08-31, 108 bestanden, 6 tests) is een oudere versie zonder `/team`, `/account`, `/privacy`, `/voorwaarden`, `/inactief`, e2e en deploy-map.
`fsbo-lead-radar` (mtime 2026-08-16, 69 bestanden, 8 tests) is de voorloper; `immoradar-pro/README.md`: "FSBO Lead Radar is volledig in dit project opgegaan ... De aparte map fsbo-lead-radar mag naar het archief."

### In code aanwezig (immoradar-pro)
- Dashboardroutes `src/app/(dashboard)/{alerts,analytics,imports,leadrevive,market,opportunities/[id],pipeline,properties,properties/[id],settings,team,territories}`; admin `src/app/admin/{agencies,health,sources}`; publiek `(public)/privacy`, `(public)/voorwaarden`; `login`, `account`, `inactief`.
- Collectors: `src/collectors/{base/httpClient,jsonld,rateLimiter,robots}.ts`, `demo/demoMarketCollector.ts`, `fixture/fixtureCollector.ts`, `reference/jsonLdFeedCollector.ts`. **Geen collector voor een echte site.**
- CRM (LeadRevive): `src/crm/{crmMatcher,csv,dedupe,dormant,normalizeContact}.ts`, adapter alleen CSV (`src/crm/adapters/csvAdapter.ts`).
- Meldingen: Telegram (dry-run zonder token, volgens README).
- Accountbeheer, lockout, sessie-intrekking, abonnementstatus handmatig in `/admin/agencies` (README "Accounts").

### Door mij geverifieerd (statisch)
- Zoektocht op `immoweb.be|zimmo.be|2dehands|realo|immovlan|logic-immo|biddit|facebook.com|puppeteer|playwright.chromium` in `src` en `scripts` van alle drie: **geen enkele treffer** op een echte vastgoedsite; alleen generieke User-Agent/robots-code. README-claim "geen enkele scraper die een echte site aanraakt" klopt statisch.
- `src/collectors/registry.ts` bevat enkel demo/fixture/reference-collectors.
- Geen online betaalprovider (README "geen online betalingen"; facturatie via boekhouding).
- TODO/FIXME-zoektocht: geen treffers, alleen UI-placeholders in invoervelden.

### Alleen beloofd in documentatie
- "Status: productieklaar (oktober 2026)" (`README.md`) — technisch misschien, maar `docs/LAUNCH-CHECKLIST.md` noemt zelf de databron en juridische review **blokkerend**.
- CI en e2e "zijn er" — workflow-bestanden bestaan, of ze gedraaid hebben is niet nagegaan.

### Ontbreekt voor verkoopbare v1
- **Databron** (blokkerend): betaalde feed/API, portaalpartnerschap of site met toestemming.
- Juridisch (blokkerend volgens checklist): verwerkersovereenkomst, register, DPIA-check, nagelezen privacy/voorwaarden, `LEGAL_ENTITY_ADDRESS`.
- Eventueel CRM-koppelingen voor Belgische makelaarssoftware (nu enkel CSV).

### GDPR / scraping-risico (extra aandacht)
- Datamodel bewaart `SellerIdentity` = contactgegevens van **particuliere verkopers uit publieke advertenties**, **gedeeld over alle kantoren**, bewaartermijn 180 dagen (`docs/privacy.md`, tabel bovenaan). Hergebruik voor telefonische prospectie door makelaars is een klassiek AVG-probleem (doelbinding, art. 14 informatieplicht, recht van bezwaar) plus Belgische regels over ongevraagde telefonische prospectie (Bel-me-niet-lijst). De eigen checklist erkent dit en vraagt juristbevestiging.
- Scrapen van Immoweb/Zimmo/2dehands zou bovendien in strijd zijn met hun gebruiksvoorwaarden en de sui-generis databankenbescherming; het project vermijdt dat bewust.
- **Laagste-risico pad (door project zelf voorgesteld):** verkopen als **LeadRevive** (alleen eigen CRM-bestand van het kantoor; Mohamed = verwerker).

**Rijpheid 3** (immoradar-pro) — volledige app en tests, maar de marktradar draait alleen op demodata; LeadRevive-module apart beschouwd ≈ 4.
**Uren tot v1: 30 / 60 / 120** (code: CRM-adapters, onboarding, deploy-hardening) **+ externe juristkosten**; hoog als een betaalde datafeed geïntegreerd moet worden. immoradar-belgium en fsbo-lead-radar: rijpheid 2, archiveren.

---

## 3. Groep B2C-woningzoeker: WoningAlert / Huiszoeker

Geen echte overlap in code: WoningAlert is een Next.js SaaS-skelet zonder bronnen; Huiszoeker is een backend met bronnen maar zonder UI. Elk dekt de helft.

### 3a. WoningAlert (`woningalert`)
Laatste mtime 2026-08-29, git-log: fase 0, 1, 2.

**In code aanwezig:** auth (register/login/verify/reset/forgot) `src/app/[locale]/(auth)/*`, Auth.js-config `src/server/auth/config.ts`; zoekprofielen `src/app/[locale]/(app)/searches/{new,[id]}`, entitlements/plannen `src/server/entitlements/plans.ts`; e-mail via Resend `src/server/email/**`; worker-skelet `src/worker/main.ts`; Redis `src/server/redis.ts`; i18n NL/FR/EN; Dockerfile + Dockerfile.worker; CI `.github/workflows/ci.yml`; Playwright-config.
**Door mij geverifieerd:** er bestaat **geen** map voor bronnen/ingestion/matching in `src` (directorylijst), `docs/sources.md` bestaat niet; `mollie|stripe` komt alleen voor in `src/lib/env.ts` (env-validatie), niet in een betaalroute; `bullmq` alleen in redis/worker-skelet.
**Alleen in docs:** Mollie, Twilio SMS, WhatsApp, kaart, Sentry (`INTEGRATIONS.md`: allemaal "NOT AVAILABLE"); PROGRESS.md: fase 3–6 "NEXT/TODO".
**Ontbreekt:** woningbronnen (grootste risico, door project zelf zo benoemd), dedup/matching, notificaties, betalingen, admin. Docker en CI "nooit gedraaid" (PROGRESS.md).
**Risico's:** zelfde bronprobleem als hieronder; geen persoonsgegevens van verkopers in huidige code.
**Rijpheid 2** — degelijke basis (auth + profielen) maar de kernwaarde (alerts op nieuwe woningen) bestaat niet.
**Uren tot v1: 150 / 250 / 400** — fasen 3–6 volgens eigen planning; hoog als geen betaalde feed beschikbaar is.

### 3b. Huiszoeker (`huiszoeker`)
Laatste mtime 2026-08-07, 90 bestanden.

**In code aanwezig:** Fastify-API `src/api/routes/{health,searches}.ts` met auth-middleware; CLI `src/cli/index.ts`; AI-parser vrije tekst → criteria `src/ai/searchParser.ts` met Anthropic- en OpenAI-provider; matching `src/services/matchingService.ts`; runner `src/services/searchRunner.ts`; bronnen `src/sources/immoweb/{immowebSource,normalize,urls}.ts`, `src/sources/zimmo/zimmoSource.ts`, fixture-bron; robots-policy `src/sources/base/RobotsPolicy.ts`; Prisma-schema; 6 testbestanden.
**Door mij geverifieerd:**
- `immowebSource.ts`: scrapt zoekpagina's van `https://www.immoweb.be` (pad-URL's), volgt detailpagina's en leest JSON-LD met cheerio; max 3 pagina's per URL; respecteert robots.txt; "staat standaard UIT ... robots.txt is niet hetzelfde als de gebruiksvoorwaarden" (r.21–24).
- `zimmoSource.ts`: "robots.txt was niet op te halen: de host weigert geautomatiseerde requests"; normalisatie "NIET geverifieerd tegen een echte pagina".
- `package.json` bevat `playwright` als dependency (headless browser beschikbaar), al zegt de code geen browser te gebruiken (`requiresBrowser = false`).
- Geen UI/frontend, geen betaling.
**Ontbreekt:** frontend, accounts voor eindgebruikers, betaling, een **legale** bron.
**Risico's:** Immoweb-ToS verbieden geautomatiseerd ophalen/hergebruik; databankenrecht; commercieel uitbaten van een Immoweb-scraper is juridisch het riskantste onderdeel van deze hele groep. Persoonsgegevens: advertenties kunnen namen/telefoons van particuliere verkopers bevatten — bij opslag zelfde AVG-vragen als bij ImmoRadar.
**Rijpheid 2** — werkende backend-kern met tests, maar steunt op een bron die je commercieel niet mag gebruiken en heeft geen UI.
**Uren tot v1: 120 / 200 / 320** — UI + accounts + betaling + vervanging bron.
**Advies groep:** als één B2C-product, dan WoningAlert als basis en Huiszoeker's AI-parser/matching overnemen; maar zonder licentieerbare feed niet starten.

---

## 4. Groep warmte-leadgen: KetelCheck / Pompkompas

Overlap: beide verkopen leads van eigenaars aan installateurs (gasketelvervanging resp. warmtepomp). KetelCheck heeft een echte backend; Pompkompas is alleen een klikdemo. Beide 2026-10-23.

### 4a. KetelCheck (`ketelcheck`)
**In code aanwezig:** statische site NL/FR `web/index.html`, `web/fr/index.html`, `web/privacy.html`, `web/partners.html`, `web/assets/app.js` (validatie, UTM, bot-timing); backend `apps-script/Code.gs` (42 KB) met `doPost`, dedup, rate-limit, partnerroutering op postcode, accept/weiger-links met token (`doGet`/`confirmAction`), 24u-expiry, credits, retentie (`applyRetention`), maandelijks factuurvoorstel (`buildInvoices_`); lokale mock `lokaal/server.cjs` (draait Code.gs in nagebootste Google-omgeving); tests `tests/mock-backend.test.js`, `tests/frontend.test.js`; sales-materiaal `sales/pilotaanbod-en-scripts.md`, partnerlijst xlsx, financieel plan xlsx.
**Door mij geverifieerd:** `web/assets/app.js` r.10: endpoint is placeholder `https://script.google.com/macros/s/VUL_HIER_JE_DEPLOYMENT_ID_IN/exec` → **niet gedeployed**. Privacyverklaring vermeldt Marhaba Data & AI Agent BV + BTW-nummer. Geen online betaling (facturatie via Peppol-software buiten de app).
**Alleen in docs:** README: "Volledig getest in een nagebootste omgeving: 25 mock-tests. In echte Apps Script: nog niets." Testlijst van 13 stappen "NOG NIET UITGEVOERD".
**Ontbreekt:** deploy (2–4u volgens README), echte end-to-end test, getekende pilotpartner, `privacy@JOUWDOMEIN.be` invullen, domein, advertentiebudget.
**Risico's:** persoonsgegevens aanvragers (telefoon/e-mail) in Google Sheet en in Gmail "Verzonden" (README "Bekende beperkingen") → bewaartermijn manueel; erkenning installateurs manueel te controleren. Terugkerend handwerk: README schat zelf 35–90 min per werkdag.
**Rijpheid 3** — complete flow in mock-omgeving, nog nooit live.
**Uren tot v1: 8 / 15 / 30** — gebaseerd op README (deploy 2–4u + 2u e2e) plus fixes na echte test.

### 4b. Pompkompas (`pompkompas`)
**In code aanwezig:** één `index.html` (37 KB) met klantflow (type warmtepomp, postcode, gsm), installateursportaal en beheerscherm, NL/FR.
**Door mij geverifieerd:** banner r.156 "Demo — Werknaam, fictieve bedrijven en aanvragen. Er wordt niets verstuurd"; sms-code hardcoded "1234" (r.237, r.447); vier "Demo"-installateurs (r.331–334); geen `fetch`/backend. Premie- en prijsbedragen hardcoded (r.319–322, r.410–414) — moeten tegen officiële Mijn VerbouwPremie-regels gecontroleerd worden.
**Ontbreekt:** alles behalve UI: backend, echte sms-verificatie, partners, betaling, privacy.
**Rijpheid 1** — klikbaar prototype.
**Uren tot v1: 20 / 40 / 70** — mits KetelCheck's Apps Script-backend hergebruikt wordt (zelfde model).
**Advies groep:** één merk, KetelCheck-backend, Pompkompas-flow als tweede dienst.

---

## 5. Ritna (`ritna`)

2026-10-23, 37 bestanden (excl. node_modules).

### In code aanwezig
- `packages/core/src/{ride-status,pricing,commission,cancellation,geo,money}.ts` + `core.test.ts`.
- `apps/api/src/app.ts` (24 KB Fastify-routes), `services/{rides,operators,admin,accounts}.ts`, `auth.ts` (JWT), `migrations/001_init.sql`, `seed.ts`, `e2e.test.ts` (23 KB).
- Webclient `apps/api/web/{index.html,app.js (39 KB),styles.css}` voor klant/taxibedrijf/chauffeur/beheer.
- `adapters.ts`: `FakePaymentProvider`, `StraightLineRouting` (hemelsbreed × 1,35), `DbNotifier`.

### Door mij geverifieerd (statisch)
- `server.ts` r.16: aparte tak bij `NODE_ENV === 'production'` (README: weigert te starten met dev-adapters).
- **"KBO-check" is alleen een modulo-97-checksum** (`services/operators.ts` r.27–33), geen opzoeking in de KBO/CBE-databank — README's "aanmelden (KBO-check)" is dus zwakker dan het klinkt.
- Seed weigert in productie (`seed.ts` r.9).
- Geen mobiele app (Expo = "fase 3" in README), geen Next.js-dashboard ("fase 2").

### Alleen beloofd in documentatie
- "45/45 tests groen" — testbestanden bestaan, niet door mij gedraaid.

### Ontbreekt voor v1
Echte betaalprovider (Stripe/Mollie Connect, marktplaats + uitbetaling), echte routering, mobiele apps (klant + chauffeur met live locatie), push-notificaties, AV/partnercontract, privacyverklaring (locatiedata), BTW-flow.

### Regelgeving taxi Brussel (bron: Brusselse taxi-ordonnantie van 9 juni 2022, uitvoeringsbesluiten in werking 21 oktober 2022 — samenvatting via [Jubel](https://www.jubel.be/fr/la-nouvelle-ordonnance-sur-les-taxis-une-solution-au-conflit-de-longue-date-au-sein-du-secteur-taxi-bruxellois/); zie ook [omzendbrief Brussel Mobiliteit](https://mobilite-mobiliteit.brussels/sites/default/files/2023-01/Circulaire%20r%C3%A9forme%20taxi.pdf))
- **Boekingstussenpersonen (platformen, dispatch) moeten vooraf erkend zijn** door Brussel Mobiliteit; zij mogen ritten alleen toewijzen aan in Brussel vergunde exploitanten en chauffeurs, en mogen geen exclusiviteit eisen.
- "Straattaxi's" werken enkel via vooraf boeken bij een erkende tussenpersoon, met **gereglementeerde (dynamische) tarieven**; prijs moet vóór de boeking gekend zijn. Ritna's vaste prijs vooraf past daarbij, maar de vrije tarieven per vervoerder (`pricing.ts`) moeten binnen de gereglementeerde min/max vallen — **niet geverifieerd in code**.
- Vergunningen zijn quota-gebonden, persoonlijk en niet overdraagbaar → Ritna moet per vervoerder/chauffeur vergunningsdocumenten controleren (documentflow bestaat in `services/admin.ts`/`operators.ts`, inhoudelijke checks manueel).
- Het Grondwettelijk Hof sprak zich in 2024 uit over deze ordonnantie ([arrest 154/2024](https://www.const-court.be/public/f/2024/2024-154f-info.pdf)); impact niet nagegaan — laten checken door jurist.
- Concurrentie: Uber en bestaande centrales zijn al erkende spelers.

**Rijpheid 2** — sterke domeinkern + API met tests en webclient, maar betaling, routing, apps en erkenning ontbreken.
**Uren tot v1: 250 / 400 / 650** — Connect-betaling + payouts (40–80), routing (10–20), twee Expo-apps met live locatie (150–350), compliance/ops-tooling (50–150). Plus erkenningstraject (doorlooptijd onbekend). Binnen €10k budget en "weinig handwerk" is dit het minst passende project (24/7 dispatch-support, tweezijdige marktplaats).

---

## 6. Groep overnames: Overnamemarkt / SaaS Overdracht

Overlap: `saas-overdracht/markt/index.html` is een demo-marktplaats met hetzelfde concept als `overnamemarkt`; `saas-overdracht/introductie-demo/index.html` demonstreert de introductiedienst. **Overnamemarkt is de enige echte app.**

### 6a. Overnamemarkt (`overnamemarkt`)
**In code aanwezig:** `app/page.tsx` (aanbod + filters), `app/aanbod/[id]` (detail + interesseformulier), `app/verkopen`, `app/account`, `app/beheer` (admin-review/publiceren), `app/login` + `auth/callback` (Supabase magic link), `app/privacy`, `app/voorwaarden`, `app/hoe-het-werkt`, `robots.ts`, `sitemap.ts`; validatie `lib/validation.ts` (zod); `supabase/migrations/0001_init.sql` (RLS); tests `tests/rls.test.ts`, `tests/validation.test.ts`; security-headers in `next.config.mjs`/`proxy.ts`.
**Door mij geverifieerd:** bestandsstructuur komt overeen met README-tabel; geen betaal-dependency. Er staat een `.env.local` in de map (niet geopend; bevat vermoedelijk Supabase-sleutels — niet committen).
**Alleen in docs:** RLS-garanties ("niemand kan zichzelf admin maken") — tests bestaan, niet gedraaid.
**Ontbreekt:** verdienmodel in de app (geen listingfee, geen succesfee, geen betaling — "bewust niet in versie 1"), e-mailmeldingen bij interesse, eigen SMTP, juridische check (README: "of het in contact brengen van kopers en verkopers van (aandelen van) bedrijven onder FSMA-regels valt ... nog niet bevestigd").
**Risico's:** FSMA/makelaarsregels bij bemiddeling in aandelenoverdrachten; verkoperscijfers niet gecontroleerd; handmatig doorsturen van elke interesse = terugkerend handwerk.
**Rijpheid 3** — werkende kernroute, deploybaar op Vercel+Supabase in ±1u volgens README, maar zonder inkomstenstroom.
**Uren tot v1: 10 / 20 / 40** — Stripe-listingfee of betaalde "featured" plaatsing + meldingen + SMTP.

### 6b. SaaS Overdracht (`saas-overdracht`)
Bevat `docs/startplan-introductiedienst.md` (40 KB), `introductie-demo/index.html` en `markt/index.html` — beide met banner "Demo: niets wordt verstuurd of opgeslagen" / "Demo-marktplaats. Geen betalingen".
Kernconclusies uit het plan: "als snelle, zelfstandige inkomstenbron is dit zwak"; Acquire.com-referral = 25% van 6–8% closing fee ≈ 1,5–2% van verkoopprijs; 6–12 maanden tot eerste euro; break-even ≈ $11.200 commissie; **"Geen app bouwen"**, eerst 30 dagen valideren (max 25u, €150).
**Rijpheid 1** — plan + demo's. **Uren tot v1: 0** (dienst, geen software). Risico: dezelfde FSMA-vraag; afhankelijk van partnervoorwaarden Acquire.

---

## 7. Marhaba Consulting (`marhaba-consulting`)
Laatste mtime 2026-10-05. Statische site (`index.html`, `styles.css`, `app.js`, `favicon.svg`), lokale preview-server `server.mjs` (127.0.0.1:3015).
**Geverifieerd:** contactformulier (`app.js` r.63–71) maakt een lokaal projectbrief-bestand en meldt "er is nog geen aanvraag verstuurd" — geen backend/mail. Interactieve voorbeelden zijn illustratief ("geen behaalde klantresultaten", README).
**Ontbreekt:** echte contactroute (Formspree/mailto/Apps Script), hosting + domein, juridische vermeldingen (ondernemingsnummer in footer niet gecontroleerd).
**Rijpheid 3** (als marketingsite; geen verkoopbaar product). **Uren: 2 / 4 / 8.**

## 8. Marktonderzoek (`marktonderzoek`)
Laatste mtime 2026-05-03. Express-survey "Marktbevraging - Islamitische Webshop" (`survey.html` titel), resultaten/admin achter sessie-login, opslag Postgres of `data/responses.json`, `render.yaml` aanwezig.
**Geverifieerd:** `server.js` r.18 bevat een **hardcoded fallback-adminwachtwoord** en r.21 een fallback-`SESSION_SECRET` als env-vars ontbreken → beveiligingsrisico bij deploy zonder env. `data/responses.json` (1,8 KB) bevat echte/test-antwoorden — persoonsgegevens mogelijk, niet in publieke repo zetten.
**Rijpheid 3** als interne tool; geen commercieel product. Hoort bij Jamal & Jamila-onderzoek, niet bij deze verkoopbaarheidsvraag.

## 9. Platformideeën (`platformideeen/platformideeen-belgie-top3.md`)
Onderzoeksdocument van 2026-10-23, 10 ideeën gescoord, met bronnen.
- **Top 3:** (1) **Beëdigde vertalingen + legalisatieroute** Brussel, startniche Arabisch/Marokkaanse akten → NL/FR (snelste eerste betaling; aanbieders in openbaar register; ~€21,60 bijdrage per bestelling vóór eigen tijd, aanname); (2) **NL-bijles** voor kinderen van anderstalige ouders in Brusselse Nederlandstalige scholen (grootste platformpotentieel, herhaalomzet, risico op weglekken); (3) **Boekhouder-matching** voor Brusselse starters in eigen taal (beste economie per aanvraag, €60/aanvraag per boekhouder, aanname).
- **Afgevallen:** vastgoedattesten (KBC/Dewaele bieden het al), grafonderhoud; laag: flexi-job-shifts (NOWJOBS/AnyShift), rijscholen (Belgische erkenningsregels), Umrah-vergelijker (Nusuk rechtstreeks, pakketreisregels).
- **Eindaanbeveling:** eerst beëdigde vertalingen testen, 30 dagen, €600, doel ≥10 betaalde bestellingen en ≤15 min werk per bestelling; anders boekhouder-matching naar voren. Alle drie vragen eerst alleen een landingspagina + betaling, geen app.
- Alle financiële cijfers zijn expliciet als aanname gelabeld.
**Rijpheid 0** (geen code).

---

## Overkoepelende conclusies
1. **Dichtst bij verkoopbaar met weinig code:** KetelCheck (8–15u tot live pilot) en Overnamemarkt (10–20u, maar verdienmodel ontbreekt). Beide vragen wel dagelijks handwerk.
2. **Technisch sterkst maar juridisch geblokkeerd:** ImmoRadar-pro. Verkoop als LeadRevive (eigen CRM-data kantoor) is de enige route zonder databron- en AVG-blokkade.
3. **TenderKompas:** goede techniek, maar live bron en marktvolume onbewezen; eerst `scripts/ted-live-check.mjs` en `npm run ted:sample` draaien vóór verdere investering.
4. **Niet doen binnen €10k / weinig handwerk:** Ritna (erkenning + twee apps + 24/7 operatie), Huiszoeker/WoningAlert (geen legale bron).
5. **Archiveren:** immoradar-belgium, fsbo-lead-radar (vervangen door immoradar-pro); Pompkompas-flow samenvoegen met KetelCheck.
6. Geen van de projecten in deze groep heeft een Expo/Capacitor-app; alleen Ritna plant er een.
