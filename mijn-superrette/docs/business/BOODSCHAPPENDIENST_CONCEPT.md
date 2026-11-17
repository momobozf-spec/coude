# Mijn Superrette Boodschappendienst: commercieel concept en MVP

Status: concept, november 2026. Opgesteld voor Marhaba Cooperation BV.

In dit document staan drie soorten informatie, telkens apart gemarkeerd:

- **[Bron]**: een gevonden tarief of regel, met link.
- **[Aanname]**: een eigen schatting die je moet meten.
- **[Na te vragen]**: niet bevestigd. Een beslissing hangt ervan af.

Het rekenmodel staat in `packages/basket-engine/src/delivered-basket.ts`. De rekensom per bestelling kun je nadoen met de formules in §3.

---

## 0. Commercieel oordeel in één pagina

**Het eerlijke resultaat.** Iemands boodschappen kopen en thuisbrengen kost veel tijd. Bij een volledig correcte vergoeding voor jouw werk (€22/u) verdient elke bestelling weinig.

Een klant die vooral wil **besparen**, gaat zelf naar Aldi, Lidl of Colruyt. Zo'n klant betaalt geen €15 tot €25 servicekost. "Goedkoopste prijs" en "laten leveren" trekken dus twee verschillende soorten klanten aan.

**De doelgroep die wel betaalt.** Dat zijn mensen die tijd of mobiliteit missen en toch in een winkel zonder eigen thuislevering willen kopen. Voorbeelden van zulke winkels:

- harddiscounters (Aldi, Lidl);
- lokale of gespecialiseerde supermarkten, zoals wereldwinkels, halal- of bioketens;
- Colruyt buiten het leveringsgebied van Collect&Go.

Hun koopreden is: _"mijn eigen winkel en mijn eigen producten, aan huis, op een vast moment"_. Een besparing is hooguit een bijkomend voordeel.

**Aanbevolen startmodel: model 2.** Eén winkel per bestelling, vaste levermomenten, één zone. De prijsvergelijker blijft de gratis instap. Die leert de klant welke winkel voor zijn mand het voordeligst is, en daarna kan hij met één knop laten leveren.

**De cijfers:**

- Je kunt de **€1.000/maand bedrijfsresultaat bovenop een correcte vergoeding voor je eigen werk niet halen met enkel je eigen 20 uur per week**. Daarvoor zijn ongeveer 350 bestellingen per maand nodig, goed voor ongeveer 240 operationele uren.
- Het wordt wel haalbaar zodra een **student of flexi-jobber** het winkelen en leveren doet en jij de planning, verkoop en software. Dan heb je ongeveer 180 bestellingen per maand nodig, ongeveer 45 per week.
- Tot dan is dit vooral een betaalde job van ongeveer €1.300 bruto per maand voor jou, met een bedrijfsresultaat rond nul. De eerste maanden bewijzen alleen dat klanten betalen en terugkomen.

**De twee grootste onzekerheden.** Laat deze eerst bevestigen:

1. **Btw-behandeling.** Ben je doorverkoper van de goederen? Dan valt je vergoeding mogelijk onder 6% btw. Ben je dienstverlener? Dan is het 21%. Bij 21% halveert de marge (§3.5).
2. **Facturen op naam van de BV voor de aankopen.** Zonder zo'n factuur kun je de 6% btw op de goederen niet aftrekken. Bij een doorverkoopmodel verlies je dan ongeveer 5,7% van elke mand.

**Na te vragen bij je boekhouder (zie de skill marhaba-boekhouding-fiscaliteit) en bij de winkels zelf, vóór de eerste betaalde levering.**

---

## 1. Het aanbod

### 1.1 Wie betaalt en waarom bij ons

| Segment                                                                                              | Waarom bestellen ze bij ons?                                                                         | Betalingsbereidheid [Aanname]                                        |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Gezinnen met jonge kinderen en twee werkende ouders                                                  | Ze willen hun vaste discounter of buurtsupermarkt, maar die levert niet. Ze winnen een uur per week. | Hoog voor een wekelijkse vaste ronde                                 |
| Senioren en mensen met beperkte mobiliteit (en hun kinderen die op afstand bestellen)                | Vertrouwde winkel, vaste persoon, vast moment. De kinderen betalen online.                           | Midden tot hoog. Concurrent: OCMW/dienstencentra (goedkoop, beperkt) |
| Klanten van een specifieke winkel zonder levering (halal, Turks, Marokkaans, Aziatisch, bio, lokaal) | Producten die Delhaize, Carrefour en AH niet hebben                                                  | Hoog. Weinig alternatieven                                           |
| Mensen zonder auto die grote volumes nodig hebben (water, luiers, wasmiddel)                         | Gewicht en volume                                                                                    | Midden                                                               |

**Wie we niet bedienen:** de koopjesjager die elke week drie winkels afloopt. Die klant gebruikt de gratis vergelijker, en dat is prima: hij levert bereik en data.

