# Eerste betalende klant — plan, demo, voorstel en berichten (geparkeerd)

> **Correctie (20-10-2026, tweede ronde):** zie [juridisch-kader.md](juridisch-kader.md) en [leadrevive-productcheck.md](leadrevive-productcheck.md). Wettelijk verplicht vóór het ontvangen van een klantbestand is een **verwerkersovereenkomst** (art. 28.3 AVG), niet een juristenreview; die review is een advies. Een steekproef kan "0 foute samenvoegingen" niet bewijzen. En een geselecteerd contact is nog geen contact dat benaderd mag worden. LeadRevive wordt commercieel geparkeerd: zie [investeringsbeslissing.md](investeringsbeslissing.md).


**Doel:** één vastgoedkantoor tekent fase 1 (intake-scan, €350), en daarna fase 2.
Alle berichten zijn **concepten**: er is niets verstuurd of gepubliceerd.

## 0. Vóór je iemand benadert

1. Getekende verwerkersovereenkomst vóór je een bestand ontvangt (wettelijk, art. 28.3 AVG). Juristenreview van die overeenkomst en van de vraag per categorie is aanbevolen (zie
   `commercial-offer.md` §8). Zonder die review mag je geen echt bestand ontvangen.
2. Merge de branches en zet de beveiligingsacties uit [beveiliging-acties.md](beveiliging-acties.md) in gang.
3. Demo klaar: `npm run demo:leadrevive` in immoradar → `demo/leadrevive/output/intake.html`.

Hosting is nog **niet** nodig voor fase 1: de intake-scan draait lokaal, zonder
database. Hosting is pas nodig bij fase 2 (checklist in immoradar
`docs/pilot/pilot-checklist.md`).

## 1. Demo-opbouw (25 minuten)

Toon het HTML-rapport van de demo (fictief kantoor "Immo Voorbeeld", 20 rijen).
Laat de live app pas zien als ze vragen hoe het er in het dagelijks gebruik uitziet.

| Min | Wat je toont | Wat je zegt | Wat je níet zegt |
|---:|---|---|---|
| 0–3 | — | "Je vertelde me dat [hun pijn]. Ik toon hoe dat er voor een fictief kantoor uitziet." | — |
| 3–8 | **Stap 1: de export zoals ze binnenkwam**: "JANSSENS" en "Janssens, Pieter", gsm in vier notaties, `03/04` dag-eerst, "Estimation" naast "schatting" | "Zo ziet een export er bijna altijd uit. Herken je dit?" (laat ze praten) | — |
| 8–12 | **Stap 2: opgeschoond**: 20 rijen → 18 contacten, 2 dubbels samengevoegd, invulgraad per veld | "Dubbels voeg ik nooit samen op naam alleen, alleen op gsm, e-mail of naam plus exact adres. Liever een dubbel te veel dan twee mensen tot één maken." | Geen percentages over "hoe goed" hun bestand is: dat weet je pas na de scan |
| 12–20 | **Stap 3: de lijst**: open 3 kaarten (schattingsaanvraag, verloren mandaat, eerdere koper). Reden, openingszin, "Wat we níet weten" | "Het getal rechts is de volgorde, geen kans op verkoop. Of iemand wil verkopen, weet niemand vóór het gesprek. Wat we wel weten: er is een concrete, eerlijke reden om te bellen." | Nooit "deze mensen gaan verkopen" of "70 % kans" |
| 20–22 | **"Niet op de lijst, en waarom"** | "Recent nog gesproken, huurder, buiten het gebied: die laten we met rust." | — |
| 22–25 | **Aanbod**: fase 1 en het beslismoment | "Ik beloof geen aantal tot ik je bestand gezien heb. Fase 1 vertelt je dat, en het opgeschoonde bestand mag je houden." Vraag: *"Wat zou je tegenhouden om fase 1 te starten?"* | — |

**Als ze naar "particuliere verkopers op Immoweb" vragen:** "Daar werk ik aan,
maar alleen met een bron die het juridisch toelaat. Dat zit niet in deze pilot."

**Als ze zeggen "dat kan ons CRM ook":** "Mag ik zien hoe je dat vandaag doet?"
Kan het CRM het echt, en gebruiken ze het, dan is dit geen klant. Noteer dat
eerlijk (het is een stopsignaal, zie §5).

## 2. Definitief pilotvoorstel (concept om te versturen na een demo)

