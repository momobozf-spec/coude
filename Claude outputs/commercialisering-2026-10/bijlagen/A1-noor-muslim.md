# A1 – Audit Noor- en Muslim-projecten (map `coude`)

Basispad: `C:\Users\mo-bo\OneDrive\Documenten\coude\`
Methode: alleen statisch lezen/zoeken via remote-device tools (PowerShell `Get-ChildItem`/`Select-String`, `read_file`). **Niets is runtime getest, gebouwd of geïnstalleerd.** Testsuites zijn geteld, niet gedraaid. `.env`- en `cookies.txt`-bestanden zijn niet inhoudelijk gelezen (alleen aanwezigheid genoteerd; bij noor-club enkel sleutelnamen/lengtes).
Datum audit: 23-10-2026.

## Samenvattende tabel

| project | groep | stack | rijpheid 0-5 | uren-tot-v1 (L/B/H) | grootste blokkade |
|---|---|---|---|---|---|
| noor-club | Kids-leren (Noor) | Next 15, Prisma/Postgres, NextAuth v5, Stripe, Resend, next-intl | 3 | 60 / 100 / 160 (+ contentproductie) | Alle PDF's, audio en covers zijn placeholders; Stripe-flow nooit met testsleutels doorlopen; privacy/voorwaarden leeg |
| kleine-qamar | Kids-leren (Noor) | Eén gebundelde React-HTML (Vite single-file) + statische wachtlijstpagina (Brevo) | 2 | 80 / 140 / 220 | Geen backend, betaling of accounts; unlock-code staat in client; verhalen niet nagekeken |
| noor-tracker | Kids-leren (Noor) | Next 14, Prisma (SQLite!), NextAuth v5, Stripe, Resend, PWA | 3 | 30 / 50 / 80 | SQLite i.p.v. Postgres (niet Vercel-geschikt), geen privacy/voorwaarden, minimale webhook |
| noor-app | Kids-leren (Noor) | Expo 54 / expo-router | 1 | 60 / 100 / 160 | Pure UI-schil: knoppen zonder acties, hardcoded data, verzonnen statistieken |
| printable-generator ("Noor Printables") | Kids-leren (Noor) – backend van noor-app | Next 16, Prisma 7 + SQLite/libsql, Stripe (+Connect), pdfkit, Printful, Circle | 2 | 40 / 80 / 140 (na herscoping) | Feature-wildgroei met mocks (e-mail, Circle, books), geen privacy/voorwaarden, SQLite |
| noor-growth-funnel | Kids-leren (Noor) – marketing | Statische HTML/JS, localStorage | 1 | 4 / 8 / 16 | Leads blijven in de browser van de bezoeker |
| noortrackter | – | leeg | 0 | n.v.t. | Lege map (0 bestanden) – typfout-duplicaat van noor-tracker |
| muslim-kids-club | Kids-leren (los concept) | vinext/Cloudflare (OpenAI "Sites"-starter) | 1 | n.v.t. (overbodig) | Alleen landingspagina; login/registratie-formulier doet niets |
| Salaat | Gebedstijden | Expo 51 RN + losse `salaat-times.html` | 1 | 20 / 35 / 60 | Niet buildbaar: ontbrekende dependencies en assets, gemengde routers |
| muslim-life | Lifestyle | Next 16, Prisma 7, Postgres | – (vervangen) | – | Oudere kopie van muslim-life-pro |
| muslim-life-pro | Lifestyle | Next 16, Prisma 7 + pg, Auth.js, Stripe-adapter, AI (Anthropic/OpenAI/mock), Docker, CI, Render | 4 | 30 / 60 / 100 | Religieuze content + vertalingen niet nagekeken; ledendeals zonder echte partners (demo-bedrijven) |
| zakat-platform | Zakat | Next 16, Prisma 7 | – (vervangen) | – | Oudere kopie van zakat-platform-pro |
| zakat-platform-pro ("Barakah") | Zakat | Next 16, Prisma 7 + pg, Auth.js v5, worker, Docker, CI, Render | 4 | 40 / 70 / 120 (incl. betalingen) | Geen betalingen; regelset moet door geleerde bevestigd; dagelijkse goud/zilverprijs is handwerk |
| halal-scanner | Halal | Next (PWA-bedoeld), Prisma/Postgres, Open Food Facts | 2 | 80 / 130 / 200 | Geen auth, OCR alleen fixture, community/favorieten/profiel "Coming soon"; classificatie vraagt religieuze review |
| halal-home | Halal / vastgoed | Next, Prisma/Postgres, Auth, AI-adapters, Docker | 3 | 120 / 200 / 320 | Woningdata alleen fixture (geen echte bron), geen betalingen, geen privacy/voorwaarden terwijl het ID's/loonfiches bewaart |

Rijpheid: 0 = idee/leeg, 3 = werkende kernroute met mock/placeholder-data, 5 = verkoopklaar met betaling.
Urenschatting = bouwen/afmaken door één ervaren dev, exclusief externe kosten (jurist, geleerde, illustrator, stemopnames) tenzij vermeld. Gebaseerd op wat statisch ontbreekt t.o.v. een verkoopbare v1.

---

## Verificatie van eerdere AI-beweringen

| Bewering | Oordeel | Onderbouwing |
|---|---|---|
| **Noor App: in het profielscherm hebben login- en upgradeknoppen geen gekoppelde actie** | **Bevestigd** (en breder) | `noor-app\app\(tabs)\profile.tsx`: `<TouchableOpacity style={styles.loginBtn}>` en `<TouchableOpacity style={styles.upgradeBtn}>` hebben geen `onPress` en geen `Link`. Hetzelfde geldt voor alle 6 menu-items in hetzelfde scherm en alle 9 game-tegels in `app\(tabs)\games.tsx`. `Link` wordt in profile.tsx geïmporteerd maar niet gebruikt. Er bestaat ook geen `(auth)`-route, terwijl `app\_layout.tsx` er een `Stack.Screen name="(auth)"` voor declareert. |
| **Noor Club: betaalcode aanwezig, maar verschillende PDF's bevatten nog placeholders** | **Bevestigd – erger: álle PDF's** | Betaalcode: `noor-club\src\app\api\stripe\webhook\route.ts` verwerkt `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.payment_failed` (r. 214-264). PDF's: alle 5 bestanden in `noor-club\private\assets\` (1 KB elk) bevatten alleen titel + ondertitel + de tekst "Noor Club - placeholder" (gelezen met read_file, o.a. `2026-09-wudu\amina-and-the-shining-droplets.pdf`). Ze worden gegenereerd door `scripts\generate-placeholders.mjs` (`buildPdf`). Ook alle 26 MP3's in `public\audio\` (elk 15 KB) zijn volgens README stille placeholders, en de covers/badges-SVG's komen uit hetzelfde script. |
| **Kleine Qamar: afzonderlijk HTML-prototype dat overlapt met de Noor-projecten (vandaag 23-10 aangemaakt)** | **Bevestigd** | `kleine-qamar\app\index.html` (214 KB, één gebundelde React-app) en `kleine-qamar\wachtlijst\index.html` (30 KB), map en bestanden aangemaakt/gewijzigd 23-10-2026 17:01. Overlap met Noor Club: zelfde doelgroep (moslimkinderen, jonge leeftijd), zelfde bouwstenen (verhalen, Arabische letters, memory/koppelen, bismillah/alhamdulillah, sterren/badges, gezinsabonnement "Plus") en zelfs het woord *qamar* zit in de WORDBUILD-game van Noor Club (`content\2026-08-eerste-stappen\games\wordbuild.json`). Geen gedeelde code. |
| **…check of muslim-kids-club hetzelfde concept is** | **Gedeeltelijk** | Zelfde productidee (islamitisch leren voor kinderen, verhalen, missies, badges, ouderdashboard, abonnement €9,99/m volgens `muslim-kids-club\app\page.tsx`), maar Engelstalig, 3-12 jaar, en het is uitsluitend een marketingpagina op een OpenAI "Sites"/vinext-starter (`README.md` = starter-README, `db\schema.ts` leeg). Login/registratie-dialoog doet alleen `e.preventDefault(); setDialog(null)`. Geen content. |

---

## Content-inventaris (wat bestaat echt?)

| Project | Verhalen | Tekeningen/kleurplaten | Audio | Overig |
|---|---|---|---|---|
| noor-club | 1 verhaal *aangekondigd* ("Amina en de glinsterende druppels") – PDF is placeholder, **0 echte verhaalteksten** | 0 echt (covers 2 + badges 2 SVG gegenereerd) | 26 MP3's, **alle stil/placeholder** | 2 maandpakketten met 10 spellen in JSON (5 engines), echte tekst in NL/EN/FR/DE + Arabisch. Wudu-pakket: 5 werkwoorden-paren, 5-staps volgorde, quiz (9 KB JSON) |
| kleine-qamar | **7 korte verhalen** met volledige tekst NL + FR (titels ook AR): gedeelde dadels, wachten op iftar, glimlach, vijf gebeden, sorry, soep voor buurvrouw, Eid. 2 gratis, 5 "Plus". Alle 7 `reviewed:!1` (false) | **6 SVG-kleurplaten** (lantaarn, moskee gratis; hilal, dadelpalm, Eid-cadeau, Koranstandaard Plus) | Geen bestanden; voorlezen via browser `speechSynthesis` | 2 spellen (Memory, Arabische letters) + gebeden-quizvragen |
| noor-app | 0 | 0 | 0 | 9 game-namen als tegels zonder implementatie |
| printable-generator | blog-artikelen in `src\lib\blog.ts` (14 KB, niet beoordeeld) | Werkbladen worden **runtime gegenereerd** met pdfkit (`src\lib\pdf.ts`: coloring/maze/wordsearch) + `templates.ts` | `game-sounds.ts` (geluidseffecten) | `names-quiz-data.ts` (99 Namen van Allah, 7 KB); `content\` en `data\` mappen zijn leeg |
| noor-tracker | 0 | 0 | 0 | 15 gewoontes (`src\lib\habits.ts`) |
| muslim-life-pro | 0 | 0 | 0 | 15 dagelijkse items: 7 Koranverzen, 5 hadith, 3 dua's (`prisma\seed\content.ts`) met bronverwijzing; 20 demo-bedrijven (fictief, deels "(demo)") |
| zakat-platform-pro | 0 | 0 | 0 | Regelset (2,5 %, 85 g goud, 595 g zilver), kennisbankartikelen op `IN_REVIEW`, 1 demo-goed doel ("Demo Waterbron (voorbeeld)") |
| halal-scanner | 0 | 0 | 0 | 11 E-nummers, 30 ingrediënten met 162 aliassen, 4 certificeerders (JAKIM, BPJPH, Halal Correct, HFA) zonder geïmporteerde uitspraken |
| halal-home | 0 | 0 | 0 | Checklists, Vlaamse kostregels, 3 demo-financieringsaanbieders, begrippenlijst |

**Conclusie content:** echte, publiceerbare kindercontent bestaat vandaag alleen in kleine-qamar (7 korte verhalen + 6 kleurplaten) en in de spel-JSON van noor-club. Er bestaat nergens één echte geïllustreerde PDF of één echte stemopname.

## Religieuze inhoud die door een geleerde gecontroleerd moet worden

1. **noor-club** – wudu-pakket: `content\2026-09-wudu\games\sequence.json` noemt *niyyah* als stap 1 en stopt na "gezicht wassen" (5 van de stappen; armen, hoofd, oren, voeten ontbreken – bewust ingekort of fout?); `quiz.json` doet uitspraken over wat *sunnah* is (o.a. aantal keer gezicht wassen) en over niyyah; `eerste-stappen\games\sequence.json` ("zo eet je zoals de Profeet ﷺ het ons leerde"). Arabische teksten met harakat (salaam, bismillah, alhamdulillah, lichaamsdelen) moeten op spelling/vocalisatie gecontroleerd worden – door encoding in de PowerShell-output kon ik de Arabische tekens niet zelf verifiëren.
2. **kleine-qamar** – 7 verhalen met religieuze uitspraken (bv. "Allah houdt van mensen die geduld hebben", "een glimlach is ook sadaqa", ziekenbezoek, Eid-gebed, vijf gebeden). De app belooft letterlijk *"Elk verhaal wordt vóór publicatie nagelezen door een imam. Profeten worden nooit afgebeeld."* terwijl alle 7 verhalen `reviewed:false` staan → misleidende claim zolang niet nagekeken. Ook de kleurplaat "Koranstandaard".
3. **printable-generator** – 99 Namen-quiz (`src\lib\games\names-quiz-data.ts`), blogartikelen.
4. **muslim-life-pro** – 15 verzen/hadith/dua's incl. gradering; AI-assistent (prompts in `src\server\modules\assistant\prompts.ts` verbieden fatwa's en verzonnen bronnen – goed – maar output blijft risicovol).
5. **zakat-platform-pro** – regelset, nisab-keuze, aftrekbare schulden, kennisbank; README en `docs\LAUNCH-CHECKLIST.md` vragen zelf om bevestiging door een geleerde met naam en datum.
6. **halal-scanner** – classificatie HARAM/MUSHBOOH per ingrediënt/E-nummer (meningsverschillen tussen madhhabs/certificeerders); naamgebruik van echte certificeerders.
7. **halal-home** – shariah-status van financieringsproducten (CERTIFIED/REVIEWED…).
8. **noor-tracker / Salaat / noor-app** – laag risico (gebedsnamen, gewoontes, berekeningsmethodes).

---

# Per project

## 1. noor-club — `coude\noor-club`
*Meest complete kids-product. Laatste wijziging 16-08-2026, 1221 bestanden excl. node_modules (waarvan ~1000 in `.pgdata`, lokale PGlite-database).*

**Stack:** Next.js 15.5 (App Router), TypeScript strict, Prisma 6 + PostgreSQL (lokaal PGlite), NextAuth v5 beta, next-intl (nl/en/fr/de), Stripe 18, Resend + react-email, zod. Mobiel: PWA (iconen, "zet op beginscherm", iOS-audiohandling) – geen Expo/Capacitor. Deploy: `vercel.json` (cron `/api/cron/daily` 07:00). Tests: **geen** testbestanden gevonden (README spreekt van "de suite controleert…", maar er is geen `*.test.*`/`*.spec.*`).

**1. In code aanwezig**
- Routes: `src\app\[locale]\(app)\` account, kinderen, kind/[childId], ouder, pakket/[slug], paspoort/[childId], spel/[gameSlug], e-mail-bevestigen; `(auth)\` login, register, wachtwoord-vergeten, wachtwoord-herstellen; `(marketing)\` landing, privacy, voorwaarden.
- API: `api\stripe\webhook`, `api\asset\[assetId]` (afgeschermde downloads), `api\account\export` (AVG), `api\cron\daily`, `api\health`, `api\auth\[...nextauth]`.
- 5 spel-engines in `src\components\games\` (MATCH, SEQUENCE, QUIZ, LISTEN, WORDBUILD); content-gedreven via `content\*.json` + seed met zod-validatie.
- Rate limiting in DB, gehashte tokens, e-mailverificatie, 7 funnel-events (`src\lib\track.ts`).
- Prijsmodel: €1 eerste maand, daarna €79/jaar.

**2. Door mij geverifieerd (statisch)**
- Webhook-switch bevat de 5 Stripe-events (r. 214-264 `route.ts`).
- Alle 5 PDF's = placeholder (zie verificatietabel). Alle 26 MP3 = identiek 15 KB (placeholder volgens README).
- `privacy\page.tsx` en `voorwaarden\page.tsx`: alleen `TODO(jurist)`-lijsten (r. 27-47).
- `.env`: `STRIPE_PRICE_ANNUAL`, `STRIPE_PRICE_TRIPWIRE`, `RESEND_API_KEY` hebben waarde van 2 tekens (dummy); README bevestigt dat `STRIPE_SECRET_KEY` een dummy is.
- README-inconsistentie: noemt `/api/cron/trial-reminder`, terwijl alleen `/api/cron/daily` bestaat.
- `2026-09-wudu` heeft volgens README een vervroegde releasedatum voor testen ("Zet dit terug bij livegang").

**3. Alleen beloofd in documentatie**
- "Getest op vijf breedtes" en iOS-audiogedrag: niet verifieerbaar, geen tests in repo.
- Stripe-flow: README zegt zelf "het enige onderdeel dat nog niet aantoonbaar werkt" (`docs\stripe-runbook.md`).

**4. Ontbreekt voor verkoopbare v1**
- Echte content: illustraties/werkbladen (5 PDF), verhaaltekst + illustraties, 26 stemopnames (Arabische uitspraak!), covers/badges; en een plan voor elke maand een nieuw pakket (= terugkerend handwerk, botst met "minimaal handwerk").
- Stripe end-to-end test met testsleutels; productie-Postgres (Supabase); Resend-domein.
- Privacy/voorwaarden door jurist (kinderdata, art. 8 AVG ouderlijke toestemming).
- Religieuze review (zie boven).
- Tests.

**Risico's:** persoonsgegevens van kinderen (naam, leeftijdsgroep, voortgang) → AVG; religieuze correctheid; herroepingsrecht digitale inhoud (checkbox is gebouwd).
**Rijpheid: 3** – kernroute (account → kind → spel → paspoort → paywall) is volledig gebouwd, maar alle media zijn placeholders en betaling is niet getest.
**Uren tot v1: 60 / 100 / 160** voor techniek (Stripe-test, deploy, legal-pagina's integreren, tests, fixes) + contentproductie die niet in uren-dev te vangen is (illustrator, stem, geleerde).

## 2. kleine-qamar — `coude\kleine-qamar`
*Aangemaakt 23-10-2026. 2 bestanden.*

**Stack:** één zelfstandige HTML met gebundelde React (Vite single-file; `<meta name="claude:viewport-fit-sides">` wijst op Claude-artifact-export), Google Fonts; wachtlijstpagina met Brevo-formulier (`sibforms.com`-endpoint, `fetch(FORM_ENDPOINT, { mode: 'no-cors' })`). Talen NL/FR/AR. Mobiel: nee (geen service worker, geen manifest). Tests: geen. Deploy-config: geen.

**1. In code aanwezig**
- 7 verhalen, 6 SVG-kleurplaten (inkleurbaar), Memory, "Vind de Arabische letter", gebedenquiz, sterren-systeem, ouderinfo, taalkeuze, voorlezen via `speechSynthesis`, voortgang in `localStorage`.
- "Plus"-vergrendeling met testcode: `const Kp=["QAMAR-BETA-2027"]` – **client-side**, dus door iedereen te omzeilen.

**2. Door mij geverifieerd**
- Alle verhalen `reviewed:!1`; `free:!0` alleen voor 2 verhalen en 2 kleurplaten.
- Tekst "Zet Kleine Qamar op je startscherm voor gebruik zonder internet" terwijl er geen service worker/manifest in het bestand zit (0 treffers) → werkt niet offline.
- Geen prijs ("De prijs maken we bekend bij de lancering").

**3. Alleen beloofd** – imam-review van elk verhaal; offline gebruik; gezinsabonnement.
**4. Ontbreekt** – backend, accounts, betaling, server-side entitlement, echte audio, PWA/app-store-verpakking, privacy/voorwaarden, religieuze review, broncode (alleen een gebundeld bestand – onderhoudbaarheid onduidelijk; bronproject niet gevonden in deze map).
**Risico's:** misleidende imam-claim; kinderdoelgroep.
**Rijpheid: 2** – leuk speelbaar prototype met echte content, maar zonder enige commerciële infrastructuur.
**Uren tot v1: 80 / 140 / 220** – afhankelijk van of het op noor-club's backend wordt gezet (dan laag) of een nieuwe app wordt (hoog).

## 3. noor-tracker — `coude\noor-tracker`
*Laatste wijziging 02-05-2026, 76 bestanden.*

**Stack:** Next.js 14, TypeScript, Tailwind, Prisma met **SQLite** (`prisma\schema.prisma`: `provider = "sqlite"`, `url = "file:./dev.db"`) – README beweert PostgreSQL. NextAuth v5 (credentials + Google), Stripe, Resend, PWA (`public\manifest.json`, `sw.js`, `offline.html`). Deploy: `vercel.json` (security headers, cron wekelijkse mail). Tests: geen.

**1. In code** – login/register, dashboard, kind toevoegen, dagelijkse gewoontes (`dashboard\[childId]\today`), voortgang, instellingen, UpgradeModal, Stripe checkout/portal/webhook, wekelijkse e-mail-cron, rate limit (in-memory), 15 gewoontes (10 gratis/5 Pro).
**2. Geverifieerd** – webhook verwerkt alleen `checkout.session.completed` en `customer.subscription.deleted` (geen `updated`/`payment_failed` → wanbetalers blijven Pro tot opzegging). `allowDangerousEmailAccountLinking: true` bij Google. Rate limit is in-memory (werkt niet op serverless). `.env` en `cookies.txt` staan in de projectmap (inhoud niet gelezen; risico als dit ooit gecommit wordt).
**3. Alleen in docs** – PostgreSQL; prijs €4,99/m.
**4. Ontbreekt** – Postgres-migratie, privacy/voorwaarden (geen route), completere webhook, tests, AVG (kindgegevens).
**Rijpheid: 3** – volledige kernroute met betaling, maar DB-keuze maakt deploy op Vercel onmogelijk zonder aanpassing.
**Uren: 30 / 50 / 80.**

## 4. noor-app — `coude\noor-app`
*Laatste wijziging 05-04-2026, 22 bestanden.*

**Stack:** Expo 54, expo-router 6, React Native 0.81, react-query, AsyncStorage. `eas.json` aanwezig (dev/preview/production), bundle-ID `com.noorprintables.app`. Mobiel: ja (Expo). Tests: geen. Een web-export staat in `dist\`.

**1. In code** – 5 tabs: home, games, prayer, profile, worksheets. `src\lib\api.ts` wijst naar `https://noorprintables.com/api` (= backend printable-generator; endpoints `/games/score` en `/games/leaderboard` bestaan daar).
**2. Geverifieerd**
- Login-/upgradeknoppen, menu-items en game-tegels zonder handler (bevestigd).
- `prayer.tsx`: hardcoded tijden + "Amsterdam" ("Demo times – in productie gebruik GPS").
- `worksheets.tsx`: alleen tekst, geen generator.
- `index.tsx`: link naar `/academy` die niet bestaat; verzonnen statistieken "10K+ Families", "500+ Werkbladen".
- Alle schermen `// @ts-nocheck`; stijlen verwijzen naar `colors.text.primary.primary` / `colors.bg.primary.surface` die niet bestaan (`primary` is een string) → stijlen vallen weg zonder compileerfout.
- `gamesAPI` wordt nergens aangeroepen.
**4. Ontbreekt** – vrijwel alles: auth, betaling (in-app purchase vereist voor App Store bij digitale content!), echte games, werkbladen, gebedstijden.
**Rijpheid: 1** – klikbare UI-schil.
**Uren: 60 / 100 / 160** (zwaar afhankelijk van backend-keuze; IAP-integratie inbegrepen).

