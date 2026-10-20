# Commercieel aanbod — LeadRevive (draait op ImmoRadar)

## 1. Eerste doelgroep: één segment, scherp afgebakend

**Onafhankelijke vastgoedkantoren in Vlaanderen** met:
- 2 tot 15 medewerkers, met verkoop als hoofdactiviteit;
- minstens 8 jaar actief (dan is er een groot, oud bestand: daar zit de waarde);
- een CRM waaruit ze een CSV of Excel kunnen exporteren (Whise, SweepBright, Omnicasa, Zabun,
  Skarabee of zelfs Excel);
- de zaakvoerder beslist zelf over de aankoop.

**Niet** in de eerste ronde:
- franchises en ketens (Era, Century 21, Dewaele…): centrale tools en een lange beslissingsweg;
- verhuur- en syndickantoren;
- Brussel en Wallonië (Franstalige verkoop, later) [aanname: jouw verkoop verloopt in het Nederlands].

## 2. Waarvoor ze willen betalen

> "Ik heb te weinig verkoopopdrachten, en ik weet dat er in mijn eigen bestand mensen zitten
> die ooit een schatting vroegen of via ons kochten — maar niemand heeft tijd om dat uit te
> spitten."

De pijn is **mandaten winnen**, niet "data". Het bestand is het middel.

*Te valideren:* hoeveel nieuwe mandaten per maand ze hebben, wat ze daar nu aan uitgeven
(leadbureaus, folders, advertenties, schattingstools) en of ze hun oude contacten vandaag
opvolgen.

## 3. Waardepropositie in één zin

**"Binnen een week krijg je uit je eigen klantenbestand een lijst van de 50 mensen die je deze
maand moet bellen om een verkoopopdracht te winnen, met per persoon de reden waarom."**

## 4. Wat de klant precies koopt

Geen software-licentie, maar **een resultaat met software erachter**:

1. **Bestandsscan**: jij importeert en schoont hun CRM-export(s), ontdubbelt die en categoriseert
   de contacten in 6 soorten slapende relaties [code: `src/crm/dormant.ts`,
   `src/leadrevive/relationshipEngine.ts`].
2. **Bellijst + platformtoegang**: de geprioriteerde kansen staan in ImmoRadar (dashboard,
   toewijzen aan makelaars, pipelinestatus), met per contact de reden en wat we wél en níet
   weten.
3. **Belaanpak**: per categorie een korte openingszin (een schattingsaanvraag bel je anders dan
   een oud-koper).
4. **Opvolging**: jij ververst de import en bespreekt de resultaten met hen.

## 5. Betaald pilotaanbod (afgebakend)

**LeadRevive Pilot — 60 dagen — €750 excl. btw**

Inbegrepen:
- verwerkersovereenkomst (art. 28 AVG) vóór er data wordt aangeleverd;
- import en opschoning van **één** CRM-export tot 15.000 contacten, plus **één** verversing op
  dag 30;
- instellen van werkgebied, maximaal 5 gebruikers en een eigen kantooromgeving;
- **een bellijst van de top 50** met een reden per contact, plus de volledige lijst in het platform;
- 1 kick-off van 45 minuten (op locatie of online) en één belaanpak per categorie;
- 2 check-ins van 20 minuten (dag 14 en dag 30) en een evaluatie op dag 60;
- e-mailsupport met antwoord binnen 1 werkdag.

**Scangarantie:** levert de scan op dag 5 **minder dan 30 bruikbare kansen** op, dan betaalt de
klant niets en verwijder ik de data. Dit kan, omdat de scan meetbaar is vóór er gebeld wordt.

**Succescriteria (samen vastgelegd op dag 0):** het aantal gevoerde gesprekken, het aantal
schattingsafspraken en het aantal gewonnen mandaten uit de lijst. Richtwaarde: ≥ 3
schattingsafspraken in 60 dagen [aanname, toetsen in de pilot].

**Na de pilot:** €249 excl. btw per maand per kantoor, maandelijks opzegbaar. Het pilotbedrag
wordt verrekend als de klant binnen 14 dagen na de evaluatie start (3 maanden à €249 = €747).

