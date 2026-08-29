# ADR 0005 — Indieningskanalen, en waar de automatisering ophoudt

Datum: 2026-08-29
Status: aanvaard — **bevat een bevinding die het productverhaal raakt**

## Context

De brief beschrijft verzending zo: "Verzending via e-mail vanaf dedicated adres,
met dossierreferentie in subject". Dat veronderstelt dat de Brusselse
administraties een e-mailadres hebben waar je een aanvraag naartoe stuurt.

Het gemeente-onderzoek (zie `docs/gemeenten.md`) laat zien dat dat voor het
grootste deel van Brussel niet klopt.

## Wat het onderzoek opleverde

**parking.brussels beheert de bewonerskaarten voor 13 van de 19 gemeenten.** En
parking.brussels heeft het e-mailkanaal afgesloten. Uit hun eigen FAQ:

> "het e-mailkanaal op 16 maart 2026 gedeactiveerd"
> "Aanvragen moeten voortaan worden ingediend via online formulieren"
> "aanvragen per post blijven mogelijk"

Er is dus geen e-mailadres om naartoe te sturen. Wie er een verzint, stuurt
iemands identiteitskaart en kentekenbewijs naar een onbekende ontvanger. Dat is
de ernstigste storing die dit product kan hebben, en precies wat werkregel 4
bedoelt.

**Brussel-Stad beheert zelf, en hun online kanaal is niet delegeerbaar.** De
aanvraag vereist de elektronische identiteitskaart van de aanvrager mét pincode
en een kaartlezer, of een afspraak aan het loket. Een pincode is persoonlijk; een
dienstverlener die daarom vraagt, vraagt om iets dat de gebruiker niet mag geven.
Dat kanaal is voor ons dicht, en hoort dicht te zijn.

**Een deel van de zelfbeherende gemeenten heeft wél een e-mailadres.** Officieel
gepubliceerd en teruggevonden:

- Sint-Joost-ten-Node — `cartestationnement@sjtn.brussels`
- Sint-Lambrechts-Woluwe — `controle-parking@woluwe1200.be`, expliciet genoemd
  als alternatief voor de online aanvraag
- Oudergem — `mobilite@auderghem.brussels`

Daar werkt het e-mailkanaal uit de brief dus gewoon.

## De beslissing

Het kanaal wordt een eigenschap van de gemeente, niet van het product. Vier
types in `SubmissionChannelType`, en per type staat vast wie de handeling doet:

| Kanaal | Wie dient in | Wat wij doen |
|---|---|---|
| `EMAIL` | wij, met volmacht | dossier samenstellen en versturen vanaf het dossieradres |
| `POST` | wij of de gebruiker, met volmacht | print-klaar dossier genereren; wie het in de bus doet is een openstaande beslissing (zie onder) |
| `ONLINE_PORTAL` | **de gebruiker zelf** | dossier klaarzetten als download en de gebruiker door het portaal loodsen |
| `COUNTER` | **de gebruiker zelf** | dossier klaarzetten, met adres en openingsuren |

`ONLINE_PORTAL` en `COUNTER` zijn geen tekortkomingen die we later wegwerken. Ze
zijn het gevolg van persoonlijke authenticatie aan de kant van de administratie,
en dat is daar een bewuste keuze. Voor die gemeenten is ons product: documenten
verzamelen, uitlezen, controleren, en een compleet en correct dossier
klaarleggen. Dat is nog steeds het grootste deel van het werk — maar het is niet
"wij dienen in", en dat mag nergens zo staan.

## Wat dit afdwingt in de code

1. Verzenden kan alleen als de gemeente `VERIFIED` is **en** het kanaal
   `EMAIL` of `POST` is. Bij `ONLINE_PORTAL` en `COUNTER` bestaat er geen
   codepad dat verstuurt; de dossierstatus gaat naar `HANDED_TO_USER`.
2. `submissionEmail` wordt alleen gevuld als het adres officieel gepubliceerd
   staat, met bron-URL in `sourceUrls`. Nooit afgeleid van een patroon, nooit
   geraden.
3. Elke `Submission` legt vast op welke verificatiestatus we op dát moment
   vertrouwden (`municipalityVerifiedAt`). Als een gemeente later `STALE` wordt,
   blijft achteraf zichtbaar waarop een verzending gebaseerd was.
4. De UI zegt per gemeente wat er gaat gebeuren, vóór de gebruiker betaalt.
   "Wij dienen in bij Sint-Joost" en "Jij dient in bij het e-loket, wij maken je
   dossier compleet" zijn verschillende beloftes en horen verschillend te staan.

## Openstaande beslissing voor de opdrachtgever

Bij `POST` kunnen wij het dossier versturen, maar dat is een operationele keuze
met kosten en een fysiek proces: printen, enveloppe, zegel, aangetekend of niet.
Het alternatief is de gebruiker een print-klaar PDF geven.

Dit raakt de kern van het aanbod voor 13 van de 19 gemeenten en is een
kostenbeslissing, dus die leg ik voor in plaats van hem zelf te nemen. Tot er een
antwoord is, bouw ik `POST` als "print-klaar dossier voor de gebruiker" — de
variant zonder terugdraaikosten, en de code laat de andere kant open.

## Waarom dit niet is weggepoetst

Het was verleidelijk om `contact@<gemeente>.be` in te vullen en de flow er
werkend uit te laten zien. Dat zou een demo opleveren die bij de eerste echte
gebruiker een identiteitskaart naar het verkeerde adres stuurt. De registry mag
liever half leeg staan dan onjuist gevuld, en de gemeenten die we nog niet
kunnen bedienen tonen "Deze gemeente wordt binnenkort ondersteund" met een
download van hun dossier.
