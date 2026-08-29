# Gemeente-registry: onderzoek en bronnen

Raadpleegdatum voor alles hieronder: **29 augustus 2026**
Onderzoeker: geautomatiseerd, met directe raadpleging van officiële pagina's

Dit document is de bron van waarheid achter `prisma/seed.ts`. Elk veld dat in de
registry `VERIFIED` staat, is hieronder terug te voeren op een officiële pagina.
Elk veld dat hier ontbreekt, staat in de registry leeg — niet ingevuld met een
aanname.

Alleen officiële bronnen zijn gebruikt: `parking.brussels` en de gemeentelijke
domeinen zelf. Geen blogs, geen nieuwsartikelen, geen aggregators.

---

## De hoofdbevinding

**parking.brussels beheert de bewonerskaarten voor 13 van de 19 gemeenten, en
heeft het e-mailkanaal op 16 maart 2026 afgesloten.**

Letterlijk, uit de parkeerkaarten-FAQ van parking.brussels:

> "het e-mailkanaal op 16 maart 2026 gedeactiveerd"
> "Aanvragen moeten voortaan worden ingediend via online formulieren"
> "aanvragen per post blijven mogelijk"

Bron: <https://parking.brussels/nl/contact-en-support/parkeerkaarten-faq>

Voor die 13 gemeenten bestaat er dus geen e-mailadres om een dossier naartoe te
sturen. De gevolgen daarvan voor het product staan in
[ADR 0005](decisions/0005-indieningskanalen-en-de-grens-van-automatisering.md).

**Netto-resultaat: bij precies één gemeente kunnen wij vandaag namens de
gebruiker indienen** — Oudergem, per e-mail, officieel bevestigd. Overal elders
is ons product "dossier compleet en correct aanleveren", niet "wij dienen in".

### Waarom directe verificatie het verschil maakte

Zoekresultaten noemden drie gemeentelijke e-mailadressen voor parkeerkaarten. Bij
het rechtstreeks openen van de officiële pagina's bleef er **één** van over:

| Adres uit zoekresultaat | Bevestigd op de officiële pagina? |
|---|---|
| `mobilite@auderghem.brussels` (Oudergem) | **Ja** — staat er, met e-mail expliciet als aanvraagkanaal |
| `controle-parking@woluwe1200.be` (S-L-Woluwe) | **Nee** — de procedurepagina noemt alleen `infocom@woluwe1200.be` voor algemene info |
| `cartestationnement@sjtn.brussels` (Sint-Joost) | **Nee** — de pagina noemt alleen een telefoonnummer en een bezoekadres |

Twee van de drie zijn dus níét geseed. Waren ze op de zoeksamenvatting
overgenomen, dan had het platform identiteitskaarten en kentekenbewijzen naar
onbevestigde adressen gestuurd. Dat is de reden dat werkregel 4 bestaat.

---

## parking.brussels — de centrale beheerder

