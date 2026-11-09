# TenderKompas: marketing- en verkoopplan + commerciële materialen

Versie: concept 23-10-2026. Status: niets verzonden of gepubliceerd. Alles hieronder is concepttekst.
Bindende bron: `/home/claude/work/BESLISSING.md`. Feiten over concurrenten: `/home/claude/work/markt/M3-b2b.md` (sectie T). Stand van het product: `/home/claude/work/audit/A3-b2b-realestate.md` (sectie 1).
Verkopende entiteit: Marhaba Data & AI Agent BV (BTW BE1003552102).

**Markering:** `[v1-werk]` = functie wordt in materiaal genoemd maar werkt vandaag nog niet (of is niet live bewezen). `[toekomstige versie]` = valt buiten v1. Wat ongemarkeerd is, bestaat in de code (audit A3), maar draait nog niet in productie: het product is vandaag nergens gedeployed.

---

## 0. Eerst dit: wat bestaat er echt, en wanneer mag er verkocht worden?

| Functie (zoals beloofd in BESLISSING.md) | Stand vandaag (audit A3) | Markering in materialen |
|---|---|---|
| Zoekprofiel instellen in klantportaal | Route `portal/profiel` bestaat | bestaat |
| Kansenoverzicht + detailpagina met bronlink | Routes `portal/kansen/[id]`, `portal/bronnen` bestaan; enkel getest met fixture/handmatige data | bestaat (op testdata) |
| Classificatie op aankondigingstekst (trefwoorden + AI) | AI-extractie met Zod-schema + citaatverificatie bestaat; nooit op live TED-tekst gedraaid | `[v1-werk]` voor de live werking |
| Relevantiescore 0–100 met uitleg | Beoordelingsengine bestaat; score 0–100 + uitleg in de UI zoals beloofd is niet geverifieerd | `[v1-werk]` |
| Wekelijkse digest per e-mail, elke maandag | Digest-rendering + nodemailer bestaan; geen scheduler, geen SMTP-provider | `[v1-werk]` (automatische maandagverzending) |
| Automatische digest zonder menselijke review per kans | Huidige workflow heeft verplichte review per kans | `[v1-werk]` (review-stap eruit/automatiseren) |
| Live bron TED | Importcode bestaat; geen enkele live TED-call ooit geslaagd | `[v1-werk]` |
| Raamcontract-radar (gegunde raamcontracten + winnende hoofdaannemer) | Niet aangetroffen in de audit | `[v1-werk]` |
| CSV-export voor klant | Alleen een admin-export van digests | `[v1-werk]` |
| Meerdere gebruikers per account (2 / 10) | Auth + rollen bestaan; gebruikerslimieten per pakket niet geverifieerd | `[v1-werk]` |
| Pilot zonder kaart, self-service aanmelden | Aanvraagformulier op landingspagina bestaat; self-service account niet geverifieerd | `[v1-werk]` |
| Betaling/abonnement, wachtwoordreset, deploy | Ontbreekt | `[v1-werk]` |
| Belgische nationale publicaties (e-Procurement) | Geen toegestane API/export gevonden | `[toekomstige versie]` (pas na bevestiging van gebruiksvoorwaarden) |

**Volgorde (eigen beslisregel):**
1. **Fase 0 (nu, vóór v1):** geen pilot beloven. Alleen 8–10 probleemgesprekken met zaakvoerders (geen verkoop). Tegelijk `scripts/ted-live-check.mjs` en de 90-dagensteekproef draaien.
2. **Poort naar fase 1:** live TED-import werkt + steekproef gedaan + deploy, SMTP en scheduler draaien. Pas dan gaan landingspagina, uitnodigingen en advertenties live.
3. **Productbeslissing na de steekproef (eigen beslisregel):** levert een typisch data/BI-profiel over 90 dagen gemiddeld **minder dan 4 relevante TED-publicaties per maand** op, dan niet als wekelijkse digest lanceren. Schuif dan de raamcontract-radar naar voren als hoofdproduct of stop. Het getal 4 is een eigen keuze, geen benchmark.

**Belangenconflict (kort, wel belangrijk):** Mohamed werkt als freelancer voor Digitaal Vlaanderen, een aanbestedende overheid. Gebruik enkel publieke data. Gebruik nooit kennis over komende opdrachten van de eigen klant en benader geen bureaus over opdrachten van die klant. Kijk de contractclausules via Cronos na (non-compete, nevenactiviteiten) vóór de eerste verkoopactie.

---

## A. Verkoopbaar aanbod

### A1. Doelgroep
- **Primair:** Belgische data-, BI- en cloudbureaus met 3–30 medewerkers (Power BI/Fabric, Databricks, Azure, datawarehouse).
- **Beslisser:** zaakvoerder of business-unit-lead. Vaak dezelfde persoon die vandaag zelf "af en toe" e-Procurement of TED checkt.
- **Typische situatie:** het bureau werkt al voor overheden of wil dat, meestal via onderaanneming. Er is geen tendermanager in huis.

### A2. Belofte (exact, BESLISSING.md)
> "Elke maandag de Belgische overheidsopdrachten en gegunde raamcontracten die bij jouw data- en BI-team passen, met een relevantiescore en bronlink – zonder zelf e-Procurement en TED door te spitten."

**Verplichte nuance in elk materiaal tot de Belgische bron er is:** "In v1 enkel Europese publicaties (TED). Belgische nationale publicaties volgen." Onder de Europese drempels publiceert België nationaal, en die opdrachten zitten dus nog niet in TenderKompas.

### A3. Afgebakende v1

| Zit in v1 | Zit NIET in v1 |
|---|---|
| Wekelijkse digest per e-mail op maandag `[v1-werk]` + webportaal | Belgische nationale publicaties (e-Procurement) `[toekomstige versie]` |
| Classificatie op de tekst van de aankondiging (trefwoorden + AI), niet alleen op CPV `[v1-werk]` | Juridisch of strategisch advies, bid/no-bid-advies op maat |
| Relevantiescore 0–100 met uitleg + link naar de officiële publicatie `[v1-werk]` | Menselijke review per kans |
| Raamcontract-radar: gegunde data/BI-raamcontracten + winnende hoofdaannemer (Team) `[v1-werk]` | Offertes schrijven, indienen, documentbeheer, pipeline-CRM |
| CSV-export (Team) `[v1-werk]` | Garantie op gunning of op een minimum aantal opdrachten |
| Bron v1: TED (EU open data) `[v1-werk]` | Mobiele app (het is een web-SaaS) |

