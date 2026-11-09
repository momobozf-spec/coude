# 01 — Portfolio-overzicht en rangschikking

*Opgesteld 23–24 oktober 2026. Basis: statische code-audit van alle mappen in `coude` (read-only, niets gewijzigd, niets gebouwd of gestart) en onafhankelijk marktonderzoek. Detailrapporten: `bijlagen/A1–A4` (audits) en `bijlagen/M1–M4` (markt).*

## Kort antwoord

| # | Project | Waarom | Eerste beslispunt |
|---|---|---|---|
| **1** | **TenderKompas** → tender- en raamcontract-radar voor Belgische data/BI-teams (B2B, web) | Laagste terugkerend handwerk van alle kandidaten, past bij jouw expertise en netwerk, laag juridisch risico, kleinste startkapitaal (Basis ± €1.900 cash). | Live TED-import + 90-dagensteekproef: levert een typisch data/BI-profiel genoeg relevante publicaties op? |
| **2** | **Kleine Qamar** → Nederlands/Franstalige Islamitische verhalen- en kleurapp voor kinderen (App Store + Google Play) | Enige kandidaat die echt in de app stores thuishoort; er bestaat geen Nederlandstalige concurrent (wel EN/FR); echte content bestaat al (7 verhalen, 6 kleurplaten). | Wachtlijst-respons + religieuze review van de verhalen vóór er gebouwd wordt. |
| Reserve | RentGuard (Brussel, huurders) | Marktscore 14/25, maar juridische grens informatie/advies en lopende Grondwettelijk Hof-zaak. | Alleen na advocaat. |
| Reserve | ImmoRadar-pro → enkel "LeadRevive" op eigen CRM-data van het kantoor | Makelaars betalen aantoonbaar voor prospectie (Realo €89/m add-on), maar FSBO-scraping is juridisch niet verdedigbaar. | Partnerschap/API met Whise of SweepBright. |

> **Update 24-10 (live TED-test, zie 10-TED-steekproef-G1.md):** de TED-import werkt live. Puur op TED zijn er wel te weinig relevante oproepen voor een abonnement (± 1,7 sterke per maand). TenderKompas blijft #1 op handwerk en risico, maar het abonnement hangt nu af van de Belgische nationale publicaties (e-Procurement). Tot dat bewezen is, is Kleine Qamar het actieve spoor.

**Eerlijke kanttekening:** geen enkel project scoort sterk op betaalbereidheid (hoogste marktscore 15/25). Het financiële model toont dat TenderKompas pas bij ± 50 klanten je eigen tijd (€75/u) terugbetaalt, en dat Kleine Qamar aan €24,99/jaar je eigen tijd praktisch nooit terugbetaalt — het is cash-positief vanaf ± 145 betalers, maar blijft een laag-marge product. Kleine Qamar zit in de top 2 omdat jouw doel expliciet een app-store-app is; puur op rendement per uur zou het niet in de top 2 staan.

## Hoe gerangschikt

Vijf marktcriteria (1–5, uit M1–M4): betaalbereidheid · bereikbaarheid · concurrentiedruk (5 = weinig) · onderscheidbaarheid · laag handwerk. Daarnaast: rijpheid van de code (0–5), uren tot verkoopbare v1, logistiek (harde eis: geen), juridisch risico, en past het binnen €10.000.

## Volledige rangschikking

