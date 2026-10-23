# ADR 0004 — Keuze van de vision-provider

- **Datum:** 2026-08-29
- **Status:** Aanvaard (`CONFIGURATION REQUIRED` tot er keys zijn)

## Context

De vergelijking check-in / check-out heeft beeldanalyse nodig: verschil
detecteren tussen twee foto's van dezelfde plek en dat verschil beschrijven.

## Beslissing

**Anthropic Claude (vision)** als volledig geïmplementeerde adapter, achter de
interface `VisionAnalyzer`.

Redenen:

1. **Gestructureerde output via tool use.** We hebben een strikt schema nodig
   (classificatie, confidence, beschrijving, waargenomen verschillen). Tool use
   dwingt dat schema af aan de modelkant, zodat we geen vrije tekst hoeven te
   parsen.
2. **Twee afbeeldingen in één bericht** met tekstlabels ertussen, zodat het model
   weet welke foto de intrek- en welke de uittreksituatie is.
3. **Voorzichtigheid bij onzekerheid** past bij een product waar een verkeerde
   classificatie geld kost voor de gebruiker.

De interface is bewust smal (één methode `comparePhotos`), zodat een
OpenAI-adapter later toegevoegd kan worden zonder de aanroepende code te raken.

## Grenzen die we in de code afdwingen

De AI **classificeert**, ze **beslist niet**:

- Confidence onder de drempel (standaard 0,70) → resultaat wordt geforceerd naar
  `UNCLEAR`, ongeacht wat het model zegt.
- Het model krijgt **geen** kostenschatting te doen. Bedragen komen uitsluitend
  uit de referentietabel `repair_cost_reference`. Is er geen match, dan is er
  geen bedrag — geen gok.
- Het model formuleert **geen** juridische tekst en verwijst naar **geen**
  wetsartikelen. Die zitten in de templates.
- De gebruiker moet elke classificatie bevestigen of corrigeren. Het rapport
  toont het **gebruikersoordeel** als hoofdresultaat; de AI-analyse staat in de
  bijlage.

## Kosten

Per fotopaar één aanroep met twee afbeeldingen. Bij een uitcheck met 40 foto's
zijn dat maximaal 40 aanroepen. De kosten worden per analyse gelogd
(`vision_usage`) zodat de prijs van het Deposit Recovery-pakket (€29,99)
onderbouwd blijft.

## Gevolgen

- Zonder `ANTHROPIC_API_KEY` is de vergelijkingsflow niet beschikbaar; de UI toont
  dat expliciet en biedt handmatige classificatie aan als volwaardig alternatief.
  De uitcheckwizard en het vergelijkende rapport werken dus ook zónder AI.
