# ADR 0003 — Hoe we over bewijswaarde communiceren

- **Datum:** 2026-08-29
- **Status:** Aanvaard — bindend voor alle UI-teksten, PDF's en marketing

## Context

Het commercieel aantrekkelijkste verhaal ("uw fotorapport is juridisch
waterdicht") is ook het gevaarlijkste. Een huurder die gelooft dat een eenzijdig
fotorapport een tegensprekelijke plaatsbeschrijving vervangt, kan daardoor
slechter af zijn dan zonder onze app.

## Beslissing

### Verboden woorden

De volgende termen mogen **nergens** voorkomen in UI, PDF, e-mail of marketing:

| Verboden | Waarom |
|---|---|
| "juridisch waterdicht" | Suggereert een garantie die niemand kan geven |
| "gegarandeerd" (over uitkomst) | Wij garanderen geen enkele uitkomst |
| "rechtsgeldig aangetekend" | Alleen waar bij een gekwalificeerd kanaal, en dan nog enkel na geslaagde verzending |
| "waarborg-garantie" | Uit de conceptnota; herbenoemd tot "volledig waarborg-dossier" |
| "officiële plaatsbeschrijving" | Onze rapporten zijn eenzijdig, tenzij medeondertekend |

Deze lijst wordt afgedwongen door een **automatische test** die alle
vertaalbestanden en templates scant (`src/lib/legal/forbidden-terms.ts` +
unit test). De build faalt bij een overtreding.

### Drie niveaus, expliciet in de UI

De app onderscheidt drie niveaus van bewijskracht en toont altijd op welk niveau
de gebruiker zit:

1. **Eenzijdig fotorapport** — door de huurder alleen opgemaakt. Bewijsmateriaal
   dat een rechter vrij beoordeelt. Vervangt géén plaatsbeschrijving.
2. **Medeondertekend rapport** — de verhuurder heeft via de uitnodigingslink
   bevestigd. Aanzienlijk sterker, want de tegenpartij heeft de inhoud aanvaard.
   Nog steeds geen door een deskundige opgestelde plaatsbeschrijving.
3. **Tegensprekelijke plaatsbeschrijving door een deskundige** — wat de wet
   bedoelt. **Dit levert onze app niet.** De app verwijst hiernaar door.

### Wat we wél mogen claimen

- Dat elke foto bij upload een **SHA-256-hash** en een **servertijdstempel**
  krijgt, en dat beide in het PDF-rapport staan. Dat is een feitelijke,
  controleerbare uitspraak.
- Dat dit aantoont dat het bestand **sinds dat tijdstip niet gewijzigd** is.
- Wat het **niet** aantoont, staat er in dezelfde alinea bij: het bewijst niet
  wanneer de foto genomen is, niet waar, en niet dat ze de woning in kwestie
  toont. Een servertijdstempel is geen gekwalificeerd tijdstempel onder eIDAS.

### Verplichte disclaimer

Elke juridische output (PDF-rapport, ingebrekestelling, audit-resultaat,
antwoord van de assistent) draagt onderaan:

> RentGuard levert informatie en hulpmiddelen, geen juridisch advies. Voor uw
> concrete situatie kunt u terecht bij de Huurdersbond of bij de juridische
> eerstelijnsbijstand.

Deze tekst zit in `src/lib/legal/disclaimer.ts` en wordt via één functie
ingevoegd, zodat ze niet per ongeluk ergens ontbreekt.

## Gevolgen

- Marketingteksten moeten door dezelfde lint-test.
- De conversie zal lager liggen dan met agressievere claims. Dat is de bedoeling.