| Veld | Waarde | Bron |
|---|---|---|
| Beheert kaarten voor | 13 van de 19 gemeenten | [gemeentelijke parkeerkaarten](https://parking.brussels/nl/je-auto-parkeren/gemeentelijke-parkeerkaarten) |
| E-mailkanaal | **Afgesloten sinds 16-03-2026** | [parkeerkaarten-FAQ](https://parking.brussels/nl/contact-en-support/parkeerkaarten-faq) |
| Online | E-loket, verplicht kanaal voor nieuwe aanvragen | idem |
| Post | Gasthuisstraat 31 / rue de l'Hôpital 31, 1000 Brussel — blijft mogelijk | [contact](https://parking.brussels/nl/contact-en-support) |
| Loket | Klantendienst, adressen via "Ontmoet ons" | idem |
| Kaartvorm | Virtueel; controle via nummerplaatscanning door stewards | commune-pagina's |
| Termijn wijziging gegevens | Binnen **10 dagen** | [Schaarbeek](https://parking.brussels/nl/je-auto-parkeren/gemeentelijke-parkeerkaarten/schaarbeek/schaarbeek-bewonerskaart) |
| Termijn **kentekenwijziging** | Binnen **5 werkdagen** | idem |
| Vernieuwing | Ten vroegste 60 dagen voor vervaldatum; formulier hoeft niet opnieuw | [FAQ](https://parking.brussels/nl/contact-en-support/parkeerkaarten-faq) |

De termijn van 5 werkdagen bij een kentekenwijziging is productlogica, geen
voetnoot: de wizard hoort bij `PLATE_CHANGE` te tonen hoeveel tijd er nog is.

### Gedeelde documentvereisten (alle parking.brussels-gemeenten)

Bevestigd op de pagina's van Anderlecht, Elsene, Vorst en Schaarbeek — identiek
geformuleerd:

- Identiteitskaart, **recto-verso**
- Inschrijvingsbewijs van het voertuig, **recto-verso**

Situationeel, afhankelijk van het geval:

| Situatie | Document |
|---|---|
| Voertuig van een derde | Verzekeringspolis met aanvrager als hoofdbestuurder |
| Bedrijfswagen | Attest van de werkgever dat aanvrager hoofdgebruiker is |
| Leasing of huur | Leasing-/huurcontract op naam van de aanvrager |
| Tweede verblijf | Aanslagbiljet tweedeverblijfsbelasting |
| Inschrijving in behandeling | Model 2-attest |

---

## De 19 gemeenten

Legenda: **V** = VERIFIED, **U** = UNVERIFIED.
"Kanaal" is het kanaal waarlangs *wij* mogen indienen — zie ADR 0005.

### Beheerd door parking.brussels

| # | Gemeente | Postcode | 1e kaart | 2e kaart | Max/gezin | Status | Kanaal |
|---|---|---|---|---|---|---|---|
| 1 | Anderlecht | 1070 | €30/j, €60/2j | €150/j | 2 (+1 tweede verblijf) | **V** | POST |
| 2 | Elsene / Ixelles | 1050 | €26/j, €52/2j | €211/j | 2 (+1) | **V** | POST |
| 3 | Vorst / Forest | 1190 | €30/j, €60/2j | €200/j | 2 (+1) | **V** | POST |
| 4 | Schaarbeek | 1030 | €37/j, €74/2j | €150/j | 2 (+1) | **V** | POST |
| 5 | Sint-Agatha-Berchem | 1082 | — | — | — | U | POST |
| 6 | Evere | 1140 | — | — | — | U | POST |
| 7 | Ganshoren | 1083 | — | — | — | U | POST |
| 8 | Jette | 1090 | — | — | — | U | POST |
| 9 | Koekelberg | 1081 | — | — | — | U | POST |
| 10 | Sint-Gillis | 1060 | — | — | — | U | POST |
| 11 | Sint-Jans-Molenbeek | 1080 | — | — | — | U | POST |
| 12 | Sint-Pieters-Woluwe | 1150 | — | — | — | U | POST |
| 13 | Watermaal-Bosvoorde | 1170 | — | — | — | U | POST |

Bronnen voor de vier geverifieerde:
[Anderlecht](https://parking.brussels/en/park-your-car/municipal-parking-permits-and-parking-information/anderlecht/anderlecht-resident-card) ·
[Elsene](https://parking.brussels/en/ixelles-resident-permit) ·
[Vorst](https://parking.brussels/en/park-your-car/municipal-parking-permits-and-parking-information/forest/forest-resident-permit) ·
[Schaarbeek](https://parking.brussels/nl/je-auto-parkeren/gemeentelijke-parkeerkaarten/schaarbeek/schaarbeek-bewonerskaart)

Extra bevestigd per gemeente: toeslag voor lange voertuigen (Anderlecht +€150/j
boven 5 m; Elsene +€120/j en Vorst +€120/j boven 4,9 m; Schaarbeek +€127/j boven
4,9 m) en tweedeverblijfstarieven (Anderlecht €550, Elsene €1.059, Vorst €529,
Schaarbeek €529). Schaarbeek vermeldt bovendien dat het totaal aantal kaarten
nooit hoger mag zijn dan het aantal rijbewijzen in het gezin.

Voor de negen met status U geldt: beheerder en kanaal staan vast (ze staan op de
index van parking.brussels en delen de centrale procedure), maar tarieven en de
exacte documentlijst zijn **niet individueel nagelezen**. Ze staan daarom leeg in
de registry. Dat blokkeert niets wat vandaag zou werken — het kanaal is voor alle
dertien toch POST — maar het voorkomt dat we een verkeerd bedrag tonen.

### Zelf beherende gemeenten

| # | Gemeente | Postcode | Bevindingen | Status | Kanaal |
|---|---|---|---|---|---|
| 14 | **Oudergem** | 1160 | E-mail `mobilite@auderghem.brussels` bevestigd, e-mail expliciet als aanvraagkanaal. €15 (1e), €127 (2e), €530 (tweede verblijf), jaarlijks. Ook IRISbox en loket Rue Emile Idiers 12. **Aanvaardt uitdrukkelijk een volmacht** naast de identiteitskaart. | **V** | **EMAIL** |
| 15 | Brussel-Stad | 1000, 1020, 1120, 1130 | Aanvraag vereist **eID mét pincode en kaartlezer**, of afspraak aan het loket (Brucity, Laken, Neder-Over-Heembeek). Max 2 per gezin, 1 of 2 jaar. Voertuig ≤3,5 t en in België ingeschreven. | **V** | ONLINE_PORTAL / COUNTER — *niet delegeerbaar* |
| 16 | Sint-Lambrechts-Woluwe | 1200 | €15 (1e), €120 (2e), per jaar, sinds 01-05-2023. Max 2 per gezin. Loket: Maison communale, av. Paul Hymans 2. Documenten bevestigd. **Indienings-e-mail niet bevestigd** op de procedurepagina. | U | onbevestigd |
| 17 | Ukkel | 1180 | Aanvraagformulieren als PDF; betaling op rekening **BE87 0910 1976 5494**; kaart 1 of 2 jaar; max 2 per gezin. Kaart wordt pas aangemaakt na controle én betaling. **Indieningskanaal niet eenduidig bevestigd.** | U | onbevestigd |
| 18 | Sint-Joost-ten-Node | 1210 | Parkeerdienst av. de l'Astronomie 12-13, tel. +32 2 220 26 11. IRISbox genoemd als kanaal. **E-mailadres niet bevestigd** op de officiële pagina. | U | onbevestigd |
| 19 | Etterbeek | 1040 | Bezoekerskaarten gedocumenteerd (52/jaar, 104 vanaf 75 jaar). **Procedure voor de bewonerskaart zelf niet teruggevonden** op een officiële pagina. | U | onbevestigd |

Bronnen:
[Oudergem](https://www.auderghem.be/carte-de-riverain) ·
[Brussel-Stad](https://www.brussel.be/bewonerskaart) ·
[S-L-Woluwe](https://www.woluwe1200.be/demarches/demander-une-carte-de-riverain-stationnement/) ·
[Ukkel](https://www.uccle.be/fr/vie-pratique/stationnement/cartes-de-derogation-riverains-handicaps-pros) ·
[Sint-Joost](https://sjtn.brussels/fr/actualites/carte-de-riverain) ·
[Etterbeek](https://www.etterbeek.be/nos-services/stationnement/plan-de-stationnement/plan-de-stationnement)

**IRISbox** (<https://irisbox.irisnet.be>) is het gewestelijke e-loket dat door
meerdere gemeenten gebruikt wordt. Het vereist persoonlijke authenticatie en is
dus voor ons een `ONLINE_PORTAL`-kanaal: de gebruiker dient zelf in.

---

## Wat er nog moet gebeuren

Dit onderzoek is een eerste ronde, geen eindpunt. Openstaand:

1. **Negen parking.brussels-gemeenten** (Berchem, Evere, Ganshoren, Jette,
   Koekelberg, Sint-Gillis, Molenbeek, Sint-Pieters-Woluwe, Watermaal-Bosvoorde):
   tarieven en documentlijst per gemeente nalezen.
2. **Sint-Lambrechts-Woluwe, Sint-Joost, Ukkel, Etterbeek**: het indieningskanaal
   vaststellen. Als er een officieel e-mailadres bestaat, komen deze in
   aanmerking voor `EMAIL` en dus voor echte verzending — dat is de hoogste
   waarde die dit onderzoek nog kan opleveren.
3. **Alles opnieuw** zodra `verifiedAt` ouder is dan zes maanden. De registry
   markeert die entries automatisch `STALE` en verzending wordt geblokkeerd tot
   iemand ze opnieuw nakijkt. De afsluiting van het parking.brussels-e-mailkanaal
   in maart 2026 laat zien hoe snel dit soort gegevens veroudert.

De verificatie hoort door een mens bevestigd te worden: `verifiedBy` staat in de
seed op `seed:onderzoek-2026-08-29`, wat leesbaar maakt dat dit uit deze
onderzoeksronde komt en niet uit een handmatige controle door een beheerder.
