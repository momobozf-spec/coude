# Validatie — wat bewezen is, wat onzeker blijft, wat van de eigenaar nodig is (23-10-2026)

Legende: **BEWEZEN** = aangetoond met een uitgevoerde test of echte bron · **GEDOCUMENTEERD** = bevestigd in officiële documentatie, niet live getest · **ONZEKER** = niet bevestigd.

## 1. TED-bronvalidatie

Live toegang was onmogelijk: `api.ted.europa.eu`, `ted.europa.eu`, `docs.ted.europa.eu` en `data.europa.eu` geblokkeerd door de netwerk-allowlist van de bouwomgeving. Daarom gecontroleerd tegen de **officiële bronbestanden** van de Publicatiebureau-documentatie, gekloond van GitHub:
- Veldenlijst: `OP-TED/ted-rdf-docs` → `docs/antora/modules/reuse/attachments/List_of_search_fields.csv` (bron van docs.ted.europa.eu/ODS/latest/reuse/field-list.html), commit `3b828132`, 17-09-2026.
- OpenAPI-spec: `OP-TED/tedapi-docs` branch `v3.0` → `ted-europa-eu.yaml` (24-07-2026): request `PublicExpertSearchRequestV1`, response `ExpertSearchResponse`/`NoticeResponse`.
- Codelijsten: `OP-TED/eForms-SDK` → `codelists/notice-type_*.gc`, `form-type.gc`, `change-corrig-justification.gc` (08-10-2026).

### De vier eerder onbevestigde velden
| Veld | Veldenlijst | Antwoordschema | Type | Status |
|---|---|---|---|---|
| `title-lot` | ja (BT-21-Lot) | ja | i18n-lijst `{taal: [titel per perceel]}` | GEDOCUMENTEERD |
| `procedure-type` | ja (alias PR, BT-105) | ja | string | GEDOCUMENTEERD |
| `place-of-performance-country-proc` | ja (BT-5141-Procedure) | ja | array<string> | GEDOCUMENTEERD |
| `place-of-performance-country-lot` | ja (BT-5141-Lot) | ja | array<string> | GEDOCUMENTEERD |

Bijkomend: `place-of-performance-subdiv-proc/-lot` (NUTS, BT-5071) en `change-notice-version-identifier` (BT-758) staan in beide → toegevoegd. Alle 41 opgevraagde velden staan in de officiële veldenlijst; **6 ontbreken in het antwoordschema** en blijven ONZEKER: `framework-maximum-value-lot`, `framework-maximum-value-cur-lot`, `deadline-receipt-answers-date-lot/-time-lot`, `duration-period-value-lot/-unit-lot`. Weigert TED een veld (HTTP 400), dan laat de importer het weg, herhaalt de import en markeert de run als `partial` met de naam van het veld (getest).

### Gedrag
| Onderwerp | Wat de officiële bron zegt | Implementatie | Status |
|---|---|---|---|
| Paginering | `PAGE_NUMBER` max 15.000; `ITERATION` onbeperkt via `iterationNextToken`; max 250/pagina, 10.000 velden/pagina | ITERATION, limit 100, stop bij lege pagina, `timedOut` = fout, verlopen token = zichtbare fout | GEDOCUMENTEERD + fixturetests |
| Scope | default **ACTIVE**; `ALL` = alle aankondigingen | expliciet `ALL` (nodig voor wijzigingen, gunningen, intrekkingen) | GEDOCUMENTEERD |
| Percelen | per-perceelvelden zijn arrays; i18n-lijsten per taal | positioneel koppelen enkel bij gelijke aantallen; anders procedureniveau + waarschuwing; talen nooit door elkaar (bug gevonden en hersteld) | GEDOCUMENTEERD + tests |
| Wijzigingen | eForms kent **geen** form-type "change"; wijzigingsbericht = zelfde notice-type + BT-758/BT-140 | herkend via `change-notice-version-identifier` of `change-reason-code` | GEDOCUMENTEERD + tests (fixtures aangepast) |
| Intrekkingen | codelijst: `cancel` = aankondiging geannuleerd; `cancel-intent`, `susp-review` = voornemen/schorsing | `cancel` ⇒ ingetrokken; `cancel-intent`/`susp-review` ⇒ status onbekend (niet langer "open"); BT-756 = beëindigd | gecorrigeerd (voorheen werd `cancel-intent` als intrekking gezien) |
| Notice-types | competition: cn-*, subco, qu-sy, pin-cfc-*; planning: pin-*; consultation: `pmc`; result/cont-modif/dir-awa-pre/completion | `pmc` stond foutief als "gegund" → nu vooraankondiging/marktconsultatie; `compl` toegevoegd | gecorrigeerd + tests |
| Deadlines | datum en tijd aparte arrays (string) | tijdstip enkel bij aanwezige offset; niet-aligneerbare tijden ⇒ onbekend | fixturetests — **offsetformaat live te bevestigen** |

