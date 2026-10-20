# Commercieel aanbod — LeadRevive-pilot (definitief concept)

Labels: zie [bronnen-en-aannames.md](bronnen-en-aannames.md).

## 1. Doelgroep

**Onafhankelijke vastgoedkantoren in Vlaanderen**, met:
- 2–15 medewerkers, verkoop als hoofdactiviteit;
- minstens 8 jaar actief (een groot, oud bestand);
- een CRM waaruit ze een CSV of Excel kunnen exporteren;
- een zaakvoerder die zelf beslist;
- iemand die effectief belt (zaakvoerder, makelaar of een vaste binnendienst).

Niet: franchises en ketens, verhuur- en syndickantoren, Brussel/Wallonië (eerst Nederlandstalig).

## 2. Het probleem waarvoor ze betalen [AANNAME, te toetsen]

> "We hebben te weinig verkoopopdrachten, en in ons bestand zitten mensen die ooit
> een schatting vroegen of via ons kochten. Niemand heeft tijd om dat uit te
> zoeken, en ons bestand zit vol dubbels."

## 3. Waardepropositie

**"Uit je eigen klantenbestand: een opgeschoonde lijst van wie je eerst belt,
met per persoon de reden en een eerlijke openingszin."**

Wat we er bewust **niet** bij zeggen: "wie gaat verkopen". Niemand weet dat vóór het gesprek.

## 4. Wat een "bruikbare kans" is

Een contact telt als bruikbare kans als het aan alle vier voldoet [CODE,
`src/leadrevive/intake.ts` in immoradar]:

1. **Reden om te bellen**: het valt in een van zes categorieën (slapende
   schattingsaanvraag, verloren mandaat, verloren verkoopprospect, eerdere koper
   ≥ 5 jaar, oud-klant, nooit opgevolgd) en haalt de volgorde-drempel van het product;
2. **bereikbaar**: geldig Belgisch telefoonnummer of e-mailadres;
3. **in het werkgebied** dat het kantoor opgeeft;
4. "nooit opgevolgd" telt alleen als de export een kolom *laatste contact* heeft.

Plus één voorwaarde die het kantoor zelf controleert: **niet op de
Bel-me-niet-meer-lijst** (als het om telefonische prospectie gaat).

## 5. Wat het kantoor moet aanleveren

| Minimum om fase 1 te starten | Aanbevolen |
|---|---|
| Export als CSV/Excel met naam en telefoon of e-mail | + type contact, aanmaakdatum, laatste contact, adres + postcode, status, klantnummer |
| Getekende verwerkersovereenkomst | Notities weglaten of opschonen (gevoelige info) |

**Er wordt geen aantal kansen beloofd vóór de intake-scan.** Pas na fase 1 weet
je wat het bestand oplevert.

## 6. Het aanbod: pilot in twee fasen, €950 excl. btw

### Fase 1 — Intake-scan (5 werkdagen, €350)

Jij levert, binnen **5 werkdagen** na ontvangst van export en getekende overeenkomst:
- een **datakwaliteitsrapport**: aantal rijen, dubbels, onbruikbare rijen, welke velden ontbreken;
- het **aantal bruikbare kansen per categorie**, berekend met de regels van het product;
- een **opgeschoonde, ontdubbelde export** die het kantoor zelf mag houden;
- een gesprek van 30 minuten om het rapport te overlopen.

**Beslismoment.** Het kantoor beslist na fase 1 of het verdergaat. Vooraf
spreek je samen een drempel af (voorstel: ≥ 40 bruikbare kansen in het
werkgebied). Ligt het resultaat onder die drempel, dan raad jij zelf af om door
te gaan. Het kantoor betaalt alleen fase 1 en houdt het opgeschoonde bestand.

### Fase 2 — Pilot (60 dagen, €600)

- Afgeschermde omgeving voor het kantoor, maximaal 5 gebruikers, werkgebied ingesteld;
- de volledige lijst bruikbare kansen in volgorde, met reden en openingszin, toewijsbaar aan makelaars;
- kick-off van 45 minuten: hoe bel je per categorie, en welke transparantie is verplicht in het gesprek;
- tweede import op dag 30 (nieuwe of gewijzigde contacten);
- check-ins op dag 14 en dag 30 (20 min), evaluatie op dag 60;
- support per e-mail, antwoord binnen 1 werkdag;
- einde: export en wissen binnen 30 dagen, of overgang naar het vervolg.