### 1.2 Drie modellen vergeleken

|                          | 1. Alleen vergelijken (abonnement)                                                                             | 2. Bestellen, één winkel                                             | 3. Bestellen, mand uit meerdere winkels                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Klantwaarde              | Laag tot midden. Besparing is klein en vraagt zelf rijden                                                      | Hoog bij de juiste doelgroep: tijd en een vaste winkel               | Lijkt groot, maar de besparing van splitsen (enkele %) gaat meestal op aan de extra stop |
| Marge per eenheid        | ~€2–4/maand per abonnee [Aanname]                                                                              | €3–8 per bestelling (§3)                                             | Lager: extra stop kost ±€6–7 per winkel                                                  |
| Uitvoerbaarheid          | Grootste probleem is de **data**: er zijn geen officiële API's (zie `docs/research/RETAILER_DATA_RESEARCH.md`) | Werkt meteen. Je hoeft maar één winkel per bestelling goed te kennen | Complex: meer wachttijd, meer kassa's, koeling langer onderweg                           |
| Tijd tot eerste betaling | Lang. Er zijn honderden abonnees nodig voor €1.000                                                             | **Kort: de eerste klant kan in week 1 betalen**                      | Midden                                                                                   |
| Voor €1.000/maand        | ±400 betalende abonnees bij €2,99                                                                              | ±180 bestellingen/maand met student-uitvoering                       | Pas zinvol bij hoge dichtheid                                                            |

**Keuze: model 2.** Het is het snelst naar de eerste betaling, operationeel beheersbaar, en het gebruikt de bestaande vergelijker als verkoopkanaal. Model 3 bieden we pas aan als de **totale prijs inclusief extra-winkeltoeslag** lager uitvalt. De app rekent dat zelf uit en toont het (§5.3). Model 1 blijft als gratis basislaag. Een betaald Plus-abonnement kan later "gratis levering" of korting op servicekosten bevatten.

### 1.3 Testprijs

**€14,95 per levering + 8% van de winkelprijs, minimumbestelling €60.** De winkelprijs zelf rekenen we zonder opslag door, op basis van het kasticket.

| Mand (winkelprijs) | Servicekost | Klant betaalt |
| ------------------ | ----------- | ------------- |
| €60                | €19,75      | €79,75        |
| €100               | €22,95      | €122,95       |
| €150               | €26,95      | €176,95       |

Waarom zo duur? Een tarief op het niveau van Delhaize (€5,95–€10,95 levering [Bron 1]) is verlieslatend zodra je je eigen tijd meetelt (§3.2, prijs A). We verkopen dit dus niet als "goedkoper dan Delhaize". We verkopen het als _"jouw winkel, aan huis, door een vaste shopper"_.

Bij de validatie testen we ook een tweede prijspunt: een abonnement van **€69/maand voor 4 wekelijkse leveringen tot €150**. Dat is €17,25 per levering, met meer voorspelbare routes.

---

## 2. Markt en databronnen

### 2.1 Bestaande diensten (België)

| Speler                                                                       | Wat                                                                | Tarief / minimum                                                                | Bron                  |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------- | --------------------- |
| Delhaize Home Delivery                                                       | Thuislevering vanuit Delhaize                                      | €5,95–€10,95 per levering, 30% korting met SuperPlus                            | [Bron 1]              |
| Albert Heijn België                                                          | Thuisbezorging in een deel van Vlaanderen                          | Bestellen vanaf €50, bezorgkosten "vanaf €1,70" (met Buurtmoment); bezorgbundel | [Bron 2], [Bron 3]    |
| Colruyt Collect&Go                                                           | Vooral afhalen; thuislevering in uitbreiding (Halle, Gent, Brugge) | Thuislevering ±€8,50–€8,95 (secundaire bron)                                    | [Bron 4], [Bron 5]    |
| Carrefour België                                                             | Thuislevering en Click & Collect                                   | Secundaire bron: levering ±€3–7                                                 | [Bron 6]              |
| Quick commerce / platforms (Deliveroo met Carrefour, vroeger Getir/Gorillas) | Kleine manden, snel                                                | Tarieven per app, niet bevestigd                                                | [Bron 7]              |
| OCMW / lokale dienstencentra                                                 | Boodschappendienst voor senioren                                   | Per gemeente                                                                    | [Na te vragen] lokaal |

**Gat in de markt:** Aldi en Lidl hebben in België geen eigen thuislevering van boodschappen. [Na te vragen]: ik vond geen bron die het tegendeel zegt, maar controleer dit nog. Ook de meeste etnische, lokale en speciaalzaken leveren niet.

Alle tarieven hierboven wijzigen vaak. Controleer ze in de checkout van elke dienst voordat je ze in marketing gebruikt.

### 2.2 Prijzen, promoties en beschikbaarheid: wat mag en wat werkt

Dit onderzoek bestaat al in `docs/research/RETAILER_DATA_RESEARCH.md`. De korte versie:

