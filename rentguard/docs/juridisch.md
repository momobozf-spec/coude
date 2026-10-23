# Juridisch dossier — RentGuard Brussels

> **Status van dit document:** werkdocument voor productontwikkeling.
> **Dit is geen juridisch advies.** Alle regels hieronder moeten vóór lancering
> door een jurist met kennis van Brussels huurrecht worden gevalideerd.

Laatste onderzoeksronde: **2026-08-29**.

## 0. Methodologie en eerlijkheid over bronnen

Voor elke regel leggen we vast: `rule_key`, `source_url`, `source_name`,
`verified_at` en `status`.

Betekenis van de statussen in dit project:

- **VERIFIED** — teruggevonden in een officiële bron (Belgisch Staatsblad /
  Moniteur belge, of een officiële overheidswebsite van het Brussels
  Hoofdstedelijk Gewest). VERIFIED betekent hier *bronvast*, **niet**
  *juridisch geaccordeerd*.
- **UNVERIFIED** — enkel via secundaire bronnen gevonden (advocatenblogs,
  vastgoedmedia, commerciële tools), of officiële bronnen spreken elkaar tegen.
  **De applicatie mag zo'n regel niet als vaststaand presenteren.**
- **STALE** — `verified_at` is ouder dan 6 maanden. De UI toont een
  waarschuwing; de berekening blijft beschikbaar maar wordt gemarkeerd.

**Harde productregel:** een berekening of brief die steunt op een
`UNVERIFIED`-regel wordt in de UI zichtbaar gemarkeerd als "nog te verifiëren"
en nooit gepresenteerd als een uitkomst waarop de gebruiker blind mag varen.

### Belangrijke beperking van deze onderzoeksronde

De geconsolideerde tekst van de Brusselse Huisvestingscode op
`ejustice.just.fgov.be` kon in deze ronde **niet betrouwbaar automatisch
opgehaald** worden: de Justel-pagina levert metadata terug, of zelfs een
volledig andere akte, in plaats van de artikelteksten. De artikelnummers en
formuleringen hieronder komen daarom uit:

1. `etaamb.openjustice.be` — een publieke reproductie van de tekst uit het
   Belgisch Staatsblad van de Ordonnantie van 04/04/2024;
2. secundaire bronnen (BIV/IPI, advocatenkantoren, vastgoedmedia).

Zolang de geconsolideerde codetekst niet artikel per artikel is nagelezen,
krijgt **geen enkele** regel hieronder de kwalificatie "juridisch geaccordeerd".

---

## 1. Huurwaarborg (Brussels Hoofdstedelijk Gewest)

### Wettelijk kader

De Ordonnantie van **4 april 2024** wijzigt de Brusselse Huisvestingscode
(Ordonnantie van 17 juli 2003) met het oog op de concretisering van het recht op
wonen. Publicatie in het Belgisch Staatsblad op **22 april 2024**;
inwerkingtreding op de eerste dag van de maand na verloop van zes maanden na
publicatie, dus **1 november 2024**.

**Toepassingsgebied (belangrijk).** De nieuwe regels gelden voor
huurovereenkomsten die **gesloten of hernieuwd zijn vanaf 1 november 2024**.
Voor oudere lopende contracten kunnen de oude regels blijven gelden. De
applicatie moet daarom altijd de begindatum van het huurcontract meenemen en mag
nooit één regel op alle contracten toepassen.

### Vastgelegde regels

