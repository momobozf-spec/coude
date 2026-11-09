# Een echte OCR-provider kiezen

Dit document bereidt de keuze voor. Het activeert niets: `OCR_PROVIDER` accepteert
nog steeds alleen `fixture`, en er staat geen sleutel in de code.

## Over de betrouwbaarheid van dit document

Onderstaande vergelijking bestaat uit twee soorten uitspraken, en het verschil is
belangrijk.

**Structurele eigenschappen** volgen uit hoe een dienst werkt en veranderen niet
met een prijslijst. "Een taalmodel kan tekst verzinnen die niet op de foto staat"
is zo'n uitspraak. Die staan hieronder zonder voorbehoud.

**Feitelijke details** — prijzen, beschikbare regio's, retentietermijnen,
ondersteunde talen per versie — veranderen doorlopend en ik kan ze hier niet
verifiëren. Die staan in een aparte tabel, uitdrukkelijk gemarkeerd als **te
verifiëren**, met de vindplaats erbij. Neem ze niet over in een besluit zonder ze
zelf na te slaan. Ik heb geen enkele bewering uit marketingmateriaal
overgenomen.

## Wat wij van een provider vragen

Minder dan je zou denken, en dat is opzet:

```
afbeelding  →  provider  →  platte tekst
```

Geen ingrediëntenlijst, geen structuur, geen oordeel. De provider mag niet
gevraagd worden of iets halal is, en ook niet welke ingrediënten problematisch
zijn. Dat doet onze eigen engine, deterministisch en navolgbaar. Een provider die
"slimmer" is dan dit, levert geen voordeel op maar een risico: hij verplaatst een
inhoudelijk oordeel naar een black box waar we geen verantwoording over kunnen
afleggen.

Concreet is het contract [`OcrProvider`](../src/server/integrations/ocr/types.ts):
één methode, tekst eruit, optionele zekerheid, providernaam. Alles daarbuiten
blijft binnen de adapter.

---

## 1. Het onderscheid dat de keuze bepaalt

De vier kandidaten vallen uiteen in twee groepen, en dat verschil weegt zwaarder
dan alle prijsverschillen bij elkaar.

**Toegewijde OCR-diensten** (Azure AI Vision Read, Google Cloud Vision, AWS
Textract) doen tekstdetectie. Ze geven terug wat ze op de pixels zien, met
posities en per-element zekerheid. Zien ze niets, dan geven ze niets terug.

**Vision-taalmodellen** (OpenAI en vergelijkbaar) genereren tekst die past bij
het beeld. Dat is een fundamenteel ander mechanisme: het model produceert een
waarschijnlijke voortzetting, en bij een onscherpe of half zichtbare
ingrediëntenlijst is een plausibele aanvulling precies wat het zal doen.

Voor deze applicatie is dat onderscheid doorslaggevend. Een OCR-fout levert
"geiatine" op: onherkenbaar, dus de engine meldt het als onbekend ingrediënt en
de gebruiker corrigeert het. Een hallucinatie levert "gelatine" op — of erger,
laat een ingrediënt weg dat er wel stond. Dat leest als een correcte lijst, komt
door de menselijke controle heen omdat er niets vreemds aan te zien is, en
resulteert in een oordeel over ingrediënten die nooit op de verpakking hebben
gestaan.

**Daarom: een toegewijde OCR-dienst, geen vision-taalmodel.** Dit is geen
kwaliteitsoordeel over die modellen; het is dat hun foutmodus hier de verkeerde
kant op wijst.

---

## 2. De drie toegewijde diensten

| | Azure AI Vision (Read) | Google Cloud Vision | AWS Textract |
|---|---|---|---|
| **Waarvoor gebouwd** | algemene tekstdetectie in beelden | algemene tekstdetectie in beelden | formulieren en documenten |
| **Foto's uit de hand** | ontworpen voor scènetekst | ontworpen voor scènetekst | sterkst op gescande documenten |
| **Uitvoer** | regels en woorden met posities | regels en woorden met posities | blokken, tabellen, sleutel-waardeparen |
| **Zekerheid** | per woord/regel | per woord/blok | per blok |
| **Regiokeuze** | bij het aanmaken van de resource | per verwerkingslocatie | per AWS-regio |

**Textract valt af** op geschiktheid. Het is gemaakt om structuur uit documenten
te halen — tabellen, formuliervelden, identiteitsbewijzen. Een gebogen etiket op
een fles onder keukenverlichting is een ander probleem, en de meerwaarde van
Textract (die structuur) is precies wat wij weggooien.

Blijven over: Azure AI Vision en Google Cloud Vision. Allebei doen ze wat we
nodig hebben. De keuze gaat dus over de dingen eromheen.

---

## 3. Wat geverifieerd moet worden vóór het besluit

Ik kan deze niet vaststellen. Sla ze na en vul de tabel in; pas daarna is het
besluit onderbouwd.