### A4. Pakketten en prijzen (exact, excl. btw)

| | **Solo** | **Team** |
|---|---|---|
| Prijs per maand | €59 | €119 |
| Jaarbetaling (10 × maandprijs) | €590 | €1.190 |
| Zoekprofielen | 1 | 3 |
| Gebruikers | 2 | 10 |
| Wekelijkse digest + portaal | ja | ja |
| Raamcontract-radar | – | ja `[v1-werk]` |
| CSV-export | – | ja `[v1-werk]` |
| Instap | 30 dagen gratis pilot, zonder kaart | 30 dagen gratis pilot, zonder kaart |
| Opzeggen | maandelijks | maandelijks |

Betaling en abonnementsbeheer: `[v1-werk]`.

### A5. Waarom een abonnement en geen eenmalige aankoop
- De waarde zit in een **doorlopende stroom nieuwe publicaties en gunningsberichten**. Een eenmalige lijst is na een paar weken verouderd.
- De kosten lopen ook door: wekelijkse import, AI-classificatie en e-mailverzending.
- Maandelijks opzegbaar + 30 dagen gratis verlaagt het risico voor de klant. Dat is een bewust contrast met concurrenten die met jaarcontracten en setup-fees werken (TenderApp: min. 12 maanden + setup €275–1.315, volgens M3).
- Jaarbetaling (10 × maandprijs) is een korting voor wie overtuigd is, geen verplichting.

### A6. Positionering t.o.v. alternatieven (eerlijk)

| Alternatief | Wat het goed doet | Waarom iemand toch TenderKompas kiest | Waarom iemand het NIET zou kiezen |
|---|---|---|---|
| **e-Procurement / e-Notification (FOD BOSA)** | Gratis, officieel, volledig Belgisch, dagelijkse alerts | Filtert enkel op CPV/regio. IT/data zit onder brede CPV-codes (72xxxxxx) en dat geeft ruis. TenderKompas leest de tekst van de aankondiging en scoort op data/BI-relevantie `[v1-werk]` | Volledige Belgische dekking, ook onder de Europese drempels. Dat heeft TenderKompas v1 **niet** |
| **TED-alerts** | Gratis, officieel, opgeslagen zoekopdrachten | Alleen de data/BI-relevante stukken, met score en uitleg, één keer per week gebundeld, plus de raamcontract-radar (wie heeft gewonnen) | Wie zelf goede TED-zoekopdrachten heeft en de tijd neemt, heeft dezelfde bron gratis |
| **TenderWolf** | Belgisch, NL/FR/EN, AI-matching op bestekinhoud, gratis instap, €79/€149 per maand, meer landen | Smal gericht op data/BI-teams, gebouwd door een data & BI-engineer uit die wereld. Raamcontract-radar met hoofdaannemers voor onderaanneming `[v1-werk]`. Iets lager geprijsd (€59/€119) | TenderWolf dekt meer bronnen en landen, heeft meer functies en bestaat al. Wie breed (niet alleen data/BI) zoekt, kiest beter TenderWolf |
| **Zelf zoeken / via hoofdaannemer** | Gratis, je kent je netwerk | Tijdsbesparing, minder gemiste publicaties, zicht op wie welk raamcontract heeft | Bureaus die al vast onderaannemen via één integrator krijgen de info soms al via die partner |

**Voor wie het NIET is (staat ook op de landingspagina):**
- Bureaus die nu al alle Belgische opdrachten nodig hebben, ook onder de Europese drempels: wacht op de Belgische bron of gebruik e-Procurement/TenderWolf.
- Wie hulp zoekt bij het schrijven of indienen van offertes, of juridisch advies.
- Teams buiten data/BI/cloud (bv. bouw, facility, algemene IT-hardware).
- Grote integratoren met een eigen tenderteam.
- Wie garanties op resultaat verwacht.

---

## B. Kanalenplan

### B1. Kanaalvergelijking

| Kanaal | Past? | Reden |
|---|---|---|
| **LinkedIn (outreach + eigen posts)** | **Past – gekozen (1)** | Beslissers zitten daar. Mohamed is zelf een data & BI-engineer in de publieke sector, dus geloofwaardige afzender. Kleine, benoembare doelgroep die je persoonlijk kan benaderen |
| **Communities / partners** (Databricks User Group Belgium, Power BI/Fabric user groups, Agoria/UNIZO) | **Past – gekozen (2)** | Doelgroep komt daar al samen. Inhoudelijke bijdrage (talk/analyse) bouwt vertrouwen. Gratis toegang tot user groups (M3) |
| Google Search (Ads) | Past niet (nu) | Zoekvolumes voor deze niche niet gevonden (M3). Kleine doelgroep, dus risico op dure klikken van brede "aanbesteding"-zoekers. Eventueel later testen |
| SEO | Past niet (nu) | Traag (maanden), kleine doelgroep. Later wel nuttig als bijproduct: een publieke pagina met een analyse van data/BI-raamcontracten |
| Instagram | Past niet | B2B-beslissers zoeken hier geen tendertool. Geen natuurlijke content |
| TikTok | Past niet | Zelfde reden, nog verder van de doelgroep |
| Meta Ads | Past niet | Targeting op "zaakvoerder data/BI-bureau BE" is onnauwkeurig. LinkedIn targett op functie en sector |
| Kleine contentmakers | Past niet (nu) | Weinig BE-creators rond data/BI + aanbestedingen. Mohamed is zelf de beste "contentmaker" voor deze niche |
| Appstore-vindbaarheid | Niet relevant | Web-SaaS, geen app |

Maximum 2 kanalen (BESLISSING.md). De rest pas heroverwegen na de eerste go/stop-meting.

### B2. Kanaal 1: LinkedIn

**Waarom het past:** de doelgroep is klein en benoembaar (zaakvoerders van BE data/BI-bureaus). Mohamed kent het Cronos- en Digitaal Vlaanderen-ecosysteem en spreekt de taal van het vak. Persoonlijke outreach werkt beter dan massamarketing bij een kleine markt zonder bekend merk.