| rule_key | Inhoud | Status |
|---|---|---|
| `bxl.deposit.max_months` | De huurwaarborg bedraagt **maximaal 2 maanden huur** (voorheen 2 of 3 maanden naargelang de vorm). Gewijzigd art. 248 Brusselse Huisvestingscode. | VERIFIED |
| `bxl.deposit.allowed_forms` | De **huurder kiest** de vorm: (1) geïndividualiseerde rekening op naam van de huurder bij een erkende financiële instelling, (2) bankwaarborg via een contract tussen OCMW en bank, (3) progressief samen te stellen bankwaarborg, (4) zakelijke zekerheid bij een erkende financiële instelling, (5) persoonlijke borgstelling (studentenhuur, cumuleerbaar). Gewijzigd art. 248. | VERIFIED |
| `bxl.deposit.restitution_deadline_months` | De waarborg moet **binnen 2 maanden na teruggave van de sleutels** aan de verhuurder worden vrijgegeven. Gewijzigd art. 249. | VERIFIED |
| `bxl.deposit.late_penalty_pct_per_month` | Bij overschrijding is de verhuurder **10 % van het waarborgbedrag per maand vertraging** verschuldigd. Gewijzigd art. 249. | VERIFIED |
| `bxl.deposit.partial_block_allowed` | Gedeeltelijke blokkering is toegelaten in gebouwen met meerdere eenheden, in afwachting van de jaarlijkse afrekening van de lasten. Gewijzigd art. 249. | VERIFIED |
| `bxl.deposit.cash_prohibited` | De waarborg mag **niet in cash** betaald worden; gebeurt dat toch, dan moet de verhuurder het bedrag op een geïndividualiseerde rekening plaatsen. | UNVERIFIED (enkel secundaire bron) |

**Bronnen**

- Ordonnantie van 04/04/2024 tot wijziging van de Brusselse Huisvestingscode —
  <https://etaamb.openjustice.be/fr/ordonnance-du-04-avril-2024_n2024003465.html>
  (geraadpleegd 2026-08-29)
- BIV/IPI, "Wijzigingen Brusselse Huisvestingscode gaan in op 1 november" —
  <https://www.biv.be/nieuws/artikels/wijzigingen-brusselse-huisvestingscode-gaan-op-1-november-0>
  (geraadpleegd 2026-08-29) — secundair
- Geconsolideerde Huisvestingscode (nog artikel per artikel na te lezen) —
  <https://www.ejustice.just.fgov.be/eli/ordonnance/2003/07/17/2003031392/justel>

### Openstaande vragen voor de jurist

1. Loopt de termijn van 2 maanden vanaf de sleuteloverdracht, of vanaf het einde
   van de huurovereenkomst wanneer die niet samenvallen?
2. Is de boete van 10 % per maand van rechtswege verschuldigd, of vereist ze een
   ingebrekestelling? **Dit bepaalt of onze ingebrekestelling die boete mag
   vorderen.** Tot dat antwoord er is, vermeldt de brief de boete als
   *aanspraak onder voorbehoud*, niet als vaststaand bedrag.
3. Gelden art. 248/249 ook op contracten van vóór 01/11/2024 bij stilzwijgende
   verlenging?

---

## 2. Plaatsbeschrijving (état des lieux)

| rule_key | Inhoud | Status |
|---|---|---|
| `be.edl.mandatory` | Een **plaatsbeschrijving bij intrek is verplicht** voor elke hoofdverblijfplaatshuur, in alle drie de gewesten. Grondslag: art. 1730 oud Burgerlijk Wetboek (dwingend recht) en art. 220 Brusselse Huisvestingscode. | UNVERIFIED (artikelnummers nog niet in officiële tekst nagelezen) |
| `be.edl.contradictoire` | Op te stellen **tegensprekelijk**: in aanwezigheid van beide partijen of hun vertegenwoordigers, op gemeenschappelijke kosten, gedetailleerd. | UNVERIFIED |
| `be.edl.timing` | Op te maken ofwel terwijl het pand onbewoond is, ofwel **tijdens de eerste maand van bewoning**. | UNVERIFIED |
| `be.edl.signature_registration` | Door elke partij ondertekend (paraaf per pagina, handtekening op het einde), gehecht aan het huurcontract en samen daarmee geregistreerd bij FOD Financiën. | UNVERIFIED |
| `be.edl.absence_presumption` | **Zonder** plaatsbeschrijving bij intrek wordt de huurder vermoed het goed in goede staat te hebben ontvangen; de bewijslast keert in zijn nadeel. Grondslag: art. 1731 oud BW. | UNVERIFIED |