**Buiten scope:**
- de marktradar of particuliere verkopers (er is geen legale databron; niet beloven);
- API-koppelingen met CRM's (alleen CSV of Excel);
- het bellen zelf, belscripts op maat per contact, marketingcampagnes;
- terugschrijven naar het CRM van de klant;
- data van meer dan één kantoor of vestiging (aparte prijs).

## 6. Prijshypothese en onderbouwing

| Anker | Bedrag | Wat het zegt |
|---|---|---|
| Immo Estate (prospectie-abonnement) | €45–95 | Ondergrens voor "software zonder dienst" |
| ProspectScope / Ledoux | €99–149/maand | Gangbaar voor een niche-tool per kantoor |
| Converted (leadgeneratie) | vanaf €499/maand | Wat een kantoor betaalt voor *nieuwe* leads |
| Waarde van één mandaat | ~€10.000 excl. btw | Rendement: 1 mandaat per jaar = ×3 op €249/maand |

**Hypothese:** €249/maand plaatst LeadRevive tussen tool en leadbureau. Dat klopt omdat je de
import en de opvolging zelf doet. De pilot van €750 dekt jouw opstartwerk (~6–8 uur).

**Hoe je dit test (in de eerste 10 gesprekken):**
1. Vraag eerst wat ze vandaag betalen voor leads of marketing (anker van de klant).
2. Toon het aanbod met **drie opties** en kijk welke ze kiezen of waar ze afhaken:
   - *Scan*: eenmalige bestandsscan + bellijst, €490;
   - *Pilot*: zie hierboven, €750 → daarna €249/maand;
   - *Volledig*: maandelijkse verversing + belcoaching, €399/maand.
3. Vraag: "Bij welke prijs vind je dit te duur om zelfs te proberen?" en "Bij welke prijs
   twijfel je aan de kwaliteit?" (een lichte versie van de Van Westendorp-methode).
4. **Beslisregel:** als ≥ 2 van de eerste 5 de pilot van €750 zonder onderhandeling accepteren,
   verhoog je het pilotbedrag naar €950. Wijst ≥ 4 van de 5 af op prijs (niet op nut), test
   dan de scan van €490 als instap.

## 7. Supportniveau

- Kantooruren, op werkdagen. Antwoord per e-mail binnen 1 werkdag, kritieke problemen (geen
  toegang) dezelfde dag.
- Imports doe ik tijdens de pilot zelf. Daarna kan de klant ze zelf doen via `/imports`, of ik
  doe ze tegen een vergoeding (inbegrepen in €249: één verversing per maand).
- Geen telefonische support buiten de geplande check-ins.

## 8. Andere verdienmodellen afgewogen

| Model | Oordeel | Waarom |
|---|---|---|
| **Betaalde pilot + abonnement (done-for-you)** | ✅ Kies dit | Snelste omzet, de klant hoeft niets te leren, en je leert per kantoor wat werkt |
| Self-service SaaS-abonnement | Later (fase B) | Vereist onboarding, betalingen en zelfstandig importeren. Te vroeg zonder bewijs |
| Eenmalige licentie | ❌ | Weinig waarde zonder verversingen. Een kantoor wil geen software beheren |
| Betalen per gebruik (per kans of contact) | ❌ voorlopig | Onvoorspelbaar voor de klant, en het zet je in een discussie over de "kwaliteit van de lead" |
| Betaalde installatie + onderhoud on-premise | ❌ | Kleine kantoren hebben geen IT. Hosting en back-ups zijn juist wat jij ontzorgt |
| Dienst waarbij ik de app inzet voor de klant | ✅ = het pilotmodel | De app is jouw tool. De klant koopt het resultaat |
| White-label onder het merk van de klant (bv. een CRM-leverancier of netwerk) | Later, mogelijk interessant | Als 3+ kantoren resultaat zien, pitch dan aan een CRM-leverancier of een netwerk van onafhankelijke kantoren. Niet nu: lange salescyclus |

**Gaat een betaalde dienst sneller dan eerst een volledig SaaS-platform bouwen?** Ja,
duidelijk. Het platform bestaat al. Wat ontbreekt is bewijs dat kantoren betalen. De pilot
levert dat bewijs met **nul** nieuwe functies. Alles wat in `technical-backlog.md` onder A staat,
is configuratie en papierwerk.