### Meetbare resultaten

**Wat wij garanderen** (onder onze controle):

| Resultaat | Norm |
|---|---|
| Intake-rapport opgeleverd | binnen 5 werkdagen |
| Elke bruikbare kans heeft een categorie, reden en openingszin | 100 % |
| Ontdubbeling: steekproef van 50 samengevoegde of naast elkaar gelaten contacten, samen nagekeken | 0 onterecht samengevoegde personen; elke fout wordt binnen 2 werkdagen hersteld |
| Tweede import verwerkt | binnen 2 werkdagen na ontvangst |
| Supportvraag beantwoord | binnen 1 werkdag |
| Export en verwijdering bij stopzetting | export binnen 10 werkdagen, wissen binnen 30 dagen, schriftelijk bevestigd |

**Wat we samen meten maar niet garanderen** (dat hangt af van het bellen):

| Indicator | Hoe |
|---|---|
| Gevoerde gesprekken | status in de pipeline |
| Schattingsafspraken uit de lijst | status in de pipeline |
| Verkoopopdrachten uit de lijst | melding door het kantoor |
| "Foute" kansen (overleden, verhuisd, al klant) | feedbackknop of notitie |

**Inspanning van het kantoor:** minstens **30 contacten van de lijst bellen** in
de eerste 30 dagen en de status bijhouden. Zonder die inspanning valt er niets te evalueren.

**Richtwaarde voor "geslaagd"** (vooraf samen vastleggen): bijvoorbeeld ≥ 3
schattingsafspraken uit 30 gesprekken [AANNAME — er is geen marktcijfer voor].

### Vervolg na de pilot
- **Standaard:** opvolging per kwartaal, €450 per kwartaal (nieuwe import, nieuwe lijst, gesprek van 30 min).
- **Optie:** maandabonnement €249/maand, als het kantoor de pipeline dagelijks gebruikt.
- Wie binnen 14 dagen verdergaat, krijgt fase 2 (€600) verrekend met de eerste factuur(en).

### Buiten scope
- marktradar en particuliere verkopers uit advertenties (geen legale databron);
- koppelingen met het CRM (alleen CSV/Excel);
- zelf bellen, campagnes, sms of e-mailings;
- de controle op de Bel-me-niet-meer-lijst (verantwoordelijkheid van het kantoor; jij herinnert eraan);
- juridisch advies aan het kantoor.

## 7. Andere modellen afgewogen

| Model | Oordeel |
|---|---|
| Pilot in twee fasen + kwartaalservice | ✅ Gekozen: geen belofte vóór de data er is; past bij hoe traag nieuwe waarde aangroeit |
| Alleen een eenmalige scan (fase 1 los, €350–590) | ✅ Uitweg voor twijfelaars; tegelijk het product voor wie het vervolg niet ziet zitten |
| Maandabonnement self-service SaaS | Later: vraagt onboarding, betalingen en self-service import, en er is nog geen bewijs van vraag |
| Betalen per kans of per afspraak | ❌ Discussie over "kwaliteit van de lead"; je beheerst het bellen niet |
| On-premise licentie | ❌ Kleine kantoren hebben geen IT |
| White-label (CRM-leverancier, netwerk van onafhankelijke kantoren) | Later, na ≥ 3 succesvolle pilots |
| **Instap voor datawerk** (CRM-opschoning, Power BI-dashboard voor het kantoor) | 🔍 Te toetsen: misschien de echte waarde van de pilot voor jou |

## 8. Juridisch kader voor het aanbod

- Het kantoor is verwerkingsverantwoordelijke, jij bent verwerker → **verwerkersovereenkomst vóór de data**: concept in immoradar `docs/pilot/verwerkersovereenkomst-concept.md`.
- De GBA (ontwerp-aanbeveling 01/2025) laat ruimte voor contact met oud-klanten en met mensen die zelf een aanvraag deden, maar **minder naarmate de relatie ouder en zwakker is**. Laat een jurist per categorie bevestigen welke termijnen verdedigbaar zijn **voordat** je de pilot verkoopt.
- De kick-off behandelt verplicht de transparantie aan het begin van elk telefoongesprek (identiteit, doel, bron van de gegevens, recht op bezwaar) en de Bel-me-niet-meer-lijst.