**Waarom dit product bestaat.** Regel `be.edl.absence_presumption` is precies de
reden waarom een gedocumenteerd fotodossier waarde heeft: het is bewijsmateriaal
tegen dat vermoeden. Maar — en dit moet de UI expliciet zeggen — een
**eenzijdig** fotorapport is **géén** tegensprekelijke plaatsbeschrijving in de
zin van art. 1730. Het is bewijsmateriaal dat een rechter vrij beoordeelt.
Zie `docs/decisions/0003-bewijswaarde-framing.md`.

**Bronnen**

- Bruxelles-J, "L'état des lieux d'entrée et de sortie" —
  <https://www.bruxelles-j.be/te-loger/etat-des-lieux-dentree-et-de-sortie/>
  (geraadpleegd 2026-08-29)
- UCLouvain (DIAL), "L'état des lieux à prendre en considération en présence de
  baux successifs" —
  <https://research.dial.uclouvain.be/bitstreams/d9ab25f2-7641-4bfe-94b4-fe3212a4f159/download>
  (geraadpleegd 2026-08-29)

---

## 3. Indexatie van de huurprijs

### Basisformule

De wettelijke indexatieformule (art. 1728bis oud BW):

```
nieuwe huurprijs = basishuurprijs × (nieuwe gezondheidsindex / aanvangsindex)
```

waarbij:

- **basishuurprijs** = de huurprijs bij aanvang van het contract, **exclusief
  lasten**;
- **aanvangsindex** = de gezondheidsindex van de maand die voorafgaat aan de
  maand waarin het contract werd **gesloten** (niet: waarin het inging);
- **nieuwe gezondheidsindex** = de gezondheidsindex van de maand die voorafgaat
  aan de **verjaardag van de inwerkingtreding** van het contract.

De indexatie gebeurt **niet automatisch**: de verhuurder moet ze schriftelijk
vragen, en kan slechts beperkt terugwerkend aanrekenen.

| rule_key | Inhoud | Status |
|---|---|---|
| `be.index.formula` | Formule hierboven, op basis van de **gezondheidsindex** (niet de gewone consumptieprijsindex). | UNVERIFIED (formule breed bevestigd; artikelverwijzing nog na te lezen) |
| `be.index.not_automatic` | Indexatie moet door de verhuurder gevraagd worden; ze gebeurt niet vanzelf. | UNVERIFIED |
| `bxl.index.requires_registration` | In Brussel is indexatie **niet toegelaten** als het huurcontract niet geregistreerd is. | UNVERIFIED |
| `bxl.index.requires_peb_certificate` | In Brussel is indexatie **niet toegelaten** als het EPB-certificaat niet aan de huurder werd voorgelegd. | UNVERIFIED |

### EPB-gebonden correctiefactoren — TEGENSTRIJDIGE BRONNEN

Secundaire bronnen verwijzen naar **art. 224/2 § 1bis/2** van de Brusselse
Huisvestingscode met correctiecoëfficiënten volgens EPB-label:

| EPB-label | Toegelaten deel van de indexatie |
|---|---|
| A, B, C | 100 % |
| D, E | 75 % |
| F, G | 0 % (bevriezing) |

**De bronnen spreken elkaar tegen over het toepassingsgebied:**

- Bron A: de correctiefactoren gelden voor contracten **van vóór 1 oktober 2022**
  met label D, E of F.
- Bron B: vanaf **14 oktober 2023** is indexatie voor labels E, F en G opnieuw
  toegelaten volgens een **aangepaste formule**, en die aangepaste formule geldt
  enkel voor contracten die vóór **14 oktober 2022** in werking traden — voor
  contracten vanaf 14 oktober 2022 zou de gewone federale formule gelden,
  ongeacht het EPB.
- Bron C beschrijft bovendien een **degressief mechanisme over 12 maanden**
  waarbij de coëfficiënt afhangt van de verjaardagsmaand van het contract.

Deze drie lezingen zijn niet met elkaar te verzoenen zonder de officiële tekst
van art. 224/2. Bovendien wijzigde de Ordonnantie van 04/04/2024 het opschrift
van art. 224/2 naar "Indexatie" en schrapte ze een verwijzing naar art. 217 —
oudere blogposts kunnen dus sowieso achterhaald zijn.