**Benodigde materialen:** geüpdatet LinkedIn-profiel (kopregel noemt TenderKompas naast freelance werk), landingspagina (C1), demovideo (C2), 5 posts (C3), DM-uitnodiging (C5), eenvoudige trackingsheet (Google Sheet: naam, bureau, datum DM, reactie, demo, pilot, profiel ingesteld, actief week 3, conversie), UTM-links (`utm_source=linkedin&utm_medium=dm|post|ad`).

**Organische aanpak (fase 1, na v1):**
- Lijst van 40 zaakvoerders/BU-leads van BE data/BI-bureaus (3–30 FTE), handmatig opgebouwd via LinkedIn-zoekopdrachten en het eigen netwerk. Geen scraping.
- Per week ±13 persoonlijke DM's (3 weken), elk met één persoonlijke zin. Geen automatiseringstools.
- 2 posts per week (C3), gespreid over 3 weken. Reageren op elke reactie binnen 24 uur.
- Demo = 15 minuten scherm delen: profiel instellen + eerste digest bekijken.

**Betaalde aanpak (pas na organische go):**
- LinkedIn Sponsored Content, 3 varianten (C4). Targeting: België; bedrijfsgrootte 2–10 en 11–50; sector IT-diensten/consultancy; functies founder/CEO/managing director/business unit manager/practice lead; eventueel vaardigheden Power BI/Databricks/Azure. Doelpagina = landingspagina met UTM.
- Kijk het minimumdagbudget en de minimale doelgroepgrootte na in Campaign Manager vóór de start. Hier worden bewust geen bedragen per klik of verwachte conversies genoemd: daar zijn geen betrouwbare cijfers voor.

**Testbudget en uren (eerste 90 dagen, afgestemd op het financiële model):**
Kader: totale eigen tijd voor marketing/verkoop = basis **12 u/maand**, dus 36 u over 90 dagen. Daarvan 22 u LinkedIn en 14 u communities/partners.

| Onderdeel | Budget | Eigen uren |
|---|---|---|
| Lijst opbouwen (40 namen) | €0 | 3 u |
| DM's + opvolging (3 weken) | €0 | 5 u |
| Posts schrijven/plaatsen/reageren (6 posts) | €0 | 5 u |
| Demo's (tot 10 × 30 min incl. voorbereiding) | €0 | 5 u |
| Demovideo opnemen | €0 | 2 u |
| LinkedIn Sponsored Content: eenmalige test, pas na werkende pilotroute (aanmelden → profiel → digest) én organische go | **€300** over 3 weken | 2 u |
| **Totaal LinkedIn** | **€300** | **22 u** |

**Meetpunten (allemaal zelf meetbaar in de trackingsheet, het portaal of Campaign Manager):**
1. Aanvaarde connectieverzoeken/DM-antwoorden van de 40.
2. Aanvaarde demo's.
3. Gestarte pilots (account aangemaakt).
4. Pilots met ingesteld profiel binnen 7 dagen.
5. Pilots die in week 3 nog actief zijn (ingelogd in het portaal of gereageerd op de digest). Login-logging in de admin: `[v1-werk]` als het nog niet bestaat.
6. Conversie naar betalend na 30 dagen.
7. Ads: klikken naar de landingspagina, pilot-aanmeldingen met `utm_medium=ad`, kost per pilot-aanmelding.

**Go / bijsturen / stop (eigen beslisregels, geen benchmarks):**

| Meting | Doorgaan | Bijsturen | Stoppen |
|---|---|---|---|
| Demo's uit 40 DM's binnen 3 weken | ≥ 8 aanvaarden een demo | 4–7: boodschap of segment aanpassen (bv. enkel Databricks-bureaus), nieuwe lijst van 20 | ≤ 3: kanaal of propositie herzien vóór verdere investering |
| Pilots na demo | ≥ 50% van de demo's start een pilot | 25–49%: demo inkorten, bezwaren (C8) beter beantwoorden | < 25%: product sluit niet aan, gesprekken analyseren |
| Actief in week 3 | ≥ 60% van de pilots | 30–59%: digest-inhoud/scores bijsturen | < 30%: waarde te laag, terug naar de steekproefbeslissing (§0) |
| Conversie na pilot | ≥ 3 betalende klanten uit de eerste cohort | 1–2: pilot verlengen voor wie twijfelt, prijs-/pakketvraag stellen | 0: niet opschalen, niet adverteren |
| Ads (€300) | Kost per pilot-aanmelding ≤ €59 (één maand Solo) | €60–150: varianten/targeting wisselen | > €150 of 0 aanmeldingen na €200: ads stoppen, organisch blijven |

### B3. Kanaal 2: Communities en partners

**Waarom het past:** Databricks User Group Belgium en Power BI/Fabric user groups brengen exact de mensen samen die met deze technologieën bij (semi-)publieke klanten werken. Agoria (ICT) en UNIZO (kmo) werken aan kmo-toegang tot overheidsopdrachten (M3). Zo kan het onderwerp "toegang tot overheidsopdrachten" inhoudelijk aangebracht worden in plaats van als verkooppraatje.

**Benodigde materialen:** partnerberichten (C6), een talk van 20 minuten "Data- en BI-overheidsopdrachten in België: wat zit er in TED open data?" (gebaseerd op de eigen 90-dagensteekproef en gunningsberichten, alleen echte cijfers uit die steekproef), 1 pagina pdf-samenvatting van die analyse, landingspagina-link met `utm_source=community`.

**Organische aanpak:**
- Talk of lightning talk aanbieden bij 2 user groups (binnen 90 dagen er 1 geven). Inhoud = analyse, geen productdemo. Product enkel op de laatste slide.
- Bij Agoria/UNIZO: de analyse aanbieden als input voor hun kmo-toegangswerk. Een ledenvoordeel voorstellen (bv. pilot van 60 i.p.v. 30 dagen voor leden; eigen voorstel, nog niet beslist).
- Aanwezig zijn op 2 meetups als deelnemer (netwerken, geen pitch).

