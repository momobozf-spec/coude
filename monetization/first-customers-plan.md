# Plan voor de eerste betalende klanten — 30 dagen

**Doel na 30 dagen:** 10 gekwalificeerde gesprekken gevoerd, **1–2 betaalde pilots getekend**
(€750) en de eerste scan opgeleverd.

> Alle berichten hieronder zijn **concepten**. Er is niets verstuurd of gepubliceerd.

---

## Week 1 — Klaarmaken (geen klantcontact, max ~8 uur)

- [ ] Productieomgeving opzetten volgens `technical-backlog.md` (deel A): Render Frankfurt op
      een betaald plan, eigen domein, back-up, en een hersteltest.
- [ ] Demo-omgeving: de seed bevat 5 Gentse demokantoren met eigen bestanden [docs: README].
      Draai `npm run db:seed` op een **aparte** demo-instance en oefen het demoscript (zie onder).
- [ ] Template voor de verwerkersovereenkomst klaarzetten (laten nalezen door een jurist,
      zie backlog A2).
- [ ] Een lijst van **30 kantoren** maken (zie "Prospects vinden") en die terugbrengen tot 10
      met de beste fit.
- [ ] Een eenvoudige pagina van 1 A4 (PDF) met het aanbod, gebaseerd op `commercial-offer.md`.

**Weekdoel:** demo werkt van begin tot eind, 10 prospects op naam, overeenkomst klaar.

## Week 2 — Gesprekken aanvragen

- [ ] 3 warme intro's vragen (zie onder) en 10 koude, persoonlijke berichten (LinkedIn of e-mail).
- [ ] Na 3 werkdagen één opvolging per prospect. Geen derde bericht.
- [ ] 3 kantoren onaangekondigd bezoeken in je eigen regio (een kantoor met een etalage is
      makkelijk binnen te lopen) met het A4'tje.
- [ ] Gesprekken van 20 minuten **zonder demo**: alleen het probleem toetsen met de vragen
      hieronder.

**Weekdoel:** ≥ 5 probleemgesprekken gevoerd of ingepland.

## Week 3 — Demo's en voorstellen

- [ ] Een demo van 30 minuten voor wie de pijn bevestigde (≥ 3).
- [ ] Binnen 24 uur na de demo een pilotvoorstel sturen.
- [ ] De prijs testen met de drie opties (`commercial-offer.md` §6) en de reacties letterlijk noteren.

**Weekdoel:** ≥ 3 demo's, ≥ 2 voorstellen verstuurd.

## Week 4 — Afsluiten en leveren

- [ ] Voorstellen opvolgen. De verwerkersovereenkomst en de pilot laten tekenen, en een factuur
      sturen (of de betaling na de scangarantie op dag 5).
- [ ] Eerste export ontvangen via een veilige weg (geen e-mailbijlage: gebruik een gedeelde map
      met vervaldatum of laat ze het bestand zelf uploaden in `/imports`).
- [ ] Scan draaien en de top 50 opleveren. Kick-off plannen.
- [ ] Evalueren op basis van de criteria onderaan.

**Weekdoel:** 1–2 getekende pilots, de eerste scan opgeleverd.

---

## Prospects vinden (de eerste 10)

1. **Warm, eerst:**
   - de makelaar via wie jij of je familie ooit kocht of huurde;
   - je boekhouder of notaris: wie van hun klanten heeft een vastgoedkantoor?;
   - je data- en BI-netwerk: wie werkt bij of voor een proptech-bedrijf of CRM-leverancier en
     kent zaakvoerders? Een LinkedIn-post is *niet* nodig, één-op-één vragen werkt beter.
2. **Koud, gericht:**
   - Immoweb- of Zimmo-kantoorpagina's in 2–3 gemeenten in je buurt, met een filter op
     onafhankelijke kantoren met > 20 panden te koop;
   - het BIV-register (biv.be) om erkenning en zaakvoerder na te gaan;
   - Google Maps "vastgoedkantoor" + gemeente: de website moet een "gratis schatting"-formulier
     hebben (dat formulier levert precies de slapende schattingsaanvragen op);
   - LinkedIn: "zaakvoerder" + "vastgoed" + regio.
