# 07 — Plan voor de eerste 30 dagen + technische takenlijst

*Start: maandag 26 oktober 2026 · Einde: woensdag 25 november 2026.*
**Wie:** M = jij · C = Claude · E = extern. **Budgetgrens 30 dagen: max. €1.000 cash** (ruim onder het plafond van €10.000; het model rekent op ± €6.400 startkapitaal voor beide samen in Basis, gespreid over 3–6 maanden).
**Harde regel:** geen verkoop, ads of uitnodigingen naar betalende klanten vóór de beloofde gebruikersroute werkt (poort G2/G4 hieronder). Onderzoek, voorbereiding en bouwen lopen parallel.

> **Update 24-10-2026, G1 uitgevoerd:** de live TED-import werkt vanaf je pc. Alleen op TED haal je ± 1,7 sterke oproepen per maand (± 3,7 met de middelmatige erbij), dus **onder de drempel van 4**. Zie `10-TED-steekproef-G1.md`. Gevolg: week 1 taak 2–3 is gedaan. TK-taken T7 (betaling) en de pilotuitnodigingen (taak 18) worden **uitgesteld** tot stap A (4 weken gratis e-Procurement-profiel tellen) en stap B (vraag aan BOSA) uitwijzen dat er genoeg volume is. Wat blijft doorgaan: de probleemgesprekken (taak 7, met prospectlijst `08-…`) en de code-fixes uit rapport 10. Kleine Qamar wordt het hoofdspoor van deze maand.

## Beslispoorten

| Poort | Wanneer | Criterium (eigen beslisregel) | Bij "nee" |
|---|---|---|---|
| **G1 – TK aanbod** | dag 7 | Live TED-import draait vanaf jouw pc; 90-dagensteekproef geeft per typisch data/BI-profiel **gemiddeld ≥ 4 relevante publicaties per maand** (drempel uit 04-plan) | Heroriënteren (raamcontract-radar als hoofdproduct of NL/TenderNed erbij) of stoppen — vóór er verder gebouwd wordt |
| **G2 – TK pilotroute** | dag 21 | Profiel → wekelijkse digest → portaal → betaallink werkt end-to-end met echte data, op productie-URL | Geen pilotuitnodigingen versturen |
| **G3 – KQ vraag** | dag 28 | Wachtlijstrespons (drempel uit 05-plan, zelf te bevestigen) + 1 reviewer akkoord + naam vrij bij BOIP/EUIPO | App-bouw niet starten; enkel web-prototype behouden |
| **G4 – KQ store** | ná dag 30 (± week 8–10) | App + abonnement goedgekeurd in TestFlight / interne Play-test, 20 nagelezen verhalen | Geen store-lancering |

## Week-per-week

### Week 1 (26/10 – 1/11) — feiten verzamelen, niets verkopen
| # | Taak | Wie | Afhankelijk van | Cash |
|---|---|---|---|---|
| 1 | Prototype Kleine Qamar en wachtlijstpagina **opschonen**: imam-claim en offline-belofte eruit (beide nu onwaar) | C (op kopie, niet in productie), M keurt goed | – | €0 |
| 2 | TenderKompas: `node scripts/ted-live-check.mjs` en `ted:sample` (90 dagen BE) draaien **op jouw pc** (cloudomgeving werd geblokkeerd) | C bereidt commando's voor, M draait | – | €0 |
| 3 | Analyse steekproef: aantal relevante publicaties per profiel (Power BI/Fabric, Databricks, DWH/governance) → **G1** | C | 2 | €0 |
| 4 | Contract Cronos/Digitaal Vlaanderen nakijken op conflict met TenderKompas | M | – | €0 |
| 5 | Boekhouder: offerte extra kost + Peppol-aanpak + boeking store-opbrengsten (⚖️ punten draaiboek) | M | – | €0 (offerte) |
| 6 | D-U-N-S aanvragen voor de BV (doorlooptijd) | M | – | €0 |
| 7 | Probleemgesprekken: 8–10 zaakvoerders van data/BI-bureaus uit je netwerk — **geen verkoop**, enkel "hoe vinden jullie nu opdrachten?" (script in 04) | M | – | €0 |