| Bron                                                                          | Status                                                                                                                                                                                                             |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Officiële publieke prijs-API van Colruyt, Delhaize, AH, Carrefour, Aldi, Lidl | **Niet gevonden / bestaat niet publiek.** In de code staan ze als `UNSUPPORTED`.                                                                                                                                   |
| Partnerschap of datalicentie                                                  | Bestaat niet. Kun je aanvragen (`PartnerFeedProvider` vereist een `licenseReference`).                                                                                                                             |
| Folders (papier en pdf op de eigen websites)                                  | Publiek bedoeld voor consumenten. Promoties overnemen door ze **handmatig in te voeren** kan; massaal automatisch overnemen niet zonder toestemming. Let op auteursrecht op de foto's: neem alleen de feiten over. |
| Websites van winkels                                                          | **Geen scraping**, geen omzeilen van bot-bescherming. Dat is een harde regel van dit project.                                                                                                                      |
| Open Prices (Open Food Facts)                                                 | Bestaat en is legaal (ODbL), maar crowdsourced en onvolledig. Zit al in de code.                                                                                                                                   |
| **Eigen kastickets en schapfoto's**                                           | **De sterkste bron voor model 2.** Wie voor klanten winkelt, ziet elke ronde de echte schapprijs en krijgt het ticket. Voer die in als eigen observatie, met bron "eigen waarneming", datum en winkel.             |
| Realtime voorraad                                                             | **Bestaat niet voor ons.** We beloven nooit dat iets op voorraad is, alleen "laatst gezien op <datum>".                                                                                                            |

**Een pilot zonder volledige marktdekking.** Kies één winkel (bijvoorbeeld één Lidl of één Aldi in je zone). Leg een assortiment van **±300 meest gekochte producten** vast met schapprijs en datum. Breid dat uit met elk kasticket. Producten buiten die lijst kunnen klanten als vrije tekst bestellen ("1 pak volle melk"). De prijs is dan een schatting met een maximumbedrag (§4.2).

---

## 3. Rekensom per bestelling

### 3.1 Aannames [Aanname, meten in week 1–2]

| Post                                                           | Waarde                                                                                                                                   |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Admin en klantcontact                                          | 4 min per bestelling                                                                                                                     |
| Winkelen                                                       | 8 min + 1 min per €8 winkelwaarde (gesorteerd per gang)                                                                                  |
| Afrekenen, factuur vragen, inpakken in koelbox                 | 6 min                                                                                                                                    |
| Rijden en afleveren, **gebundeld** (5–6 adressen binnen ±2 km) | 9 min                                                                                                                                    |
| Rijden en afleveren, **op aanvraag**                           | 24 min                                                                                                                                   |
| Auto                                                           | €0,35/km; gebundeld 4 km, op aanvraag 12 km per bestelling                                                                               |
| Betaling (Bancontact via Mollie)                               | €0,39 per transactie [Bron 8; actuele prijs controleren]                                                                                 |
| Verpakking (herbruikbare kratten, koelelementen, slijtage)     | €0,60                                                                                                                                    |
| Ontbrekende producten, prijsverschillen, goodwill              | €1,00                                                                                                                                    |
| Klantenservice-tools                                           | €0,40                                                                                                                                    |
| Mislukte leveringen                                            | 3% van de arbeidskost opnieuw                                                                                                            |
| Vergoeding eigen werk                                          | **€22/u** (loonkost voor de BV, vóór jouw personenbelasting)                                                                             |
| Externe shopper (student of flexi-job)                         | **€17/u** loonkost [Aanname; laat je sociaal secretariaat berekenen]                                                                     |
| Vaste kosten/maand                                             | €300: verzekering BA + goederen ±€40, boekhouding extra ±€50, software/hosting ±€30, marketing ±€150, FAVV-heffing en koelmateriaal ±€30 |

De winkelprijs zelf geef je zonder opslag door. Er staat geen supermarktcommissie of groothandelskorting in de berekening, omdat daar geen bewijs voor is.

### 3.2 Bijdrage per bestelling (gebundelde ronde, btw op de vergoeding 6%)

**Prijs A: "Delhaize-niveau" (€9,95 + 5%)**

| Mand | Klant betaalt fee | Netto fee | Variabel | Arbeid (eigen €22/u) | **Bijdrage** | Met student €17/u |
| ---- | ----------------- | --------- | -------- | -------------------- | ------------ | ----------------- |
| €50  | €12,45            | €11,75    | €4,15    | €12,10 (33 min)      | **−€4,51**   | −€1,68            |
| €100 | €14,95            | €14,10    | €4,22    | €14,30 (39 min)      | **−€4,42**   | −€1,07            |
| €150 | €17,45            | €16,46    | €4,29    | €16,50 (45 min)      | **−€4,32**   | −€0,46            |

**Prijs B: testprijs (€14,95 + 8%)**

