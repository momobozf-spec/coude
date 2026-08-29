# NMBS/SNCB compensatieregels — geverifieerd

> **Status:** geverifieerd op **2026-08-29** tegen de officiële NMBS/SNCB-website (belgiantrain.be).
> Alle regels hieronder zijn letterlijk terug te voeren op de geciteerde bronpagina's.
> **Niets in dit document is geïnterpreteerd of verzonnen.** Waar de bron zwijgt, staat dat expliciet
> vermeld onder [Open punten](#open-punten) en is de regel **niet** geïmplementeerd.

## Bronnen

| # | Bron | URL | Taal | Geraadpleegd |
|---|------|-----|------|--------------|
| B1 | Compensatie voor vertragingen | https://www.belgiantrain.be/nl/support/customer-service/compensation | NL | 2026-08-29 |
| B2 | Bereken zelf je compensatie voor vertraging | https://www.belgiantrain.be/nl/support/customer-service/compensation/calculte-your-compensation | NL | 2026-08-29 |
| B3 | Hoe ziet je compensatie eruit en hoe ontvang je ze? | https://www.belgiantrain.be/nl/support/customer-service/compensation/how-is-it-paid-compensation | NL | 2026-08-29 |
| B4 | Réclamation pour retard en train : compensation | https://www.belgiantrain.be/fr/support/customer-service/compensation | FR | 2026-08-29 |
| B5 | Ombudsrail — Vergoeding bij vertraging en afschaffing | https://www.ombudsrail.be/nl/uw-rechten/Vergoeding%20bij%20vertraging%20en%20afschaffing | NL | 2026-08-29 |

B1–B4 zijn de primaire bron (de vervoerder zelf). B5 (federale ombudsdienst voor treinreizigers) is
uitsluitend gebruikt als kruiscontrole, niet als grondslag voor geïmplementeerde parameters.

---

## 1. Hoe wordt de vertraging gemeten?

> "Je precieze vertraging is het verschil tussen het voorziene aankomstuur volgens de officiële
> dienstregeling van de NMBS en de werkelijke aankomsttijd in een Belgisch station of grensstation." — B2

**Gevolgen voor de implementatie:**

- Wij meten **aankomstvertraging op het aankomststation**, niet vertrekvertraging. Dit is de enige
  grootheid die telt. (`monitored_trips.actual_arrival_delay_minutes`)
- Bij werken geldt de **vooraf aangekondigde, aangepaste dienstregeling** als referentie — niet de
  oorspronkelijke. De iRail-data die wij pollen geeft de op dat moment geldende geplande tijd, wat
  hiermee overeenstemt.
- Bij een gemiste aansluiting mag de **totale** opgelopen vertraging worden aangerekend, op voorwaarde
  dat de reiziger de eerstvolgende trein naar de bestemming nam (B2). Wij meten daarom de vertraging
  op het **eindstation van het traject**, over alle legs heen.

## 2. Occasionele langdurige vertraging (>= 60 min)

| Parameter | Waarde | Bron |
|---|---|---|
| Drempel | **60 minuten** aankomstvertraging | B1, B2, B4 |
| Compensatie | **100 %** van de waarde van het traject | B1, B2, B4 |
| Indieningstermijn | **3 maanden** vanaf de datum van de treinreis | B1, B4 |
| Vereist (ticket / Train+ / Student Multi / Halftijds) | foto van het vervoersbewijs, per betrokken reis | B1, B4 |
| Vereist (abonnement, behalve Student Multi / Halftijds) | **abonnementsnummer of MoBIB-kaartnummer**; termijn loopt vanaf **de dag van de vertraging** | B1, B4 |
| Algemene voorwaarde | vervoersbewijs moet **geldig** zijn op het moment van de vertraging | B1 |

> "Vanaf vertraging van minstens 60 minuten: vergoed aan 100% van de waarde van je traject." — B1

**Een vertragingsattest is niet verplicht** om een compensatieverzoek in te dienen (B1). Dat is
relevant: het betekent dat ons voorbereide dossier op zichzelf volstaat als onderbouwing en dat wij
geen attest hoeven te automatiseren.

### Uitsluitingen (occasioneel)

Compensatie is **niet** van toepassing (B1, B4):

1. als de vertraging veroorzaakt werd door een **andere vervoersmaatschappij** (De Lijn, TEC, MIVB);
2. als je reisde met een **legitimatiebewijs voor gratis vervoer**;
3. als je **op de vertraging gewezen werd vóór aankoop** van het vervoersbewijs;
4. als je **een andere trein kon nemen** die je met minder dan 60 minuten vertraging op bestemming bracht.

## 3. Herhaaldelijke vertragingen (abonnees)

| Parameter | Waarde | Bron |
|---|---|---|
| Minimum aantal vertragingen | **10** | B1, B4 |
| Minimum duur per vertraging | **30 minuten** | B1, B4 |
| Referentieperiode | **6 maanden** | B1, B4 |
| Bijkomende voorwaarde | vertragingen op **hetzelfde traject** | B1, B4 |
| Compensatie | **50 %** per vertraging, op basis van de prijs van het traject | B1 |
| Indieningsvenster | **tussen 6 en 9 maanden na de eerste vertraging** | B1, B4 |
| Vereist | reisdagen, routes en **MoBIB- of Flex-abonnementnummer** | B1, B4 |
| Algemene voorwaarde | vervoersbewijs geldig op het moment van de vertraging | B1 |

> "Bij minstens 10 vertragingen van minimum 30 minuten over een tijdspanne van 6 maand, kan je je
> aanvraag voor compensatie binnen 6 tot 9 maanden na de eerste vertraging indienen." — B1

**Let op — het indieningsvenster opent pas na 6 maanden.** Een dossier voor herhaaldelijke
vertragingen kan dus niet meteen na de tiende vertraging ingediend worden. Dit is geïmplementeerd als
`submission_window_opens_at = eerste_vertraging + 6 maanden` en
`deadline_at = eerste_vertraging + 9 maanden`.

### Uitsluitingen (herhaaldelijk)

Bovenop uitsluitingen 1, 2 en 3 uit paragraaf 2 (B1, B4):

5. als je **NIET met een abonnement** reisde;
6. als je **zowel op de heen- als de terugreis** vertraging opliep **en er minder dan 2 uur** verstreken
   is tussen het tijdstip van aankomst van de heenreis en het tijdstip van vertrek van de terugreis.

Uitsluiting 6 is een harde ontdubbelingsregel die wij moeten toepassen vóór wij tellen: van zo'n
heen/terug-paar telt maar één vertraging mee.

## 4. Berekening van het bedrag

Bron: B2, letterlijk.

```
Prijs traject      = prijs vervoersbewijs / aantal trajecten (tabel hieronder)
Totaalprijs        = prijs traject x aantal trajecten met vertraging
Compensatie        = totaalprijs x compensatiepercentage
```

### Aantal trajecten per type vervoersbewijs (B2)

| Vervoersbewijs | Aantal trajecten |
|---|---|
| Enkel Standard Ticket | 1 |
| Standard Ticket heen en terug | 2 |
| Abonnement 1 maand | 40 |
| Abonnement 3 maanden | 120 |
| Abonnement 12 maanden | 480 |
| Passes, kaarten, Student Multi, Halftijds abonnement | aantal lijnen = aantal trajecten |

### Percentages (B2)

- **100 %** — uitsluitend bij langdurige vertragingen, **60 minuten of meer**
- **50 %** — bij **30 tot 59 minuten** vertraging, **enkel binnen de regeling herhaaldelijke vertragingen**

### Afronding (B2)

> "Eurocenten worden steeds afgerond naar het volgend tiental, bv. 9,35 wordt 9,40."

Afronding gebeurt dus **naar boven, op 10 eurocent**. Geïmplementeerd in
`roundCompensationUpToTenCents()` — met de exacte voorbeelden uit B2 als unit tests.

### Prijsgrondslag

- De compensatie wordt **uitsluitend** berekend op de prijs van het **treintraject** (B2).
- Bij gecombineerde abonnementen tellen metro-, tram- of bustrajecten **niet** mee (B2).
- Voor abonnementhouders is de prijs **inclusief werkgeversbijdrage** — de reiziger heeft dus recht op
  compensatie ook als de werkgever het woon-werktraject betaalt (B2). Dit is een veelvoorkomend
  misverstand bij pendelaars en wordt expliciet in de UI vermeld.

### Geverifieerde rekenvoorbeelden (B2) — gebruikt als unit tests

| Geval | Berekening | Resultaat |
|---|---|---|
| Senior Ticket EUR 8,50, vertraging 2 u | 8,50 / 2 = 4,25 -> x 1 -> x 100 % | **EUR 4,25** |
| Enkel ticket EUR 11,60, vertraging 60 min | 11,60 / 1 = 11,60 -> x 1 -> x 100 % | **EUR 11,60** |
| Jaarabonnement EUR 1400, 10 x 30 min in 6 maanden | 1400 / 480 = 2,91 -> x 10 = 29,10 -> x 50 % = 14,55 | **EUR 14,60** (afgerond) |

## 5. Indieningskanalen

| Kanaal | Beschrijving | Bron |
|---|---|---|
| **My NMBS (online)** | Aanbevolen kanaal. Aanvraag met **ticketnummer**, ongeacht het type ticket. Foto van papieren ticket kan geüpload worden; voor een digitaal ticket volstaat het ticketnummer. Frequente vertragingen worden **in My NMBS ingevuld**. | B1 |
| **Loket** | Formulier verkrijgbaar aan het loket, ter plaatse invullen en afgeven. | B1, B4 |
| **Post** | NMBS Customer Services 10-14 B-CS.6423, Hallepoortlaan 40, 1060 Brussel.<br>FR: SNCB Customer Services 10-14 B-CS.6423, Avenue de la Porte de Hal 40, 1060 Bruxelles.<br>**FR-bron voegt toe:** voldoende gefrankeerd terugsturen **met het originele vervoersbewijs (behalve abonnementen op MoBIB-kaart)**. | B1, B4 |

**Er is geen publieke API en geen gedocumenteerd e-mailkanaal** voor het indienen van
compensatieaanvragen. Zie [ADR 0001](decisions/0001-indieningskanaal.md) voor de gevolgen.

## 6. Uitbetaling

| Situatie | Vorm | Bron |
|---|---|---|
| Houder treinabonnement (incl. Flex en Unlimited) | **elektronische portefeuille** in My NMBS | B3 |
| Overige reizigers | **1 of meer waardebonnen**, **1 jaar geldig**, op naam maar overdraagbaar; inwisselbaar in het station voor een binnenlands NMBS-product van minstens dezelfde waarde | B3 |
| **Overschrijving** | **Enkel op verzoek en enkel voor vertragingen van minstens 60 minuten.** IBAN op te geven tijdens de aanvraag via My NMBS. | B3 |

**Dit is de reden dat wij een IBAN bewaren, en meteen ook de grens ervan:** een IBAN is uitsluitend
zinvol bij de 60-minutenregeling. Bij herhaaldelijke vertragingen (50 %) is uitbetaling per
overschrijving volgens B3 **niet** voorzien — de compensatie loopt daar via de elektronische
portefeuille. De UI moet dat eerlijk tonen en mag geen storting op rekening beloven voor
frequente-vertragingendossiers.

## 7. Welke persoonsgegevens vereist NMBS werkelijk?

Op basis van B1, B3 en B4 zijn dit de gegevens die in een aanvraag gevraagd worden:

- naam van de reiziger;
- **ticketnummer** (occasioneel, alle tickettypes) **of** **abonnementsnummer / MoBIB-kaartnummer**
  (abonnees, en verplicht bij herhaaldelijke vertragingen);
- reisdagen en trajecten;
- **IBAN** — enkel indien uitbetaling per overschrijving gevraagd wordt, en enkel bij >= 60 min;
- foto van het vervoersbewijs, enkel bij ticket / Train+ / Student Multi / Halftijds.

> **Rijksregisternummer wordt in geen enkele geraadpleegde officiële bron gevraagd.**
> Conform de opdracht ("alleen verwerken als fase 0-onderzoek aantoont dat NMBS het vereist")
> verwerkt RailClaim **géén** rijksregisternummer. Er is geen kolom voor in het datamodel en er is
> geen invoerveld voor in de UI. Zie `docs/privacy.md`.

## Open punten

Zaken die wij **niet** hebben kunnen staven op een officiële bron en die daarom **niet**
geïmplementeerd zijn:

1. **Minimumdrempel voor uitbetaling.** De ombudsdienst (B5) verwijst naar de Europese regel dat een
   vervoerder een minimumdrempel van ten hoogste EUR 4 mag hanteren. **NMBS vermeldt op B1/B2/B3 geen
   minimumdrempel.** Wij implementeren er dus géén, en tonen het verwachte bedrag zonder aftrek.
   Zodra dit wél gestaafd kan worden, is het een parameterwijziging in `compensation_rules`
   (`payout_minimum_eur`), geen codewijziging.
2. **Afgeschafte treinen.** B1 spreekt over vertraging; de geraadpleegde pagina's geven geen expliciete
   regel voor de compensatie bij een **afgeschafte** trein. Wij detecteren afschaffingen wél en tonen
   ze aan de gebruiker, maar berekenen er **geen automatisch bedrag** voor: een afschaffing wordt
   omgezet naar de werkelijk opgelopen aankomstvertraging met de eerstvolgende trein, en pas als die
   de geverifieerde drempel haalt ontstaat er een claim. Dat is verdedigbaar op basis van paragraaf 1
   (vertraging = verschil tussen geplande en werkelijke aankomst) zonder een regel te verzinnen.
3. **Exacte prijs van het traject.** NMBS berekent op de prijs van het vervoersbewijs. Wij kennen die
   prijs niet uit iRail. De gebruiker geeft zijn abonnementstype en -prijs op; wij rekenen daarmee de
   verwachte compensatie **indicatief** uit en labelen dat in de UI ook zo. Het definitieve bedrag
   bepaalt NMBS.
4. **Internationale reizen.** Buiten scope. B1 verwijst voor internationaal naar een aparte regeling;
   RailClaim monitort uitsluitend binnenlands verkeer.

## Onderhoud

`compensation_rules` draagt per regel een `verified_at`. De adminmodule markeert elke regel ouder dan
**6 maanden** als `STALE` en toont een waarschuwing. Bij herverificatie: dit document bijwerken
(bron-URL + nieuwe raadpleegdatum) én `verified_at` in de database aanpassen. De regels staan
**uitsluitend** in de database — er zijn geen drempels of percentages hardcoded in de applicatiecode.
