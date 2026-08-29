# Voortgang

Laatst bijgewerkt: **2026-08-29**

## Fase 0 — Juridisch onderzoek & fundament ✅

**Exit-criterium:** rules-tabel gevuld met eerlijke verificatiestatussen, CI groen.

### Verificatie-gate

```
npm run typecheck   groen
npm run lint        groen
npm test            groen — 102 tests, 7 bestanden
npm run build       groen
```

### Opgeleverd

| Onderdeel | Waar |
|---|---|
| Juridisch dossier met bronnen, raadpleegdata en verificatiestatus | `docs/juridisch.md` |
| ADR aangetekende zending | `docs/decisions/0001-aangetekende-zending-provider.md` |
| ADR huurrooster (geen eigen berekening) | `docs/decisions/0002-huurrooster-geen-eigen-berekening.md` |
| ADR bewijswaarde-framing (verboden termen) | `docs/decisions/0003-bewijswaarde-framing.md` |
| ADR vision-provider | `docs/decisions/0004-vision-provider.md` |
| Databankschema, 25 tabellen | `supabase/migrations/20260829000001_init_schema.sql` |
| RLS op alle tabellen + storage-beleid | `supabase/migrations/20260829000002_rls.sql` |
| Referentiedata: legal_rules, brieftemplates, clausule-checklist, prijzen | `supabase/migrations/20260829000003_reference_data.sql` |
| Waalse slijtagegrille, 40 posten | `supabase/migrations/20260829000004_vetuste_reference.sql` |
| Env-validatie + integratiestatus | `src/lib/env.ts` |
| Verboden-termen-guard | `src/lib/legal/forbidden-terms.ts` |
| Disclaimer en bewijsniveaus, één bron | `src/lib/legal/disclaimer.ts` |
| Regeltoegang, staleness, momentopname | `src/lib/legal/rules.ts` |
| Datumrekenkunde met maandklemming | `src/lib/date.ts` |
| Bewijsintegriteit: SHA-256, EXIF, servertijd | `src/lib/evidence/hash.ts` |
| Waarborg-termijnengine | `src/lib/deposit/deadline.ts` |
| Slijtageberekening volgens de officiële methode | `src/lib/vetuste/calculate.ts` |
| i18n NL/FR met sleutelpariteit afgedwongen door types | `src/i18n/` |
| Supabase-clients (browser, server, admin) | `src/lib/supabase/` |
| PDF-tekstextractie | `scripts/extract-pdf.mjs` |

### Beslissingen die de opdracht bijstellen

1. **Geen eigen huurrooster-berekening.** Methode niet publiek reproduceerbaar.
   Begeleide flow naar de officiële tool. (ADR 0002)
2. **Geen brief op basis van de EPB-indexatieregel.** Drie bronnen geven drie
   onverenigbare lezingen van het toepassingsgebied. Regel staat op `UNVERIFIED`
   en draagt geen enkele brief. (`docs/juridisch.md` §3)
3. **Retentie: standaard 2 jaar, verlengbaar tot 10.** De opdracht vroeg 2 jaar,
   maar vorderingen uit een huurovereenkomst verjaren pas na 10 jaar. De
   standaard blijft 2 jaar wegens dataminimalisatie, met een expliciete
   waarschuwing en de mogelijkheid te verlengen. (`docs/juridisch.md` §6)
4. **"Waarborg-garantie" is geschrapt** en vervangen door "volledig
   waarborg-dossier". De term staat in de verboden-termenlijst en de build faalt
   als hij terugkomt.
5. **Waalse slijtagegrille als niet-bindende referentie.** Er is geen Brussels
   equivalent; de UI zegt dat expliciet. (ADR in `docs/juridisch.md` §5)

### Eerlijk over wat nog niet vaststaat

- De geconsolideerde Brusselse Huisvestingscode kon niet automatisch worden
  uitgelezen (Justel gaf metadata, en één keer een compleet andere akte). De
  artikelnummers komen van een Staatsblad-mirror. Alles wat daarop steunt draagt
  status `VERIFIED` in de zin van *bronvast*, niet *juridisch geaccordeerd*.
- 11 van de 20 regels in `legal_rules` staan op `UNVERIFIED`. Dat is geen
  tekortkoming die verborgen wordt: de UI toont het per regel.
- Alle brieftemplates staan op `PLACEHOLDER`.

---

## Fase 1 — Accounts, woningen & check-in ⏳ volgende

**Exit-criterium:** volledig check-in-rapport uit een echte testrun, tweetalig.

- [ ] Auth-flows NL/FR (registratie, aanmelden, wachtwoordherstel)
- [ ] Middleware voor sessieverversing en taalkeuze
- [ ] UI-primitieven in shadcn-stijl (hand-geschreven, geen interactieve init)
- [ ] Woningbeheer met postcodevalidatie 1000–1299
- [ ] Check-in wizard: kamers, geleide fotochecklist, notities
- [ ] Upload met SHA-256, EXIF en servertijdstempel
- [ ] PDF-rapport NL/FR met hashes, tijdstempels en uitlegpagina bewijswaarde
- [ ] Uitnodiging verhuurder + medeondertekenflow via token
- [ ] Gratis check-in voor één woning (acquisitie)

## Fase 2 — Check-out & AI-vergelijking

## Fase 3 — Waarborg-engine & brieven

## Fase 4 — Auditors (huurprijs, indexatie)

## Fase 5 — Contractscanner, assistent, betalingen & launch