**Geen enkele TED-call is live geslaagd.** Tests met fixtures ≠ geslaagde live import.

### Wat de eigenaar moet doen
1. Laat uitgaand HTTPS toe naar **`api.ted.europa.eu:443`** (verplicht). Optioneel `ted.europa.eu` (links/pdf), `docs.ted.europa.eu`.
2. Voer buiten deze omgeving uit (geen database nodig, Node ≥ 20):
   ```bash
   node scripts/ted-live-check.mjs > ted-live-report.json
   ```
   Rapporteert per veld geaccepteerd/geweigerd + werkelijk type, paginering (3 pagina's), perceelarrays, wijzigingen, intrekkingen, deadlineformaat en het ruwe aantal aankondigingen van de 90-dagenzoekopdracht.
3. Daarna de echte steekproef (met database):
   ```bash
   npm run ted:sample
   ```
   Levert unieke procedures en relevante percelen afzonderlijk, met query en beperkingen. Pas dan kan de aanbodsvraag voor het abonnement beantwoord worden. **Niet uitgevoerd — geen aantallen gerapporteerd.**

## 2. Echte Belgische opdrachten (doelgroepvalidatie)

**Zoekmethode** (toegestane bronnen): zoekmachine (NL/FR/EN-termen), Publications Office-procurementpagina's (op.europa.eu, officiële TED-weergave), TED-pdf's, TED-SPARQL-endpoint (`publications.europa.eu/webapi/rdf/sparql`, full-text op "Databricks", "Power BI", "Microsoft Fabric", "datawarehouse", "dataplatform", "plateforme de données", "datagovernance"), aggregator tendermetric.com als vindhulp (Belgische lijst: 37 actieve aankondigingen, geen data/BI).

**Beperkingen:** SPARQL-URL's > ~200 tekens werden geweigerd (geen datum- of landfilter mogelijk); op.europa.eu-detailpagina's enkel bereikbaar via zoekresultaten; TED-pdf's gaven later lege antwoorden. Dit is **geen** representatieve steekproef.

**Resultaat: 1 echte, relevante Belgische opdracht gevonden — geen open.**

| | Zorgband Leie & Schelde — "Data project framework agreement" |
|---|---|
| Bron | op.europa.eu procurement-details `705980b5-a456-4c15-9f8c-d113794450fb` (Publicatiebureau) |
| Opdrachtgever | Zorgband Leie & Schelde, NUTS BE234 (Arr. Gent), België |
| Publicatie / deadline | 21/01/2026 / **05/03/2026** (tijdstip niet vermeld) → **afgesloten** |
| CPV | 72316000 (data-analyse) |
| Inhoud | use cases → inzichten binnen bestaand **Microsoft Fabric**-platform en **Power BI** (KPI's, dashboards, pijplijnen, governance, opleiding) |
| Waarde | niet gepubliceerd |
| Selectiecriteria | niet apart vermeld op de pagina → **onbekend** |
| Gunningscriteria | prijs 50%, plan van aanpak 40%, service/helpdesk 10% |
| Indiening | publicprocurement.be |

**Beoordeling tegen het expliciete testprofiel** (enkel door de eigenaar opgegeven gegevens: bedrijfsnaam, diensten Databricks/Fabric-Power BI/Azure, technologieën Databricks, Power BI, Azure, PySpark, Delta Lake, talen nl/fr/en; **geen** referenties, omzet, certificeringen, werkregio, capaciteit of contractomvang ingevuld):
- Diensten: **past** (CPV 72316000, Power BI, Microsoft Fabric) · Technologie: **deels** (Power BI) · Taal, regio, contractomvang, capaciteit: **onbekend**.
- Relevantiescore 43/100 (laag door 4 onbekende criteria, niet door slechte fit).
- Harde blokkade: deadline verstreken ⇒ **momenteel niet passend**. Toelatingsvoorwaarden onbekend.
- Conclusie: inhoudelijk precies de doelgroep, maar geen bewijs van een **actuele** kans.

Overige gevonden data/BI-opdrachten waren niet-Belgisch (o.a. Nederland — LVNL Qlik/Power BI; Luxemburg — SNCI BI; Oostenrijk — Kelag Power Platform; Spanje — Fusion for Energy) en zijn bewust niet als Belgisch voorbeeld uitgewerkt.

**Eerlijke conclusie:** met de beschikbare middelen is de bruikbaarheid voor Belgische IT-bureaus **nog niet aangetoond**. Er is één inhoudelijk perfecte maar afgesloten match. Het aanbod-volume moet blijken uit de live 90-dagensteekproef.

## 3. Risico's — bewijs

| Risico | Bewijs | Status |
|---|---|---|
| Organisatie-isolatie server-side bij rechtstreekse requests en gewijzigde identifiers | `scripts/security-check.ts` tegen de draaiende productiebuild, echte browser: 18/18 geslaagd (`demo-output/security-check-report.json`). O.a. kans/document/export van andere klant → 404; verzonnen/ongeldige id → 404; vervalste feedback en volgen met id van klant B → geweigerd, geen rij; geïnjecteerd `organizationId` in profielformulier → genegeerd; admin-server action (goedkeuren) rechtstreeks aangeroepen door klant én anoniem met echte actie-ID → status ongewijzigd | BEWEZEN |
| Gewijzigde voorwaarden of deadlines maken goedkeuring ongeldig | integratietests: nieuwe voorwaarde, gewijzigd verplicht karakter, gewijzigde deadline, TED-wijziging ⇒ goedkeuring vervalt, publicatie geweigerd, nieuwe versie ter controle, gepubliceerde versie met melding | BEWEZEN |
| Verlopen/ingetrokken opdracht niet als open kans | unit + integratie + HTTP-check (ingetrokken kans staat onder "Niet passend of afgesloten", niet onder open kansen) | BEWEZEN |
| Testverzending ≠ overhandiging aan SMTP ≠ aflevering | eigen statussen: `test` (enkel naar eigen beheerdersadres, `[TEST]`, digest blijft concept) · `handed_to_smtp` (SMTP antwoordde 250, antwoord bewaard) · aflevering `unknown` tot provider-bevestiging. Integratietest met **echte lokale SMTP-server + echte nodemailer**: overhandiging, herhaling zonder dubbel bericht, geweigerde ontvanger (550) ⇒ `failed` | BEWEZEN (aflevering zelf: niet meetbaar zonder provider-webhook) |
| Demo-accounts/-data niet automatisch in productie | migraties bevatten geen INSERT (test); demo-scripts weigeren zonder `ALLOW_DEMO_DATA=true` en altijd bij `NODE_ENV=production` (test); beheerdersdashboard toont blokkerende waarschuwing als er toch demodata in productie staat; demo-organisaties zien enkel demo-opdrachten | BEWEZEN |