| Mand | Klant betaalt fee | Netto fee | Variabel | Arbeid (eigen) | **Bijdrage** | Met student |
| ---- | ----------------- | --------- | -------- | -------------- | ------------ | ----------- |
| €50  | €18,95            | €17,88    | €4,15    | €12,10         | **+€1,62**   | +€4,46      |
| €100 | €22,95            | €21,65    | €4,22    | €14,30         | **+€3,13**   | +€6,48      |
| €150 | €26,95            | €25,42    | €4,29    | €16,50         | **+€4,64**   | +€8,50      |

**Levering op aanvraag** (24 min rijden, 12 km) is bij beide prijzen verlieslatend. Bij prijs B en een mand van €100 is de bijdrage −€6 tot −€9. **Daarom alleen vaste levermomenten met gebundelde routes.**

De €50-mand dekt nauwelijks de kosten, daarom geldt een minimum van €60.

### 3.3 Break-even en het doel van €1.000/maand

Gemiddelde mand €120, prijs B, gebundeld, 6% btw:

|                         | Bijdrage/bestelling | Break-even (vaste kosten €300) | Voor €1.000 bedrijfsresultaat | Operationele uren nodig                                          |
| ----------------------- | ------------------- | ------------------------------ | ----------------------------- | ---------------------------------------------------------------- |
| Alles zelf              | €3,73               | 80 bestellingen/maand          | **348 bestellingen/maand**    | ±240 u/maand                                                     |
| Student shopt en levert | €7,29               | 41 bestellingen/maand          | **178 bestellingen/maand**    | ±123 u/maand **student**; jij ±25–35 u/maand planning en verkoop |

**Past het binnen je 20 u/week (±86 u/maand)?**

- **Alles zelf:** nee. Met ±60 u/maand operationeel (de rest gaat naar verkoop en software) doe je ±87 bestellingen. Dan krijg je **€1.320 bruto vergoeding** voor je werk en ±€25 bedrijfsresultaat.
- **Met een student:** ja. Het doel van €1.000 vraagt ±45 bestellingen per week, bijvoorbeeld 4 avonden met 2 rondes van 6 adressen.

### 3.4 Drie bedragen apart houden

Voor jou als zaakvoerder van de BV:

1. **Vergoeding voor eigen werk:** loonkost of bezoldiging, kosten voor de BV, belast in je personenbelasting met sociale bijdragen.
2. **Bedrijfsresultaat:** wat overblijft na alle kosten, ook jouw vergoeding. Het doel van €1.000/maand is dit bedrag.
3. **Vennootschapsbelasting:** op dat resultaat. Het verlaagd tarief van 20% op de eerste schijf geldt onder voorwaarden, onder meer een minimale bezoldiging van de bedrijfsleider. [Na te vragen bij je boekhouder.] Wat na belasting overblijft, kun je pas via een dividend (met roerende voorheffing) privé opnemen.

€1.000 resultaat is dus niet €1.000 "in je zak".

### 3.5 Btw: waarom dit de belangrijkste beslissing is

- Gewone voedingsmiddelen staan in België op **6%**. Sinds 1 maart 2026 gaan bepaalde meeneemmaaltijden en bereide voeding naar 12% [Bron 9, Bron 10]. Controleer de precieze afbakening in KB nr. 20, tabel A/B.
- **Als doorverkoper/commissionair** koop je in eigen naam en verkoop je door. Dan omvat de maatstaf van heffing ook de kosten van vervoer die je aanrekent (art. 26 WBTW). Je service- en leveringskost volgt dan mogelijk het tarief van de goederen, overwegend 6%. [Na te vragen: bevestigen met je boekhouder of via een voorafgaande beslissing.]
- **Als zuivere dienstverlener** (de klant koopt, jij haalt op): **21%** op de vergoeding. Dan zakt de bijdrage bij een mand van €120 van €3,73 naar **€0,86** (eigen werk) en van €7,29 naar €4,42 (student). Het doel van €1.000 vraagt dan ±1.500 of ±300 bestellingen.
- **Aftrek van voorbelasting.** Als doorverkoper heb je een **factuur op naam van Marhaba Cooperation BV** nodig, met btw-nummer. Een gewoon kasticket volstaat niet. Zonder factuur betaal je 6% btw op de verkoop en kun je de 6% op de aankoop niet aftrekken: dat is ±€5,66 verlies op een mand van €100.
- [Na te vragen per winkel, in week 1]: kan de kassa een factuur op naam van de BV maken (Colruyt, Aldi, Lidl), en zijn er limieten voor professionele aankopen?

### 3.6 Wanneer loont meer dan één winkel?

Een extra winkel kost ±18 minuten (een extra parkeer- en winkelronde plus een extra kassa) en ±2 km. Dat is **±€7,30 met eigen arbeid** of ±€5,80 met een student.