| Vraag | Waarom die bepalend is | Waar te controleren |
|---|---|---|
| Welke **Arabische** ondersteuning heeft elke dienst, in welke API-versie? | Halal-producten dragen vaak Frans-Arabische of Nederlands-Arabische etiketten. Onze eigen parser laat Arabisch al vallen (zie §5); als de OCR het ook niet leest, is die hele categorie onbruikbaar. **Dit is het zwaarstwegende punt.** | Azure: talenlijst van de Read/Image Analysis API. Google: lijst met ondersteunde talen voor `TEXT_DETECTION` / `DOCUMENT_TEXT_DETECTION`. |
| Kan verwerking gegarandeerd **binnen de EU** plaatsvinden? | AVG. Een foto van een keukentafel is persoonsgegeven zodra er een hand of adreslabel op staat. | Azure: regio's per dienst + datalocatiebeleid. Google: documentatie over dataregio's/`EU`-endpoints. |
| Wordt het beeld **bewaard**, en hoe lang? | Bepaalt wat er in de privacyverklaring moet en of er een bewaartermijn is die we niet zelf beheersen. | De verwerkersvoorwaarden, niet de productpagina. |
| Wordt het beeld gebruikt voor **modeltraining**, en is dat uit te zetten? | Een etiketfoto met de omgeving erop mag geen trainingsdata worden zonder dat de gebruiker dat weet. | Idem: de contractuele voorwaarden. |
| Is er een **verwerkersovereenkomst** en dekt die deze use case? | Wettelijk vereist. | Standaard-DPA van de leverancier. |
| Wat kost 1000 aanroepen, en is er een gratis staffel? | Bepaalt `OCR_RATE_LIMIT` en `OCR_GLOBAL_RATE_LIMIT`. | Actuele prijspagina. |
| Wat is de **maximale beeldgrootte en -resolutie**? | Onze limieten (10 MB, 40 megapixel) moeten daaronder liggen, anders krijgt de gebruiker de fout van de provider in plaats van de onze. | API-documentatie. |
| Wat betekent hun **confidence** precies? | Wij vertalen naar één domeinbegrip; zonder betekenis is de drempel verzonnen. Zie §4. | API-documentatie. |
| Typische **latency** voor een foto van ~2 MB? | Bepaalt of `OCR_TIMEOUT_MS` (nu 15 s) klopt. | Zelf meten met een proefsleutel. |

## Voorlopige aanbeveling

**Azure AI Vision (Read) als eerste echte provider**, met Google Cloud Vision als
alternatief zodra blijkt dat de Arabische ondersteuning tekortschiet.

De redenering, en waar hij op steunt:

1. Het is een toegewijde OCR-dienst, dus geen hallucinatierisico (§1 —
   structureel).
2. De regio wordt vastgelegd bij het aanmaken van de resource, wat de
   EU-verwerkingsvraag tot een expliciete, controleerbare keuze maakt in plaats
   van een beleidsdocument (structureel, maar **verifieer** welke regio's
   beschikbaar zijn).
3. De uitvoer met zekerheid per regel past rechtstreeks op onze
   `confidencePolicy`.

**Deze aanbeveling valt om** als de Arabische ondersteuning onvoldoende is. Dat is
geen randgeval maar een kerneis, en het is het eerste dat je moet nagaan. Kies in
dat geval Google Cloud Vision, mits de dataregiovraag daar bevredigend te
beantwoorden is.

---

## 4. Zekerheid is providerafhankelijk

Er is geen algemene regel `confidence >= 0.8 betekent betrouwbaar`. De ene dienst
geeft een gemiddelde per woord, de andere per regio, en de schalen zijn niet
vergelijkbaar. Daarom declareert elke provider zijn eigen beleid:

```ts
readonly confidencePolicy: OcrConfidencePolicy =
  { kind: "threshold", lowBelow: 0.7 };
```

Bij het toevoegen van een provider hoort daar een onderbouwing bij: waar komt dat
getal vandaan, en wat betekent het bij deze dienst. Is dat niet vast te stellen,
kies dan `{ kind: "none" }`. Dan waarschuwt de UI niet op zekerheid — eerlijker
dan een verzonnen drempel, en de gebruiker moet de tekst toch al nakijken.

**Zekerheid gaat over tekstherkenning.** Niet over of de ingrediënten kloppen, en
niet over de halal-conclusie. Ook bij 0.99 blijft de controlestap verplicht; die
regel zit in de toestandsmachine en niet in de UI, juist zodat een hoge score hem
niet kan omzeilen.

---

## 5. Wat er nog mis is aan onze eigen kant

Zonder dit op te lossen levert een betere provider geen beter resultaat.

