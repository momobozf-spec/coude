# LeadRevive als zelfstandig product? — productcheck

*20 oktober 2026.* Labels: **[CODE]** vastgesteld · **[BRON]** externe bron ·
**[REKENING]** afgeleid · **[AANNAME]** te toetsen.

## 1. Kan een kantoor het zelf kopen en gebruiken?

| Wat self-service vraagt | Stand vandaag | Wat nodig is |
|---|---|---|
| Zelf een account aanmaken | ❌ Een platformbeheerder maakt kantoren aan [CODE: `/admin/agencies`] | Registratie, e-mailverificatie, aanmaken van de tenant |
| Verwerkersovereenkomst | ❌ Concept, op papier | Overeenkomst online aanvaarden (art. 28.9 AVG laat elektronische vorm toe) + versiebeheer |
| Betalen | ❌ Niets in de app | Stripe/Mollie-checkout, facturen met btw, opzeggen |
| Import zonder hulp | 🟡 Preview in twee stappen bestaat [CODE]; echte exports vragen nog interpretatie | Handleiding per CRM, automatische validatie, hulptekst per fout |
| Wachtwoord vergeten | ❌ Alleen een admin reset [CODE] | E-mailprovider + resetflow |
| **Mag dit contact benaderd worden?** | ❌ Ontbreekt volledig (zie §3) | Een apart contacteerbaarheidsmodel |
| Taal en land | Nederlands, Belgische formaten [CODE] | Frans voor Wallonië en Frankrijk; per land andere CRM-exports, telefoonformaten en regels |

Inschatting van het bouwwerk [AANNAME]: **25–40 werkdagen** van jou. Daarbovenop
cash: juridische templates (€1.000–2.000) en hosting (€30–50/maand).

## 2. Is er terugkerende waarde?

Nee, niet genoeg voor een maandabonnement:
- De grote waarde komt bij de **eerste** scan: oude dubbels opruimen en jaren aan slapende relaties vinden.
- Daarna komen er per maand maar **5–20 nieuwe redenen** om te bellen bij [AANNAME, zie `pricing-and-costs.md` §1].
- Een kantoor dat elke dag inlogt, krijgt daar geen extra waarde van. Dagelijks
  gebruik zou alleen zinvol zijn als LeadRevive het CRM vervangt, en dat is een
  ander, veel groter product in een markt met gevestigde spelers (Whise, SweepBright).
- **Juridische rugwind ontbreekt, tegenwind niet:** het Belgische wetsvoorstel DOC
  56 1081 zou telemarketing naar consumenten zonder voorafgaande toestemming
  verbieden, behalve binnen een lopende overeenkomst. Dat raakt de kern van het
  product (zie [juridisch-kader.md](juridisch-kader.md)).

## 3. Een geselecteerd contact is geen contact dat benaderd mag worden

Wat LeadRevive vandaag doet: **selecteren** (er is een reden) en **bereikbaarheid**
vaststellen (er is een telefoonnummer of e-mailadres). Geen van beide zegt dat
iemand commercieel benaderd mag worden. In de vorige versie heette dat een
"bruikbare kans"; die term was misleidend.

Een correct model kent drie lagen, per contact **en per kanaal**:

| Laag | Vraag | Wie beslist | In het product |
|---|---|---|---|
| 1. Geselecteerd | Is er een reden om dit contact te overwegen? | Software | Categorie + reden (bestaat) |
| 2. Bereikbaar | Is er een technisch geldig nummer of adres? | Software | Validatie (bestaat) |
| 3. Toegestaan | Mag het kantoor deze persoon via dit kanaal benaderen? | **Het kantoor**, als verwerkingsverantwoordelijke | Per kanaal (telefoon, e-mail, post): status *onbekend / toegestaan / niet toegestaan*, met grond en datum |

Laag 3 bestaat uit:
- **Bezwaar** (art. 21.2 AVG): eenmaal gemaakt, nooit meer marketing. Opslaan en nooit overschrijven bij een nieuwe import.
- **Bel-me-niet-meer**: datum van de laatste controle per nummer. Zonder controle is de status voor telefoon *onbekend*.
- **E-mail**: toestemming, of eigen klant met soft opt-in (Boek XII).
- **Belangenafweging per categorie**: het kantoor zet categorieën aan of uit, met
  een maximale ouderdom (bv. "schattingsaanvraag tot 3 jaar"). Zo wordt die
  afweging aantoonbaar.