**Betaalde aanpak:** €0 cash in de eerste 90 dagen. Partnerkosten zijn niet gevonden (M3). Optioneel: sponsoring van één user group-meetup, **maximaal €200**, en alleen na een go op kanaal 1.

**Testbudget en uren (eerste 90 dagen):**

| Onderdeel | Budget | Eigen uren |
|---|---|---|
| Analyse + talk voorbereiden (hergebruikt de 90-dagensteekproef) | €0 | 8 u |
| Contact met organisatoren/federaties (4 contacten + opvolging) | €0 | 2 u |
| 1 talk/meetup geven of bijwonen | €0 | 4 u |
| Optioneel: sponsoring van één meetup | max. €200 | – |
| **Totaal communities/partners** | **€0** (optioneel max. €200) | **14 u** |

**Totaal beide kanalen, eerste 90 dagen:** €300 cash (+ optioneel max. €200), 36 u eigen tijd (12 u/maand).

**Meetpunten:** aantal positieve antwoorden van organisatoren, aantal gegeven talks, pilot-aanmeldingen met `utm_source=community`, gesprekken na de talk, eventueel een formele partnerafspraak.

**Go / bijsturen / stop (eigen beslisregels):**

| Meting | Doorgaan | Bijsturen | Stoppen |
|---|---|---|---|
| Antwoord van de 4 contacten binnen 4 weken | ≥ 2 positief (talk of samenwerking) | 1: andere invalshoek (bv. Fabric-groep, Waalse groep in FR) | 0: kanaal parkeren, focus op LinkedIn |
| Pilots per gegeven talk | ≥ 3 pilot-aanmeldingen per talk | 1–2: CTA/aanbod aanpassen | 0 na de eerste talk: geen talks meer als acquisitie in deze 90 dagen |
| Federatie (Agoria/UNIZO) | Concrete afspraak (nieuwsbrief, webinar, ledenvoordeel) binnen 8 weken | Enkel interesse: opnieuw opvolgen na de Belgische bron | Geen reactie na 2 opvolgingen: stoppen |

---

## C. Materialen

### C1. Landingspagina (volledige tekst)

**[Hero]**

# Overheidsopdrachten voor jouw data- en BI-team. Elke maandag in je inbox.

TenderKompas leest Europese publicaties (TED) en gegunde raamcontracten. Je krijgt enkel wat past bij Power BI, Fabric, Databricks, Azure en datawarehousing, met een relevantiescore en een link naar de officiële publicatie.

**[Knop] Start 30 dagen gratis pilot**: zonder kaart, daarna maandelijks opzegbaar.

*Let op: v1 bevat enkel Europese publicaties (TED). Belgische nationale publicaties volgen.*

---

**[Probleem]**

## Zoeken naar overheidsopdrachten is ruis filteren

- IT- en data-opdrachten zitten onder brede CPV-codes. Een alert op die codes levert vooral netwerkapparatuur, licenties en helpdesks op.
- De inhoud die ertoe doet (een Fabric-migratie, een datawarehouse, Power BI-rapportering) staat in de tekst van de aankondiging, niet in de code.
- Kleine bureaus winnen grote raamcontracten zelden zelf. De echte kans is vaak onderaanneming bij wie wél gewonnen heeft. Maar wie is dat?
- En niemand in je team heeft tijd om elke week e-Procurement en TED door te spitten.

---

**[Hoe het werkt]**

## Zo werkt het

1. **Stel je profiel in (5 minuten).** Je kiest technologieën, type werk, regio en trefwoorden die je wil uitsluiten.
2. **TenderKompas leest elke week de nieuwe publicaties.** Het classificeert op de tekst van de aankondiging (trefwoorden + AI), niet alleen op CPV-code. `[v1-werk]`
3. **Je krijgt een score van 0 tot 100 met uitleg.** Waarom past deze opdracht (of niet), met een link naar de officiële publicatie. `[v1-werk]`
4. **Elke maandag een digest.** Per e-mail en in je webportaal. Jij beslist wat je ermee doet. `[v1-werk]`

---

**[Wat je krijgt]**

## Wat je krijgt

- **Wekelijkse digest** per e-mail op maandag + een webportaal met alle kansen. `[v1-werk]`
- **Relevantiescore 0–100 met uitleg**, telkens met link naar de officiële bron. `[v1-werk]`
- **Raamcontract-radar** (Team): gegunde raamcontracten in data en BI, met de winnende hoofdaannemer, zodat je weet bij wie onderaanneming mogelijk is. `[v1-werk]`
- **CSV-export** (Team) om kansen in je eigen pipeline of Power BI te zetten. `[v1-werk]`

Wat je níet krijgt: juridisch of strategisch advies, een menselijke review per kans, of een garantie dat je een opdracht wint. Je beoordeelt zelf, met de officiële publicatie als bron.

---

**[Prijzen]**

## Prijzen (excl. btw)

| | Solo | Team |
|---|---|---|
| Per maand | **€59** | **€119** |
| Per jaar (2 maanden gratis) | €590 | €1.190 |
| Zoekprofielen | 1 | 3 |
| Gebruikers | 2 | 10 |
| Wekelijkse digest + portaal | ✓ | ✓ |
| Raamcontract-radar | – | ✓ |
| CSV-export | – | ✓ |

Beide pakketten starten met **30 dagen gratis pilot, zonder kaart**. Daarna maandelijks opzegbaar, zonder jaarcontract en zonder setup-kosten.

**[Knop] Start 30 dagen gratis pilot**

---

**[Voor wie het niet is]**

## Eerlijk: voor wie TenderKompas (nog) niet is

- Je hebt nu al **alle** Belgische opdrachten nodig, ook die onder de Europese drempels. Die publiceert België nationaal, en die zitten nog niet in v1.
- Je zoekt hulp bij het schrijven of indienen van offertes.
- Je team werkt niet in data, BI of cloud.
- Je verwacht een garantie op gunning of op een minimum aantal opdrachten per maand.

---

**[FAQ]**

Vragen over bronnen, aantallen, TenderWolf of e-Procurement? **[Link] Lees de FAQ en eerlijke antwoorden** (C8)

---

**[Slot-CTA]**

## Probeer het een maand op je eigen profiel

Na 30 dagen weet je of het genoeg oplevert voor jouw team. Zo niet, dan stopt het gewoon. Je hebt niets te annuleren.