**Arabisch verdwijnt in onze parser.** `normalizeIngredientName` houdt alleen
Latijns schrift over. Bij een Frans-Arabisch etiket wordt het Franse deel
geanalyseerd en het Arabische deel weggegooid — en het oordeel gaat dan over de
helft van de lijst. Dit is nu zichtbaar gemaakt met een waarschuwing
(`unsupportedScriptWarning`) en vastgelegd in `tests/fixtures/ocrCorpus.ts`, maar
niet opgelost. Het écht verwerken vraagt uitbreiding van de parser uit fase 3.
**Zolang dat er niet is, is een provider met goede Arabische OCR half verspild.**

**Een tweede kopregel midden in de tekst blijft staan.** Bij een tweetalig etiket
wordt `Ingrédients :` halverwege niet weggehaald, waardoor er één rommelig
onbekend ingrediënt ontstaat. Onschuldig, maar zichtbaar voor de gebruiker.

**De normalisatie is nooit op echte OCR-uitvoer getest.** Alle testteksten zijn
met de hand ingevoerd. Reële uitvoer is rommeliger: kolommen door elkaar,
allergenen als losse regel, afgebroken zinnen. Reken op een tweede ronde aan
`normalizeOcrText` zodra er echte data is.

---

## 6. EXIF en voorbewerking

**Nu niet geïmplementeerd, en dat is een bewust uitgesteld privacyrisico.**

Een telefoonfoto draagt EXIF-metadata: tijdstip, toestel, camera-instellingen en
vaak **GPS-coördinaten**. Vandaag maakt dat niets uit — de fixture-provider kijkt
niet naar de bytes en er gaat niets de deur uit. Zodra er een echte provider
hangt, gaan de volledige originele bytes naar die partij, inclusief de plek waar
de foto genomen is. Dat is doorgaans iemands huis of supermarkt.

De gewenste keten zodra een provider wordt aangesloten:

```
bytes  →  decoderen  →  metadata strippen  →  eventueel verkleinen  →  provider
```

Verkleinen naar circa 1600–2000 px op de lange zijde zou naar verwachting
privacy-exposure, bandbreedte, kosten en latency verlagen. **Doe dat pas nadat de
OCR-kwaliteit meetbaar is**: kleine lettertjes op een etiket zijn precies wat
kapotgaat bij te agressieve compressie, en dat merk je niet zonder meting. Geen
willekeurige compressie vooruitlopend op data.

Dit vraagt een beeldbibliotheek (`sharp` of vergelijkbaar). Die is er nu bewust
niet: voor het lezen van headers is hij niet nodig (zie
[`imageSignature.ts`](../src/server/integrations/ocr/imageSignature.ts)) en een
decoder is een groot aanvalsoppervlak dat je alleen binnenhaalt als je hem echt
gebruikt.

---

## 7. Wat er af moet vóór het aanzetten

Een checklist, geen suggestie.

- [ ] De vragen in §3 beantwoord, met bron
- [ ] Verwerkersovereenkomst getekend
- [ ] EU-verwerking vastgelegd en gecontroleerd
- [ ] Modeltraining op onze beelden contractueel uitgesloten
- [ ] EXIF-stripping geïmplementeerd (§6)
- [ ] Privacyverklaring aangepast: dat er een externe dienst is, welke, waarvoor
- [ ] Producttekst in de UI vóór verzending — bijvoorbeeld "Je foto wordt
      tijdelijk verwerkt om de ingrediënten te herkennen". Nooit de claim dat de
      foto de server niet verlaat, want dat is dan onwaar
- [ ] `OCR_RATE_LIMIT` en `OCR_GLOBAL_RATE_LIMIT` op de werkelijke kosten gezet
- [ ] `OCR_TIMEOUT_MS` op gemeten latency gezet
- [ ] `confidencePolicy` met onderbouwing (§4)
- [ ] Providerfouten vertaald naar onze codes, zonder hun boodschappen door te
      geven — de service dwingt dit af, maar de adapter moet er ook naar handelen
- [ ] Het abort-signaal doorgegeven aan de HTTP-call, anders loopt een afgebroken
      aanroep door en kost hij alsnog geld

## 8. Hoe je hem aansluit

Eén bestand plus één regel:

1. Maak `src/server/integrations/ocr/azureVisionProvider.ts` die `OcrProvider`
   implementeert. Daarin, en alleen daarin, staan de providerspecifieke types en
   de vertaling van hun fouten naar `PROVIDER_TIMEOUT` / `PROVIDER_UNAVAILABLE` /
   `PROVIDER_RATE_LIMITED`.
2. Voeg de waarde toe aan `OCR_PROVIDER` in `src/config/env.ts` en een tak in
   `src/server/integrations/ocr/index.ts`.

Er verandert niets aan de UI, de toestandsmachine, de normalisatie of de analyse.
De bestaande tests blijven draaien op de fixture; de nieuwe provider krijgt zijn
eigen tests met opgevangen HTTP-verkeer, niet met echte aanroepen.