**Productbeslissing.** De indexatie-auditor implementeert:

1. de **basisformule** (gezondheidsindex), met vermelding dat dit de algemene
   formule is;
2. de **voorwaardencheck** (registratie + EPB-certificaat) als *vragen aan de
   gebruiker* met bronvermelding, niet als automatisch oordeel;
3. de **EPB-correctiefactoren** als `legal_rules`-record met status `UNVERIFIED`;
   de UI toont het resultaat expliciet als *"mogelijk van toepassing — te
   verifiëren"*, met de drie tegenstrijdige lezingen en het advies om de
   Huurdersbond te contacteren.

Er wordt **geen** ingebrekestelling wegens onterechte indexatie gegenereerd die
zich uitsluitend op de EPB-correctiefactor baseert zolang die regel `UNVERIFIED`
is. Een brief op basis van de basisformule (rekenfout, niet-geregistreerd
contract) kan wel.

**Bronnen** (alle secundair — officiële tekst nog te verifiëren)

- Seeds of Law via Legal News, "Indexatie van woninghuur in Vlaanderen en
  Brussel. Wat is de stand van zaken na 1 oktober 2023?" —
  <https://legalnews.be/bouw-vastgoed/indexatie-van-woninghuur-in-vlaanderen-en-brussel-wat-is-de-stand-van-zaken-na-1-oktober-2023-seeds-of-law/>
- Verenigde Eigenaars, "Correctiefactoren van toepassing in Brussel" (PDF) —
  <https://verenigdeeigenaars.be/wp-content/uploads/2024/04/Correctiefactoren-Brussels-Hoofdstedelijk-Gewest-Eigenaarsmagazine-okt-2023.pdf>
- Dewaele, "Huurindexatiestop afhankelijk van EPB-waarde" —
  <https://www.dewaele.com/nl/advies/epc-huurindexatie-brussel-zonder-beperking>

Geraadpleegd 2026-08-29.

### Gezondheidsindex-cijfers

De indexcijfers komen van Statbel (FOD Economie). Ze worden **niet** hardcoded:
ze horen in een aparte, dateerbare referentietabel (`health_index_values`) met
bron en publicatiedatum, zodat een verouderde index zichtbaar is in plaats van
stil verkeerde bedragen te produceren.

Let op het **nieuwe basisjaar 2025**: een berekening die indexcijfers met
verschillende basisjaren mengt, geeft een fout resultaat. De applicatie weigert
te rekenen wanneer aanvangs- en eindindex niet hetzelfde basisjaar hebben.

---

## 4. Indicatief huurrooster (loyers.brussels)

### Wat officieel gepubliceerd is

Het Brusselse referentiehuurrooster berust op de **Besluiten van de Brusselse
Hoofdstedelijke Regering van 30 juni 2022 en 6 oktober 2022**. De officiële
toelichting op `loyers.brussels` beschrijft de opbouw:

- vergelijkingen met drie hoofdvariabelen: **oppervlakte**, **ligging**
  (moeilijkheidsindex van de wijk) en **staat van het gebouw** (schaal 1–3, op
  basis van bouwjaar en aanwezigheid van dubbele beglazing);
- bijkomende variabelen: centrale verwarming, thermische regeling, tweede
  badkamer, buitenruimte, bergruimte, garage(s), EPB-niveau;
- een **marge van 10 %** rond de mediane huurprijs voor kwalitatieve factoren
  (ingerichte keuken, uitzonderlijk zicht, bijzondere architectuur);
- gebaseerd op **14.042 enquêtes** bij huurders in 2017, 2018 en 2020 (drie
  Observatoria van de Huurprijzen);
- de referentiehuurprijzen worden **jaarlijks herzien** en, bij gebrek aan nieuwe
  enquêtes, **automatisch geïndexeerd op de gezondheidsindex** (verwijzing naar
  art. 1728bis BW). De laatste indexatie dateert van **januari 2026**.