**[Knop] Start 30 dagen gratis pilot**

---

**[Footer]**
TenderKompas is een product van Marhaba Data & AI Agent BV, BTW BE1003552102. Bronnen: TED (Publicatiebureau van de EU, open data). TenderKompas is geen officiële overheidsdienst en geeft geen juridisch advies. Privacyverklaring · Algemene voorwaarden `[v1-werk: beide documenten opstellen]`

---

### C2. Demovideoscript (40 seconden)

Opnamevoorwaarde: enkel opnemen nadat de live TED-import werkt. Gebruik een **echte** TED-publicatie uit de import, geen fictieve opdracht. Lukt dat niet, dan wordt in beeld "Voorbeeldweergave – testdata" getoond.

| Tijd | Beeld | Voice-over |
|---|---|---|
| 0:00–0:05 | Mohamed in beeld of zijn naam + "Data & BI engineer" als titel | "Ik ben Mohamed, data- en BI-engineer. Ik bouwde TenderKompas voor bureaus zoals het mijne." |
| 0:05–0:10 | Scherm: TED-zoekresultaat met lange lijst ongerelateerde IT-opdrachten (scrollen) | "Overheidsopdrachten zoeken op CPV-code levert vooral ruis op." |
| 0:10–0:17 | Portaal: profielpagina, aanvinken Power BI, Databricks, datawarehouse, regio | "In TenderKompas stel je één keer je profiel in: technologieën, type werk, regio." |
| 0:17–0:26 | Portaal: kansenoverzicht, één kans openen met score + uitleg + knop "Officiële publicatie" `[v1-werk: score 0–100 met uitleg]` | "Elke publicatie krijgt een score van 0 tot 100, met uitleg waarom ze past, en een link naar de officiële bron." |
| 0:26–0:32 | E-mail-inbox: digest "Jouw kansen deze week" op maandag `[v1-werk]` | "Elke maandag krijg je dat overzicht in je mailbox." |
| 0:32–0:37 | Team-weergave: raamcontract-radar met gegunde raamcontracten + hoofdaannemer `[v1-werk]` | "In het Team-pakket zie je ook wie welk data-raamcontract gewonnen heeft. Handig voor onderaanneming." |
| 0:37–0:42 | Eindkaart: "30 dagen gratis pilot, zonder kaart. v1: Europese publicaties (TED)." + URL | "Probeer het 30 dagen gratis. Voorlopig met Europese publicaties; de Belgische volgen." |

Regel: scènes met `[v1-werk]` pas opnemen wanneer de functie echt werkt. Anders schrappen en de video inkorten tot ±30 seconden.

---

### C3. Vijf LinkedIn-posts

**Post 1: Het probleem (CPV-ruis)**

> Wie als data- of BI-bureau overheidsopdrachten volgt, kent het: je zet een alert op de IT-CPV-codes en krijgt laptops, telefonie, licenties en helpdesks.
>
> De opdrachten die voor ons interessant zijn (een datawarehouse, een Fabric- of Databricks-platform, Power BI-rapportering) herken je pas als je de tekst van de aankondiging leest.
>
> Daarom bouw ik TenderKompas: het leest die tekst en scoort elke publicatie op relevantie voor data- en BI-teams. Eerst op Europese publicaties (TED), Belgische volgen.
>
> Hoe volgen jullie vandaag overheidsopdrachten op? Ik ben oprecht benieuwd.

**Post 2: Onderaanneming en raamcontracten**

> Eerlijke vaststelling: kleine data-bureaus winnen grote overheidsraamcontracten zelden zelf. Referenties, omzetdrempels en de omvang van de percelen maken het moeilijk.
>
> Maar het werk wordt wel gedaan, vaak door specialisten in onderaanneming.
>
> De vraag is dan niet alleen "welke opdracht loopt er?", maar ook "wie heeft welk data-raamcontract gewonnen, en bij wie kan ik aankloppen?"
>
> Die informatie staat in gunningsberichten, maar niemand zet ze voor je op een rij. Daar werk ik aan met een raamcontract-radar in TenderKompas.
>
> Werk jij via onderaanneming voor de overheid? Hoe kom je aan die contacten?

**Post 3: Bouwen in het openbaar (wat werkt, wat nog niet)**

> Stand van zaken TenderKompas, zonder opsmuk:
>
> ✔ Profielen, AI-classificatie op de tekst van aankondigingen, portaal en digest staan.
> ✔ De TED-import is gebouwd op de officiële API.
> ✘ Nog niet: Belgische nationale publicaties. Daarvoor wil ik eerst duidelijkheid over de gebruiksvoorwaarden.
> ✘ Nog geen klanten, dus ook geen testimonials.
>
> Wat ik wél ga doen: een steekproef van 90 dagen TED-publicaties om te zien hoeveel er echt relevant is voor data- en BI-teams. De resultaten deel ik hier, ook als ze tegenvallen.

*(Pas posten als de live TED-import werkt. Tot dan de tweede ✔-regel vervangen door: "De TED-import is gebouwd; de eerste live run volgt.")*

**Post 4: Kmo-vriendelijk aanbesteden (context)**

> In mei 2026 verscheen een Vlaamse omzendbrief over kmo-vriendelijk aanbesteden. Hij beveelt onder meer aan om opdrachten op te delen, bestekken duidelijk te houden en langere indieningstermijnen te voorzien (bron: VLAIO).
>
> Federaal heeft de regering doelen geformuleerd voor meer kmo-deelname aan overheidsopdrachten (bron: UNIZO). Het zijn doelen, geen resultaten.
>
> Als dat in de praktijk leidt tot kleinere percelen, wordt het voor gespecialiseerde data- en BI-bureaus interessanter om rechtstreeks mee te dingen. Dan moet je die percelen wel op tijd zien.
>
> Merken jullie al iets van die opdeling in recente bestekken?

*(Bronlinks in de eerste reactie: vlaio.be/nl/nieuws/kmo-vriendelijk-aanbesteden-omzendbrief-en-concrete-tips en unizo.be/betere-toegang-voor-kmos-tot-overheidsopdrachten.)*

**Post 5: Pilot-oproep (pas na v1)**

