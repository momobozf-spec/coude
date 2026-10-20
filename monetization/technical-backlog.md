# Technische backlog — status na de voorbereiding van de pilot

Code: repo `immoradar`, branch `ccr-02331f64-4fd2md` (nog niet gemerged).
Labels: ✅ klaar en getest · 🔧 jouw actie (account, dashboard, contract) · ⏳ open.

## Getest op deze branch
- `npm run verify` (schema, typecheck, lint, 163 unittests): ✅
- Integratietests tegen een echte PostgreSQL 16 (privacy en export), samen 168 tests: ✅
- `npm run build`, `npm run smoke` (alle schermen, tenantgrens) en 9/9 Playwright-tests: ✅
- Echte import + LeadRevive-taak op de demo-CSV: 18 contacten, 12 kansen, gelijk aan de intake-scan: ✅

## A. Nodig vóór de eerste betaalde pilot

| # | Onderwerp | Status |
|---|---|---|
| A1 | Alle zes beloofde categorieën komen ook uit een CSV-import | ✅ Opgelost (voorheen alleen schattingen, oud-klanten en "nooit opgevolgd") |
| A2 | Kolom "Laatste contact" niet langer als naam herkend | ✅ |
| A3 | "Achternaam, Voornaam" correct gesplitst | ✅ |
| A4 | Import ontdubbelt op naam + exact adres, zoals de documentatie belooft | ✅ |
| A5 | Intake-scan zonder database: datakwaliteit + bruikbare kansen (`npm run leadrevive:intake`) | ✅ |
| A6 | Demo met fictieve gegevens (`npm run demo:leadrevive`) | ✅ |
| A7 | Export per kantoor (`npm run agency:export`), getest | ✅ |
| A8 | Verwijdering per kantoor en per persoon | ✅ (bestond al, getest) |
| A9 | Marktradar en panden verborgen zonder marktbron | ✅ |
| A10 | CI draait (bestand naar `.github/workflows/`) | ✅ (draait bij de eerste push naar `main` of een PR) |
| A11 | Concepten: verwerkersovereenkomst, register, DPIA-screening | ✅ concept · 🔧 **jurist** |
| A12 | Juridische vraag per categorie (GBA 01/2025, Bel-me-niet-meer) | 🔧 **jurist** — blokkerend |
| A13 | Hosting Render Frankfurt (betaald plan), domein, `LEGAL_*`, monitoring | 🔧 pas voor fase 2 |
| A14 | Back-up: PITR aan + één hersteltest | 🔧 pas voor fase 2 |
| A15 | Beveiligingsacties uit [beveiliging-acties.md](beveiliging-acties.md) | 🔧 |

Fase 1 (intake-scan) heeft **geen hosting** nodig: de scan draait lokaal op je
laptop (versleutelde schijf), onder een getekende verwerkersovereenkomst.

## B. Nodig vóór meerdere betalende klanten

| # | Onderwerp | Waarom |
|---|---|---|
| B1 | Ochtendsamenvatting per e-mail (nu alleen Telegram, en uit) | Zonder dagelijkse prikkel loggen makelaars niet in |
| B2 | Self-service wachtwoordherstel (vraagt een e-mailprovider, EU-regio) | Minder support |
| B3 | Bel-me-niet-meer-markering per contact (importkolom of handmatig) | Het kantoor moet het controleren; het product kan het helpen tonen |
| B4 | Termijnen en categorieën per kantoor instelbaar, op basis van het juridisch advies | Een kantoor of jurist kan bv. "eerdere koper" uitzetten |
| B5 | Handleiding per CRM: hoe exporteer je uit Whise, SweepBright, Omnicasa | Minder tijd per import |
| B6 | Export als knop voor de kantoorbeheerder | Nu alleen via de CLI |
| B7 | Plannen vastleggen (`pilot`, `kwartaal`, `maand`) in plaats van vrije tekst | Duidelijke facturatie |
| B8 | Foutopvolging (bv. Sentry, EU-regio) | Problemen sneller zien |
| B9 | Huisnummers van vier cijfers (bv. 1100) een adressleutel geven | Nu geen pandkoppeling voor zulke adressen |
| B10 | Feedbackknop "foute kans" (overleden, verhuisd, al klant) | Meetbaar resultaat uit het aanbod |

## C. Kan wachten

- Betaalprovider in de app (facturen per overschrijving volstaan bij een handvol klanten).
- CRM-API-koppelingen (vragen partnercontracten).
- Marktradar met externe databron (eerst een legale bron en juridisch advies; nooit scrapen).
- AI-functies, white-label, Franstalige interface.