| Mand | Prijsverschil bij splitsen [Aanname 3–6%] | Extra stop | Loont?                                                                           |
| ---- | ----------------------------------------- | ---------- | -------------------------------------------------------------------------------- |
| €50  | €1,50–€3,00                               | €6–7       | Nee                                                                              |
| €100 | €3–€6                                     | €6–7       | Bijna nooit                                                                      |
| €150 | €4,50–€9                                  | €6–7       | Alleen bij grote prijsverschillen of als een product nergens anders te vinden is |

Daarom rekent de app altijd met **totaalprijs = winkelprijzen + basistarief + percentage + €6 extra-winkeltoeslag per bijkomende winkel**. De code (`FulfilmentPricing.compare`) toont de klant de goedkoopste optie inclusief alle kosten. Als splitsen alleen op schapprijs goedkoper leek, meldt de app: "de extra winkel kost meer dan je bespaart".

---

## 4. Uitvoering van bestelling tot levering

### 4.1 Betaling

1. Bij het bestellen geeft de klant via Mollie een **pre-autorisatie of betaling voor het geschatte bedrag + buffer** (standaard +15%, door de klant in te stellen). Kaarten ondersteunen pre-autorisatie, Bancontact niet altijd. [Na te vragen: welke methoden "authorize then capture" ondersteunen.]
2. Alternatief voor Bancontact: de klant betaalt het geschatte bedrag vooraf. Na het winkelen volgt een **verrekening**: we storten het verschil automatisch terug, of de klant betaalt het tekort bij via een betaallink.
3. De eindfactuur gebruikt de bedragen van het **echte kasticket**. Een foto van het ticket zit in de bestelling.

### 4.2 Geschatte en werkelijke prijzen

- Elke prijs in de app toont **bron, datum en winkel**: "schapprijs gezien op 12/11", "folder week 46", "schatting".
- De klant stelt een **maximum extra bedrag** in (standaard €10 of 15%). Komt het ticket daarboven, dan belt of berichtet de shopper vóór de kassa. Antwoordt de klant niet binnen 5 minuten, dan laten we de duurste afwijkende producten weg.

### 4.3 Vervangproducten

Per product kiest de klant:

- _niet vervangen_;
- _vergelijkbaar product, max. +X%_;
- _specifiek alternatief_.

Default: _vergelijkbaar, max. +10%, zelfde dieetkenmerken_ (halal, vegetarisch, lactosevrij en dergelijke worden **nooit** zonder toestemming vervangen door een product zonder dat kenmerk). Het voorstel komt van de equivalentie-engine (`ProductEquivalenceEngine`). De shopper bevestigt in de app met een foto.

### 4.4 Promoties, klantenkaarten en persoonlijke kortingen

- **Algemene schappromoties** (1+1, −30%) die aan de kassa vanzelf gelden, gaan volledig naar de klant. Volgens het ticket.
- **Kaartpromoties** (Xtra, SuperPlus, Lidl Plus): gebruik **niet je eigen kaart voor klanten**. Dat is meestal in strijd met de kaartvoorwaarden en vermengt persoonsgegevens. [Na te vragen per programma.] De app toont de kaartprijs als "niet van toepassing bij levering" (dat bestaat al als `missedPromotions` met reden).
- **Persoonlijke kortingen of bonnen van de klant:** in de pilot niet. Later eventueel als de klant een digitale bon deelt, maar alleen als de voorwaarden van de winkel dat toelaten.
- **Volumelimieten** ("max. 6 per klant"): we respecteren ze per klantbestelling en per kassabeurt. We kopen nooit gericht promoties op voor doorverkoop.

### 4.5 Vers, gekoeld en diepvries

- Volgorde: eerst droge waren, gekoeld op het einde, diepvries als laatste.
- **Koelboxen met koelelementen** per bestelling, met gescheiden zakken voor diepvries. Vanaf groei een thermometerlogger in de box.
- Maximale tijd van kassa tot aflevering: **60 minuten** voor gekoeld en diepvries. Dat bepaalt de grootte van een ronde.
- Volg de B2C-autocontrolegids van het FAVV (G-044), met het luik vervoer [Bron 11]. Leg een eenvoudig registratieformulier vast: temperatuur, tijden, schoonmaak van de boxen.

### 4.6 Wie koopt, haalt op en levert

- **Week 1–4:** jij doet alles zelf. Dat is ook je meetperiode.
- **Vanaf ±25 bestellingen/week:** een student of flexi-jobber met eigen auto, betaald per uur (niet per stuk: dat geeft minder druk en minder fouten), met een vaste instructie.
- **Externe koerier als scenario:** de shopper winkelt, de koerier levert. Dat werkt alleen als het koeriertarief per adres onder ±€5 ligt. [Na te vragen: offertes bij lokale fietskoeriers.] Anders is het duurder dan één persoon die beide doet.

### 4.7 Tijdsloten, zones en capaciteit

