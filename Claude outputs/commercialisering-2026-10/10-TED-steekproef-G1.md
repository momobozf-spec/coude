# 10 — Beslispoort G1: live TED-test en 90-dagensteekproef (TenderKompas)

*Uitgevoerd op 24-10-2026 rond 00:15 vanaf jouw pc (Windows, Node 24). Read-only: het script `scripts/ted-live-check.mjs` en een eigen steekproefscript (`data/sample.mjs`) zijn gedraaid vanuit een tijdelijke map. **Niets in `coude\tenderkompas` is gewijzigd.** Ruwe data: `data/ted-be-90d-raw.json`, `data/ted-live-report.json`, `data/ted-probe.json`; gelabelde lijst: `data-ted-steekproef.csv`.*

## 1. Technische resultaten (de allereerste live TED-calls)

| Test | Resultaat | Gevolg voor de code |
|---|---|---|
| Verbinding `api.ted.europa.eu/v3/notices/search` | ✅ werkt vanaf je pc | De blokkade zat alleen in de bouwomgeving |
| Velden | 31/41 geaccepteerd. De 10 "geweigerde" velden kregen **HTTP 429 (Too Many Requests)**; ze zijn dus niet afgewezen, maar het script vroeg te snel (400 ms pauze) | Veldtest opnieuw met ≥ 1,5 s pauze. `client.ts` heeft al backoff + Retry-After ✅ |
| Velden die geaccepteerd werden maar nooit gevuld waren | `deadline-receipt-request-*`, `change-description`, `framework-maximum-value-lot`, `deadline-receipt-answers-date-lot` (in de 5 voorbeelden) | Niet als verplicht behandelen |
| **ITERATION-paginering met `SORT BY … ASC`** | ❌ **HTTP 400:** `Syntax error in expert query … extraneous input 'ASC' expecting <EOF>` | **Bug in productie:** `src/lib/ted/query.ts` r.26 plakt `" SORT BY publication-number ASC"` achter elke query, dus elke import faalt. Fix: `ASC` weglaten (of de juiste TED-syntax gebruiken); zonder sortering werkt ITERATION wel (token aanwezig) |
| Deadlineformaat | Datum mét offset in de datum zelf: `"2026-11-22+01:00"`, tijd `"15:00:00+01:00"` | Parser moet de offset uit de datum strippen vóór het combineren |
| Twee-fase-procedures | Vaak alleen `deadline-receipt-request-date-lot` (aanvraag tot deelneming), geen indieningsdatum | Beide deadlines tonen |
| Wijzigingen/intrekkingen | 1.658 BE-wijzigingsberichten en 142 intrekkingen (EU-breed) op 90 dagen | Ontdubbelen per `procedure-identifier` is essentieel: dezelfde procedure kwam tot **6×** terug (bv. Vlaamse Overheid, AI-kennisplatform) |

## 2. Volume (België, 90 dagen: 25-07 → 23-10-2026)

| Selectie | Aantal publicaties |
|---|---|
| Alle BE-publicaties in TED | 5.371 |
| CPV 72* (IT-diensten) | 462 |
| CPV 48* (software) | 188 |
| IT/software of data-trefwoord (breed filter) | 865 |
| Met een data/BI-kernwoord in titel of beschrijving | 39 |

## 3. Handmatige relevantiebeoordeling (door Claude, op titel + beschrijving)

Na ontdubbeling per procedure:

| Niveau | Unieke procedures (90 d) | Per maand | Voorbeelden |
|---|---|---|---|
| **Sterk** — kernopdracht voor een data/BI-bureau | **5** | **± 1,7** | De Watergroep (VMW): raamovereenkomst support BI/dataplatform · Parkeersagentschap: implementatie datawarehouse · Digipolis Antwerpen: "RO DA Flexibel Schaalbaar" (Power BI) · VLAIO: raamcontract ICT-profielen (BI, data science) · International Post Corporation: Data Product Mesh |
| **Middel** — deels relevant | 6 | ± 2 | EC DG SANTE European Health Data Space · Vlaamse Overheid: AI-gemedieerd kennisplatform, modelintegratie · Sibelga: observability/dashboards · IBFFP: onderhoud BI-licenties · Mouscron: datagovernance-oplossing |
| **Radar** — gunningen (wie won wat) | 19 publicaties | ± 6 | Vooral Infrabel e-Market (individuele profielen: Data Analyst, Senior Data Engineer, SAP BI), SPW IT-missies, EC DG GROW BI Services, Smals, Partena (Customer Data Platform) |