> **Voorstel LeadRevive-pilot — [naam kantoor]**
> [datum] · geldig 30 dagen
>
> **Doel**
> Nagaan of jullie eigen klantenbestand concrete, eerlijke redenen oplevert om
> mensen te bellen, en of dat in 60 dagen tot schattingsafspraken leidt.
>
> **Fase 1 — Intake-scan · €350 excl. btw · 5 werkdagen**
> - Jullie bezorgen een export uit [CRM] (CSV of Excel), na ondertekening van de verwerkersovereenkomst.
> - Jullie krijgen: een datakwaliteitsrapport, het aantal bruikbare kansen per
>   categorie en een opgeschoonde, ontdubbelde export die jullie mogen houden.
> - We overlopen het rapport samen (30 min).
> - **Beslismoment:** jullie gaan pas verder als het resultaat de afgesproken
>   drempel haalt ([voorstel: 40] bruikbare kansen in jullie werkgebied). Haalt
>   het die niet, dan raad ik zelf af om verder te gaan.
>
> **Fase 2 — Pilot · €600 excl. btw · 60 dagen**
> - Eigen afgeschermde omgeving voor maximaal 5 gebruikers.
> - De volledige lijst in volgorde, met per contact de reden en een openingszin; toewijsbaar per makelaar.
> - Kick-off (45 min): aanpak per categorie en wat je verplicht zegt aan het begin van elk gesprek.
> - Tweede import op dag 30; check-ins op dag 14 en 30; evaluatie op dag 60.
>
> **Wat ik garandeer**
> - Rapport binnen 5 werkdagen; tweede import binnen 2 werkdagen.
> - Elke kans heeft een reden en een openingszin.
> - Jullie krijgen de volledige lijst van samengevoegde contacten om na te kijken; elke gemelde foute samenvoeging maak ik binnen 2 werkdagen ongedaan.
> - Antwoord op vragen binnen 1 werkdag.
>
> **Wat we samen meten** (niet gegarandeerd: het hangt af van het bellen)
> - Gesprekken, schattingsafspraken en verkoopopdrachten uit de lijst.
> - Geslaagd als: [samen in te vullen, bv. ≥ 3 schattingsafspraken uit 30 gesprekken].
>
> **Wat ik van jullie vraag**
> - Minstens 30 contacten van de lijst bellen in de eerste 30 dagen en de status bijhouden.
> - De Bel-me-niet-meer-lijst controleren vóór telefonische prospectie.
>
> **Niet inbegrepen**
> Marktgegevens over particuliere verkopers, koppelingen met jullie CRM, het
> bellen zelf, juridisch advies.
>
> **Na de pilot**
> Opvolging per kwartaal (€450 per kwartaal: nieuwe import, nieuwe lijst,
> gesprek van 30 min) of maandelijks (€249/maand). Starten jullie binnen 14
> dagen, dan verreken ik fase 2. Stoppen jullie, dan krijgen jullie binnen 10
> werkdagen een volledige export, en binnen 30 dagen wis ik alles en bevestig ik dat schriftelijk.
>
> **Gegevens**
> Jullie blijven verantwoordelijk voor het klantenbestand; ik verwerk het alleen
> voor jullie, op servers in de EU, volgens de bijgevoegde verwerkersovereenkomst.
>
> Akkoord voor fase 1: [naam, handtekening, datum]
>
> [jouw naam] · [onderneming, btw] · [telefoon] · [e-mail]

## 3. Kort bericht: een warme introductie vragen

**Aan je eigen makelaar, notaris, boekhouder of een kennis in vastgoed.**
WhatsApp of e-mail, persoonlijk, niet als massabericht:

> Hoi [naam], een vraag waar je gerust nee op mag zeggen. Ik heb als data
> engineer iets gebouwd dat uit het klantenbestand van een vastgoedkantoor haalt
> wie het opnieuw zou moeten bellen: oude schattingsaanvragen, kopers van vijf
> jaar of langer geleden, dat soort dingen. Voor ik het verkoop, wil ik 20 minuten
> praten met één zaakvoerder van een onafhankelijk kantoor, vooral om te horen of
> dit voor hen een echt probleem is. Ken jij iemand die daarvoor open zou staan,
> en mag ik zeggen dat ik via jou kom? Ik stuur je dan een zinnetje dat je kan doorsturen.

**Het zinnetje om door te sturen:**

> [Naam] is data engineer en heeft een tool gebouwd die uit het klantenbestand
> van een vastgoedkantoor haalt wie je opnieuw zou moeten bellen. Hij zoekt een
> zaakvoerder die 20 minuten wil vertellen hoe jullie nu aan verkoopopdrachten
> komen. Geen verkooppraatje. Mag hij je contacteren? [telefoon]