3. **Kwalificeer** op: onafhankelijk, ≥ 8 jaar actief, 2–15 medewerkers, verkoopgericht,
   schattingsformulier op de site.

Houd alles bij in één spreadsheet: kantoor, contactpersoon, bron, datum van contact, status,
notities en bezwaren.

## Vragen om het probleem en de betalingsbereidheid te toetsen

Stel ze over het **verleden en het heden**, niet over wat ze in de toekomst zouden doen.

1. Hoeveel nieuwe verkoopopdrachten haalden jullie vorige maand binnen? Waar kwamen die vandaan?
2. Wat deden jullie de afgelopen 3 maanden om er méér te krijgen? Wat kostte dat?
3. Hoeveel contacten zitten er ongeveer in jullie CRM? Hoe oud is het oudste?
4. Wanneer heeft iemand voor het laatst systematisch oude schattingsaanvragen of oud-kopers gebeld?
   Wat gebeurde er?
5. Wat houdt jullie tegen om dat elke maand te doen?
6. Als ik je morgen 50 namen uit je eigen bestand geef met een reden om te bellen: wie zou die
   bellen, en wanneer?
7. Hoeveel is één extra verkoopopdracht per kwartaal jullie waard?
8. Wat geven jullie nu per maand uit aan leads of marketing? (prijsanker)
9. Wie beslist bij jullie over zoiets, en hoe gaat dat in zijn werk?
10. (Na het aanbod) Wat zou je tegenhouden om de pilot volgende week te starten?

**Signalen dat het goed zit:** ze noemen zelf een concreet bedrag dat ze aan leads uitgeven, ze
erkennen dat het oude bestand "onontgonnen" is, en ze hebben iemand die kan bellen.
**Rode vlaggen:** "dat doet ons CRM al en we bellen ze maandelijks", geen tijd of mensen om te
bellen, of de beslissing ligt bij het hoofdkantoor.

## Concept: persoonlijk outreachbericht

**Onderwerp:** Oude schattingsaanvragen in jullie bestand

> Dag [voornaam],
>
> Ik ben [naam], freelance data engineer uit [regio]. Ik help vastgoedkantoren om de
> verkoopkansen terug te vinden die al in hun eigen klantenbestand zitten: mensen die ooit
> een schatting vroegen, een mandaat dat niet doorging, kopers van 6 à 10 jaar geleden.
>
> Ik zag dat [kantoor] al sinds [jaar] actief is in [gemeente]. Dan zit daar waarschijnlijk een
> mooi bestand dat niemand nog systematisch opvolgt.
>
> Mag ik je 20 minuten vragen om te horen hoe jullie vandaag aan nieuwe verkoopopdrachten
> komen? Geen verkooppraatje. Ik wil vooral begrijpen of dit voor kantoren als het jouwe een
> echt probleem is.
>
> [dag 1] of [dag 2], bij jullie op kantoor of telefonisch?
>
> Groet,
> [naam] — [telefoon]

**Opvolging na 3 werkdagen (één keer):**
> Dag [voornaam], even een korte opvolging. Als het nu niet past, laat het gerust weten, dan
> stoor ik niet meer. Een vraag die je misschien kan beantwoorden: wanneer heeft iemand bij
> jullie voor het laatst de oude schattingsaanvragen nagebeld?