**Beperking:** veel aankondigingen hebben alleen "zie bestek" als beschrijving; de relevantie zit dan in de bestekdocumenten. Dit telt dus vooral wat zichtbaar is op aankondigingsniveau, en de echte relevantie kan iets hoger liggen. Ook bevat TED alleen opdrachten **boven de Europese drempels**; kleinere Belgische opdrachten staan enkel nationaal op e-Procurement.

## 4. Beslissing G1 (jouw eigen beslisregel: gemiddeld ≥ 4 relevante publicaties per maand per typisch profiel)

**Uitkomst: NEE voor een digest op basis van alleen TED.** Je haalt ± 1,7 sterke oproepen per maand, of ± 3,7 als je de middelmatige meetelt. Een abonnement van €59 per maand verkoop je daar niet op.

**Wat de data wél laat zien:**
1. **Gunningen en raamcontracten zijn het interessantste signaal** (± 6 per maand): Infrabel e-Market laat zien dat individuele dataprofielen via mini-competities binnen raamovereenkomsten worden gegund. Voor kleine bureaus is de vraag "in welk raamcontract moet ik binnen, en wie is de hoofdaannemer?" waardevoller dan losse alerts.
2. **De ontbrekende helft zit in de nationale publicaties** (onder de EU-drempel). Voor e-Procurement heb ik geen publieke API of open-datadump gevonden; scrapen is niet de bedoeling.

**Herorientatie (voorstel, jouw beslissing):**
- **Stap A (gratis, 4 weken, geen code):** maak zelf een gratis e-Procurement-profiel (e-Notification) met de CPV-codes voor data/BI en tel 4 weken hoeveel relevante nationale publicaties binnenkomen. Dat beantwoordt de volumevraag zonder scraping.
- **Stap B:** vraag bij FOD BOSA na of hergebruik of een API voor e-Procurement-publicaties toegestaan is (conceptmail hieronder).
- **Stap C:** pas als A + B samen ≥ 4 sterke publicaties per maand opleveren én hergebruik toegestaan is: het digest-abonnement bouwen. Anders TenderKompas inzetten als **gratis kwartaalrapport "Data & BI in Belgische overheidsopdrachten"**, als leadmagnet voor je eigen consultancy (dat kost weinig onderhoud en gebruikt dezelfde code).
- **Code-fixes die hoe dan ook nodig zijn** (op een branch, niet uitgevoerd): `SORT BY … ASC` in `query.ts`, deadline-offset-parsing, ontdubbeling per procedure, pauze ≥ 1,5 s tussen calls.

> **Let op belangenconflict:** de sterkste hits zijn Digipolis Antwerpen en de Vlaamse Overheid, aanbestedende diensten waar jij freelance aan verbonden bent of was. Nog een reden om je contract via Cronos te laten nakijken vóór je hier commercieel mee naar buiten komt.

### Conceptmail aan FOD BOSA (niet verstuurd)

**Onderwerp:** Vraag over hergebruik van publicaties op e-Procurement (publicprocurement.be)

Geachte,

Via mijn onderneming Marhaba Data & AI Agent BV (BE1003552102) onderzoek ik een dienst die kleine Belgische IT-bedrijven helpt om relevante overheidsopdrachten te vinden. Voor Europese publicaties gebruik ik de open data van TED.

Mag ik u vragen:
1. of de publicaties op e-Procurement (aankondigingen en gunningen) hergebruikt mogen worden in een commerciële meldingsdienst, en onder welke voorwaarden;
2. of er een officiële API, export of open-datadataset bestaat (bv. via data.gov.be);
3. zo niet, of er plannen zijn in die richting.

Ik zoek uitdrukkelijk een toegestane en gedocumenteerde manier, geen scraping.

Met vriendelijke groeten,
Mohamed Bouzouf
Marhaba Data & AI Agent BV · +32 484 94 77 77