### 3b. Koud bericht (e-mail naar een zakelijk adres, één opvolging na 3 werkdagen)

> **Onderwerp:** Oude schattingsaanvragen in jullie bestand
>
> Dag [voornaam],
>
> Ik ben [naam], freelance data engineer uit [regio]. Ik heb een tool gebouwd
> die uit het klantenbestand van een vastgoedkantoor haalt wie je opnieuw zou
> moeten bellen, met per persoon de reden: een schatting zonder mandaat, een
> koper van jaren geleden, een lead die nooit is teruggebeld.
>
> [Kantoor] is al sinds [jaar] actief in [gemeente], dus waarschijnlijk zit er
> een flink bestand dat niemand nog systematisch opvolgt.
>
> Mag ik 20 minuten van je tijd om te horen hoe jullie nu aan verkoopopdrachten
> komen? Ik wil vooral weten of dit voor jullie een echt probleem is.
>
> Groet, [naam] · [telefoon]
>
> *Wil je geen berichten meer van mij? Laat het weten, dan stop ik.*

B2B-e-mail naar een zakelijk adres valt onder Boek XII WER. Geef altijd een
manier om af te haken. Bel je prospects, controleer dan ook de
Bel-me-niet-meer-lijst: daar staan ook ondernemingen op.

## 4. Plan voor 30 dagen

| Week | Doel | Concreet |
|---|---|---|
| 1 | Klaar om te praten | Jurist gecontacteerd; branches gemerged; beveiligingsacties gedaan; demo geoefend (2× hardop); lijst van 15 kantoren; **3 warme introducties gevraagd** |
| 2 | 5 gesprekken over het probleem | Warme intro's opvolgen; 7 persoonlijke koude berichten (concept in §3b); 2 kantoren in je buurt binnenstappen. **Geen demo in het eerste gesprek**, alleen vragen (§6). |
| 3 | 2 demo's, 1 voorstel | Demo alleen voor wie de pijn bevestigde; voorstel binnen 24 u na de demo |
| 4 | 1 getekende fase 1 | Verwerkersovereenkomst + fase 1 getekend; export ontvangen via een veilige weg; scan lokaal gedraaid; rapport overlopen |

## 5. Doorgaan, bijsturen of stoppen (na 30 dagen)

| Uitkomst | Criterium | Actie |
|---|---|---|
| **Doorgaan** | ≥ 1 betaalde fase 1 **en** ≥ 3 van 5 gesprekken bevestigen de pijn | Volgende 10 prospects; hosting opzetten voor fase 2 |
| **Bijsturen: prijs of vorm** | Pijn bevestigd, niemand betaalt | Fase 1 los aanbieden als "datakwaliteitsrapport"; of een ander segment (kantoor met een eigen binnendienst) |
| **Bijsturen: ander probleem** | Ze willen vooral nieuwe leads van buiten | De marktradar is wat ze willen: eerst een legale bron, niet bouwen |
| **Bijsturen: ander product** | Ze vragen vooral om CRM-opschoning of rapportering | Verkoop datawerk (je vak), met LeadRevive als onderdeel |
| **Stoppen** | < 2 van 5 herkennen het probleem, of "ons CRM doet dit al en we gebruiken het" | Stop met LeadRevive als product; gebruik het als referentieproject |

Na de pilot: doorgaan als het kantoor overstapt naar het kwartaalmodel **en** er
≥ 3 schattingsafspraken uit de lijst kwamen.

## 6. Vragen voor het eerste gesprek (over het verleden, niet over "zou je…")

1. Hoeveel verkoopopdrachten haalden jullie de laatste 3 maanden binnen, en waar kwamen ze vandaan?
2. Wat deden en betaalden jullie om er meer te krijgen (advertenties, folders, leadbureaus, schattingstools)?
3. Hoeveel contacten zitten er ongeveer in jullie CRM, en hoe oud is het oudste?
4. Wanneer heeft iemand voor het laatst oude schattingsaanvragen of oud-kopers nagebeld? Wat gebeurde er toen?
5. Wat houdt jullie tegen om dat elk kwartaal te doen?
6. Wie zou zo'n lijst bellen, en wanneer?
7. Hoe controleren jullie nu de Bel-me-niet-meer-lijst?
8. Wat is één extra verkoopopdracht per kwartaal jullie waard?
9. Wie beslist over zoiets?
10. (Pas aan het einde) Mag ik je tonen hoe het eruitziet voor een fictief kantoor?
