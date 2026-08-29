# ADR 0002 — Geen eigen implementatie van het Brusselse huurrooster

- **Datum:** 2026-08-29
- **Status:** Aanvaard

## Context

De opdracht vraagt om "de berekening van het Brusselse indicatieve huurrooster op
basis van de officieel gepubliceerde methode/parameters (loyers.brussels)", met
de expliciete instructie: is de methode niet volledig publiek reproduceerbaar,
bouw dan een begeleide flow naar de officiële tool en documenteer die beperking
eerlijk.

## Vaststelling

De officiële pagina van `loyers.brussels` beschrijft **welke variabelen** in de
berekening zitten (oppervlakte, wijkmoeilijkheidsindex, staat van het gebouw op
schaal 1–3, centrale verwarming, thermische regeling, tweede badkamer,
buitenruimte, bergruimte, garages, EPB-niveau) en vermeldt een marge van 10 %
rond de mediaan. Ze publiceert **niet** de vergelijkingen zelf, de basisprijzen
per m², de wijkcoëfficiënten of de gewichten van de bijkomende variabelen. Die
zitten in de onderliggende ULB-IGEAT-studie.

De formule die op commerciële sites circuleert
(`Oppervlakte × Basisprijs × Wijkindex × Staatscoëfficiënt × Coëfficiënt aantal
kamers`) is **niet** door het Gewest als officiële methode gepubliceerd.

Bron: <https://loyers.brussels/a-propos-des-loyers-de-reference> (2026-08-29).

## Beslissing

We implementeren **geen eigen berekening** van het referentiehuurrooster.

De huurprijs-check werkt als volgt:

1. **Begeleide invoer** — de gebruiker vult de kenmerken in die het officiële
   rooster gebruikt. Deze gegevens worden opgeslagen op de woning en hergebruikt.
2. **Doorverwijzing** — de app genereert een samenvatting van die kenmerken en
   stuurt de gebruiker naar de officiële tool op `loyers.brussels`, met de uitleg
   dat alleen die tool het officiële referentiebedrag kan geven.
3. **Terugkoppeling** — de gebruiker vult het bekomen referentiebedrag in.
4. **Duiding** — de app vergelijkt de werkelijk gevraagde huur met dat bedrag,
   past de gepubliceerde marge van 10 % toe en toont het verschil in euro en in
   procent, met de expliciete melding dat het rooster **indicatief** is en geen
   wettelijk maximum oplegt.

## Gevolgen

- De vergelijking is zo betrouwbaar als het officiële cijfer dat de gebruiker
  invult; de app markeert dat cijfer als door de gebruiker ingevoerd, met datum.
- Er wordt **geen** brief gegenereerd die stelt dat de huurprijs "te hoog is
  volgens het rooster" als juridische claim. De brief die wel bestaat, vraagt om
  een gesprek over de huurprijs met verwijzing naar het indicatieve rooster.
- Als het Gewest de volledige methode later publiceert, kan de berekening achter
  dezelfde interface `RentGridEvaluator` alsnog geïmplementeerd worden zonder de
  UI te wijzigen.

## Verworpen alternatieven

- **De commerciële formule overnemen.** Levert getallen op die officieel niet te
  verantwoorden zijn — precies wat de opdracht verbiedt.
- **De officiële tool scrapen.** Fragiel, en vermoedelijk in strijd met de
  gebruiksvoorwaarden. Niet gedaan.