| Rang | Project (canonieke map) | Overlappende versies | Rijpheid | Uren v1 L/B/H | Markt /25 | Oordeel |
|---|---|---|---|---|---|---|
| 1 | tenderkompas | – | 3 | 40/80/140 | 14 | **Top 1** — herpositioneren, prijs €59/€119 |
| 2 | kleine-qamar (+ onderdelen noor-club) | noor-club, noor-tracker, noor-app, printable-generator, muslim-kids-club, Salaat, noor-growth-funnel, noortrackter (leeg) | 2 | 110/190/300 incl. store + in-app aankoop | 13 | **Top 2** — gated |
| 3 | rentguard (`rentguard-pro.zip` is de meest complete versie) | rentguard/src.zip | 3 | 80/140/220 | 14 | Reserve |
| 4 | immoradar-pro (LeadRevive-deel rijpheid 4) | immoradar-belgium, fsbo-lead-radar | 3 | 30/60/120 + jurist | 12 | Reserve B2B |
| 5 | zakat-platform-pro (Barakah) | zakat-platform | 4 | 40/70/120 | 13 | Parkeren: calculators zijn overal gratis; zelf giften innen = PSD2-terrein |
| 6 | resume-roaster | – | 3 | 20/40/70 | n.o. | Parkeren |
| 7 | overnamemarkt | saas-overdracht | 3 | 10/20/40 | n.o. | Parkeren: geen verdienmodel in app |
| 8 | ketelcheck | pompkompas | 3 | 8/15/30 | 10 | Stoppen: gratis Mijn VerbouwBegeleiding + leadvalidatie = handwerk |
| 9 | muslim-life-pro | muslim-life | 4 | 30/60/100 | 9 | Stoppen: Muslim Pro, Pillars, Mawaqit (gratis, standaard in BE-moskeeën) |
| 10 | layali-pro | jamal-jamila | 4 | 15/30/50 | n.o. | Technisch het meest verkoopklaar, maar fysieke voorraad = buiten jouw eis |
| 11 | superette-pro (prijsvergelijker) | superette | 3 | 40/80/150 | n.o. | Stoppen tenzij legale databron (eigen docs zeggen: licentie per keten nodig) |
| 12 | brainvoice | orbit, Assitant | 3 | 120/200/350 | 11 | Geen product: rode oceaan (Todoist Ramble NL/FR, Gemini, Apple Intelligence) |
| 13 | halal-scanner | – | 2 | 80/130/200 | 11 | Stoppen: halal-oordeel uit etiket is niet betrouwbaar te leveren |
| 14 | halal-home | – | 3 | 120/200/320 | n.o. | Parkeren |
| 15 | railclaim | – | 1 | 120/180/280 | 15 | Stoppen: NMBS betaalde in 2024 gemiddeld ± €8 per aanvaarde claim |
| 16 | parking-guard | parking-brussel-helper | 1 | 150/250/400 | 13 | Stoppen: betwisten is gratis |
| 17 | woningalert | huiszoeker | 2 | 150/250/400 | 10 | Stoppen: BE-alerts gratis; huiszoeker scrapet Immoweb |
| 18 | ritna | – | 2 | 250/400/650 | n.o. | Stoppen binnen €10k: voorafgaande erkenning als boekingsplatform in Brussel |
| 19 | sites/brandstofprijzen (TankSlim) | `brandstofprijzen.html` (exacte kopie) | 2 | 40/80/150 | n.o. | Archiveren (carbu.com via corsproxy, LU-prijzen = `Math.random`) |
| 20 | eid-luxe-shop, luxe-store, webshop | – | 2–3 | 40–160 | n.o. | Archiveren (logistiek) |
| 21 | superette-pro (onbemande boetiek) | – | 3 | 200+ en hardware | n.o. | Buiten eis (fysiek) |
| 22 | marhaba-consulting | – | 3 | 2/4/8 | – | Je eigen consultancysite; contactformulier verstuurt niets |
| 23 | marktonderzoek | `onprem online` (kopie) | 3 | – | – | Interne tool |
| 24 | codex, simple-webapp, sites, lokaal, Claude outputs, Nieuw, noortrackter | – | 0–1 | – | – | Starters/tooling/leeg |

*n.o. = niet onderzocht in de marktronde (op basis van audit al afgevallen of buiten de eis).*

## Controle van de voorlopige bevindingen van ChatGPT

