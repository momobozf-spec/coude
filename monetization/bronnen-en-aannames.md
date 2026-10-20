# Bronnen en aannames — wat is bewezen, wat niet

*Bijgewerkt 20 oktober 2026.* Elke uitspraak in de andere documenten valt in één
van vier soorten:

| Label | Betekenis |
|---|---|
| **[CODE]** | Vastgesteld in de broncode of door een test die ik heb gedraaid |
| **[BRON]** | Staat in een externe bron (link + datum hieronder); niet door mij nagegaan in de praktijk |
| **[REKENING]** | Afgeleid uit bronnen of code met een formule die je kan nadoen |
| **[AANNAME]** | Mijn inschatting; te toetsen in klantgesprekken of de pilot |

---

## 1. "€10.000 per verkoopopdracht" — [REKENING], geen bewezen cijfer

| Stap | Waarde | Soort |
|---|---|---|
| Gemiddelde prijs woning België, Q1–Q3 2025 | €346.218 | [BRON] Notarisbarometer T3 2025 |
| Gemiddelde prijs appartement | €275.862 | [BRON] idem |
| Ereloon makelaar | 2–4 % excl. btw; mediaan grote steden ~3 % | [BRON] housing-service.be, 23-09-2026 |
| Ereloon op €350.000 | "vaak meer dan €12.000 incl. btw" (≈ €9.900 excl.) | [BRON] idem |
| **Ereloon gemiddeld huis, 3 %** | **≈ €10.400 excl. btw** | [REKENING] |
| Ereloon gemiddeld appartement, 2 % | ≈ €5.500 excl. btw | [REKENING] |

**Correcte formulering:** "één verkoopopdracht levert een kantoor typisch
**€5.500 tot €10.400** ereloon op (excl. btw)". Wat een kantoor er netto aan
overhoudt (na kosten en commissie van de makelaar) weet ik niet. Dat moet je in
het gesprek vragen.

## 2. Concurrentieprijzen — [BRON], zelf opgegeven door de aanbieders

| Aanbieder | Wat | Prijs | Opmerking |
|---|---|---|---|
| Immo Estate (Propenda) | Prospectietool op online advertenties, filters per postcode | Starter €45, Bedrijf €95, Advanced op aanvraag | Periode (maand/jaar) en btw niet vermeld op de pagina |
| ProspectScope | CRM + routeplanning voor terreinprospectie, **geen leadbron** | €99/maand lancering, daarna €149/maand | Eén plan; 14 dagen proef |
| Ledoux | Inkoop-CRM voor makelaars | €149/maand excl. btw | Volgens een zoekresultaat; de pagina gaf bij controle een 404, dus **niet bevestigd** |
| Converted | Advertentiecampagnes (Google/Meta) voor leads | Beheer vanaf €499/maand excl. btw + €250 opstart + ≥ €500 advertentiebudget | Kost per verkopers-lead (waardebepaling) volgens hun eigen benchmark €18–40 |
| Whise | Marktleidend CRM in BE/FR | Geen publieke prijs | >2.000 kantoren en 5.500 gebruikers volgens een bedrijfsprofiel |
| SweepBright | CRM | Op aanvraag | — |

**Wat dit wel en niet zegt.** Er is geen directe concurrent gevonden die het
*eigen* klantenbestand van een kantoor heractiveert. Dat is een gat in de markt
**of** een teken dat kantoren er niet voor betalen. Dat weet je pas na gesprekken
[AANNAME]. Whise en SweepBright kunnen filteren op laatste contact. Hoe goed dat
werkt bij een export met dubbels, weet ik niet [AANNAME].

## 3. Marges — [REKENING] op [AANNAME]

De bedragen in `pricing-and-costs.md` zijn rekenvoorbeelden:

| Post | Waarde | Soort |
|---|---|---|
| Render web $7, worker $7, Postgres basic-256mb $6/maand | ≈ €18,50 | [BRON] Render-prijspagina + derde partij (juli 2026); bij de eerste deploy controleren |
| AI- of API-kosten | €0 | [CODE] ImmoRadar heeft geen LLM-, geen betaal- en geen e-mailafhankelijkheid |
| Betaalkost per factuur | €0 (overschrijving) tot ~€0,25 (SEPA via Mollie) | [BRON] derde partij, **niet officieel bevestigd** |
| Supporttijd en uren per pilot | zie `pricing-and-costs.md` | [AANNAME] — meet je echte uren in de eerste pilot |
| Je tijd gewaardeerd aan €75/u | | [AANNAME] — onder je freelancetarief, bewust conservatief |

## 4. Juridische beperkingen