> Ik zoek een handvol Belgische data- en BI-bureaus (3 tot 30 mensen) die TenderKompas 30 dagen gratis willen testen op hun eigen profiel.
>
> Wat je krijgt: elke maandag de Europese (TED-)publicaties die bij je team passen, met een score en uitleg, plus een link naar de officiële bron.
> Wat ik vraag: na 30 dagen een eerlijk gesprek van 20 minuten. Wat was nuttig, wat was ruis?
>
> Geen kaart nodig, niets automatisch verlengd.
> Voor wie het niet is: wie nu al alle Belgische opdrachten onder de Europese drempels nodig heeft. Die zitten nog niet in v1.
>
> Interesse? Stuur me een bericht of gebruik de link in de eerste reactie.

---

### C4. Drie advertentievarianten (LinkedIn Sponsored Content)

**Variant A: Ruis (probleemgericht)**
- **Intro:** Een CPV-alert op IT levert vooral laptops en licenties op. TenderKompas leest de tekst van Europese aanbestedingen en toont enkel wat past bij data- en BI-teams, met score en bronlink.
- **Kop:** Minder ruis in overheidsopdrachten voor data & BI
- **Beschrijving:** Wekelijkse digest. €59/maand na 30 dagen gratis. v1: TED-publicaties.
- **CTA-knop:** Aanmelden (Sign Up)

**Variant B: Onderaanneming (raamcontract-radar)**
- **Intro:** Wie heeft welk data- en BI-raamcontract gewonnen? De raamcontract-radar van TenderKompas zet gegunde Europese raamcontracten en hun hoofdaannemers op een rij, voor bureaus die via onderaanneming werken.
- **Kop:** Zie wie de data-raamcontracten won
- **Beschrijving:** Team-pakket €119/maand. 30 dagen gratis pilot, zonder kaart.
- **CTA-knop:** Meer informatie (Learn More)

*(Variant B pas inzetten als de raamcontract-radar werkt. `[v1-werk]`)*

**Variant C: Tijd (zaakvoerder)**
- **Intro:** Geen tendermanager in je team? TenderKompas leest elke week de Europese publicaties voor je en stuurt op maandag wat bij jouw Power BI-, Fabric-, Databricks- of Azure-team past.
- **Kop:** Elke maandag de relevante overheidsopdrachten
- **Beschrijving:** Maandelijks opzegbaar, geen setup-kosten. Start met 30 dagen gratis.
- **CTA-knop:** Aanmelden (Sign Up)

Gemeenschappelijk: doel-URL = landingspagina met `utm_source=linkedin&utm_medium=ad&utm_content=A|B|C`. Beeld = schermafbeelding van het echte portaal (geen stockfoto, geen fictieve opdrachten).

---

### C5. Persoonlijke uitnodiging voor pilot-testers

**LinkedIn-DM (kort)**

> Hoi [voornaam], ik zag dat [bureau] veel met [Power BI / Databricks / Fabric] werkt, [persoonlijke zin: bv. "ook voor publieke klanten"].
>
> Ik ben zelf freelance data- en BI-engineer en bouwde TenderKompas: elke maandag de Europese overheidsopdrachten (TED) die passen bij een data/BI-team, met een score en een link naar de officiële publicatie. Belgische nationale publicaties zitten er nog niet in.
>
> Ik zoek een paar bureaus die het 30 dagen gratis willen testen op hun eigen profiel, zonder kaart, in ruil voor 20 minuten eerlijke feedback achteraf. Zou je dat zien zitten? Een demo van 15 minuten kan ook.
>
> Mohamed

**E-mailversie**

Onderwerp: 30 dagen gratis test: overheidsopdrachten voor jullie data-team

> Dag [voornaam],
>
> [Persoonlijke zin: hoe je hem/haar kent of waarom je dit bureau aanschrijft.]
>
> Ik ben freelance data- en BI-engineer en werk al een tijd voor de publieke sector. Wat me opvalt: data- en BI-opdrachten van de overheid zijn moeilijk te vinden. Ze zitten onder brede IT-CPV-codes, tussen hardware en licenties.
>
> Daarom bouwde ik TenderKompas:
> - elke maandag een digest met de Europese overheidsopdrachten (TED) die bij jullie profiel passen;
> - per publicatie een relevantiescore van 0 tot 100 met uitleg, en een link naar de officiële bron;
> - in het Team-pakket ook een overzicht van gegunde data- en BI-raamcontracten en wie ze won, handig voor onderaanneming.
>
> Eerlijk vooraf: v1 bevat enkel Europese publicaties. Opdrachten onder de Europese drempels, die België nationaal publiceert, volgen later. Ik kan dus niet beloven hoeveel relevante opdrachten er per maand voor jullie bij zitten. Dat is net wat de pilot moet uitwijzen.
>
> Mijn voorstel: 30 dagen gratis, zonder kaart, niets verlengt automatisch. Daarna een gesprek van 20 minuten: wat was nuttig, wat was ruis?
>
> Antwoord gerust gewoon op deze mail, of plan een demo van 15 minuten: [link].
>
> Met vriendelijke groet,
> Mohamed Bouzouf
> TenderKompas – Marhaba Data & AI Agent BV
> +32 484 94 77 77

---

### C6. Partnerberichten

**a) Aan de organisator van een Databricks- of Power BI/Fabric-user group**

Onderwerp: Voorstel talk: data- en BI-overheidsopdrachten in België (analyse op TED open data)

> Dag [naam],
>
> Ik ben Mohamed Bouzouf, freelance data- en BI-engineer (Databricks, Power BI, publieke sector) en lid/bezoeker van [user group].
>
> Ik wil graag een talk van 15–20 minuten voorstellen: **"Wat vraagt de overheid in data en BI? Een analyse van 90 dagen Europese aanbestedingen (TED open data)."** Ik toon welke technologieën en types opdrachten terugkomen, hoe raamcontracten verdeeld zijn en wat dat betekent voor wie in onderaanneming werkt. Alles op basis van publieke data, met de methode erbij (inclusief een Databricks-pipeline, als dat de groep interesseert).
>
> Transparant: ik bouw zelf een tool rond dit thema (TenderKompas). De talk gaat over de analyse, niet over het product. Ik vermeld het hooguit op de laatste slide, en alleen als jullie dat oké vinden.
>
> Past dit op een van de volgende meetups? Ik stuur graag eerst een outline.
>
> Groeten,
> Mohamed