## 5. printable-generator ("Noor Printables") — `coude\printable-generator`
*Laatste wijziging 02-05-2026, 257 bestanden excl. node_modules; 10 migraties allemaal op 01-04-2026.*

**Stack:** Next 16, React 19, Prisma 7 met SQLite/libsql (`dev.db`), NextAuth v5, Stripe 21 (+ Stripe Connect voor marketplace), pdfkit, Resend, Printful (boeken), Circle (community), Bunny (video). Deploy: `vercel.json`. Tests: geen. README = standaard create-next-app; uitleg zit in `BUSINESS.md`, `PLATFORM.md`, `DOCS.md`.

**1. In code** – PDF-generator (`api\generate` + `src\lib\pdf.ts`, 3 activiteiten, gebruikslimiet per plan), Stripe checkout/portal/webhook (2 webhook-routes: `api\stripe\webhook` én `api\webhooks\stripe`), academy (cursussen, certificaten, admin-upload), Ramadan-challenge, marketplace met sellers/payouts, white-label voor scholen, Printful-boeken, 10 games, gebedstijden, referral, blog, SEO-landingspagina's.
**2. Geverifieerd (mocks/TODO)**
- `src\lib\emails\send.ts:15` – e-mail is mock (`console.log("[Email Mock]")`).
- `src\lib\circle.ts:50,80` – Circle mock.
- `src\app\books\create\page.tsx:31` – "Mock worksheet IDs for demo".
- `src\components\community\RecentActivity.tsx:14` – mock data.
- `api\webhooks\stripe\route.ts:305,315` – TODO downgrade/waarschuwingsmail; `api\stripe\invoice-request\route.ts:67` TODO.
- Geen privacy- of voorwaardenroute in `src\app`.
**3. Alleen in docs** – business-claims in BUSINESS.md/PLATFORM.md niet beoordeeld als bewijs.
**4. Ontbreekt** – scope terugbrengen (marketplace/white-label/Printful/academy zijn elk een product op zich), Postgres, echte e-mail, juridische pagina's, tests.
**Risico's:** marketplace = uitbetalingen aan derden (Stripe Connect KYC, aansprakelijkheid); kinderdata; 99 Namen-content.
**Rijpheid: 2** – de generator-kern + Stripe lijkt werkend, maar het geheel is breed en half-gemockt.
**Uren: 40 / 80 / 140** na herscoping tot "generator + abonnement".

