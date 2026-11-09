# Kleine Qamar – marketing- & verkoopplan en commerciële materialen

Versie: concept 23-10-2026. Bindende basis: `/home/claude/work/BESLISSING.md` (#2 Kleine Qamar) + aanvulling coördinator (testbudgetten 90 dagen). Feiten over wat bestaat: `/home/claude/work/audit/A1-noor-muslim.md` (§ Content-inventaris, § Religieuze inhoud, § 2. kleine-qamar). Markt: `/home/claude/work/markt/M1-kids.md`.

**Niets in dit document is verstuurd of gepubliceerd. Alles is concept.**

### Leeswijzer: markeringen (verplicht respecteren)

| Markering | Betekenis | Regel |
|---|---|---|
| `[v1-werk]` | Hoort bij de afgebakende v1, maar bestaat vandaag niet (of werkt niet). | Tekst met deze markering pas publiceren als het gebouwd én getest is. Daarna markering weghalen. |
| `[toekomstige versie]` | Niet in v1. | Niet publiek beloven; hooguit "staat op onze wensenlijst". |
| `[pas gebruiken na review door … ]` | Claim over religieuze controle. | Pas gebruiken als élk gepubliceerd verhaal is nagelezen door een met naam genoemde imam/islamleerkracht, met datum. Vul naam + rol in. |
| `[beslissing Mohamed]` | Keuze die nog niet is gemaakt. | Invullen vóór gebruik. |
| `[invullen]` | Praktisch gegeven (link, domein, naam). | Invullen vóór gebruik. |

### Wat bestaat vandaag écht (audit 23-10-2026)

- Prototype = één gebundeld HTML-bestand (`kleine-qamar\app\index.html`) + wachtlijstpagina met Brevo-formulier (`kleine-qamar\wachtlijst\index.html`). Broncode niet gevonden. Rijpheid 2.
- **7 korte verhalen** met volledige tekst NL + FR (titels ook Arabisch): gedeelde dadels, wachten op iftar, glimlach, vijf gebeden, sorry, soep voor de buurvrouw, Eid. 2 gratis, 5 "Plus". **Alle 7 `reviewed:false`.**
- **6 SVG-kleurplaten**, inkleurbaar in de app: lantaarn, moskee (gratis); hilal, dadelpalm, Eid-cadeau, Koranstandaard (Plus). Allemaal voorwerpen/gebouwen.
- **2 spelletjes**: Memory, "Vind de Arabische letter". Daarnaast een gebedenquiz, sterren-systeem, ouderinfo, taalkeuze NL/FR/AR.
- **Voorlezen** via browser-`speechSynthesis` (computerstem van het toestel). Geen stemopnames.
- **Ontbreekt**: backend, betaling, app-verpakking (App Store/Play), ouderlijke poort, offline werking (de tekst "werkt zonder internet" klopt vandaag niet: geen service worker/manifest), privacy/voorwaarden, religieuze review.
- **Te verwijderen uit het prototype vóór je het aan iemand toont**: de zin *"Elk verhaal wordt vóór publicatie nagelezen door een imam."* (misleidend zolang niets is nagelezen) en de offline-belofte.

### Voorwaarden vóór enige publieke marketing (Fase 0)

1. Misleidende imam-claim en offline-claim uit prototype en wachtlijstpagina halen.
2. Reviewer vastleggen: een met naam genoemde imam/islamleerkracht die elk verhaal en elke kleurplaat naleest (let op: kleurplaat "Koranstandaard" expliciet laten beoordelen). `[beslissing Mohamed: wie, vergoeding]`
3. Naam "Kleine Qamar" = werknaam → BOIP/EUIPO-check vóór logo, domein en Instagram-handle definitief worden.
4. Verkopende entiteit kiezen: Marhaba Data & AI Agent BV of Marhaba Cooperation BV `[beslissing Mohamed]`; D-U-N-S-nummer + organisatiewebsite op eigen domein (Apple-vereiste).
5. Privacyverklaring voor website/wachtlijst (Brevo = verwerker; alleen gegevens van de ouder). Privacy- en voorwaardenpagina voor de app `[v1-werk]`.

---

# A. Verkoopbaar aanbod

## A1. Doelgroep

- **Koper**: Nederlandstalige moslimouders in Vlaanderen en Brussel met kinderen van 4–8 jaar. Frans = tweede taal in dezelfde app (Franstalige of tweetalige Brusselse gezinnen). Nederlandse markt later.
- **Gebruiker**: het kind (4–8). In de App Store-Kids-categorie kiezen we leeftijdsband **6–8**; in de communicatie spreken we over "4 tot 8 jaar" (voorlezen maakt het bruikbaar voor jongere kinderen naast een ouder).
- **Kernsituatie**: ouder wil korte, rustige schermtijd met Islamitische waarden in de eigen taal, als alternatief voor YouTube; vaak 's avonds of in het weekend, vaker rond Ramadan en Eid.

## A2. Belofte (letterlijk uit BESLISSING.md)

> **"Korte Islamitische verhalen en kleurplaten in het Nederlands en Frans, met voorleesfunctie – zonder reclame, zonder YouTube-ruis."**

FR: *« De courtes histoires islamiques et des coloriages en néerlandais et en français, avec lecture à voix haute – sans publicité, sans le bruit de YouTube. »*

## A3. Afgebakende v1 – wat wel, wat niet

| Onderdeel | v1 bij lancering | Vandaag |
|---|---|---|
| Verhalen NL + FR | 20 | 7 bestaan (13 te schrijven = `[v1-werk]`) |
| Kleurplaten (inkleuren in de app) | 15 | 6 bestaan (9 te maken = `[v1-werk]`) |
| Voorlezen | Ingebouwde tekst-naar-spraak van het toestel | Werkt in prototype via browser; in app-versie `[v1-werk]` |
| Spelletjes | 2: Memory, Arabische letters | Bestaan in prototype |
| Offline werken | Ja | Werkt NIET in prototype → `[v1-werk]` |
| Ouderlijke poort voor aankopen en links | Ja | Bestaat niet → `[v1-werk]` |
| Geen reclame, geen third-party analytics | Ja | Prototype bevat geen reclame; app-build moet dit garanderen |
| Geen account voor het kind | Ja | Klopt (voortgang lokaal) |
| Abonnement via App Store / Google Play | Ja | Bestaat niet → `[v1-werk]` |
| Religieuze review per verhaal | Voorwaarde vóór publicatie | 0 van 7 nagelezen |
| Nieuwe content | 4 verhalen per kwartaal | – |
| Ramadan-pakket | Seizoensuitbreiding | `[v1-werk]` (inhoud nog te maken) |

**Niet in v1** (niet beloven): echte stemopnames `[toekomstige versie]`, video/animatie, Koran-/tajwidles, Turkse of Arabische vertaling van de verhalen, ouderdashboard met statistieken, gewoontetracker, accounts/profielen per kind, chat of sociale functies, printbare PDF's (eventueel later).

**Harde inhoudsregel**: profeten worden niet afgebeeld – niet in de app, niet in marketing, niet in advertenties.

## A4. Gratis vs. Qamar Plus (prijzen exact uit BESLISSING.md, incl. btw)

| | **Gratis** | **Qamar Plus** |
|---|---|---|
| Verhalen | 2 | Volledige bibliotheek (20 bij lancering) + 4 nieuwe per kwartaal |
| Kleurplaten | 2 | Alle (15 bij lancering) |
| Spelletjes | 1 | Beide |
| Voorlezen (toestelstem) | Ja | Ja |
| Seizoenspakket (Ramadan) | – | Ja `[v1-werk]` |
| Reclame | Nooit | Nooit |
| Prijs | €0 | **€3,49 per maand** of **€24,99 per jaar** |
| Gezinsdeling | – | Aan (Apple Gezinsdeling; Google Play voor zover het platform dit voor abonnementen ondersteunt – `[te verifiëren bij store-setup]`) |

- Jaarabonnement = hoofdproduct. €24,99/jaar ≈ €2,08 per maand, ongeveer 40% minder dan 12 × €3,49 (€41,88).
- **Geen automatische proefperiode-truc.** De gratis versie ís de kennismaking.
- **Opzeggen** via de store-instellingen, overal in heldere taal uitgelegd:
  - iPhone/iPad: Instellingen → [je naam] → Abonnementen → Kleine Qamar → Annuleer abonnement.
  - Android: Play Store → profielfoto → Betalingen en abonnementen → Abonnementen → Kleine Qamar → Opzeggen.
- Aankoop gebeurt op naam/account van de ouder, achter de ouderlijke poort `[v1-werk]`.

Netto-opbrengst per abonnee (ter info voor beslisregels; berekening, geen benchmark): €24,99 / 1,21 btw = €20,65 × 0,85 (na 15% storecommissie, Small Business Program) ≈ **€17,55 per jaarabonnee per jaar**. Maand: €3,49 / 1,21 × 0,85 ≈ **€2,45 per maand**.

## A5. Waarom abonnement – en de eenmalige variant als test

**Waarom abonnement**
1. Het product groeit: 4 nieuwe verhalen per kwartaal + seizoenspakketten. Doorlopend werk (schrijven, illustreren, laten nalezen) vraagt doorlopende inkomsten.
2. Jaarabonnement als standaard beperkt maandelijkse churn-administratie en past bij het ritme (Ramadan komt elk jaar terug).
3. Prijs ligt in de range van vergelijkbare apps (Histoires des Prophètes $3,99/m – $29,99/j; Miraj $3,49–8,90/m; Muslim Kids TV $9,99/m – bron M1, US-storefront, EUR-prijzen niet opgehaald).

**Risico**: abonnementsmoeheid en slechte reputatie van trials/opzeggen in deze niche (M1 §3: klachten bij Durioo+ en Muslim Kids TV). Antwoord: geen trial-truc, opzeggen uitleggen vóór de aankoop, herinnering in de mailreeks.

**Test-optie eenmalige aankoop** `[voorstel – niet in BESLISSING.md; pas activeren na evaluatie dag 90]`
- Wat: "Qamar Startbibliotheek" – eenmalige in-app aankoop (non-consumable) die de 20 lanceringsverhalen + 15 kleurplaten + 2 spellen permanent ontgrendelt. Nieuwe kwartaalverhalen en seizoenspakketten blijven Plus.
- Prijs: te bepalen `[beslissing Mohamed]`; logisch testbereik tussen 1× en 1,5× de jaarprijs, zodat het abonnement aantrekkelijk blijft.
- Wanneer testen: alleen als na 90 dagen (zie B4) de verhouding *installaties → betalend* tegenvalt én ouders in feedback expliciet "geen abonnement" noemen. Eén variabele tegelijk wijzigen.
- Meten: aandeel eenmalig vs. abonnement in App Store Connect / Play Console (Sales and Trends / Financiële rapporten).

## A6. Eerlijke positionering

| Alternatief | Wat het goed doet | Waar Kleine Qamar anders is | Eerlijk: wanneer kies je beter het alternatief |
|---|---|---|---|
| **Miraj** (EN, verhalen + games, Kids-categorie 6–8) | Grote bibliotheek, verzorgd, veel ratings | Nederlands en Frans; korter en rustiger; kleurplaten | Je kind is vlot in het Engels en wil veel content |
| **Muslim Kids TV** (EN, video/animatie, 0–5) | Video, liedjes, veel materiaal | Geen video, maar lezen/voorlezen en kleuren in NL/FR; lagere prijs | Je wil animatie en liedjes, Engels is geen probleem |
| **BDouin / Awlad** (FR, gratis/donatie; gebed & wudu, Arabisch) | Bekend Frans merk, sterk in gebed leren, gratis | Wij doen verhalen en kleurplaten, geen gebedsles; ook Nederlands | Je wil dat je kind het gebed/wudu stap voor stap leert in het Frans → Awlad (gratis) |
| **YouTube (Omar & Hana e.a.)** | Gratis, veel, kinderen kennen het | Geen reclame, geen autoplay naar volgende video, geen aanbevelingen van vreemden, NL/FR | Je hebt geen probleem met YouTube-omgeving en wil gratis video |
| **Moskeeles / weekendschool** | Een echte leerkracht, gemeenschap, Koran en Arabisch | Aanvulling thuis, niet vervanging. Korte verhalen om thuis over te praten | Altijd: de moskeeles blijft de basis. Wij vervangen geen leerkracht. |
| Gedrukte NL-boeken | Geen scherm, vertrouwd | Interactief (kleuren, spel, voorlezen), tweetalig | Je wil helemaal geen scherm |

Positioneringszin (intern): *Voor Nederlandstalige moslimgezinnen in Vlaanderen en Brussel die schermtijd rustig en vertrouwd willen houden, is Kleine Qamar de app met korte Islamitische verhalen en kleurplaten in hun eigen taal – zonder reclame en zonder YouTube-ruis. Een aanvulling op de moskeeles, geen vervanging.*

## A7. Voor wie Kleine Qamar NIET is

- Ouders die geen schermtijd willen voor hun kind (begrijpelijk – een boek is dan beter).
- Kinderen ouder dan ±9 jaar: de verhalen zijn kort en eenvoudig.
- Wie Koranles, tajwid of Arabisch als taal wil leren (het letterspel is een kennismaking, geen cursus).
- Wie video, animatie of liedjes zoekt.
- Wie de verhalen in het Turks of Arabisch zoekt (alleen NL en FR; Arabisch alleen in titels en het letterspel).
- Wie fiqh-uitleg of uitspraken over meningsverschillen tussen scholen verwacht.

---

# B. Kanalenplan

## B1. Vergelijking kanalen

| Kanaal | Past nu? | Reden |
|---|---|---|
| LinkedIn | **Past niet** | B2B-platform; ouders van 4–8-jarigen zoeken hier geen kinderapp. Hooguit één persoonlijke post in eigen netwerk bij lancering. |
| Google Search (ads) | **Past niet (nu)** | Zoekvolume voor NL-zoektermen als "islamitische verhalen kinderen" niet gekend (niet onderzocht); budget beter in kanaal met visuele uitleg. Herbekijken na dag 90. |
| SEO | **Past niet als kanaal (nu)** | Traag; één landingspagina met correcte titel/meta-beschrijving NL+FR is wel basis-hygiëne. |
| **Instagram (organisch + kleine creators)** | **Past – kanaal 1** | Ouders (vooral moeders 25–40) zitten er; visueel product (kleurplaten, schermbeelden); kleine NL-talige moslim-ouder-creators in BE/NL bestaan; Meta-ads op ouders als versterker. |
| TikTok | **Past niet (nu)** | Max 2 kanalen; extra productietijd; Reels kunnen later hergebruikt worden. |
| Meta Ads | **Past – als betaalde laag binnen kanaal 1** | Gericht op ouders 25–44 in Vlaanderen/Brussel. Niet op kinderen. Religie-targeting is niet beschikbaar/toegestaan → werken met taal, regio en de boodschap zelf. |
| Communities (WhatsApp-oudergroepen, Ramadan-markten) | **Ondersteunend** | Bereikbaar via partners en eigen netwerk; geen apart kanaal, wel doorstuurbare berichten (zie C5/C6). |
| **Partners: moskeeën / weekendscholen** | **Past – kanaal 2** | Vertrouwen is dé koopdrempel (M1 §7: "wie heeft dit gemaakt, welke stroming?"); een leerkracht of bestuur die het aanraadt weegt zwaarder dan een advertentie. Flyer met QR + leerkrachtcode. Traag, relationeel. |
| Kleine contentmakers | **Past – binnen kanaal 1** | Eerlijke ervaring van een ouder bouwt vertrouwen; klein budget of in natura (gratis jaarabonnement). |
| App Store-/Play-vindbaarheid (ASO) | **Ondersteunend** | Goede titel, ondertitel, trefwoorden en screenshots NL+FR (zie C9). Geen eigen budget. |

## B2. Budget en tijd eerste 90 dagen (bindend volgens coördinator)

| Post | Bedrag | Opmerking |
|---|---|---|
| Meta-ads naar ouders | **€400** in 2 tranches van €200 | Tranche 1 = wachtlijst-test (pre-lancering). Tranche 2 = alleen na "go" of "bijsturen" op tranche 1. |
| Kleine creators | **€300 cash** (of in natura: gratis jaarabonnementen) | Bv. 2–3 samenwerkingen; vast bedrag per creator `[beslissing Mohamed]`, in natura heeft voorkeur zolang dat volstaat. |
| Moskee-/weekendschoolpartners | **Drukwerk flyers max €100** | A5-flyer met QR, NL/FR. |
| **Totaal cash** | **max €800** | |
| Eigen tijd marketing | **12 u/maand** basis (≈ 36 u over 90 dagen) | Verdeling hieronder. |

Indicatieve tijdsverdeling per maand (12 u): Instagram content maken + posten 5 u · creators zoeken/contact/opvolging 2 u · moskee-/schoolcontacten 3 u · Meta-ads opzetten + wekelijkse check 1 u · Brevo-mails + metingen bijhouden 1 u.

## B3. Fasering

| Fase | Wanneer | Doel | Kanaalactiviteit |
|---|---|---|---|
| 0 – Voorwaarden | Vóór enige publieke post | Zie "Voorwaarden" bovenaan | Geen |
| 1 – Pre-lancering (wachtlijst) | Week 1–6 van de 90 dagen | Interesse meten vóór de bouw van v1 volledig af is | Instagram organisch, 1–2 creators, eerste moskeegesprekken, Meta tranche 1 (€200) naar landingspagina met wachtlijst |
| 2 – Testgezinnen | Zodra een app-build bestaat `[v1-werk]` (TestFlight / Play intern testen) | 10–15 gezinnen uit wachtlijst en netwerk testen 2 weken | Uitnodiging C5 |
| 3 – Lancering | Pas als review, store-goedkeuring en betaling rond zijn | Eerste betalende gezinnen | Lanceringsmail, flyers bij partners, Meta tranche 2 (€200) naar landingspagina → store |

Ramadan 2027 (begin rond begin februari 2027, afhankelijk van maanwaarneming) is een logisch moment, maar **lancering niet forceren** zonder review en geteste betaling. Geen aftellers of "laatste kans"-boodschappen.

## B4. Kanaal 1 – Instagram (organisch + kleine creators + Meta-ads naar ouders)

**Waarom het past**: visueel product; ouders van jonge kinderen zijn er actief; Mohamed kan zelf in NL/FR posten; creators geven vertrouwen; Meta-ads laten toe om met klein budget de belofte te testen bij ouders in Vlaanderen/Brussel.

**Benodigde materialen**
- Instagram-account `@[invullen na naamcheck]`, bio NL/FR, link naar landingspagina met UTM.
- 5 startposts (C3), 3 advertentievarianten (C4), demovideo 30–45 s (C2), schermopnames uit het echte prototype/de app (zonder imam-claim).
- Creatorbrief + bericht (C6).
- Landingspagina met Brevo-wachtlijst (C1) en mailreeks (C7).

**Organische aanpak**
- 2 posts per week (1 carrousel/beeld + 1 Reel met schermopname). Thema's: wat zit erin, achter de schermen (een verhaal schrijven, laten nalezen – zodra dat gebeurt), privacy/geen reclame, kleurplaat, vragen aan ouders ("welk verhaal wil je kind?").
- Reageren op elke reactie/DM binnen 48 u (deel van de 12 u).
- Geen kinderen van anderen in beeld; geen gezichten van kinderen nodig – handen, tablet, kleurplaat volstaan.

**Kleine creators** (€300 cash of in natura)
- Profiel: Nederlandstalige moslimouder in BE (of NL), kinderen 4–8, publiek dat overwegend uit ouders bestaat, eigen stijl, geen ophef rond stroming/polemiek. Volgersaantal is secundair; past het publiek?
- Afspraak: creator test de app (of het prototype in fase 1) met eigen gezin, maakt 1 Reel of 3 stories met **eigen, eerlijke mening**. Wij schrijven geen tekst voor, wel feitencheck (prijs, functies). Verplicht label "betaald partnerschap"/"samenwerking" (ook bij vergoeding in natura).
- Eigen link per creator: `?utm_source=instagram&utm_medium=creator&utm_campaign=[naam]` + eigen code in wachtlijstformulier.

**Betaalde aanpak – Meta-ads (€400, 2 × €200)**
- **Doelgroep = ouders, niet kinderen**: leeftijd 25–44 (eventueel 25–49), locatie Vlaanderen + Brussel (+ Franstalige advertentieset Brussel), taal NL resp. FR. Geen religie-targeting (niet beschikbaar). Eventuele ouder-interesses alleen als Meta die aanbiedt; anders breed laten en de creatie het werk laten doen.
- **Meta-beleid persoonlijke kenmerken**: advertentietekst mag niet suggereren dat we de religie van de kijker kennen. Dus níet "Ben jij een moslimmama?" of "Als moslimouder wil jij…". Wél: "Islamitische verhalen voor kinderen, in het Nederlands."
- Doel: verkeer/leads naar de **landingspagina** (niet naar de app): een Kids-app mag geen Meta-SDK bevatten, dus app-install-optimalisatie valt weg. **Geen Meta-pixel** op de landingspagina (consistent met de privacybelofte); meting via UTM + Brevo.
- Tranche 1 (€200, pre-lancering): 3 varianten (C4) × NL, ±€10/dag gedurende ±20 dagen; na 7 dagen zwakste variant stoppen.
- Tranche 2 (€200, lancering): alleen winnende variant(en), CTA naar landingspagina met store-knoppen.

**Meetpunten**
- Landingspagina: UTM-parameters worden in een verborgen veld van het Brevo-formulier meegegeven (`UTM_SOURCE`, `UTM_CAMPAIGN`) → aanmeldingen per bron in Brevo `[v1-werk: verborgen velden toevoegen aan wachtlijstformulier]`.
- Meta Ads Manager: vertoningen, klikken, kosten per klik (platformcijfers).
- Brevo: aanmeldingen, bevestigingen (double opt-in), open-/klikratio van de reeks, antwoorden op mail 2.
- Na lancering: App Store Connect (App Analytics: weergaven productpagina, downloads, conversie per bron en per **campagnelink**; abonnementen in Sales and Trends) en Google Play Console (store-listing-bezoekers, acquisities, conversie, UTM-verwijzers, abonnementsdashboard). Let op: App Analytics-gebruiksgegevens komen alleen van gebruikers die delen met ontwikkelaars toestaan → deels onvolledig; downloads en verkopen zijn volledig.
- **In de app zelf: geen third-party analytics.** Geen Firebase, geen Meta-SDK, geen AdMob.

**Vooraf vastgelegde beslisregels (eigen beslisregel – geen benchmark; Mohamed past aan vóór de start, niet erna)**

Afleiding: netto ≈ €17,55 per jaarabonnee. Aanname (te toetsen, niet gemeten): 1 op 5 wachtlijst-aanmelders wordt later betalend. Dan mag één aanmelding maximaal ±€3,50 kosten om binnen één jaaropbrengst te blijven.

| Meetpunt | Go | Bijsturen | Stop |
|---|---|---|---|
| Meta tranche 1: kosten per bevestigde wachtlijst-aanmelding (Meta-uitgave / aanmeldingen met UTM meta) | ≤ €3,50 | €3,51 – €7 → andere beeldkeuze/tekst, tranche 2 alleen met winnende variant | > €7 → geen tranche 2; geld naar creators in natura/flyers |
| Instagram organisch + creators: bevestigde aanmeldingen met UTM instagram, na 6 weken | ≥ 75 | 25 – 74 → onderwerpen/creator bijsturen | < 25 → organisch op minimum (1 post/week) |
| Totale wachtlijst (alle bronnen) eind fase 1 | ≥ 150 bevestigd | 50 – 149 → lancering voorbereiden maar contentbudget beperken | < 50 → v1-bouw pauzeren en heroverwegen (bv. B2B-route weekendscholen, zie M1 eindoordeel) |
| Na 90 dagen live: betalende abonnees (Plus, alle stores) | ≥ 50 | 20 – 49 → test eenmalige variant (A5) en/of prijscommunicatie | < 20 → app live houden, geen nieuwe kwartaalcontent tot er betere signalen zijn |

## B5. Kanaal 2 – Moskeeën en weekendscholen als partners

**Waarom het past**: vertrouwen is de koopdrempel; een aanbeveling van een leerkracht of bestuur weegt zwaar; ouders worden er wekelijks samen bereikt; de app is aanvulling op de les, geen concurrent. Mohamed spreekt NL/FR, heeft netwerk en ervaring met lesgeven/community.

**Wat we vragen, wat we bieden**
- Vragen: flyers mogen liggen/uitgedeeld worden; eventueel vermelding in de WhatsApp-oudergroep (bericht C6, door de school zelf verstuurd); feedback van één leerkracht.
- Bieden: gratis Qamar Plus voor de leerkracht(en) (via promocodes van de stores `[v1-werk]`); een eigen **leerkrachtcode** per partner (= herkenning van de bron); inspraak in onderwerpen van nieuwe verhalen.
- Optioneel: een imam/islamleerkracht van een partner kan de **reviewer** worden (tegen vergoeding `[beslissing Mohamed]`). Dit lost de publicatievoorwaarde op – maar dan moet die rol transparant vermeld worden.
- Geen geldelijke doorverkoopvergoeding in v1 (eenvoud). Als een partner dat vraagt: `[beslissing Mohamed]`.

**Benodigde materialen**: partnerbericht NL/FR (C6), A5-flyer NL/FR met QR (≤ €100 drukwerk), 1-pagina-uitleg "wat zit erin en wie leest na" (pas na review), demo op eigen tablet.

**Organische aanpak**: 8–10 moskeeën/weekendscholen in Brussel en Vlaanderen aanschrijven of bezoeken in 90 dagen (eerst eigen netwerk), mikken op 3–5 gesprekken. Per gesprek ±1–2 u incl. verplaatsing.

**Betaalde aanpak**: alleen drukwerk (max €100). Geen betaalde plaatsing.

**Meetpunten**
- Per partner een eigen QR-link: `[domein]/?utm_source=moskee&utm_medium=flyer&utm_campaign=[partnercode]` → Brevo-veld.
- Leerkrachtcode in het wachtlijstformulier (veld "Code van je school/moskee, als je die hebt").
- Na lancering: aparte App Store-campagnelink (`ct=[partnercode]`) en Play-link met `utm_campaign=[partnercode]` op de flyer/landingspagina.
- Als promocodes worden gebruikt: aantal ingewisselde codes per partner in App Store Connect / Play Console. Let op: promo-/aanbiedingscodes voor abonnementen verlengen in de stores automatisch na de gratis periode → dit staat dan letterlijk op de flyer en in de uitleg ("daarna €3,49/maand tenzij je opzegt – zo zeg je op: …"). Anders geen codes gebruiken voor ouders, alleen voor leerkrachten.

**Beslisregels (eigen beslisregel)**

| Meetpunt (na 90 dagen) | Go | Bijsturen | Stop |
|---|---|---|---|
| Partners die flyers verdelen of in hun oudergroep posten | ≥ 3 | 1 – 2 → aanpak/bericht aanpassen, ander type partner (school vs. moskee) | 0 → kanaal pauzeren, alleen eigen netwerk |
| Bevestigde aanmeldingen/installaties met partner-UTM of -code | ≥ 30 | 10 – 29 | < 10 per actieve partner na 6 weken flyers → flyerformaat/plaats herzien |

---

# C. Materialen

## C1. Landingspagina (NL) – met wachtlijst-CTA vóór lancering

*Domein: `[invullen]`. Pagina-titel (SEO): "Kleine Qamar – Islamitische verhalen en kleurplaten voor kinderen (NL/FR)". Meta-beschrijving: "Korte Islamitische verhalen en kleurplaten in het Nederlands en Frans, met voorleesfunctie. Zonder reclame. Voor kinderen van 4 tot 8 jaar."*

---

**[HERO]**

### Kleine Qamar
## Islamitische verhalen voor je kind, in je eigen taal.

Korte Islamitische verhalen en kleurplaten in het Nederlands en Frans, met voorleesfunctie – zonder reclame, zonder YouTube-ruis.

Voor kinderen van 4 tot 8 jaar · iPhone, iPad en Android `[v1-werk: app-versie]`

**[Knop] Zet me op de wachtlijst**
<small>We mailen je één keer wanneer de app er is, plus een paar berichten over hoe we hem maken. Uitschrijven kan met één klik.</small>

*(Na lancering vervangen door:)* **[App Store-knop] [Google Play-knop]** · "Gratis te downloaden. Qamar Plus: €3,49/maand of €24,99/jaar."

---

**[PROBLEEM – herkenning]**

### Je zoekt iets rustigs. YouTube geeft je nog tien video's erbij.

Je wil dat je kind iets leert over de islam: delen, geduld, een glimlach, het gebed, Eid. Maar wat je vindt is vaak Engels of Arabisch, of het staat op YouTube tussen reclame en automatisch afspelende video's. Kleine Qamar is gemaakt om dat eenvoudiger te maken: korte verhalen in het Nederlands of Frans, die je samen leest of laat voorlezen.

---

**[WAT ZIT ERIN]**

### Wat zit er in Kleine Qamar?

- **Korte verhalen** over dingen uit het dagelijks leven van een kind: dadels delen, wachten op iftar, sorry zeggen, soep brengen naar de buurvrouw, het Eid-feest. Bij lancering 20 verhalen `[v1-werk: 7 bestaan]`, daarna 4 nieuwe per kwartaal.
- **Nederlands én Frans** – wissel met één tik. Handig in tweetalige gezinnen en in Brussel.
- **Voorlezen** – de app leest het verhaal voor met de stem van je toestel. (Het is een computerstem, geen ingesproken stem. Echte stemopnames staan op onze wensenlijst.)
- **Kleurplaten om in de app in te kleuren** – lantaarn, moskee, maansikkel, dadelpalm en meer. Bij lancering 15 `[v1-werk: 6 bestaan]`.
- **Twee spelletjes** – Memory en "Vind de Arabische letter".
- **Werkt ook zonder internet** `[v1-werk]` – ideaal in de auto of bij familie.

---

**[VEILIG EN RUSTIG]**

### Gemaakt voor kinderen. Ingesteld door ouders.

- **Geen reclame.** Nooit.
- **Geen tracking-tools van derden** in de app. We weten niet wie je kind is en willen dat ook niet weten.
- **Geen account voor je kind.** Geen naam, geen e-mail, geen foto.
- **Aankopen en links zitten achter een ouderslot** `[v1-werk]` – je kind kan niet per ongeluk iets kopen of de app verlaten.
- **Geen autoplay, geen eindeloos scrollen.** Een verhaal is af als het af is.

---

**[INHOUD EN VERTROUWEN]**

### Wie maakt de verhalen?

Kleine Qamar wordt gemaakt door Mohamed Bouzouf uit Zaventem `[beslissing Mohamed: persoonlijke info tonen of niet; eigen motivatie in eigen woorden aanvullen]`, omdat er nauwelijks Islamitische verhalen voor kinderen in het Nederlands bestaan.

`[pas gebruiken na review door [naam imam/islamleerkracht], [rol, moskee/school] – en alleen als élk gepubliceerd verhaal is nagelezen]`
> Elk verhaal wordt vóór publicatie nagelezen door [naam], [rol]. We vertellen over wat moslims gemeenschappelijk hebben – vriendelijkheid, geduld, delen, het gebed, de feesten – en laten meningsverschillen tussen scholen over aan je moskee en je gezin.

**Profeten worden nooit afgebeeld.**

*(Zolang er geen review is, staat hier alleen:)* "We laten elk verhaal nalezen door een imam of islamleerkracht vóór we de app lanceren. Wie dat is, vermelden we hier met naam zodra het zover is."

---

**[PRIJS]**

### Wat kost het?

| Gratis | Qamar Plus |
|---|---|
| 2 verhalen, 2 kleurplaten, 1 spel | Alle verhalen en kleurplaten, beide spelletjes, elk kwartaal nieuwe verhalen, Ramadan-pakket `[v1-werk]` |
| €0 | **€3,49 per maand** of **€24,99 per jaar** |
| | Eén abonnement voor het hele gezin (gezinsdeling) |

- Geen proefperiode die stilletjes overgaat in betalen. Je probeert de gratis versie, en beslist dan zelf.
- Opzeggen doe je in de instellingen van je App Store of Google Play. We leggen precies uit hoe, vóór je koopt.

---

**[FAQ – kort]** *(volledige FAQ: zie C8)*

- **Vervangt dit de moskeeles?** Nee. Het is iets voor thuis, naast de les.
- **Welke leeftijd?** 4 tot 8 jaar. Jongere kinderen samen met een ouder.
- **Turks of Arabisch?** De verhalen zijn in het Nederlands en het Frans. Titels staan ook in het Arabisch en er is een spel met Arabische letters.

---

**[SLOT-CTA]**

### Wil je weten wanneer Kleine Qamar er is?

**[Formulier]** Voornaam ouder (optioneel) · E-mailadres · Taal: Nederlands / Français · Code van je school of moskee (optioneel)
☐ Ja, ik wil e-mails ontvangen over de lancering van Kleine Qamar. Ik kan me altijd uitschrijven. (Lees onze [privacyverklaring].)

**[Knop] Zet me op de wachtlijst**

<small>We vragen alleen gegevens van de ouder, nooit van je kind. Je gegevens staan bij onze e-maildienst Brevo en worden nergens anders voor gebruikt.</small>

---

**[FOOTER]**
Kleine Qamar is een product van `[Marhaba Data & AI Agent BV / Marhaba Cooperation BV – te bevestigen]`, `[adres]`, ondernemingsnummer `[invullen]`. · Privacyverklaring · Contact: `[e-mail]` · Nederlands | Français

---

### Franse hero + CTA

**Kleine Qamar**
## Des histoires islamiques pour votre enfant, dans votre langue.

De courtes histoires islamiques et des coloriages en néerlandais et en français, avec lecture à voix haute – sans publicité, sans le bruit de YouTube.

Pour les enfants de 4 à 8 ans · iPhone, iPad et Android `[v1-werk : version app]`

**[Bouton] M'inscrire sur la liste d'attente**
<small>Nous vous écrirons quand l'application sera disponible, avec quelques messages sur la façon dont nous la construisons. Désinscription en un clic.</small>

Formulaire : Prénom du parent (facultatif) · Adresse e-mail · Langue : Nederlands / Français · Code de votre école ou mosquée (facultatif)
☐ Oui, je souhaite recevoir des e-mails sur le lancement de Kleine Qamar. Je peux me désinscrire à tout moment. ([Politique de confidentialité])
<small>Nous ne demandons que les données du parent, jamais celles de l'enfant.</small>

*(Après le lancement :)* **[App Store] [Google Play]** · « Téléchargement gratuit. Qamar Plus : 3,49 €/mois ou 24,99 €/an. »

---

## C2. Demovideoscript (40 seconden)

*Opname: schermopname van het echte prototype/de app (tablet, verticaal 9:16 voor Reels en staand 1080×1920; tweede versie liggend voor de landingspagina). Vooraf: imam-claim en offline-tekst verwijderd. Voice-over: Mohamed zelf, rustig. Muziek: geen of zachte geluiden zonder instrumenten `[beslissing Mohamed]`. Geen kinderen in beeld nodig; eventueel kinderhanden die kleuren (eigen kind, met eigen keuze). Geen afbeelding van profeten.*

| Tijd | Beeld | Voice-over (NL) | Status functie |
|---|---|---|---|
| 0:00–0:04 | Tablet op tafel, startscherm Kleine Qamar met maansikkel-logo. Tekst in beeld: "Islamitische verhalen. In het Nederlands." | "Op zoek naar Islamitische verhalen voor je kind… in het Nederlands?" | Bestaat |
| 0:04–0:10 | Tik op verhalenlijst; scroll langs titels ("Wachten op iftar", "Soep voor de buurvrouw", "Eid"). | "Kleine Qamar heeft korte verhalen over delen, geduld, sorry zeggen en het Eid-feest." | Bestaat (7 verhalen) |
| 0:10–0:16 | Verhaal openen, tik op voorleesknop; tekst licht op terwijl de toestelstem leest (geluid even hoorbaar). | "Lees samen – of laat de app voorlezen." | Bestaat (toestelstem) |
| 0:16–0:20 | Tik op taalknop NL → FR, zelfde verhaal in het Frans. | "En met één tik in het Frans." | Bestaat |
| 0:20–0:26 | Kleurplaat lantaarn: vinger kleurt vlakken in. | "Kleurplaten om in de app in te kleuren…" | Bestaat (6 kleurplaten) |
| 0:26–0:31 | Memory-spel, daarna "Vind de Arabische letter". Sterren verschijnen. | "…en twee spelletjes, met Arabische letters." | Bestaat |
| 0:31–0:36 | Tekstkaarten op effen achtergrond: "Geen reclame · Geen autoplay · Geen account voor je kind". | "Zonder reclame. Zonder YouTube-ruis." | Geen reclame/geen account: klopt. Ouderslot niet tonen tot `[v1-werk]` |
| 0:36–0:40 | Eindkaart: logo + "Zet je op de wachtlijst" + URL. (Na lancering: store-badges + "Gratis te proberen".) | "Kleine Qamar. Zet je nu op de wachtlijst." | – |

**Niet tonen tot gebouwd**: offline gebruik `[v1-werk]`, ouderslot `[v1-werk]`, betaalscherm/abonnement `[v1-werk]`, Ramadan-pakket `[v1-werk]`, ingesproken stemmen `[toekomstige versie]`. Geen tekst "nagelezen door een imam" `[pas gebruiken na review door … ]`.

## C3. Vijf Instagram-posts

**Post 1 – Introductie (carrousel, 4 slides)** – *ook in het Frans, zie onder*
- Beeldidee: slide 1 maansikkel-logo op effen nachtblauw met tekst "We maken iets in het Nederlands." · slide 2 schermbeeld verhalenlijst · slide 3 kleurplaat moskee half ingekleurd · slide 4 "Wachtlijst – link in bio".
- Caption NL:
> Toen ik Islamitische verhalen zocht voor kinderen in het Nederlands, vond ik vooral Engels, Arabisch of YouTube.
> Dus maken we het zelf: **Kleine Qamar**. Korte verhalen en kleurplaten in het Nederlands en Frans, met voorleesfunctie. Zonder reclame.
> We zijn nog aan het bouwen. Wil je het als eerste weten? Wachtlijst via de link in bio. 🌙
> #islamitischeverhalen #moslimkinderen #moslimgezin #kinderverhalen #vlaanderen #brussel

**Post 2 – Kleurplaat (beeld/Reel)**
- Beeldidee: time-lapse (8–10 s) van een vinger die de lantaarn-kleurplaat inkleurt op tablet; eindbeeld volledig ingekleurd.
- Caption NL:
> Een lantaarn voor de avonden van Ramadan. 🏮
> In Kleine Qamar kleurt je kind kleurplaten rechtstreeks in de app: lantaarn, moskee, maansikkel, dadelpalm…
> Welke kleurplaat moeten we nog maken? Laat het weten in de reacties.
> #kleurplaat #ramadanknutselen #islamitischeopvoeding #kinderapp

**Post 3 – Uit een verhaal (carrousel)**
- Beeldidee: 3 slides met een kort fragment uit "Soep voor de buurvrouw" in grote letters op zachte achtergrond (geen figuren nodig); slide 4: schermbeeld van het verhaal met voorleesknop.
- Caption NL:
> Een kort fragment uit "Soep voor de buurvrouw". `[fragment pas plaatsen na review van dit verhaal]`
> Kleine verhalen over grote dingen: zorgen voor je buren, delen, geduld.
> Je kan zelf voorlezen, of de app laten voorlezen met de stem van je toestel.
> Over welk thema wil jouw kind een verhaal?
> #kinderverhalen #islamvoorkinderen #voorlezen #moslimmama

**Post 4 – Waarom geen reclame (tekstcarrousel)**
- Beeldidee: 4 tekstslides, eenvoudig typografisch: "Geen reclame." / "Geen tracking-tools van derden." / "Geen account voor je kind." / "Geen autoplay."
- Caption NL:
> Wat er níet in Kleine Qamar zit, is even belangrijk als wat er wel in zit.
> ✗ geen reclame
> ✗ geen tracking-tools van derden in de app
> ✗ geen account, naam of foto van je kind
> ✗ geen video die automatisch de volgende start
> Een verhaal is af als het af is. Dan mag de tablet weer weg.
> #schermtijd #veiligonline #kinderapp #moslimgezin

**Post 5 – Oproep testgezinnen / wachtlijst (beeld)** – *ook in het Frans, zie onder*
- Beeldidee: foto van tablet naast een kopje thee en een kleurpotlood, schermbeeld startscherm; tekst in beeld "Testgezinnen gezocht".
- Caption NL:
> We zoeken 10 à 15 gezinnen in Vlaanderen en Brussel met een kind van 4 tot 8 jaar om Kleine Qamar 2 weken te testen. `[pas plaatsen als er een testbuild is – v1-werk]`
> Wat vragen we? Dat je het eerlijk gebruikt en ons 15 minuten feedback geeft.
> Wat krijg je? Een jaar Qamar Plus gratis zodra de app er is.
> Interesse? Stuur een DM of schrijf je in via de link in bio en vink "testgezin" aan.
> #testgezin #moslimgezin #kinderapp #vlaanderen #brussel

**Post 1 – FR**
> Quand j'ai cherché des histoires islamiques pour enfants en néerlandais et en français, j'ai surtout trouvé de l'anglais, de l'arabe ou YouTube.
> Alors on les crée nous-mêmes : **Kleine Qamar**. De courtes histoires et des coloriages en néerlandais et en français, avec lecture à voix haute. Sans publicité.
> L'application est en construction. Envie d'être prévenu(e) en premier ? Liste d'attente via le lien en bio. 🌙
> #histoiresislamiques #enfantsmusulmans #famillemusulmane #bruxelles

**Post 5 – FR**
> Nous cherchons 10 à 15 familles à Bruxelles et en Flandre, avec un enfant de 4 à 8 ans, pour tester Kleine Qamar pendant 2 semaines. `[à publier seulement quand une version test existe – v1-werk]`
> Ce que nous demandons : l'utiliser honnêtement et nous donner 15 minutes de retour.
> Ce que vous recevez : un an de Qamar Plus offert dès que l'application est disponible.
> Intéressé(e) ? Envoyez-nous un message ou inscrivez-vous via le lien en bio en cochant « famille test ».
> #famillemusulmane #applienfants #bruxelles

## C4. Drie Meta-advertentievarianten (doelgroep: ouders 25–44, Vlaanderen + Brussel)

*Regels: geen tekst die impliceert dat we de religie van de kijker kennen; geen kinderen als doelgroep; geen schaarste; pre-lancering → CTA "Inschrijven" naar landingspagina met UTM `utm_source=meta&utm_medium=paid&utm_campaign=v[A|B|C]`. Na lancering zelfde teksten met CTA "Meer informatie" naar landingspagina (store-knoppen daar).*

**Variant A – Taal**
- Primaire tekst: "Islamitische verhalen voor kinderen, eindelijk in het Nederlands. Kleine Qamar brengt korte verhalen en kleurplaten in het Nederlands en Frans, met voorleesfunctie. Zonder reclame. Schrijf je in op de wachtlijst en hoor als eerste wanneer de app er is."
- Kop: "Islamitische kinderverhalen in het Nederlands"
- Beschrijving: "Voor kinderen van 4 tot 8 jaar"
- CTA: Inschrijven
- Beeldidee: schermbeeld verhalenlijst op tablet, met NL/FR-taalknop zichtbaar; effen nachtblauwe achtergrond met maansikkel.

**Variant B – Geen YouTube-ruis**
- Primaire tekst: "Geen reclame. Geen autoplay. Geen eindeloos doorklikken. Kleine Qamar is een rustige app met korte Islamitische verhalen en kleurplaten voor kinderen van 4 tot 8, in het Nederlands en Frans. Binnenkort in de App Store en Google Play – zet je op de wachtlijst."
- Kop: "Rustige schermtijd, zonder reclame"
- Beschrijving: "Verhalen, kleurplaten en 2 spelletjes"
- CTA: Inschrijven
- Beeldidee: split-beeld – links een vaag/onscherp "drukke videofeed"-patroon (geen echte YouTube-schermafbeelding of logo), rechts het rustige startscherm van Kleine Qamar.

**Variant C – Voorlezen & kleuren**
- Primaire tekst: "Een verhaal over geduld voor het slapengaan, een lantaarn om in te kleuren. Kleine Qamar leest korte Islamitische verhalen voor in het Nederlands of Frans en heeft kleurplaten om in de app in te kleuren. Gratis te proberen bij lancering. Schrijf je in om het als eerste te weten."
- Kop: "Verhalen die de app voorleest"
- Beeldidee: Reel 10–15 s uit de demovideo (scènes 0:10–0:26): voorleesknop → taalwissel → kleuren.
- Beschrijving: "In het Nederlands en Frans"
- CTA: Inschrijven

*(FR-advertentieset Brussel: variant A in het Frans – Primaire tekst: « Des histoires islamiques pour enfants en français et en néerlandais. Kleine Qamar propose de courtes histoires et des coloriages, avec lecture à voix haute. Sans publicité. Inscrivez-vous sur la liste d'attente. » · Titre : « Histoires islamiques pour enfants » · Description : « Pour les 4 à 8 ans » · CTA : S'inscrire.)*

## C5. Uitnodiging testgezinnen

*Pas versturen als er een testbuild bestaat (TestFlight / Play intern testen) `[v1-werk]`. Alleen naar mensen uit eigen netwerk of die zich als testgezin aanmeldden.*

**WhatsApp**
> Salaam [naam]! 😊
> Ik ben bezig met een app voor kinderen: **Kleine Qamar**. Korte Islamitische verhalen en kleurplaten in het Nederlands en Frans, met voorleesfunctie en zonder reclame.
> Ik zoek een paar gezinnen met een kind van 4 tot 8 die hem 2 weken willen testen, voor de lancering.
> Wat ik vraag: gewoon gebruiken zoals je wil, en daarna 15 minuutjes eerlijke feedback (bellen of spraakbericht, wat jij makkelijk vindt).
> Wat je krijgt: een jaar Qamar Plus gratis als de app er is.
> Je kind heeft geen account nodig en ik verzamel niks over je kind.
> Zin? Dan stuur ik je de testlink (iPhone/iPad of Android – welke heb je?). Geen probleem als het niet past hoor! 🙏

**E-mail**
- Onderwerp: Wil jij Kleine Qamar 2 weken testen met je kind?
> Salaam [naam],
>
> Ik werk aan **Kleine Qamar**, een app met korte Islamitische verhalen en kleurplaten voor kinderen van 4 tot 8 jaar, in het Nederlands en Frans. De app leest voor met de stem van je toestel, heeft twee spelletjes (Memory en Arabische letters) en bevat geen reclame.
>
> Vóór de lancering zoek ik 10 à 15 gezinnen die de app twee weken willen testen.
>
> **Wat ik vraag**
> - De app installeren via een testlink (TestFlight voor iPhone/iPad, of een testlink voor Android).
> - Gebruiken zoals je zelf wil – geen opdrachten.
> - Na twee weken 15 minuten feedback: wat vond je kind leuk, wat niet, wat ontbreekt, wat klopt niet?
>
> **Wat je krijgt**
> - Een jaar Qamar Plus gratis zodra de app in de stores staat.
>
> **Privacy**
> Je kind heeft geen account nodig. De app stuurt geen gegevens over je kind naar ons of naar anderen. Je feedback geef je zelf, als ouder.
>
> Laat je me weten of je meedoet, en of je iPhone/iPad of Android gebruikt?
>
> Bedankt alvast,
> Mohamed
> Kleine Qamar – [e-mail] – [website]

## C6. Partnerberichten

### Aan een moskeebestuur / weekendschool (NL)

- Onderwerp (e-mail): Voorstel: Islamitische verhalen-app in het Nederlands voor de kinderen van jullie school
> Assalamu alaykum,
>
> Mijn naam is Mohamed Bouzouf. Ik ben vader en ik ontwikkel **Kleine Qamar**: een app met korte Islamitische verhalen en kleurplaten voor kinderen van 4 tot 8 jaar, in het Nederlands en het Frans. De verhalen gaan over delen, geduld, sorry zeggen, buren helpen, het gebed en de feesten. De app leest voor, bevat geen reclame en verzamelt geen gegevens over kinderen.
>
> Ik schrijf jullie omdat de app bedoeld is als **aanvulling thuis op wat de kinderen bij jullie leren** – niet als vervanging van de les.
>
> Mijn vraag:
> 1. Mag ik de app eens tonen aan het bestuur of een leerkracht (15–20 minuten, op mijn tablet)?
> 2. Als jullie het goed vinden: mogen er flyers liggen of mee naar huis, en/of mag ik een kort bericht aanleveren voor jullie oudergroep?
>
> Wat ik daartegenover zet:
> - Gratis Qamar Plus voor de leerkrachten.
> - Een eigen code voor jullie school, zodat jullie zien hoeveel ouders via jullie kwamen.
> - Inspraak in de onderwerpen van nieuwe verhalen.
>
> Ik zoek ook een imam of islamleerkracht die de verhalen vóór publicatie wil nalezen (tegen vergoeding). Als iemand bij jullie daarvoor openstaat, hoor ik het graag.
>
> Voor alle duidelijkheid: de app is nog niet gelanceerd en de verhalen zijn nog niet nagelezen; dat gebeurt vóór de lancering. Profeten worden in de app nooit afgebeeld.
>
> Wanneer zou een korte kennismaking passen?
>
> Met vriendelijke groet,
> Mohamed Bouzouf
> Kleine Qamar · [telefoon] · [e-mail] · [website]

*Bijlage-tekst voor de oudergroep (door de school zelf te versturen, pas na lancering):*
> Salaam beste ouders, we willen jullie een nieuwe app laten kennen: Kleine Qamar, met korte Islamitische verhalen en kleurplaten in het Nederlands en Frans voor kinderen van 4 tot 8. Geen reclame. Gratis versie met 2 verhalen; volledige versie €3,49/maand of €24,99/jaar. Meer info: [link met code]. (Wij ontvangen hier geen vergoeding voor.) `[laatste zin enkel als dat klopt]`

### À un comité de mosquée / une école du week-end (FR)

- Objet : Proposition : une application d'histoires islamiques en français et en néerlandais pour les enfants de votre école
> Assalamu alaykum,
>
> Je m'appelle Mohamed Bouzouf. Je suis papa et je développe **Kleine Qamar** : une application de courtes histoires islamiques et de coloriages pour les enfants de 4 à 8 ans, en français et en néerlandais. Les histoires parlent de partage, de patience, de pardon, d'aide aux voisins, de la prière et des fêtes. L'application lit les histoires à voix haute, ne contient aucune publicité et ne collecte aucune donnée sur les enfants.
>
> Elle est pensée comme un **complément à la maison de ce que les enfants apprennent chez vous** – pas comme un remplacement des cours.
>
> Ma demande :
> 1. Puis-je présenter l'application au comité ou à un enseignant (15–20 minutes, sur ma tablette) ?
> 2. Si vous êtes d'accord : pourrions-nous déposer des flyers, et/ou vous transmettre un court message pour votre groupe de parents ?
>
> En retour :
> - Qamar Plus offert aux enseignants.
> - Un code propre à votre école, pour voir combien de parents sont venus par vous.
> - Un avis sur les thèmes des prochaines histoires.
>
> Je cherche aussi un imam ou un enseignant de religion islamique qui accepterait de relire les histoires avant publication (rémunéré). Si quelqu'un chez vous est intéressé, je serais ravi d'en parler.
>
> Pour être transparent : l'application n'est pas encore lancée et les histoires n'ont pas encore été relues ; cela se fera avant le lancement. Les prophètes ne sont jamais représentés dans l'application.
>
> Quand pourrions-nous nous rencontrer brièvement ?
>
> Bien cordialement,
> Mohamed Bouzouf
> Kleine Qamar · [téléphone] · [e-mail] · [site web]

### Aan een kleine creator (Instagram-DM, NL)

> Salaam [naam]! Ik volg je al een tijdje en vind hoe je over [onderwerp uit hun content] praat met je kinderen echt fijn.
>
> Ik maak **Kleine Qamar**, een app met korte Islamitische verhalen en kleurplaten in het Nederlands en Frans voor kinderen van 4 tot 8. Hij leest voor, heeft twee spelletjes en geen reclame. Hij is nog in ontwikkeling.
>
> Zou je hem met je gezin willen uitproberen en, als hij je bevalt, er eerlijk over vertellen (1 Reel of een paar stories)?
> - Je zegt wat je echt vindt – ook wat beter kan. Ik schrijf geen tekst voor, ik check alleen of prijs en functies kloppen.
> - Vergoeding: [€… / een jaar Qamar Plus gratis voor jou + [x] codes voor je volgers] `[beslissing Mohamed – binnen €300 totaal]`.
> - We vermelden het duidelijk als samenwerking ("betaald partnerschap").
> - Je kind hoeft niet in beeld; handen en tablet zijn genoeg.
>
> Zin om erover te bellen? Geen probleem als het niet past 🙏
> Mohamed

## C7. Mailreeks via Brevo (5 mails)

*Lijst: wachtlijst (double opt-in). Taal per contact (NL/FR) via Brevo-attribuut; hieronder NL. Afzender: "Mohamed van Kleine Qamar". Brevo weet niet wie de app installeert (geen tracking in de app); mails 4–5 gaan naar de hele lijst na lancering en zijn zo geformuleerd.*

**Mail 1 – direct na bevestiging**
- Onderwerp: Je staat op de wachtlijst van Kleine Qamar 🌙
> Salaam [voornaam, anders "beste ouder"],
>
> Bedankt! Je staat op de wachtlijst van Kleine Qamar: korte Islamitische verhalen en kleurplaten voor kinderen van 4 tot 8 jaar, in het Nederlands en Frans, met voorleesfunctie en zonder reclame.
>
> Wat kan je verwachten?
> - Een paar korte mails over hoe we de app maken (niet meer dan één per twee weken).
> - Eén mail wanneer de app in de App Store en Google Play staat.
>
> Eén vraag: **hoe oud is je kind, en welke taal spreken jullie thuis het meest?** Antwoord gewoon op deze mail. Ik lees alles zelf.
>
> Mohamed
> <small>Je ontvangt deze mail omdat je je inschreef op [website]. Uitschrijven: [link].</small>

**Mail 2 – dag 7: achter de schermen + vraag**
- Onderwerp: Welk verhaal moet er nog bij?
> Salaam,
>
> Er staan vandaag 7 korte verhalen klaar, onder andere over dadels delen, wachten op iftar, sorry zeggen en soep brengen naar de buurvrouw. Bij de lancering worden het er 20 `[v1-werk]`.
>
> Elk verhaal is kort (een paar minuten), in het Nederlands en het Frans, en de app kan het voorlezen met de stem van je toestel.
>
> **Welk thema zou jij graag zien?** Bijvoorbeeld: een nieuw broertje of zusje, de eerste keer vasten, naar de moskee gaan, ruzie bijleggen… Antwoord op deze mail – de meest gevraagde onderwerpen komen bovenaan het lijstje.
>
> Mohamed

**Mail 3 – dag 21 (of zodra van toepassing): wie leest na + testgezinnen**
- Onderwerp: Wie leest de verhalen na?
> Salaam,
>
> Een vraag die ouders ons vaak stellen: wie controleert de inhoud?
>
> `[pas gebruiken na review door [naam], [rol]]` Elk verhaal wordt vóór publicatie nagelezen door [naam], [rol bij moskee/school]. We vertellen over wat moslims gemeenschappelijk hebben – vriendelijkheid, geduld, delen, het gebed, de feesten – en laten meningsverschillen tussen scholen aan je moskee en je gezin.
> *(Zolang er geen review is:)* We laten elk verhaal vóór de lancering nalezen door een imam of islamleerkracht. Wie dat is, vertellen we je met naam zodra het rond is. Pas daarna lanceren we.
>
> Profeten worden in Kleine Qamar nooit afgebeeld.
>
> Nog dit: we zoeken 10 à 15 testgezinnen `[alleen als testbuild bestaat – v1-werk]`. Je test 2 weken, geeft 15 minuten feedback en krijgt een jaar Qamar Plus gratis. Interesse? Antwoord met "testgezin".
>
> Mohamed

**Mail 4 – lanceringsdag**
- Onderwerp: Kleine Qamar staat in de App Store en Google Play
> Salaam,
>
> Het is zover: Kleine Qamar is te downloaden.
> [App Store-knop met campagnelink ct=brevo] [Google Play-knop met utm_source=brevo]
>
> **Gratis**: 2 verhalen, 2 kleurplaten en 1 spel – zonder dat je iets hoeft te kopen.
> **Qamar Plus**: alle verhalen en kleurplaten, beide spelletjes en elk kwartaal nieuwe verhalen. €3,49 per maand of €24,99 per jaar, voor het hele gezin.
>
> Geen proefperiode die vanzelf betalend wordt. Probeer de gratis versie en beslis dan zelf.
>
> Bedankt dat je zo lang gewacht hebt.
> Mohamed

**Mail 5 – 7 dagen na lancering: tips + opzeggen + feedback**
- Onderwerp: 3 tips voor Kleine Qamar (en hoe je opzegt, als je dat ooit wil)
> Salaam,
>
> Heb je Kleine Qamar al geïnstalleerd? Drie tips:
> 1. **Voorlezen**: tik op de luidspreker bovenaan een verhaal. Lees daarna samen nog eens – kinderen vinden het leuk om de zinnen te herkennen.
> 2. **Taal wisselen**: tik op NL/FR. Handig als oma Frans spreekt of de juf Nederlands.
> 3. **Ouderslot** `[v1-werk]`: aankopen en links zitten achter een kleine opdracht voor volwassenen. Zo kan je kind de app veilig alleen gebruiken.
>
> **Abonnement opzeggen** – altijd in een paar tikken:
> - iPhone/iPad: Instellingen → [je naam] → Abonnementen → Kleine Qamar → Annuleer abonnement.
> - Android: Play Store → je profielfoto → Betalingen en abonnementen → Abonnementen → Kleine Qamar → Opzeggen.
> Je houdt Plus tot het einde van de betaalde periode.
>
> En tot slot: **wat vindt je kind ervan?** Eén zin als antwoord op deze mail helpt ons enorm. Een beoordeling in de App Store of Google Play mag ook – alleen als je dat zelf wil.
>
> Mohamed

## C8. FAQ + 8 bezwaren

**Algemene FAQ**

- **Voor welke leeftijd?** 4 tot 8 jaar. In de App Store staat de app in de Kids-categorie, leeftijdsband 6–8. Jongere kinderen gebruiken hem best samen met een ouder.
- **Welke toestellen?** iPhone, iPad en Android-telefoons/tablets `[v1-werk]`.
- **Werkt het zonder internet?** Ja, na de eerste download `[v1-werk]`.
- **Hoe werkt het voorlezen?** De app gebruikt de stem van je toestel (tekst-naar-spraak). Het is een computerstem, geen ingesproken stem. Ingesproken verhalen staan op onze wensenlijst `[toekomstige versie]`.
- **Hoeveel verhalen?** 20 bij de lancering `[v1-werk]`, daarna 4 nieuwe per kwartaal voor Plus-gebruikers.
- **Kan ik het abonnement delen met mijn gezin?** Ja, via gezinsdeling van Apple; op Android voor zover Google Play dit toelaat `[te verifiëren]`.
- **Wie maakt Kleine Qamar?** Mohamed Bouzouf, via `[Marhaba Data & AI Agent BV / Marhaba Cooperation BV – te bevestigen]`.

**De 8 meest waarschijnlijke bezwaren**

1. **"Ik wil juist minder schermtijd."**
   Begrijpelijk, en we zijn het met je eens. Kleine Qamar is gemaakt om kort te zijn: een verhaal duurt een paar minuten en eindigt dan. Geen autoplay, geen eindeloos scrollen, geen "nog één video". Veel ouders gebruiken het als vast moment – bijvoorbeeld één verhaal voor het slapengaan – en praten er daarna samen over. Wil je helemaal geen scherm? Dan is een boek de betere keuze, en dat zeggen we eerlijk.

2. **"Wie keurt de inhoud?"**
   `[pas gebruiken na review door [naam], [rol]]` Elk verhaal en elke kleurplaat wordt vóór publicatie nagelezen door [naam], [rol]. Zijn naam staat op onze website.
   *(Tot dan:)* Vóór de lancering laten we elk verhaal nalezen door een imam of islamleerkracht, die we met naam vermelden. Zolang dat niet gebeurd is, lanceren we niet. Profeten worden nooit afgebeeld.

3. **"YouTube is gratis."**
   Klopt, en er staat ook mooie Islamitische content op. Het verschil: in Kleine Qamar is er geen reclame, geen automatisch volgende video, geen aanbevelingen van onbekende kanalen en alles is in het Nederlands of Frans. De gratis versie (2 verhalen, 2 kleurplaten, 1 spel) blijft gratis – je kan dus eerst zelf vergelijken.

4. **"Welke stroming volgen jullie?"**
   De verhalen gaan over wat moslims gemeenschappelijk hebben: vriendelijkheid, delen, geduld, sorry zeggen, het gebed, Ramadan en Eid. We gaan niet in op punten waarover scholen van mening verschillen; dat laten we aan je moskee en je gezin. `[beslissing Mohamed: eventueel aanvullen met de achtergrond van de reviewer]`

5. **"Wat met de privacy van mijn kind?"**
   Je kind heeft geen account nodig: geen naam, geen e-mail, geen foto. De app bevat geen reclame en geen tracking-tools van derden. Voortgang (zoals sterren) blijft op je eigen toestel. Aankopen gebeuren via jouw Apple- of Google-account, achter een ouderslot `[v1-werk]`. Op de wachtlijst vragen we alleen het e-mailadres van de ouder.

6. **"Hoe zeg ik op?"**
   Via de instellingen van je store, op elk moment:
   iPhone/iPad: Instellingen → [je naam] → Abonnementen → Kleine Qamar → Annuleer abonnement.
   Android: Play Store → profielfoto → Betalingen en abonnementen → Abonnementen → Kleine Qamar → Opzeggen.
   Je behoudt Plus tot het einde van de betaalde periode. Er is geen proefperiode die stilletjes betalend wordt.

7. **"€3,49 per maand is te duur."**
   Je kan Kleine Qamar gratis gebruiken (2 verhalen, 2 kleurplaten, 1 spel). Qamar Plus kost €3,49 per maand of €24,99 per jaar – dat is ongeveer €2,08 per maand – voor het hele gezin. Met dat geld maken we elk kwartaal nieuwe verhalen en laten we ze nalezen. Geen reclame betekent: de ouders die betalen, houden de app draaiende.

8. **"Is het ook in het Turks of Arabisch?"**
   Nee. De verhalen zijn in het Nederlands en het Frans. De titels staan ook in het Arabisch en er is een spel om Arabische letters te herkennen. Andere talen hebben we niet gepland; laat het ons weten als dit voor jou belangrijk is.

## C9. App Store- en Google Play-conceptteksten

*Tekenlimieten gecontroleerd (zie tabel onder). Geen namen van concurrenten in trefwoorden of beschrijving (store-regels). "Kleine Qamar" = werknaam tot BOIP/EUIPO-check.*

### Nederlands

- **App-naam (≤30)**: `Kleine Qamar: verhalen & kleur`
- **Ondertitel – App Store (≤30)**: `Islamitische kinderverhalen`
- **Promotietekst – App Store (≤170)**: `Korte Islamitische verhalen en kleurplaten in het Nederlands en Frans, met voorleesfunctie. Zonder reclame, zonder account voor je kind.`
- **Trefwoorden – App Store (≤100, komma's zonder spaties)**: `islam,moslim,kinderen,kleurplaten,voorlezen,ramadan,eid,arabisch,letters,frans,kinderboek,gebed`
- **Google Play korte beschrijving (≤80)**: `Islamitische verhalen en kleurplaten in NL en FR, met voorlezen. Geen reclame.`
- **Beschrijving (App Store + Google Play)**:

> Kleine Qamar brengt korte Islamitische verhalen en kleurplaten voor kinderen van 4 tot 8 jaar, in het Nederlands en het Frans – zonder reclame en zonder YouTube-ruis.
>
> VERHALEN
> Korte verhalen over het dagelijks leven van een kind: dadels delen, wachten op iftar, een glimlach, sorry zeggen, soep brengen naar de buurvrouw, het Eid-feest en meer. Bij lancering 20 verhalen, elk kwartaal komen er nieuwe bij voor Qamar Plus.
>
> VOORLEZEN
> Lees zelf voor of laat de app voorlezen met de stem van je toestel. Wissel met één tik tussen Nederlands en Frans.
>
> KLEURPLATEN
> Kleur in de app: lantaarn, moskee, maansikkel, dadelpalm, Eid-cadeau en meer.
>
> SPELLETJES
> Memory en "Vind de Arabische letter".
>
> VEILIG EN RUSTIG
> • Geen reclame
> • Geen tracking-tools van derden
> • Geen account, naam of foto van je kind nodig
> • Aankopen en links achter een ouderslot
> • Werkt ook zonder internet
> • Profeten worden nooit afgebeeld
>
> INHOUD
> `[pas gebruiken na review door [naam], [rol]]` Elk verhaal wordt vóór publicatie nagelezen door [naam], [rol]. We vertellen over wat moslims gemeenschappelijk hebben en laten meningsverschillen tussen scholen aan je moskee en je gezin.
>
> GRATIS EN QAMAR PLUS
> Gratis: 2 verhalen, 2 kleurplaten en 1 spel.
> Qamar Plus: alle verhalen en kleurplaten, beide spelletjes, nieuwe verhalen elk kwartaal en seizoenspakketten. €3,49 per maand of €24,99 per jaar, te delen met je gezin.
> Het abonnement wordt via je App Store- of Google Play-account betaald en verlengt automatisch tot je opzegt. Opzeggen kan op elk moment in de abonnementsinstellingen van je account, uiterlijk 24 uur vóór het einde van de lopende periode. Er is geen proefperiode.
>
> Kleine Qamar is een aanvulling op de moskeeles thuis, geen vervanging.
>
> Privacybeleid: [link] · Gebruiksvoorwaarden: [link] · Contact: [e-mail]

*(Alle functies in deze beschrijving moeten bij indiening gebouwd zijn: 20 verhalen, 15 kleurplaten, offline, ouderslot, abonnement = `[v1-werk]`.)*

### Français

- **Nom de l'app (≤30)**: `Kleine Qamar : histoires`
- **Sous-titre – App Store (≤30)**: `Histoires islamiques enfants`
- **Texte promotionnel – App Store (≤170)**: `De courtes histoires islamiques et des coloriages en français et en néerlandais, avec lecture à voix haute. Sans publicité, sans compte enfant.`
- **Mots-clés – App Store (≤100)**: `islam,musulman,enfants,coloriage,lecture,ramadan,aid,arabe,lettres,neerlandais,conte,priere`
- **Description courte – Google Play (≤80)**: `Histoires islamiques et coloriages en FR et NL, lecture à voix haute. Sans pub.`
- **Description**:

> Kleine Qamar propose de courtes histoires islamiques et des coloriages pour les enfants de 4 à 8 ans, en français et en néerlandais – sans publicité et sans le bruit de YouTube.
>
> HISTOIRES
> De courtes histoires sur la vie quotidienne d'un enfant : partager des dattes, attendre l'iftar, un sourire, demander pardon, apporter de la soupe à la voisine, la fête de l'Aïd, et plus encore. 20 histoires au lancement, de nouvelles chaque trimestre avec Qamar Plus.
>
> LECTURE À VOIX HAUTE
> Lisez vous-même ou laissez l'application lire avec la voix de votre appareil. Passez du français au néerlandais d'un seul geste.
>
> COLORIAGES
> À colorier dans l'application : lanterne, mosquée, croissant de lune, palmier dattier, cadeau de l'Aïd et plus.
>
> JEUX
> Memory et « Trouve la lettre arabe ».
>
> SÛR ET CALME
> • Aucune publicité
> • Aucun outil de suivi tiers
> • Aucun compte, nom ou photo de l'enfant
> • Achats et liens protégés par un contrôle parental
> • Fonctionne sans internet
> • Les prophètes ne sont jamais représentés
>
> CONTENU
> `[à utiliser seulement après relecture par [nom], [fonction]]` Chaque histoire est relue avant publication par [nom], [fonction]. Nous parlons de ce que les musulmans ont en commun et laissons les divergences entre écoles à votre mosquée et à votre famille.
>
> GRATUIT ET QAMAR PLUS
> Gratuit : 2 histoires, 2 coloriages et 1 jeu.
> Qamar Plus : toutes les histoires et tous les coloriages, les deux jeux, de nouvelles histoires chaque trimestre et des packs saisonniers. 3,49 € par mois ou 24,99 € par an, partageable en famille.
> L'abonnement est payé via votre compte App Store ou Google Play et se renouvelle automatiquement jusqu'à résiliation. Vous pouvez le résilier à tout moment dans les réglages d'abonnement de votre compte, au plus tard 24 heures avant la fin de la période en cours. Pas de période d'essai.
>
> Kleine Qamar complète les cours à la mosquée à la maison ; il ne les remplace pas.
>
> Politique de confidentialité : [lien] · Conditions d'utilisation : [lien] · Contact : [e-mail]

### Tekenlimietcontrole

| Veld | Limiet | NL | FR |
|---|---|---|---|
| App-naam | 30 | 30 | 24 |
| Ondertitel | 30 | 27 | 28 |
| Promotietekst | 170 | 136 | 143 |
| Trefwoorden | 100 | 95 | 91 |
| Google korte beschrijving | 80 | 78 | 79 |

### Screenshotbriefing (6 schermen, NL + FR bijschrift)

*Formaat: echte schermafbeeldingen van de app-build (iPhone 6,9" en iPad 13" voor App Store; telefoon + 7"/10"-tablet voor Play). Bijschrift bovenaan in grote letters, effen achtergrond (nachtblauw/zacht crème). Geen kinderen, geen profeten, geen nep-reviews of sterren-scores, geen "nr. 1"-claims. Geen claim "nagelezen" tenzij na review.*

| # | Wat tonen | Bijschrift NL | Légende FR | Status |
|---|---|---|---|---|
| 1 | Startscherm met verhalenlijst (titels zichtbaar) | Korte Islamitische verhalen voor kinderen | De courtes histoires islamiques pour enfants | Bestaat |
| 2 | Open verhaal met voorleesknop actief | De app leest voor | L'application lit à voix haute | Bestaat (toestelstem) |
| 3 | Zelfde verhaal na taalwissel NL ↔ FR (split of twee telefoons) | In het Nederlands én Frans | En français et en néerlandais | Bestaat |
| 4 | Kleurplaat lantaarn, half ingekleurd met kleurenpalet | Kleur in de app | Colorie dans l'application | Bestaat |
| 5 | Spel "Vind de Arabische letter" (en/of Memory) | Spelen met Arabische letters | Jouer avec les lettres arabes | Bestaat |
| 6 | Ouderhoek: ouderslot + "geen reclame / geen tracking / geen account" | Geen reclame. Ouderslot voor aankopen. | Sans publicité. Contrôle parental pour les achats. | Ouderslot `[v1-werk]` |

---

## Bijlage – openstaande beslissingen voor Mohamed

1. Naam reviewer (imam/islamleerkracht), rol en vergoeding → ontgrendelt alle `[pas gebruiken na review …]`-teksten.
2. Verkopende entiteit (Marhaba Data & AI Agent BV of Marhaba Cooperation BV), D-U-N-S, domein.
3. BOIP/EUIPO-check "Kleine Qamar" → Instagram-handle en domein vastleggen.
4. Creatorvergoeding binnen €300 (cash vs. in natura).
5. Persoonlijke info op landingspagina (vader, Zaventem) ja/nee.
6. Beslisregeldrempels in B4/B5 bevestigen of aanpassen **vóór** de start.
7. Eenmalige test-variant (A5): prijs pas bepalen bij evaluatie dag 90.