### Week 2 (2/11 – 8/11) — TK bouwen, KQ valideren
| # | Taak | Wie | Afhankelijk van | Cash |
|---|---|---|---|---|
| 8 | TK technische taken T1–T6 (zie takenlijst) | C | G1 = ja | €0 |
| 9 | KQ: opgeschoonde wachtlijstpagina online op eigen domein; Brevo double opt-in | C bouwt, M zet live | 1, domein | domein ± €15 |
| 10 | KQ: reviewer zoeken (imam/islamleerkracht NL+FR), afspraak vergoeding | M | – | onbekend |
| 11 | KQ: BOIP/EUIPO-zoektocht "Kleine Qamar" | M (of C bereidt zoekopdrachten voor) | – | €0 |
| 12 | KQ: wachtlijst delen in eigen netwerk + 2 moskee/weekendschool-gesprekken (partnerbericht 05) | M | 9 | flyers ≤ €100 |

### Week 3 (9/11 – 15/11) — TK pilotroute af, KQ eerste test
| # | Taak | Wie | Afhankelijk van | Cash |
|---|---|---|---|---|
| 13 | TK T7–T11 (betaling, deploy, scheduler, juridische pagina's) | C | 8 | hosting ± €12/maand |
| 14 | TK: AV/privacy-concepten naar jurist ⚖️ | C concept, M stuurt | 13 | onbekend (model Basis €500) |
| 15 | KQ: Meta-ads tranche 1 (€200) naar wachtlijst — **pas na** pagina live en zonder religie-targeting-tekst | M zet aan, C maakt varianten | 9 | €200 |
| 16 | KQ: Instagram-account + eerste 3 posts (05) | M post, C maakt concepten/beelden | 9 | €0 |

### Week 4 (16/11 – 25/11) — poorten
| # | Taak | Wie | Afhankelijk van | Cash |
|---|---|---|---|---|
| 17 | TK: volledige route testen met echte data → **G2** | C test, M bevestigt | 13 | €0 |
| 18 | TK: bij G2 = ja → 10–15 persoonlijke pilotuitnodigingen (bericht 04), 30 dagen gratis | M verstuurt | 17 | €0 |
| 19 | TK: partnerbericht aan Databricks/Power BI user group-organisatoren | M | 17 | €0 |
| 20 | KQ: evaluatie wachtlijst + reviewer + naam → **G3** | M + C | 9–15 | €0 |
| 21 | KQ bij G3 = ja: start technische taken Q1–Q4; Apple Developer + Google Play-accounts | C, M (accounts) | 20, 6 | ± €110 |
| 22 | Maandrapport: cijfers t.o.v. financieel model, beslissing maand 2 | C | alles | €0 |

**Cash in 30 dagen (max):** domein(en) ± €30 + flyers ≤ €100 + Meta €200 + hosting ± €12 + store-accounts ± €110 + jurist (alleen als offerte goedgekeurd) = **± €450 zonder jurist**, ruim onder de €1.000-grens.

**Jouw tijd in 30 dagen (schatting):** ± 25–30 u (gesprekken, accounts, beslissingen, posts). Claude: ontwikkeling en concepten.

---

## Technische takenlijst — TenderKompas (`coude\tenderkompas`, werk op een branch/kopie)

| ID | Taak | Uren (B) | Definition of done |
|---|---|---|---|
| T1 | Live TED-import vanaf toegestane netwerkomgeving; 6 "ONZEKER"-velden en deadlineformaat corrigeren | 8–20 | `ted-live-report.json` met echte respons; import idempotent |
| T2 | 90-dagensteekproef BE + rapport per profiel (aantallen, voorbeelden) | 4 | Rapport → G1 |
| T3 | Verplichte menselijke review per kans **weghalen**; vervangen door automatische relevantiescore 0–100 + uitleg + bronlink; disclaimer "geen advies" | 8 | Digest zonder handmatige stap |
| T4 | Classificatie op aankondigingstekst (trefwoorden + Haiku-model), testset van 50 gelabelde publicaties | 8 | Precisie/recall gemeten op testset (geen beloofde waarde) |
| T5 | Raamcontract-radar: gunningsberichten (TED contract award notices) data/BI → lijst winnaar, looptijd, waarde | 12 | Pagina in portaal + sectie in digest |
| T6 | Profielen: Solo (1) / Team (3), gebruikerslimieten 2/10, CSV-export (Team) | 6 | Limieten afgedwongen server-side |
| T7 | Stripe Billing: Solo/Team maand/jaar, klantportaal, webhook (checkout, invoice.paid, payment_failed, subscription.deleted), pilot 30 dagen zonder kaart | 16–24 | E2E-test met testsleutels |
| T8 | Deploy: Dockerfile + Render (web + Postgres), omgevingsvariabelen, back-up, health check | 6 | Productie-URL, back-up hersteltest |
| T9 | Scheduler (Render cron) voor wekelijkse import + maandag-digest; SMTP via Resend (domein, SPF/DKIM) | 6 | Digest komt aan in testinbox, niet in spam |
| T10 | Wachtwoordreset per e-mail, account verwijderen + export | 6 | Flows getest |
| T11 | Juridische pagina's, wettelijke vermeldingen, cookiebeleid (enkel functioneel) | 3 | Pagina's live met BV-gegevens |
| T12 | Monitoring + alert bij lege/mislukte import; maandexport Stripe voor boekhouding | 4 | Alert getest |
| T13 | [later] Belgische e-Procurement-publicaties — pas na bevestigde gebruiksvoorwaarden | – | – |
| | **Totaal** | **± 85–105** | (audit: 40/80/140) |

## Technische takenlijst — Kleine Qamar (`coude\kleine-qamar`, nieuw project naast het prototype)

| ID | Taak | Uren (B) | Definition of done |
|---|---|---|---|
| Q0 | Opschonen prototype + wachtlijstpagina (claims) | 1 | Geen onware beloftes meer |
| Q1 | Herbouw als broncodeproject (Expo/React Native — één codebase iOS + Android; Capacitor enkel als Expo niet past). Content uit prototype extraheren naar JSON (NL/FR/AR-titels, `reviewed`-veld) | 30–40 | Alle 7 verhalen, 6 kleurplaten, 2 spellen werken op simulator |
| Q2 | Kleurplaten (SVG inkleuren met vinger), voorlezen via toestel-TTS (NL/FR), sterren/voortgang lokaal | 20–30 | Werkt offline op echt toestel |
| Q3 | Ouderlijke poort (volwassen taak) vóór paywall, instellingen, externe links | 6 | Voldoet aan Apple 1.3 |
| Q4 | In-app abonnement (StoreKit/Play Billing via RevenueCat of native) + "Abonnement beheren" + herstellen aankopen; ⚠️ nagaan of RevenueCat-SDK toegelaten is in Kids-categorie (geen analytics-tracking) | 16–24 | Sandbox-aankoop + herstel op iOS en Android |
| Q5 | Contentpipeline: verhaal alleen zichtbaar als `reviewed=true` met naam/datum; remote content-update zonder app-update | 8 | Niet-nagelezen verhaal verschijnt niet |
| Q6 | Content: 13 extra verhalen (C concept NL+FR, M eindredactie, E review), 9 kleurplaten (geen afbeelding van profeten/sahaba) | content-uren apart (model) | 20 verhalen + 15 kleurplaten nagelezen |
| Q7 | Geen third-party analytics/ads; privacylabels; privacyverklaring NL/FR | 4 | Store-formulieren ingevuld |
| Q8 | Store-assets: icoon, 6 screenshots per taal (briefing in 05), store-teksten NL/FR | 8 | Ingediend voor review |
| Q9 | TestFlight + interne Play-test met 10–20 testgezinnen (uitnodiging 05) | 6 | Bugs opgelost, → G4 |
| Q10 | EAS build/submit-pipeline, crashrapportage zonder third-party tracking (of geen) | 6 | Reproduceerbare build |
| | **Totaal dev** | **± 105–135** + store/IAP | (model Basis 190 u incl. herbouw en marge) |

## Wat Claude níét doet zonder jouw expliciete opdracht
Berichten versturen, posts publiceren, ads activeren, accounts aanmaken of iets kopen, productieomgevingen wijzigen, bestaande projectmappen wijzigen (werk gebeurt op een branch of kopie).