*(Pas versturen als de 90-dagensteekproef gedraaid is. Zonder echte cijfers is er geen talk.)*

**b) Aan een kmo-federatie (Agoria / UNIZO)**

Onderwerp: Input voor kmo-toegang tot overheidsopdrachten: data- en BI-sector

> Geachte [naam],
>
> Ik volg met interesse jullie werk rond betere toegang van kmo's tot overheidsopdrachten, en de recente Vlaamse omzendbrief over kmo-vriendelijk aanbesteden.
>
> Ik ben freelance data- en BI-engineer en zaakvoerder van Marhaba Data & AI Agent BV. Ik heb Europese aanbestedingen (TED open data) in de data- en BI-sector geanalyseerd: welke opdrachten er zijn, hoe groot de percelen zijn en welke spelers de raamcontracten winnen. Die analyse deel ik graag kosteloos als input voor jullie werkgroep of ledencommunicatie.
>
> Daarnaast bouw ik TenderKompas, een wekelijkse selectie van overheidsopdrachten voor kleine data- en BI-teams. Als het jullie leden helpt, bespreek ik graag een ledenvoordeel (bv. een langere gratis pilot). Dat is uitdrukkelijk een tweede punt; de analyse staat los daarvan.
>
> Hebt u 20 minuten voor een kort gesprek in de komende weken?
>
> Met vriendelijke groet,
> Mohamed Bouzouf
> Marhaba Data & AI Agent BV – BTW BE1003552102
> +32 484 94 77 77

---

### C7. Onboarding- en opvolgmailreeks (pilot)

Verzending: handmatig of via nodemailer-sjablonen `[v1-werk: geautomatiseerde reeks/scheduler]`. Afzender: Mohamed (persoonlijk, niet "noreply").

**Mail 1: dag 0, welkom + profiel instellen**
Onderwerp: Welkom bij TenderKompas: stel je profiel in (5 min)

> Dag [voornaam],
>
> Welkom! Je pilot loopt 30 dagen, tot [datum]. Je hebt geen kaart opgegeven, dus er verlengt niets automatisch.
>
> Eén ding om nu te doen: **stel je zoekprofiel in** → [link naar portaal/profiel]
> - Kies je technologieën (bv. Power BI, Fabric, Databricks, Azure, datawarehouse).
> - Voeg trefwoorden toe die je zeker wil zien, en trefwoorden die je wil uitsluiten.
> - Kies je regio en het type werk.
>
> Je eerste digest komt op maandag [datum] `[v1-werk]`. Tot dan kan je al kijken in het portaal.
>
> Goed om te weten: v1 bevat Europese publicaties (TED). Belgische nationale publicaties onder de Europese drempels zitten er nog niet in. De score is een hulpmiddel, geen advies. Lees altijd de officiële publicatie via de bronlink.
>
> Vragen? Antwoord gewoon op deze mail.
> Mohamed

**Mail 2: dag 3, eerste indruk**
Onderwerp: Klopt je profiel? Een snelle check

> Dag [voornaam],
>
> [Variant A, profiel ingesteld:] Je profiel staat. Kijk in het portaal of de kansen met de hoogste score ook echt bij jullie passen. Zie je ruis, voeg dan een uitsluitwoord toe. Zie je iets niet dat je verwachtte, laat het me weten: dan kijk ik of de classificatie het mist.
>
> [Variant B, nog geen profiel:] Je profiel is nog niet ingesteld, dus de digest van maandag blijft leeg. Het kost 5 minuten: [link]. Liever samen? Plan 15 minuten: [link].
>
> Mohamed

**Mail 3: dag 10, na de eerste digest(s)**
Onderwerp: Wat vond je van je eerste digest?

> Dag [voornaam],
>
> Je hebt inmiddels [1/2] digest(s) ontvangen. Twee vragen, antwoorden mag in één zin:
> 1. Zat er minstens één publicatie bij die je zonder TenderKompas niet gezien had?
> 2. Welke publicatie had een te hoge of te lage score?
>
> [Bij Team:] Kijk ook eens in de raamcontract-radar `[v1-werk]`: daar zie je de gegunde data- en BI-raamcontracten en de hoofdaannemers.
>
> Mohamed

**Mail 4: dag 25, pilot bijna voorbij**
Onderwerp: Nog 5 dagen pilot: verder of stoppen?

> Dag [voornaam],
>
> Je pilot loopt af op [datum]. Daarna zijn er twee mogelijkheden:
>
> - **Verder:** Solo €59/maand (1 profiel, 2 gebruikers) of Team €119/maand (3 profielen, 10 gebruikers, raamcontract-radar, CSV-export), excl. btw. Maandelijks opzegbaar. Per jaar betaal je 10 maanden. → [link activeren] `[v1-werk: betaling]`
> - **Stoppen:** je hoeft niets te doen. Je account wordt na de pilot gepauzeerd.
>
> Hoe het ook uitvalt: ik plan graag 20 minuten om te horen wat nuttig was en wat ruis was → [link]. Juist dat gesprek helpt me het meest.
>
> Mohamed

**Mail 5a: dag 31, na conversie**
Onderwerp: Bedankt, je abonnement loopt

> Dag [voornaam],
>
> Bedankt voor je vertrouwen. Je [Solo/Team]-abonnement loopt vanaf vandaag. De digest blijft elke maandag komen.
>
> Opzeggen kan maandelijks via [instellingen/link] `[v1-werk]` of door op deze mail te antwoorden.
> Komen de Belgische nationale publicaties erbij, dan laat ik je dat als eerste weten.
>
> Mohamed

**Mail 5b: dag 31, geen conversie**
Onderwerp: Je pilot is afgelopen: mag ik één vraag stellen?

> Dag [voornaam],
>
> Je pilot is afgelopen en je account staat op pauze. Je wordt niets aangerekend.
>
> Eén vraag, zodat ik TenderKompas beter kan maken: **wat was de belangrijkste reden om niet verder te gaan?**
> (a) te weinig relevante opdrachten, (b) de Belgische publicaties ontbreken, (c) prijs, (d) we halen dit al elders, (e) iets anders: …
>
> Wil je een seintje als de Belgische publicaties erbij komen? Antwoord dan "ja" en ik mail je één keer. Verder niets.
>
> Mohamed