- **Standaard = onbekend = niet op de bellijst.** Een export of bellijst bevat alleen laag 3 = *toegestaan*.

**In het aanbod** betekent dat:
- de software levert *geselecteerde en bereikbare* contacten;
- het kantoor bevestigt de toelating;
- het rapport toont drie getallen: geselecteerd → bereikbaar → toegestaan.
  Garanties en succescijfers gaan alleen over wat de software beheerst.

**Status:** niet gebouwd. Op jouw verzoek heb ik geen nieuwe features gestart. Het
voorstel staat hier als ontwerp; het is pas relevant als LeadRevive doorgaat.

## 4. Kan een steekproef "geen foute samenvoegingen" garanderen?

Nee.

- **Statistiek** [REKENING]: vind je in een willekeurige steekproef van *n*
  samenvoegingen **nul** fouten, dan ligt het werkelijke foutpercentage met 95 %
  zekerheid onder ongeveer 3/*n*:

  | Steekproef | Bovengrens (95 %) | Bij 300 samenvoegingen: maximaal nog |
  |---:|---:|---:|
  | 50 | 5,8 % | ~17 foute |
  | 100 | 3,0 % | ~9 foute |
  | 200 | 1,5 % | ~4 foute |

  Een steekproef van 50 sluit dus niet uit dat er tientallen foute samenvoegingen
  in een groot bestand zitten. "0 fouten" is alleen te garanderen voor wat
  **volledig** is nagekeken.
- **Een structureel risico** [CODE]: de import voegt samen op hetzelfde
  telefoonnummer (`src/crm/dedupe.ts`). Gezinsleden met één vast nummer, of een
  bedrijfsnummer dat bij meerdere mensen staat, worden dan één contact. Dat is
  geen toeval maar een regel, en een steekproef vindt het pas als het toevallig in
  de steekproef zit.
- **De andere fout:** dubbels die níet samengevoegd werden. Een steekproef van samenvoegingen ziet die niet.

**Wat wel kan:**
1. **Alle** samenvoegingen tonen. Bij een bestand van een kantoor zijn dat er
   meestal tientallen tot enkele honderden [AANNAME]: volledig na te kijken.
2. Samenvoegingen op een **vast nummer of een gedeeld nummer** apart markeren en
   standaard niet automatisch samenvoegen.
3. De garantie formuleren als proces en herstel: "elke gemelde foute samenvoeging
   maken we binnen 2 werkdagen ongedaan". De import houdt per rij een diff bij
   [CODE: `CrmImportRow.changes`], dus herstel is mogelijk.

## 5. Economie van een self-service LeadRevive

Alle getallen [AANNAME] tenzij anders vermeld.

**Werving via website en socials.** B2B-advertenties naar zaakvoerders van vastgoedkantoren in Vlaanderen:

| Scenario | Prijs per klik | Bezoek → proef | Proef → betalend | **Kost per klant** |
|---|---:|---:|---:|---:|
| Optimistisch | €3,00 | 5 % | 30 % | €200 |
| Middel | €4,50 | 4 % | 25 % | €450 |
| Pessimistisch | €6,00 | 3 % | 20 % | €1.000 |

**Wat een klant oplevert:**
- Kwartaalscan €39/maand. Omdat de waarde vooraan zit, verwacht ik een levensduur
  van 6–12 maanden. Na betaalkosten en support blijft er per klant **€140–285** over.
- Eenmalige scan €149: na kosten en 45 minuten support **~€88**.

**Plafond van de markt** [REKENING op AANNAME]: als er in België 2.000–4.000
kantoren zijn (Whise alleen al >2.000 in BE+FR [BRON]), geeft 5 % penetratie aan
€39 een omzet van **€3.900–7.800 per maand**. Internationaal schalen botst op een
ander CRM-landschap, andere taal en strengere telemarketingregels per land.

**Conclusie:** de kost per klant (€200–1.000) ligt boven wat een klant oplevert
(€88–285). Zelfs bij optimistische aannames verdient de self-service-versie zijn
werving niet terug. Het plafond is klein, en internationaal schaal je slecht.
Daarbovenop komen 25–40 werkdagen bouwwerk.