*Let op (juridisch):* B2B-prospectie per e-mail naar een zakelijk adres is in België toegestaan
onder voorwaarden (Boek XII WER). Geef altijd een uitschrijfmogelijkheid. Bel je prospects, check
dan de Bel-me-niet-meer-lijst, want ook ondernemingen kunnen zich daar inschrijven
([bron](https://blog.forumforthefuture.be/nl/article/genoeg-van-ongewenste-reclameoproepen-zo-kun-je-het-beste-reageren-/26444)).

## Demo-opbouw (30 minuten)

1. **(3 min) Terugkoppeling:** "Je zei dat [hun pijn uit het gesprek]."
2. **(5 min) Import:** toon de preview in 2 stappen met een rommelige CSV ("Janssens, Pieter",
   `0475/12.34.56`, `03/04/2019`). Leg uit dat de datum als 3 april gelezen wordt en dat er niets
   geschreven wordt zonder bevestiging. Dit is het moment waarop je data-expertise zichtbaar wordt.
3. **(10 min) LeadRevive-lijst:** 6 categorieën. Open één kaart: waarom komt deze persoon
   boven, wat weten we wel en niet, de score-opbouw. Wijs een kans toe aan een makelaar.
4. **(5 min) Pipeline en opvolging:** de statussen en hoe je meet wat het oplevert.
5. **(2 min) Privacy:** alleen hun eigen kantoor ziet hun contacten, er komen geen documenten of
   financiële gegevens in, er zijn bewaartermijnen en er is een verwerkersovereenkomst.
6. **(5 min) Aanbod:** de pilot en de scangarantie. Vraag: "Wat zou je tegenhouden om te starten?"

**Toon niet:** de marktradar of `/market` (demodata) als iets wat ze kunnen kopen. Wordt ernaar
gevraagd, dan zeg je eerlijk: "Daar werk ik aan, maar alleen met een bron die het legaal toelaat."

## Concept: voorstel voor een betaalde pilot

> **Voorstel LeadRevive Pilot — [kantoor]**
>
> **Doel:** binnen 60 dagen aantonen dat jullie eigen bestand nieuwe verkoopopdrachten oplevert.
>
> **Wat jullie krijgen**
> - import en opschoning van jullie CRM-export (tot 15.000 contacten) + één verversing op dag 30
> - een geprioriteerde lijst van slapende kansen in een eigen, afgeschermde omgeving (max. 5 gebruikers)
> - een top 50 om mee te starten, met een reden en een belaanpak per contact
> - kick-off (45 min), check-ins op dag 14 en dag 30, evaluatie op dag 60
>
> **Wat we samen meten:** gesprekken gevoerd, schattingsafspraken, gewonnen mandaten.
>
> **Investering:** €750 excl. btw. **Scangarantie:** minder dan 30 bruikbare kansen op dag 5 =
> niets betalen, en de data wordt verwijderd.
>
> **Daarna:** €249 excl. btw per maand, maandelijks opzegbaar. De pilot wordt verrekend bij een
> start binnen 14 dagen.
>
> **Voorwaarden:** verwerkersovereenkomst (bijgevoegd) vóór de aanlevering van data. De data
> blijft van jullie, en na afloop exporteer of verwijder ik op verzoek.
>
> **Niet inbegrepen:** koppelingen met jullie CRM, het bellen zelf, marktdata over particuliere
> verkopers.
>
> **Start:** [datum] · **Contact:** [naam, telefoon]

## Criteria na 30 dagen

| Uitkomst | Criterium | Actie |
|---|---|---|
| **Doorgaan en investeren** | ≥ 1 getekende betaalde pilot **en** ≥ 5 van 10 gesprekken bevestigen de pijn | Tweede ronde van 20 prospects. Start fase B van de backlog (e-maildigest) zodra er 2 pilots lopen |
| **Bijsturen** | ≥ 5 bevestigen de pijn, maar niemand betaalt | Scope of prijs is het probleem: test de eenmalige scan van €490, of een ander segment (grotere kantoren met een eigen belcel). Nog 2 weken |
| **Bijsturen (ander probleem)** | Ze willen vooral **nieuwe** leads, niet hun oude bestand | De marktradar is wat ze willen. Onderzoek eerst een legale bron (partnerschap of feed) voordat je bouwt. Niet scrapen |
| **Stoppen** | < 3 van 10 herkennen het probleem, of iedereen zegt "dat doet ons CRM al" | Stop met ImmoRadar als product. Gebruik het als referentiecase voor dataprojecten in vastgoed |

**Na 60 dagen (einde pilot):** doorgaan als ≥ 1 pilotklant omzet naar €249/maand **en** de pilot
≥ 3 schattingsafspraken uit de lijst opleverde.