### 4a. Marktradar (particuliere verkopers in advertenties) — **niet verkopen**
- [CODE] Er is geen collector voor een echte site; alleen fixture- en demodata (`src/collectors/registry.ts`).
- [BRON] Belgisch databankrecht: substantieel hergebruik van een beschermde databank (zoals een immoportaal) is niet "normaal gebruik" (legalnews.be). Een uitspraak specifiek over Immoweb heb ik **niet** gevonden.
- [AANNAME] De gebruiksvoorwaarden van Immoweb en Zimmo verbieden scraping. Niet gecontroleerd: lees ze zelf of laat ze lezen.
- [BRON] Contactgegevens van particulieren uit advertenties gebruiken voor prospectie door derden vraagt een eigen grondslag en informatie volgens art. 14 AVG. Dat staat in je eigen lanceringschecklist als blokkerend.

### 4b. LeadRevive (eigen klantenbestand) — **mogelijk, met voorwaarden**
- [BRON] GBA, *ontwerp*-aanbeveling 01/2025 (versie ter publieke consultatie):
  - §114–115: prospects verwachten doorgaans geen marketing, **maar** wie zelf
    contact opnam en (nog) geen klant werd, kan dat "afhankelijk van de feitelijke
    omstandigheden" wel verwachten. Het voorbeeld van de aannemer van ramen lijkt
    sterk op een slapende schattingsaanvraag.
  - §54: een sterke klantrelatie en een product met een lange levenscyclus
    kunnen een langere bewaartermijn rechtvaardigen. Voor prospects moet die
    termijn korter zijn dan voor klanten.
  - Bijlage 2: wie telefonisch prospecteert zegt **vooraf** wie hij is, waarom hij
    belt, waar de gegevens vandaan komen en dat de persoon bezwaar kan maken. Ook
    moet hij de Bel-me-niet-meer-lijst respecteren (WER art. VI.110–115).
- [BRON] Een uitzondering voor bestaande klanten op de Bel-me-niet-meer-lijst
  heb ik voor België **niet** gevonden. De bekende uitzondering is uitdrukkelijke toestemming.
- [AANNAME] Een slapende schattingsaanvraag van 1–3 jaar en een oud-klant zijn
  verdedigbaar. Een koper van 10 jaar geleden en een "nooit opgevolgde" lead van
  5 jaar geleden zijn twijfelachtiger. **Laat de jurist per categorie oordelen.**
  Daarna kan je de termijnen per categorie instellen (`DORMANT_MONTHS`,
  bewaartermijnen) of categorieën uitzetten.

## 5. Wat in de code is vastgesteld en getest

| Bewering | Bewijs |
|---|---|
| Alle zes LeadRevive-categorieën komen uit een CSV-export | [CODE] `tests/leadrevive.test.ts` (immoradar, branch `ccr-02331f64-4fd2md`) |
| Intake-scan en echte import tellen hetzelfde | [CODE] lokaal gedraaid tegen PostgreSQL 16: 20 rijen → 18 contacten → 12 kansen, in beide wegen |
| Export per kantoor zonder wachtwoordhashes, zonder andere kantoren, met bescherming tegen formules | [CODE] `tests/export.integration.test.ts` tegen PostgreSQL |
| Wissen van één persoon en van een kantoor | [CODE] `tests/privacy.integration.test.ts` (bestond al, slaagt) |
| De app bouwt en draait | [CODE] `npm run verify`, `npm run build`, `npm run smoke`, 9/9 Playwright-tests |

## Bronnenlijst (geraadpleegd 20-10-2026)

- Notarisbarometer T3 2025: https://www.notaris.be/sites/default/files/files/2025-10/Notarisbarometer%20T3%202025.pdf
- Makelaarskosten 2026 (housing-service.be, 23-09-2026): https://www.housing-service.be/?p=1153
- Immo Estate / Propenda: https://immo.estate/
- ProspectScope: https://prospectscope.be/
- Ledoux (zoekresultaat; pagina gaf bij controle 404): https://www.ledoux.app/makelaar-inkoop-crm
- Converted, leadgeneratie vastgoed: https://converted.be/diensten/leadgeneratie/vastgoed/
- Whise-profiel: https://village.ai/company/whise
- SweepBright-prijzen (op aanvraag): https://g2.com/products/sweepbright/pricing
- Render-prijzen: https://render.com/pricing.md
- Mollie-tarieven (derde partij): https://blog.finexer.com/mollie-pricing/
- GBA, ontwerp-aanbeveling 01/2025 direct marketing: https://autoriteprotectiondonnees.be/publications/aanbeveling-01-2025-over-de-verwerking-van-persoonsgegevens-bij-direct-marketing.pdf
- Commentaar op de GBA-richtlijnen (Sirius Legal): https://legalnews.be/handel-consument/de-nieuwe-direct-marketing-richtlijnen-van-de-gba-scherper-maar-ook-realistisch-sirius-legal/
- FOD Economie, reclameoproepen en Bel-me-niet-meer: https://news.economie.fgov.be/248036-genoeg-van-ongewenste-reclameoproepen-reageer/
- Bel-me-niet-meer-lijst, toelichting: https://blog.forumforthefuture.be/nl/article/genoeg-van-ongewenste-reclameoproepen-zo-kun-je-het-beste-reageren-/26444
- Databankrecht en scraping: https://legalnews.be/?p=64036
