# Privacy — aanzet tot verwerkingsregister

> **Status:** werkdocument voor juristenreview. Dit is nog geen sluitend
> verwerkingsregister in de zin van art. 30 AVG.

Laatst bijgewerkt: 2026-08-29.

## Waarom dit document er vroeg is

RentGuard verzamelt bijzonder gevoelige gegevens: **foto's van iemands woning
van binnen**, het **huurcontract**, en de **naam en het adres van de
verhuurder** — een derde die zelf geen gebruiker is en geen keuze had.

Foto's van een woninginterieur zeggen veel over de bewoner: gezinssamenstelling,
levensstandaard, mogelijk religie of gezondheid. Ze zijn geen bijzondere
categorie in de zin van art. 9 AVG, maar ze kunnen er wel gegevens uit
onthullen. Dat rechtvaardigt een strengere aanpak dan wat strikt vereist is.

## Verwerkingen

### 1. Account en profiel

| | |
|---|---|
| **Gegevens** | naam, e-mailadres, taalvoorkeur |
| **Doel** | de dienst leveren, communiceren in de juiste taal |
| **Grondslag** | uitvoering van de overeenkomst (art. 6.1.b) |
| **Bewaartermijn** | tot verwijdering van het account |
| **Ontvangers** | Supabase (verwerker) |

### 2. Woning en huurgegevens

| | |
|---|---|
| **Gegevens** | adres, huurprijs, waarborg, contractdata, EPB-label, oppervlakte |
| **Doel** | termijnen berekenen, audits uitvoeren, brieven opstellen |
| **Grondslag** | uitvoering van de overeenkomst |
| **Bewaartermijn** | door de gebruiker bepaald, standaard 2 jaar na einde huur |
| **Ontvangers** | Supabase |

### 3. Foto's van de woning

| | |
|---|---|
| **Gegevens** | foto's, EXIF (toestel, opnamedatum, eventueel GPS), SHA-256, servertijdstempel |
| **Doel** | bewijsdossier bij intrek en vertrek |
| **Grondslag** | uitvoering van de overeenkomst |
| **Bewaartermijn** | zie retentie hieronder |
| **Ontvangers** | Supabase Storage (private bucket); Anthropic **alleen** wanneer de gebruiker een vergelijking laat uitvoeren |
| **Bijzonderheid** | GPS-coördinaten uit EXIF worden bewaard omdat ze de bewijswaarde versterken. De gebruiker moet dit kunnen uitzetten. **Openstaand punt.** |

### 4. Huurcontract

| | |
|---|---|
| **Gegevens** | het contract als bestand plus de geëxtraheerde tekst |
| **Doel** | scan op problematische clausules |
| **Grondslag** | uitvoering van de overeenkomst |
| **Bewaartermijn** | zie retentie |
| **Ontvangers** | Supabase Storage (private bucket) |

### 5. Gegevens van de verhuurder

| | |
|---|---|
| **Gegevens** | naam, adres, e-mailadres |
| **Doel** | **uitsluitend** het adresseren en versturen van brieven, en de uitnodiging tot medeondertekening |
| **Grondslag** | gerechtvaardigd belang van de gebruiker om zijn rechten uit te oefenen (art. 6.1.f) |
| **Bewaartermijn** | samen met het dossier van de betrokken woning |
| **Ontvangers** | de aanbieder van aangetekende zending, uitsluitend bij verzending |

De verhuurder is een betrokkene die de app niet zelf gebruikt. Daarom:

- worden zijn gegevens **nooit** gebruikt voor iets anders dan de brief;
- worden ze **niet** gedeeld met andere gebruikers, ook niet geaggregeerd;
- krijgt hij bij de uitnodiging tot medeondertekening te zien welke gegevens over
  hem verwerkt worden en waarom;
- moet er een route zijn waarlangs hij inzage of verwijdering kan vragen.
  **Openstaand punt: dat kanaal bestaat nog niet.**

### 6. Toegangslogboek

| | |
|---|---|
| **Gegevens** | wie welk document opende of verzond, tijdstip, IP, user agent |
| **Doel** | beveiliging en verantwoording |
| **Grondslag** | gerechtvaardigd belang |
| **Bewaartermijn** | 12 maanden — **nog te bevestigen** |

Het logboek bevat **nooit** inhoud: geen foto's, geen contracttekst, geen
brieftekst. Alleen verwijzingen.

## Retentie

Standaard: **2 jaar na het einde van de huurovereenkomst**.

Dat is een bewuste keuze voor dataminimalisatie, maar hij staat op spanning met
de verjaringstermijn: vorderingen uit een huurovereenkomst verjaren pas na
**10 jaar** (`docs/juridisch.md` §6). Een gebruiker kan dus zijn bewijs
kwijtraken terwijl een vordering nog loopt.

Daarom:

- de UI legt dit uit op het moment dat de gebruiker de termijn instelt;
- de termijn is per woning verlengbaar tot maximaal 10 jaar;
- **30 dagen** vóór automatische verwijdering krijgt de gebruiker een bericht met
  een exportlink en de mogelijkheid te verlengen;
- verwijdering is dan onherroepelijk.

## Rechten van de betrokkene

| Recht | Hoe |
|---|---|
| Inzage | export van alle eigen gegevens als downloadbaar archief |
| Rectificatie | rechtstreeks in de app |
| Verwissing | via `deletion_requests`, met bedenktijd vóór uitvoering |
| Overdraagbaarheid | de export is machineleesbaar |
| Bezwaar | verwerkingen op grond van gerechtvaardigd belang zijn opzegbaar |

## Beveiligingsmaatregelen

- Alle tabellen hebben Row Level Security. Wat niet uitdrukkelijk is toegelaten,
  is verboden.
- Storage buckets zijn privaat. Toegang loopt via signed URLs met korte
  geldigheidsduur.
- De service role key wordt uitsluitend server-side gebruikt, in routes die hun
  eigen autorisatie doen.
- Encryptie in rust en tijdens transport via Supabase.
- Geen persoonsgegevens in applicatielogs of foutrapporten. Bij het configureren
  van Sentry moeten `merge_fields`, `exif` en storage-paden gescrubd worden.

## Openstaande punten voor de jurist

1. Is gerechtvaardigd belang de juiste grondslag voor de verhuurdergegevens, of
   is er een andere kwalificatie aangewezen?
2. Welk kanaal krijgt de verhuurder om zijn rechten uit te oefenen?
3. Is een DPIA vereist? Gezien de aard van de gegevens (woninginterieurs,
   mogelijk GPS) en de schaal is dat een reële vraag.
4. Wat is een verdedigbare bewaartermijn voor het toegangslogboek?
5. Moeten GPS-coördinaten uit EXIF standaard bewaard of standaard verwijderd
   worden?
6. Verwerkersovereenkomsten met Supabase, Anthropic, Resend, Stripe en de
   aanbieder van aangetekende zending — alle nog af te sluiten.
7. Doorgifte buiten de EER: waar draaien Supabase en Anthropic voor dit project,
   en welke waarborgen gelden?