### Wat níet gepubliceerd is

**De volledige vergelijkingen, basisprijzen per m², wijkcoëfficiënten en de
exacte gewichten van de bijkomende variabelen staan niet op de publieke pagina.**
Ze zitten in de onderliggende ULB-IGEAT-studie. De veelgeciteerde "formule"
`Oppervlakte × Basisprijs × Wijkindex × Staatscoëfficiënt × Coëfficiënt aantal
kamers` komt uit een **commerciële** bron en is niet als zodanig door het Gewest
gepubliceerd.

### Productbeslissing — eerlijke beperking

Wij **reproduceren het huurrooster niet**. In plaats daarvan:

1. de huurprijs-check verzamelt de kenmerken van de woning in een begeleide flow
   (dezelfde variabelen als het officiële rooster);
2. de app verwijst door naar de **officiële rekentool** op
   <https://loyers.brussels> en laat de gebruiker het bekomen referentiebedrag
   invullen;
3. de app vergelijkt de gevraagde huur met dat officiële bedrag, past de
   10 %-marge toe en geeft duiding — inclusief de vermelding dat het rooster
   **indicatief** is en op zich geen recht op huurvermindering geeft.

Zie `docs/decisions/0002-huurrooster-geen-eigen-berekening.md`.

| rule_key | Inhoud | Status |
|---|---|---|
| `bxl.rentgrid.legal_basis` | Besluiten BHR 30/06/2022 en 06/10/2022. | VERIFIED |
| `bxl.rentgrid.margin_pct` | Marge van 10 % rond de mediane referentiehuurprijs. | VERIFIED |
| `bxl.rentgrid.indicative_only` | Het rooster is **indicatief**; het legt geen maximumhuurprijs op. | VERIFIED |
| `bxl.rentgrid.method_not_public` | De volledige berekeningsmethode is niet publiek reproduceerbaar. | VERIFIED |

**Bron**

- loyers.brussels, "À propos des loyers de référence" —
  <https://loyers.brussels/a-propos-des-loyers-de-reference> (geraadpleegd 2026-08-29)

---

## 5. Slijtage (vétusté) versus huurschade

Er is **geen officieel Brussels slijtagerooster**. Wallonië publiceert wél een
*grille indicative de vétusté* met theoretische levensduren per uitrusting, met
een officiële gebruikshandleiding.

**Productbeslissing.** Wij gebruiken de Waalse indicatieve grille als
**referentiemateriaal** voor de classificatiecriteria van de AI-analyse, en
zeggen in de UI én hier uitdrukkelijk dat dit **geen Brussels recht** is en dat
een Brusselse rechter er niet aan gebonden is. De grille komt in de database als
referentietabel met bron, niet als `legal_rules`-record met Brusselse werking.

### De officiële Waalse berekeningsmethode

Het Waalse *Guide d'utilisation* beschrijft de methode volledig. Wij nemen ze
één op één over in `src/lib/vetuste/calculate.ts`:

1. zoek in de grille de **levensduur** en het **afschrijvingspercentage** van de
   betrokken uitrusting;
2. bepaal de **leeftijd van de uitrusting** bij intrek;
3. pas het percentage toe per gebruiksjaar — **elk begonnen jaar telt volledig**
   ("Toute année commencée est considérée comme échue");
4. laat de herstelkost door een vakman ramen (bv. via een offerte);
5. het bekomen afschrijvingspercentage is het deel **ten laste van de
   verhuurder**; de rest is ten laste van de huurder.

```
afschrijving % = (leeftijd bij intrek + bewoningsjaren) × jaarpercentage
deel verhuurder = herstelkost × afschrijving %
deel huurder    = herstelkost × (100 % − afschrijving %)
```

Voorbij de theoretische levensduur draagt de huurder **niets** meer.

**Startpunt van de levensduur** — volgens het Guide: de bouwdatum uit de
aankoopakte (of bij gebrek daaraan de datum van de bouwvergunning), de datum van
de laatste vernieuwing door de verhuurder, de vertrekdatum van de vorige huurder
indien die zelf vernieuwde (mits bewijs), of — met schriftelijk akkoord van de
huurder — de datum van intrek.