- **Eén zone:** 2 tot 3 postcodes rond één winkel, binnen ±10 minuten rijden.
- **Vaste levermomenten:** di, do en za, telkens 17:30–19:30 en 19:30–21:30 (za 10:00–12:00).
- **Maximaal 6 bestellingen per slot.** Bestellen kan tot 12:00 dezelfde dag.
- De app sluit een slot automatisch als het vol zit.

### 4.8 Ontbrekende producten, annuleringen en klachten

- **Ontbrekend product:** wordt niet aangerekend. De klant krijgt meteen een bericht.
- **Annuleren gratis** tot de shopper begint. Daarna wordt de winkelaankoop aangerekend (die is dan al gekocht) en vervalt de servicekost. Dit staat in de voorwaarden.
- **Herroepingsrecht:** voor bederfelijke goederen geldt het niet [Bron 12]. Voor niet-bederfelijke goederen in principe wel, binnen 14 dagen. Neem dat correct op in je voorwaarden. [Na te vragen: tekst van art. VI.53 WER en het modelformulier van de FOD Economie.]
- **Klacht** (kwaliteit, beschadiging): een foto binnen 24 uur geeft een credit. Bij een herhaalde klacht neem je zelf contact op.

### 4.9 Verplichtingen in België

| Onderwerp                                   | Wat we doen                                                                                                                                                                                                                                | Zekerheid                                                                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| **FAVV**                                    | Registratie aanvragen voor de activiteit "handel/distributie" met vervoer van levensmiddelen, via de LCE van je provincie of het ondernemingsloket. HACCP-basiskennis. Jaarlijkse heffing (bedrag zie de brochure 2026) [Bron 13, Bron 14] | Registratieplicht bevestigd. **Welke activiteitencode precies geldt (doorverkoper of vervoerder) is na te vragen bij de LCE** |
| **Rol: doorverkoper of aankoopbemiddelaar** | Aanbeveling: **doorverkoper / commissionair in eigen naam**. Jij koopt en verkoopt door met een correcte factuur. Dat is duidelijk voor btw, aansprakelijkheid en consumentenrecht                                                         | Juridisch en fiscaal te bevestigen                                                                                            |
| **Consumentenrecht (WER boek VI)**          | Precontractuele informatie, totaalprijs vóór bestelling, herroepingsregels, algemene voorwaarden, ondernemingsgegevens op de site                                                                                                          | Bevestigd als verplichting; de concrete tekst laten nalezen                                                                   |
| **Verzekering**                             | BA uitbating, goederen tijdens vervoer, auto voor beroepsgebruik (niet je privépolis!), arbeidsongevallen zodra er personeel is                                                                                                            | Offertes vragen                                                                                                               |
| **Privacy (GDPR)**                          | Adres, telefoon en eventueel gezondheidsinfo (dieet) zijn persoonsgegevens; dieet kan gevoelig zijn. Verwerkersovereenkomst met Mollie en hosting, bewaartermijnen. Zit grotendeels al in `docs/PRIVACY_ARCHITECTURE.md`                   | Bevestigd                                                                                                                     |
| **Voorwaarden van winkels**                 | Aankopen voor derden en doorverkoop: geen algemeen verbod gevonden, wel tijdelijke aankooplimieten [Bron 15]. Een winkel mag je weigeren                                                                                                   | **Per winkel na te vragen. Bij twijfel eerst de filiaalmanager aanspreken**                                                   |
| **Personeel**                               | Studentenarbeid (urencontingent) of flexi-job, Dimona-aangifte, sociaal secretariaat                                                                                                                                                       | Na te vragen bij je sociaal secretariaat                                                                                      |

---

## 5. MVP

### 5.1 Prototype of productieklaar

|              | Klikbaar prototype (nu mogelijk)                          | Productieklare dienst                                                    |
| ------------ | --------------------------------------------------------- | ------------------------------------------------------------------------ |
| Betalingen   | Geen, of een Mollie-betaallink die je handmatig maakt     | Mollie API met pre-autorisatie en verrekening, webhooks, terugbetalingen |
| Prijzen      | Assortiment van één winkel, handmatig ingevoerd met datum | Prijsobservaties uit tickets en schapfoto's via de admin                 |
| Bestellingen | Formulier, plus WhatsApp of mail naar jou                 | Statusflow, slotcapaciteit, shopper-app                                  |
| Juridisch    | Voorwaarden in concept                                    | Nagelezen voorwaarden, FAVV-registratie, verzekering                     |

Wat al bestaat in deze repo en hergebruikt wordt: zoeken, productmatching, eenheidsprijzen, promotie-engine, boodschappenlijsten (gedeeld en realtime), mandvergelijking, Smart Basket, de admin met matchreview, privacy en i18n (nl/fr/en). **Nieuw toegevoegd:** `FulfilmentPricing`, de totaalprijs inclusief service-, leverings- en extra-winkelkosten, met tests.

### 5.2 Klantomgeving