---

### C8. FAQ + antwoorden op de 8 meest waarschijnlijke bezwaren

**Algemene FAQ**

- **Welke bronnen gebruikt TenderKompas?** In v1 TED, de Europese publicatiedatabank (open data van het Publicatiebureau van de EU) `[v1-werk: live import]`. Belgische nationale publicaties (e-Procurement) volgen pas nadat de gebruiksvoorwaarden en toegang bevestigd zijn `[toekomstige versie]`.
- **Hoe wordt de score berekend?** Op basis van de tekst van de aankondiging (trefwoorden uit je profiel + AI-classificatie), niet alleen de CPV-code. Je ziet altijd de uitleg en de link naar de officiële publicatie `[v1-werk]`.
- **Is dit advies?** Nee. Het is een selectie- en signaleringstool. Je beoordeelt en beslist zelf, op basis van de officiële publicatie.
- **Kijkt er een mens naar elke kans?** Nee, in v1 niet. Dat houdt de prijs laag.
- **Wat gebeurt er na de pilot?** Niets automatisch. Je kiest zelf om te activeren. Zonder keuze wordt je account gepauzeerd.
- **Kan ik opzeggen?** Ja, maandelijks. Jaarbetaling (10 × de maandprijs) is optioneel.
- **Wie zit erachter?** Mohamed Bouzouf, freelance data- en BI-engineer, via Marhaba Data & AI Agent BV (BTW BE1003552102).
- **Welke gegevens bewaren jullie?** Je accountgegevens en zoekprofiel. Publicaties zijn openbare data. Details in de privacyverklaring `[v1-werk]`.

**Bezwaren**

1. **"e-Procurement is gratis."**
   Klopt, en voor volledige Belgische dekking blijft het de officiële bron. Het profiel daar filtert op CPV-code en regio. Data- en BI-werk zit onder brede IT-codes, met veel ruis als gevolg. TenderKompas leest de tekst van de aankondiging en scoort op data/BI-relevantie. Als je e-Procurement-alert vandaag al genoeg oplevert zonder ruis, heb je TenderKompas niet nodig.

2. **"TenderWolf bestaat al."**
   Ja, en het is een goede, bredere tool: meer landen, meer bronnen, een gratis instap. TenderKompas is smaller: enkel data, BI en cloud, gebouwd door iemand uit die praktijk, met een raamcontract-radar gericht op onderaanneming `[v1-werk]` en een iets lagere prijs. Zoek je breed over sectoren en landen, kies dan TenderWolf.

3. **"Wij winnen nooit rechtstreeks een overheidsopdracht."**
   Dat geldt voor veel kleine bureaus: referenties, omzetdrempels en grote percelen maken het moeilijk. Precies daarom is er de raamcontract-radar (Team): die toont wie welk data/BI-raamcontract gewonnen heeft, zodat je weet bij welke hoofdaannemer onderaanneming mogelijk is `[v1-werk]`. Garanties op werk geven we niet.

4. **"Hoeveel opdrachten zijn er dan per maand?"**
   Eerlijk: dat weten we nog niet. De steekproef over 90 dagen is nog niet gedraaid, en we noemen geen cijfer dat we niet gemeten hebben. Het aantal hangt ook af van je profiel. Daarom de pilot van 30 dagen op je eigen profiel: je ziet zelf wat er binnenkomt, en blijkt het te weinig, dan stop je zonder kosten. *(Na de steekproef dit antwoord vervangen door de gemeten resultaten, inclusief spreiding.)*

5. **"Jullie hebben de Belgische opdrachten niet eens."**
   Klopt, in v1 niet. Opdrachten onder de Europese drempels publiceert België nationaal, en die volgen pas als de toegang en gebruiksvoorwaarden bevestigd zijn. Is dat voor jou essentieel, wacht dan of gebruik intussen e-Procurement. We melden het je graag wanneer het er is.

6. **"Kan ik een AI-score wel vertrouwen?"**
   Gebruik de score als sorteerhulp, niet als oordeel. Bij elke kans staat waarom ze zo scoort, en een link naar de officiële publicatie. Te hoog of te laag gescoord? Meld het: zo wordt de classificatie beter. Advies is het niet.

7. **"€59 of €119 per maand voor iets wat ik zelf kan zoeken?"**
   Zelf zoeken kan, en kost niets behalve tijd. Reken uit hoeveel tijd iemand in je team wekelijks besteedt aan e-Procurement en TED, en wat één gemiste relevante opdracht of onderaannemerscontact waard is. Komt dat niet boven de prijs uit, dan is TenderKompas niet voor jou. Daarom 30 dagen gratis en maandelijks opzegbaar.

8. **"Wij krijgen die info al via onze hoofdaannemer (bv. een grote integrator)."**
   Dan heb je misschien al wat je nodig hebt. TenderKompas helpt vooral als je minder afhankelijk wil zijn van één partner: zien welke opdrachten lopen voor die partner ze voorstelt, en welke andere hoofdaannemers data/BI-raamcontracten hebben `[v1-werk: raamcontract-radar]`.

---

### C9. Appstore-teksten

Niet relevant. TenderKompas is een web-SaaS (Next.js), er is geen mobiele app gepland. Appstore-vindbaarheid speelt geen rol in dit plan.

---

## D. Checklist vóór iets live gaat (samengevat)

1. Contract/nevenactiviteit nagekeken (Cronos/Digitaal Vlaanderen), geen gebruik van niet-publieke info.
2. Live TED-import geslaagd + 90-dagensteekproef gedraaid → beslisregel §0 toegepast.
3. Deploy, SMTP-provider, scheduler (maandagdigest), wachtwoordreset, betaling: werkend.
4. Elke `[v1-werk]`-claim in C1–C8 nagelopen: werkt het niet, dan schrappen of markeren.
5. Privacyverklaring en algemene voorwaarden op de site.
6. Trackingsheet + UTM-links klaar.
7. Pas dan: DM's (C5), posts (C3), en na de organische go de ads (C4).
