# Handmatig testplan voor camera en foto-invoer

Dit plan bestaat omdat de geautomatiseerde tests iets anders bewijzen dan wat ze
lijken te bewijzen. `tests/ui/scannerLifecycle.test.tsx` toont aan dat onze code
één ZXing-reader aanmaakt, hem bij unmount opruimt en bij achtergrond de stream
vrijgeeft — tegen een **nagebootste** reader in **jsdom**, dat geen camera heeft,
geen permissiedialoog kent en geen `getUserMedia` implementeert.

Wat daar dus niet in zit: of iOS Safari de stream werkelijk vrijgeeft, of Android
Chrome na een app-wissel opnieuw toestemming vraagt, of `capture="environment"`
op een specifiek toestel de achtercamera opent. Dat zijn eigenschappen van
browsers en besturingssystemen, niet van onze code, en die kun je alleen
vaststellen door het te doen.

**Status: dit plan is nog niet uitgevoerd.** Geen enkele regel hieronder is
afgevinkt. Zolang dat zo is, geldt voor de camera- en fotofunctionaliteit:
levenscyclus geverifieerd via geautomatiseerde mocks, fysieke verificatie nog
vereist.

## Hoe te gebruiken

Draai per toestel de hele lijst en noteer per regel: geslaagd, gefaald met
beschrijving, of niet van toepassing. Een gefaalde regel is een bevinding, ook
als hij "logisch" lijkt — juist de logische gevallen gaan stuk.

Noteer bij elke sessie het toestel, de OS-versie en de browserversie. Zonder die
gegevens is een bevinding niet reproduceerbaar en een geslaagde test niets waard
zodra er een update uitkomt.

---

## A. Barcodescanner (`/scan`)

### A1. iPhone, Safari

| # | Handeling | Verwacht |
|---|---|---|
| 1 | Open `/scan` voor het eerst | Toestemmingsvraag verschijnt; geen beeld ervoor |
| 2 | Geef toestemming | Achtercamera start, beeld staat rechtop |
| 3 | Scan een EAN-13 | Barcode wordt herkend, productscherm volgt |
| 4 | Verlaat de pagina via de navigatie | Camera-indicator dooft binnen een seconde |
| 5 | Ga terug naar `/scan` | Camera start opnieuw, geen dubbele stream |
| 6 | Wissel naar een andere app | Stream wordt losgelaten (indicator uit) |
| 7 | Kom terug in de app | Beeld hervat zonder herladen |
| 8 | Draai het toestel | Beeld schaalt mee, geen verminkte weergave |
| 9 | Vergrendel en ontgrendel het scherm | Beeld hervat, geen vastgevroren frame |
| 10 | Weiger toestemming (na resetten) | Uitleg met herstelactie, handmatige invoer bereikbaar |
| 11 | Zet toestemming in instellingen op "blokkeren" | Boodschap legt uit dat het via instellingen moet |
| 12 | Open `/scan` in twee tabbladen | Geen crash; het tweede tabblad meldt netjes of werkt |

### A2. Android, Chrome

Dezelfde twaalf regels als A1, plus:

| # | Handeling | Verwacht |
|---|---|---|
| 13 | Toestel met meerdere achtercamera's | Er wordt een bruikbare camera gekozen, niet de macro |
| 14 | Split screen | Beeld blijft werken of faalt met een begrijpelijke melding |
| 15 | Batterijbesparing aan | Geen stille bevriezing zonder melding |

### A3. Desktop Chrome met webcam

| # | Handeling | Verwacht |
|---|---|---|
| 16 | Open `/scan` | Webcam start; als er meerdere zijn, een werkende keuze |
| 17 | Trek de webcam eruit tijdens het scannen | Foutmelding, geen vastloper |

### A4. Desktop zonder camera

| # | Handeling | Verwacht |
|---|---|---|
| 18 | Open `/scan` | Geen mislukte camerapoging; handmatige invoer meteen in beeld |

---

## B. Ingrediëntenscanner (`/scan/ingredients`)

### B1. Mobiel (iPhone Safari en Android Chrome)

| # | Handeling | Verwacht |
|---|---|---|
| 19 | Tik op "Foto maken of kiezen" | Keuze tussen camera en galerij, of direct de camera |
| 20 | Maak een foto | **Achtercamera** wordt geopend (`capture="environment"`) |
| 21 | Bevestig de foto | Preview verschijnt, OCR start |
| 22 | Kies in plaats daarvan een galerijfoto | Werkt gelijkwaardig |
| 23 | Annuleer de camera | Scherm blijft bruikbaar, geen laadtoestand die blijft hangen |
| 24 | Foto van een HEIC-toestel (iPhone standaard) | Wordt geaccepteerd |
| 25 | Zeer grote foto (48 MP-stand) | Ofwel verwerkt, ofwel een begrijpelijke "te groot" |
| 26 | Foto bij weinig licht | OCR faalt netjes met een bruikbare herstelactie |
| 27 | Foto van de voorkant van de verpakking | Waarschuwing "dit lijkt geen ingrediëntenlijst" |
| 28 | Corrigeer de tekst in het tekstvak | Toetsenbord dekt het veld niet af; tekst blijft zichtbaar |
| 29 | Draai het toestel tijdens het corrigeren | Ingevoerde tekst blijft behouden |
| 30 | Wissel naar een andere app en terug | Preview en tekst blijven bestaan |

### B2. Desktop

| # | Handeling | Verwacht |
|---|---|---|
| 31 | Klik op "Foto maken of kiezen" | Bestandskiezer, geen camerapoging |
| 32 | Kies een niet-afbeelding | Afgewezen met uitleg over toegestane types |
| 33 | Sleep een bestand op de knop | Ofwel werkt het, ofwel gebeurt er niets vreemds |

---

## C. Toegankelijkheid op een echt toestel

| # | Handeling | Verwacht |
|---|---|---|
| 34 | VoiceOver aan, doorloop `/scan/ingredients` | Elke stap wordt aangekondigd; het tekstvak heeft een label |
| 35 | TalkBack aan, idem | Idem |
| 36 | Alleen toetsenbord (desktop) | Alles bereikbaar, focus altijd zichtbaar |
| 37 | Grote systeemletters (200%) | Niets valt weg of overlapt |
| 38 | Donkere modus | Statuskleuren blijven leesbaar |

---

## D. Wat dit plan niet dekt

- **Echte OCR-kwaliteit.** Zolang de fixture-provider draait, geeft stap 21 altijd
  dezelfde tekst terug, ongeacht de foto. Deze lijst test de invoerketen, niet de
  herkenning. Zie `docs/OCR-PROVIDERS.md`.
- **Prestaties onder slechte netwerkomstandigheden.** Verdient een eigen ronde
  zodra er een provider hangt en er echt bytes over de lijn gaan.
- **Toestellen ouder dan wat hier staat.** De ondergrens is nog niet vastgesteld.