## 6. noor-growth-funnel — `coude\noor-growth-funnel`
4 bestanden (14-04-2026). Statische landingspagina + intakeformulier; leads in `localStorage` (`app.js:129,137`), export CSV/JSON. README zegt zelf dat koppeling aan Mailchimp/Supabase/Stripe nog moet. **Rijpheid 1. Uren 4 / 8 / 16** (formulier naar Brevo/Resend koppelen, privacyverklaring – vraagt naam, e-mail, telefoon).

## 7. noortrackter — `coude\noortrackter`
Lege map (0 bestanden), aangemaakt 29-07-2026 op hetzelfde moment als noor-tracker. **Rijpheid 0.** Verwijderen.

## 8. muslim-kids-club — `coude\muslim-kids-club`
*07/08-08-2026, 47 bestanden (incl. `dist\` build).*
**Stack:** vinext (Cloudflare) via OpenAI Sites-starter (`.openai\hosting.json`, `app\chatgpt-auth.ts`), Drizzle/D1 optioneel (schema leeg). Tests: 1 (`tests\rendered-html.test.mjs`, controleert alleen landingsteksten).
**In code:** één landingspagina (`app\page.tsx`) met prijs €9,99/m, "7 days free"; login/join-modal zonder backend.
**Alleen in docs:** `docs\PRODUCT.md` (5 lessen, 10 quizzen, 5 verhalen, 5 games, Stripe, AI-verhalen) en `docs\DATA_MODEL.md` – niets daarvan gebouwd.
**Risico:** "Loved by growing families" / "parent approved" – ongefundeerde claims.
**Rijpheid 1.** Concept overlapt met noor-club en kleine-qamar; niet apart verder ontwikkelen.

## 9. Salaat — `coude\Salaat`
*11-03-2026, 30 bestanden: `salaat-app.zip`, `salaat-times.html` (32 KB), Expo-project in `salaat-app\salaat-app\`.*
**Stack:** Expo 51 / RN 0.74, `adhan` (berekening), expo-location, expo-notifications, Nominatim reverse geocoding. Bundle-ID placeholder `com.yourname.salaat`. Tests: geen.
**In code:** gebedstijden met 12 methodes, aftelling, Hijri-datum (eigen algoritme), qibla-scherm, notificaties met `adhan.wav`.
**Geverifieerd – niet buildbaar zoals het er staat:**
- Twee navigatiesystemen door elkaar: `index.js` → `App.tsx` → react-navigation, én `app\_layout.tsx` met `expo-router`; `expo-router` staat niet in `package.json`.
- `expo-linear-gradient` en `react-native-svg` worden geïmporteerd in `QiblaScreen.tsx` maar staan niet in dependencies.
- Er is geen `assets\`-map: `icon.png`, `splash.png`, 7 fonts (`_layout.tsx`) en `adhan.wav` ontbreken.
- `notifications.ts` importeert type `PrayerTime`, `prayerTimes.ts` exporteert `PrayerTimes`.
- Nominatim-gebruik vereist naleving van hun usage policy (geen zware productie-load).
**Rijpheid 1.** **Uren 20 / 35 / 60.** Commercieel: verzadigde markt (Muslim Pro, Athan e.d.) – weinig verkoopbaar.

## 10-11. muslim-life & muslim-life-pro — groep "Muslim Life"
- `muslim-life`: 286 bestanden, laatst 05-10-2026; bevat losse `src\app\(app)\app.zip` (39 KB).
- `muslim-life-pro`: genest in `muslim-life-pro\muslim-life-pro\`, 314 bestanden, laatst 06-10-2026. **Superset**: extra migratie `account_security`, forgot/reset-password, `legal\privacy` + `legal\terms`, e-mailintegratie, Dockerfile, `render.free.yaml`, GitHub Actions, scripts (`check-schema-drift`, `bootstrap-admin`), 1 extra integratietest. → **muslim-life-pro is de meest recente en complete; muslim-life is vervangen.**

**Stack (pro):** Next 16, React 19, Prisma 7 + `pg`, Auth.js v5, Radix/Tailwind 4, adhan, zod 4, Vitest (23 unit + 13 integratie), Playwright (1 e2e). AI: Anthropic/OpenAI/mock-adapters (standaard mock). Betaling: stub-provider + Stripe-adapter. Mobiel: nee (responsive web). Deploy: Docker, Render free.

**1. In code** – My Day (gebed, taken, gewoontes, timeline, reflectie), planner, habits, Explore (bedrijven, deals, favorieten, redeem), AI-assistent met streaming en plan-generators, billing (checkout/portal/webhook), privacy-export/-verwijdering, admin (users, businesses, deals, AI-usage, operations), NL/FR/AR met RTL, health/ready.
**2. Geverifieerd** – assistant-prompts verbieden fatwa's en verzonnen bronnen (`prompts.ts:15-27`); scholar-referral-vlag in `conversation.service.ts`; content 7 verzen/5 hadith/3 dua's; demo-bedrijven met deels Britse context ("Seventy-five pounds off… Umrah"). Testen niet gedraaid; README claimt "193 tests green".
**3. Alleen in docs** – 193 groene tests; productieklaar.
**4. Ontbreekt** – review religieuze content + vertalingen (README "Still open"), jurist voor voorwaarden (nu Engels), echte partners voor ledendeals (anders verkoopt Premium weinig), juridische entiteit-gegevens (`LEGAL_ENTITY_*`; checklist noemt "Marhaba Cooperation BV"), merknaamcheck "Muslim Life" (BOIP/EUIPO), Stripe live-test.
**Risico's:** AI over religie; AVG art. 9 (religieuze overtuiging = bijzondere categorie – expliciete toestemming is gebouwd); partnerdeals = commerciële afspraken.
**Rijpheid: 4** – technisch vrijwel verkoopklaar, met betaling en juridische basis; blokkades zijn niet-code.
**Uren: 30 / 60 / 100.**

## 12-13. zakat-platform & zakat-platform-pro ("Barakah") — groep "Zakat"
- `zakat-platform`: 243 bestanden, laatst 09-08-2026, 55 routes, 32 testbestanden.
- `zakat-platform-pro`: 300 bestanden, laatst 05-10-2026, 69 routes, 39 testbestanden (+ e2e), git-repo (1 commit "Barakah"), CI, Render, wachtwoordherstel, sessies, worker. → **pro is de meest recente en complete.**

**Stack (pro):** Next 16, React 19, Prisma 7 + pg, Auth.js v5, Zod 4, Vitest, Playwright, Docker, GitHub Actions, Render free. Mobiel: nee. AI: mock (niet in gebruik).

**1. In code** – zakat-wizard (8 stappen, autosave), nisab-engine (goud/zilver/handmatig), bezittingen/schulden, immutable snapshots, donaties + bewijsstukken (private opslag, signed URL), sadaqah-doelen, goede-doelengids met bron per claim + transparantiescore, Hijri-kalender, herinneringen + worker (e-mail), jaarrapport-PDF, admin-prijzen, AVG-export/-verwijdering, privacy/voorwaarden.
**2. Geverifieerd** – routes bestaan (zie lijst); seed bevat 12 categorieën en één demo-goed doel; `docs\LAUNCH-CHECKLIST.md` bevestigt dat betalingen niet in v1 zitten.
**3. Alleen in docs** – "productieklaar voor gratis plan" (niet getest door mij).
**4. Ontbreekt** – betaalprovider (Mollie/Stripe) + btw-facturatie als je wilt verkopen; review regelset door geleerde; dagelijkse publicatie goud/zilverprijs (handwerk of betaalde API met licentie); echte goede doelen met bronnen (handmatig onderzoek per organisatie); S3-opslag; rate limit is in-memory (1 instantie).
**Risico's:** financiële gegevens (AVG), religieuze regelset, uitspraken over echte goede doelen (reputatie/aansprakelijkheid).
**Rijpheid: 4** – complete kernproduct zonder betaling.
**Uren: 40 / 70 / 120** (incl. Mollie/Stripe + facturatie). Terugkerend handwerk: prijzen + charity-onderzoek.

## 14. halal-scanner — `coude\halal-scanner`
*146 bestanden, laatst 08/09-08-2026; 89 src-bestanden, 30 testbestanden.*
**Stack:** Next.js, Prisma/Postgres, zod-env, Open Food Facts-client, Vitest (+ integratie). README spreekt van PWA, maar geen manifest/service worker gevonden. Docker-compose (alleen db).
**1. In code** – barcode-lookup (`api\products\barcode\[barcode]`), zoeken, analyse-engine (`src\server\halal\engine\` met woordgrens-matching, specifiekste term wint), ingrediënten-scan-flow met OCR-correctiestap, API's voor analyse/refresh.
**2. Geverifieerd** – OCR alleen `fixtureProvider.ts`; echte OpenAI/Azure-providers zijn uitgecommentarieerd (`ocr\index.ts:39-40`). `community`, `profile`, `favorites` = `ComingSoon`-component. Geen auth. README ("Status: Fase 1 afgerond") is verouderd t.o.v. de code.
**4. Ontbreekt** – echte OCR, auth, favorieten, community, PWA/app-verpakking, betaalmodel, juridische pagina's, religieus gevalideerde regelset, echte certificaatdata.
**Risico's:** foutieve halal/haram-uitspraak = reputatie- en aansprakelijkheidsrisico; Open Food Facts-data valt onder ODbL (attributie + share-alike voor afgeleide database); merknamen certificeerders.
**Rijpheid: 2. Uren: 80 / 130 / 200.**

## 15. halal-home — `coude\halal-home`
*1928 bestanden (grotendeels `.devdb` lokale Postgres en `.storage-integration` testbestanden), src laatst 08-09-2026.*
**Stack:** Next.js, Prisma/Postgres, Auth (credentials), AI-adapters (Anthropic/OpenAI, standaard fixture), Docker, Vitest (unit + 13 integratie). `public\*.webmanifest` aanwezig. Mobiel: PWA-manifest, geen app.
**1. In code** – traject/journey per aankoopfase, zoekprofielen + resultaten, woningdetail/vergelijken, financiering (calculators per constructie, vergelijken, quotes, shariah-status met validatie), checklists, documenten (upload/download met signed URL, AI-uitleg met juridische guardrails), notaris-pagina, onboarding, Vlaamse kostregels met geldigheidsvenster.
**2. Geverifieerd** – woningbron alleen `src\server\integrations\property\fixtureSource.ts` (`PROPERTY_SOURCES` default `['fixture']`); documentuitleg default fixture; places default fixture; billing = alleen feature-flags ("Betalingen zijn nog niet geïmplementeerd"); geen privacy/voorwaarden-route; financieringsaanbieders zijn "(demo)". README "Wat er nog niet is" is deels verouderd (documents/notary/neighborhood-modules bestaan al gedeeltelijk).
**4. Ontbreekt** – echte vastgoeddata (Immoweb/Zimmo hebben geen open API; scraping = ToS-risico), betalingen, juridische pagina's, echte financieringspartners.
**Risico's:** bewaart identiteitskaarten, loonfiches, bankafschriften → zware AVG-eisen; uitspraken over shariah-conformiteit van financiering; mogelijk gereguleerd (kredietbemiddeling/advies) als het platform financiering aanbeveelt.
**Rijpheid: 3** – veel gebouwd met fixture-data, maar de kerninput (woningen) ontbreekt.
**Uren: 120 / 200 / 320.**

---

## Groeperingen en aanbeveling per groep (feitelijk)

- **Kids-leren (Noor-familie):** noor-club (meest complete techniek), kleine-qamar (meeste echte content), noor-tracker (los gewoonte-product met betaling), noor-app (lege schil die op printable-generator leunt), printable-generator (brede backend), noor-growth-funnel (marketing), muslim-kids-club (alleen landing), noortrackter (leeg). Vijf overlappende kidsproducten met elk een eigen prijsmodel (€1+€79/j, €4,99/m, €12/m, €9,99/m, "nog bekend te maken"). Logische consolidatie: content van kleine-qamar in de noor-club-backend.
- **Muslim Life:** pro is de versie; muslim-life archiveren.
- **Zakat:** pro (Barakah) is de versie; zakat-platform archiveren.
- **Halal:** halal-scanner en halal-home zijn verschillende producten (geen overlap in code).
- **Salaat:** los, niet buildbaar, verzadigde markt.

## Losse aandachtspunten
- `.env`-bestanden staan in noor-club, noor-tracker, printable-generator (+ `.env.local`), muslim-life, zakat-platform, halal-scanner, halal-home; noor-tracker heeft ook `cookies.txt`. Inhoud niet gelezen (toegang tot noor-tracker `.env` is door de sandbox geweigerd). Controleren dat dit nooit in een publieke repo belandt.
- Meerdere projecten beweren in README "productieklaar"/"tests groen"; dat is hier niet runtime bevestigd.