1. **Boodschappenlijst:** typen, plakken of een foto van een handgeschreven lijstje.
2. **Vergelijken:** per winkel de totale winkelprijs, met bron en datum per prijs.
3. **Aanbevolen mand:** de goedkoopste optie **inclusief alle kosten** (`FulfilmentPricing.compare`).
4. **Kostenoverzicht:** winkelprijs (geschat), servicekost, eventuele extra-winkeltoeslag, maximum extra bedrag.
5. **Vervangvoorkeuren** per product (§4.3).
6. **Tijdslot** uit de beschikbare slots.
7. **Betalen** (§4.1).
8. **Bestelstatus:** ontvangen → aan het winkelen → vragen over vervangingen → afgerekend (met ticket) → onderweg → geleverd → verrekend.

### 5.3 Interne omgeving (uitbreiding van `apps/admin`)

- **Producten en prijsbronnen:** observatie invoeren vanaf een ticket of foto; per prijs bron, datum en "verouderd na X dagen".
- **Actualiteit:** dashboard met het aandeel prijzen per winkel dat ouder is dan 7, 14 of 30 dagen.
- **Bestellingen:** lijst per slot, met status.
- **Bundelen:** picklijst per winkel en slot, gesorteerd per gang, met vakjes per klant.
- **Vervangingen:** voorstel, foto en goedkeuring van de klant in één scherm.
- **Leveringsplanning:** volgorde van de adressen. In het begin een eenvoudige "dichtstbijzijnde eerst"-heuristiek, later een routeplanner.
- **Verrekening:** ticketbedrag invoeren; het verschil met de schatting gaat automatisch naar terugbetaling of bijbetaling.

### 5.4 Wat AI doet, en wat niet

| AI (taalmodel) **mag**                                                                         | AI **mag nooit**                                                  |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Een rommelig lijstje omzetten naar regels ("2 pakken melk, halfvolle" → item, aantal, variant) | Een prijs, promotie of totaal berekenen of verzinnen              |
| Een foto of handschrift van een lijstje lezen (met een controlescherm voor de klant)           | Beweren dat iets op voorraad is                                   |
| Vergelijkbare producten voorstellen uit **ons eigen** catalogusbestand                         | Een besparing noemen die niet uit de deterministische engine komt |
| In gewone taal uitleggen waarom een alternatief is voorgesteld                                 | Een vervanging uitvoeren die een dieetkenmerk schendt             |

Prijzen, promoties, eenheidsprijzen, mandtotalen en servicekosten komen **uitsluitend** uit `pricing-engine`, `basket-engine` en `FulfilmentPricing`. Demonstratiedata blijft gemarkeerd als `DEVELOPMENT_SEED` en "Voorbeelddata".

### 5.5 Bouwvolgorde (na positieve validatie)

1. Orders-schema (order, orderregel met geschatte en werkelijke prijs, vervangbeslissing, slot, betaling) en de statusmachine in de API.
2. Slots en capaciteit, en de checkout in de app met `FulfilmentPricing`.
3. Mollie-integratie (eerst in testmodus), met webhooks en verrekening.
4. Shopper-weergave: picklijst, vervangingen, ticket uploaden.
5. Lijstje-parser met een taalmodel, achter een feature flag, met verplichte bevestiging door de klant.

---

## 6. Validatieplan van 14 dagen

**Startopzet:** één winkel (de Lidl of Aldi die het dichtst bij je zone ligt, of een buurtsupermarkt die niet levert en meewerkt), **2 postcodes**, levermomenten **di en do 18:00–20:00 en za 10:00–12:00**, maximaal 6 bestellingen per slot. Uitvoering volledig handmatig.

**Waarom?** Een harddiscounter levert zelf niet, heeft een klein en stabiel assortiment (makkelijk om 300 producten vast te leggen) en een bekende naam die je in je pitch kunt gebruiken. Gebruik geen logo's of huisstijl van de winkel, en suggereer geen samenwerking die er niet is.