**De grille geldt niet** bij vrijwillige beschadiging, vandalisme, abusief
gebruik, gebrek aan hygiëne, niet-toegestane verbouwingen, verlies of verwijdering
van uitrusting, wanneer de aansprakelijkheid van de huurder vaststaat, of wanneer
afgesproken was dat de huurder vrij mocht herschilderen. Die uitsluitingsgronden
zitten als `VetusteExclusion` in de code.

De drie rekenvoorbeelden uit het Guide (CAS DE FIGURE 1, 2 en 3) staan als
unit tests in `src/lib/vetuste/calculate.test.ts`.

> Aandachtspunt in de bron: in CAS DE FIGURE 2 drukt het officiële document bij
> het deel voor de verhuurder "1.500 € x (62,5%) = 1.312,50 €" af. Het percentage
> in dat label klopt niet — 1.312,50 € is 87,5 % van 1.500 €. Het bedrag is
> juist, het label niet. Onze implementatie volgt de formule, niet het label.

### De grille zelf

De tabel telt **40 posten** in vijf categorieën (verwarming, elektriciteit,
schrijnwerk, afwerking, sanitair). Ze staat volledig in
`supabase/migrations/20260829000004_vetuste_reference.sql`, met per post de
levensduur en het jaarpercentage zoals de bron ze afdrukt.

Enkele waarden ter illustratie: binnenschilderwerk muren 8 jaar (12,50 %),
behangpapier 8 jaar (12,50 %), tapijt 9 jaar (11,11 %), laminaat 17 jaar
(5,88 %), massief parket 27 jaar (3,70 %), verwarmingsketel 15 jaar (6,67 %),
elektrische installatie 20 jaar (5 %), ligbad 20 jaar (5 %).

| rule_key | Inhoud | Status |
|---|---|---|
| `be.vetuste.no_brussels_grid` | Er bestaat geen officieel slijtagerooster voor het Brussels Hoofdstedelijk Gewest. | UNVERIFIED (negatieve vaststelling — expliciet aan de jurist voorleggen) |
| `wal.vetuste.reference_grid` | Waalse indicatieve grille de vétusté, 40 posten, met berekeningsmethode. Niet-bindende referentie in Brussel. | VERIFIED als Waalse bron — **NIET van toepassing als Brussels recht** |

**Bronnen** (beide officieel, Service public de Wallonie, geraadpleegd 2026-08-29)

- "Grille indicative de vétusté — Guide d'utilisation" (PDF) —
  <https://logement.wallonie.be/storage/logement/documents/content/lease/reparations-et-vetuste-listes/grille-indicative-de-vetuste-des-logements-guide-utilisation.pdf>
- "Grille indicative de référence portant sur la vétusté naturelle des logements
  en Wallonie" (PDF, de tabel) —
  <https://logement.wallonie.be/storage/logement/documents/content/lease/reparations-et-vetuste-listes/grille-indicative-de-vetuste-des-logements-tableau.pdf>

Wettelijke achtergrond die het Guide zelf aanhaalt: Decreet van 15 maart 2018
betreffende de woninghuurovereenkomst (Waals Gewest), art. 7, 8, 15 en 16.

### Wat dit betekent voor de UI

Bij elke kostenverdeling die op deze grille steunt, toont de app:

> Deze verdeling volgt het Waalse indicatieve slijtagerooster. Er bestaat geen
> Brussels equivalent. Een Brusselse rechter is hier niet aan gebonden.

### Openstaand werk

De **herstelkosten** zelf (`repair_cost_reference`) zijn een aparte tabel en nog
leeg. De grille zegt hoe je een kost verdeelt, niet wat een herstelling kost.
Zolang die tabel leeg is, toont de app "geen kostenschatting beschikbaar" in
plaats van een verzonnen bedrag.

---

## 6. Verjaring en bewaartermijn