| Bewering | Oordeel | Bewijs |
|---|---|---|
| BrainVoice: spraak/taken/agenda/administratie aanwezig; echte toestellen en aankooproute niet bewezen | **Bevestigd — en erger:** er is géén aankooproute (geen RevenueCat/StoreKit/IAP). Single-tenant (één gedeeld server-token), placeholders "Mohamed"/"Fabrice". | `src\platform\voice\VoiceInputService.ts`, `README.md` r.56-62, `docs\DEPLOYMENT.md` r.30/34, geen `projectId` in `eas.json` |
| Noor App: login- en upgradeknoppen zonder actie | **Bevestigd.** Ook 6 menu-items en 9 game-tegels zonder handler; routes `(auth)` en `/academy` bestaan niet; gebedstijden hardcoded Amsterdam; verzonnen cijfers "10K+ Families". | `noor-app\app\(tabs)\profile.tsx`, `games.tsx` |
| Noor Club: betaalcode aanwezig, PDF's met placeholders | **Bevestigd — erger:** alle 5 PDF's zijn placeholders, alle 26 MP3's zijn stil. Stripe-webhook verwerkt 5 events maar is nooit met testsleutels doorlopen. Privacy/voorwaarden = `TODO(jurist)`. | `src\app\api\stripe\webhook\route.ts`, `private\assets\` |
| Kleine Qamar: afzonderlijk HTML-prototype dat overlapt met Noor | **Bevestigd.** Eén gebundeld HTML-bestand (broncode niet gevonden), geen gedeelde code met Noor. Unlockcode staat client-side. De belofte "elk verhaal nagelezen door een imam" is nu misleidend: alle 7 verhalen `reviewed:false`. | `kleine-qamar\` (2 bestanden) |
| TenderKompas: live TED-import niet bewezen | **Bevestigd.** "Geen enkele TED-call is live geslaagd" (bouwomgeving blokkeerde de API). Code en fixtures-tests bestaan; 90-dagensteekproef nooit gedraaid; slechts 1 echte BE-match (deadline verstreken). | `docs/VALIDATIE.md` §1, `docs/STATUS.md`, `src/lib/ted/client.ts` |
| RailClaim: vooral fundament, routes ontbreken | **Bevestigd.** Alleen landingspagina + healthcheck; `/register` (CTA) bestaat niet; `src\worker\` is leeg; geen Stripe-checkout. | `PROGRESS.md`, `src\app\[locale]\page.tsx` |

## Onderscheid: wat bestaat, wat is getest, wat is beloofd, wat ontbreekt — top 2

| | TenderKompas | Kleine Qamar |
|---|---|---|
| **In code aanwezig** | Next.js 16 + Drizzle/Postgres (25 tabellen), better-auth, beheer- en klantportaal, TED-client op het echte endpoint, AI-extractie met citaatverificatie, beoordelingsengine, digest-rendering, 5 testbestanden | 7 verhalen NL+FR, 6 inkleurbare SVG's, Memory, Arabische letters, gebedenquiz, sterren, voorlezen via browser-TTS, voortgang in localStorage, wachtlijstpagina (Brevo) |
| **Door mij/agents geverifieerd** | Statisch: endpoint + paginering in `client.ts`; geen betaal-dependency; geen deploy-config. **Niets runtime getest.** | Statisch: `reviewed:false` op alle verhalen; geen service worker/manifest (dus niet offline, ondanks belofte); unlockcode client-side. **Niets runtime getest.** |
| **Alleen beloofd in docs** | "18/18 security-checks", SMTP-integratietest (rapportbestanden bestaan, niet herhaald); prijs €299 | Imam-review, offline gebruik, gezinsabonnement |
| **Ontbreekt voor v1** | Live TED-run, betaling, deploy + scheduler + SMTP, wachtwoordreset, raamcontract-radar, weghalen van verplichte review per kans, privacy/AV | Broncode/herbouw, app-verpakking (Expo of Capacitor), in-app abonnement, ouderlijke poort, offline, 13 extra verhalen + 9 kleurplaten, religieuze review, privacy (kinderen), merkcheck |

## Opruimadvies (niet uitgevoerd)

- **Beveiliging vóór je `push-to-github.ps1` draait:** `.env`, `dev.db` (met demo-admin-wachtwoorden), `cookies.txt` staan in o.a. jamal-jamila, luxe-store, superette(-pro), noor-tracker, overnamemarkt. Brandstofprijzen bevat Firebase-config en een ANWB-key client-side; marktonderzoek heeft een wachtwoord-fallback in `server.js` r.18. Controleer `.gitignore` per project.
- **Kandidaten om naar `coude-archieven` te verplaatsen** (jouw beslissing): jamal-jamila, eid-luxe-shop, luxe-store, webshop, simple-webapp, onprem online, Nieuw, noortrackter, superette (oud), muslim-life (oud), zakat-platform (oud), immoradar-belgium, fsbo-lead-radar, noor-app, Salaat, muslim-kids-club, codex.
- **Entiteit:** layali-pro staat op "Marhaba Cooperation BV", je facturatie-BV is Marhaba Data & AI Agent BV. Kies per product bewust één verkopende entiteit (zie draaiboek).