| Dag   | Wat                                                                                                                                                                |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1–2   | Boekhouder: btw-rol en facturen. Filiaalmanager: factuur op naam van de BV, aankopen voor derden. FAVV-registratie aanvragen. Verzekeringsofferte.                 |
| 2–3   | Een landingspagina met het aanbod ("Lidl- of Aldi-boodschappen aan huis, vaste shopper, €14,95 + 8%"), bestelformulier, Mollie-betaallink. Voorwaarden in concept. |
| 3     | 300 producten met schapprijs en datum vastleggen (zelf in de winkel, met foto's).                                                                                  |
| 4–10  | Klanten werven (zie hieronder). Eerste leveringen. Alles meten: minuten per stap, km, afwijkingen tussen schatting en ticket.                                      |
| 11–12 | Tweede prijspunt testen (abonnement €69/maand) bij nieuwe aanvragen.                                                                                               |
| 13–14 | Evaluatie tegen de criteria hieronder.                                                                                                                             |

**De eerste tien betalende klanten:**

- Je eigen netwerk en dat van familie: berichten in buurt- en schoolgroepen op WhatsApp en Facebook.
- Flyers bij kinderopvang, apotheken, dienstencentra en moskeeën of verenigingen in de zone (met toestemming).
- Een gratis eerste servicekost voor de eerste 10 klanten. De boodschappen betalen ze wel zelf.
- Kinderen van senioren aanspreken: "doe de boodschappen voor je ouders vanop afstand".

**Minimaal testbudget [Aanname]:**

| Post                                    | Bedrag                                                                       |
| --------------------------------------- | ---------------------------------------------------------------------------- |
| Flyers                                  | €60                                                                          |
| 3 koelboxen + koelelementen + 6 kratten | €120                                                                         |
| Domein en landingspagina                | €20                                                                          |
| Mollie                                  | geen vaste kost                                                              |
| Brandstof                               | €40                                                                          |
| Kortingen eerste klanten                | 10 × €15 = €150                                                              |
| **Totaal**                              | **±€390**, exclusief verzekering, FAVV en eventuele kosten van de boekhouder |

**Wat je eerst handmatig doet:** bestellingen via een formulier, prijzen in een spreadsheet of in de admin, betaallinks per bestelling, picklijst op papier en verrekening met de hand. Software alleen voor wat in die 14 dagen echt pijn doet.

**Criteria (na 14 dagen):**

|                                            | Doorgaan            | Bijsturen                           | Stoppen                                   |
| ------------------------------------------ | ------------------- | ----------------------------------- | ----------------------------------------- |
| Betalende klanten                          | ≥ 10                | 5–9                                 | < 5                                       |
| Herhaalbestelling binnen 14 dagen          | ≥ 40%               | 20–40%                              | < 20%                                     |
| Gemeten minuten per bestelling (gebundeld) | ≤ 40                | 40–55                               | > 55                                      |
| Gemiddelde mand                            | ≥ €90               | €60–90                              | < €60                                     |
| Afwijking schatting ↔ ticket               | ≤ 5%                | 5–10%                               | > 10%                                     |
| Klachten                                   | ≤ 1 op 10           | 2–3                                 | > 3                                       |
| Btw en facturen geregeld                   | Ja (6% en facturen) | 21%: dan prijs omhoog of abonnement | Geen factuur mogelijk en geen alternatief |

**Bijsturen** betekent een andere winkel, andere zone, een andere doelgroep (bijvoorbeeld alleen senioren via hun kinderen) of een andere prijs.

---

## Bronnen

1. Test-Aankoop, _Delhaize SuperPlus-kaart_: https://www.test-aankoop.be/familie-prive/supermarkten/nieuws/superpluskaart-delhaize
2. Albert Heijn België, klantenservice thuisleveren: https://www.ah.be/klantenservice/thuisleveren/zakelijk
3. Albert Heijn België, algemene voorwaarden B2C (maart 2026): https://static.ah.nl/binaries/ah/content/assets/ah-be/core/legal/2026/algemene-vw-b2c---belgie-2026-03-161033144.1.pdf
4. RetailDetail, Collect&Go servicekosten: https://www.retaildetail.be/nl/news/food/collectgo-verhoogt-servicekost-op-piekmomenten/
5. Subger (secundair, niet officieel), Collect&Go: https://subger.com/de/service/collect-go-be
6. Subger (secundair), Carrefour België: https://subger.com/en/service/carrefour-be
7. Test-Aankoop, supermarkten leveren aan huis: https://www.test-aankoop.be/familie-prive/supermarkten/nieuws/supermarkten-leveren-aan-huis
8. Mollie, Bancontact: https://www.mollie.com/payments/bancontact
9. Forum for the Future (FOD Financiën), hervorming btw-tarieven: https://blog.forumforthefuture.be/nl/article/hervorming-van-bepaalde-btw-tarieven-in-de-praktijk/30210
10. Billy, btw-tarief 12%: https://billy.tech/nl/gids/fiscaliteit/btw/btw-tarieven/btw-tarief-12/
11. FAVV, praktijkhandboek autocontrole B2C (G-044): https://favv-afsca.be/sites/default/files/2023-08/G-044_Praktijkhandboek_Nl_met_voorblad.pdf
12. Your Europe, herroepingsrecht en uitzonderingen: https://europa.eu/youreurope/business/selling-in-eu/selling-goods-services/ecommerce-distance-selling/index_nl.htm
13. VLAIO, voedselveiligheid (FAVV): https://www.vlaio.be/nl/begeleiding-advies/vergunningen-getuigschriften/sector-overschrijdende-vergunningen/voedselveiligheid-favv
14. FAVV, brochure heffingen 2026: https://favv-afsca.be/sites/default/files/2026-06/brochure%202026%20NL%20V2.pdf
15. VRT NWS, aankooplimiet Colruyt (2023): https://www.vrt.be/vrtnws/nl/2023/04/17/colruyt-aankooplimiet/

Tarieven van derden (Subger) en oudere artikels zijn indicatief. Controleer ze in de checkout van elke dienst.