| rule_key | Inhoud | Status |
|---|---|---|
| `be.prescription.lease_claims_years` | Persoonlijke rechtsvorderingen uit de huurovereenkomst (huurschade, herstelkosten, bezettingsvergoeding) verjaren na **10 jaar** — art. 2262bis § 1 oud BW. | UNVERIFIED |
| `be.prescription.rent_arrears_years` | Achterstallige huur verjaart na **5 jaar** vanaf de vervaldag van elke maandhuur — art. 2277 oud BW. | UNVERIFIED |

**Spanning met de bewaartermijn uit de opdracht.** De opdracht zet de
standaardbewaartermijn op **2 jaar na einde huurcontract**. Dat is **korter** dan
de tienjarige verjaringstermijn voor huurschadevorderingen. Gevolg: een gebruiker
kan zijn bewijsmateriaal verliezen terwijl een vordering nog ontvankelijk is.

**Productbeslissing.** De standaard blijft 2 jaar (dataminimalisatie, AVG), maar:

- de UI legt bij het instellen van de retentie uit dat vorderingen tot 10 jaar
  kunnen lopen;
- de gebruiker kan de termijn per woning verlengen tot maximaal 10 jaar;
- vóór automatische verwijdering krijgt de gebruiker **30 dagen op voorhand** een
  bericht met exportlink en de mogelijkheid te verlengen.

**Bronnen**

- elfri.be, "Persoonlijke rechtsvorderingen verjaren na 10 jaar" —
  <https://www.elfri.be/artikel/persoonlijke-rechtsvorderingen-verjaren-na-10-jaar>
- Advocaten Leuven, "Verjaring en huur" —
  <https://advocaten-leuven.be/verjaring-en-huur-wanneer-verjaart-mijn-vordering-inzake-huur/>

Geraadpleegd 2026-08-29. Beide secundair.

---

## 7. Aangetekende zending

Zie `docs/decisions/0001-aangetekende-zending-provider.md`. Kern:

- **Gekwalificeerde elektronische aangetekende zending (QERDS)** onder eIDAS
  heeft in België dezelfde rechtsgevolgen als een papieren aangetekende zending,
  maar **alleen** wanneer ze door een *gekwalificeerde* verlener wordt uitgevoerd
  en de geadresseerde correct geïdentificeerd is.
- Een gewone e-mail via Resend is **nooit** aangetekend. De UI mag het woord
  "aangetekend" niet in de buurt van die knop gebruiken.
- Ontvangst door de bestemmeling is niet gegarandeerd: bij QERDS naar een
  particulier die de dienst niet aanvaardt, kan de zending mislukken. De fallback
  "verstuur zelf via het bpost-loket" blijft daarom altijd zichtbaar.

---

## 8. Wat we bewust NIET implementeren

| Niet geïmplementeerd | Reden |
|---|---|
| Eigen berekening van het Brusselse huurrooster | Methode niet publiek reproduceerbaar (§4) |
| Automatisch oordeel "deze indexatie is onwettig wegens EPB" | Bronnen tegenstrijdig (§3) |
| Kostenschatting zonder referentietabel | Zou neerkomen op verzonnen bedragen (§5) |
| Berekening van wettelijke intresten in de ingebrekestelling | Rentevoet en aanvangsdatum nog niet uit officiële bron bevestigd |
| Enige vorm van procesvertegenwoordiging of advies "u gaat winnen" | Geen advocatenkantoor; wettelijk voorbehouden handeling |
| Het woord "aangetekend" bij e-mailverzending | Zou de gebruiker misleiden over de bewijswaarde (§7) |

---

## 9. Revisiekalender

| Regelgroep | Herzien vóór | Waarom |
|---|---|---|
| Indexatie + EPB (§3) | 2027-02-28 | Meest volatiele regelgeving; STALE na 6 maanden |
| Huurwaarborg (§1) | 2027-02-28 | Recent gewijzigd; uitvoeringsbesluiten mogelijk |
| Huurrooster (§4) | 2027-01-31 | Jaarlijkse indexatie in januari |
| Verjaring (§6) | 2027-08-29 | Stabiel |
