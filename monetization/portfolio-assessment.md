# Portfolio-assessment — welke app kan als eerste geld opleveren?

*Datum: 20 oktober 2026. Onderzocht: de map `coude` (alle submappen) en de GitHub-repo's
`immoradar`, `muslim-life`, `barakah2`, `marktonderzoek`, `hikmar-ai`, `rwina`, `clodeproject`,
`clodeproject1` en `barakah`. Er zijn geen secrets of persoonsgegevens overgenomen.*

Legenda: **[code]** = vastgesteld in de broncode · **[docs]** = staat in de projectdocumentatie ·
**[aanname]** = mijn inschatting, nog te valideren. Het volledige overzicht van
bronnen, berekeningen en aannames staat in [bronnen-en-aannames.md](bronnen-en-aannames.md).

> **Bijgewerkt na verificatie (20-10-2026).** (1) "€10.000 per opdracht" is een
> rekenvoorbeeld; het correcte bereik is **€5.500–10.400 excl. btw** (zie bronnen).
> (2) Bij het testen bleek dat LeadRevive uit een CSV-export maar drie van de zes
> beloofde categorieën kon opleveren, door vier bugs in import en motor. Die
> zijn hersteld en getest. (3) De GBA beperkt het gebruik van oude relaties voor
> marketing, en telemarketing schuift richting opt-in: zie juridisch-kader.md. (4) Het
> maandabonnement van €249 is herzien naar een kwartaalmodel (zie
> `pricing-and-costs.md`).

---

## 0. De korte conclusie

1. **ImmoRadar is de enige app met een betalende B2B-klant binnen bereik.** Het is ook de enige
   die aansluit op wat jij verkoopt als freelancer: data opschonen, ontdubbelen, matchen en scoren.
   Je verkoopt hem niet als "AI-radar voor de hele markt", maar als **LeadRevive**: een
   afgebakende dienst die de slapende verkoopkansen in het eigen klantenbestand van een kantoor
   bovenhaalt. Dat deel werkt volledig zonder externe databron [docs: `docs/LAUNCH-CHECKLIST.md` §1].
2. **De marktradar (particuliere verkopers vinden) kan je vandaag niet legaal leveren.** Er is
   geen toegestane databron [code: `src/collectors/registry.ts` bevat alleen fixture- en
   demo-collectors]. Beloof hem niet aan klanten.
3. **De consumentenapps voor moslims (zeven projecten) overlappen sterk en zijn commercieel zwak.**
   Ze vragen lage prijzen in een drukke markt, verwerken bijzondere persoonsgegevens (art. 9 AVG)
   en hebben nog geen live betalingen. Nieuwe functies erbij bouwen helpt je niet aan een eerste
   verkoop. Bevries ze.
4. **De webshops en de kleine tools zijn demo's of prototypes.** Ze hebben geen eigen merk,
   voorraad of klanten. Daarmee verdien je alleen geld als portfolio voor maatwerkopdrachten.

---

## 1. Per app: wat ik heb vastgesteld

### 1.1 ImmoRadar (repo `immoradar`) — ★ gekozen

| | |
|---|---|
| **Wat het doet** [code] | Een acquisitietool voor Belgische vastgoedkantoren met twee motoren. **LeadRevive**: een CSV-export van het CRM importeren, normaliseren (Belgische datums, E.164-telefoonnummers, namen in beide volgordes), ontdubbelen en daarna slapende relaties indelen in 6 categorieën (slapende schattingsaanvraag, verloren mandaat, verloren verkoopprospect, eerdere koper, oud-klant, nooit opgevolgde lead), met een uitlegbare score. **ImmoRadar**: advertenties van particuliere verkopers ophalen, classificeren, prijsdalingen en herplaatsingen detecteren en die matchen met het eigen bestand ("CROSS"-kansen). Verder: dashboard, pipeline, team en toewijzen, gebieden, Telegram-meldingen en analytics. |
| **Probleem** | Kantoren zitten op duizenden oude contacten die niemand systematisch opvolgt, terwijl nieuwe verkoopopdrachten winnen hun duurste activiteit is. |
| **Wie betaalt** | De zaakvoerder van een onafhankelijk vastgoedkantoor. Eén extra mandaat brengt **€5.500–10.400 excl. btw** aan ereloon op [rekening: gemiddeld huis €346.218 / appartement €275.862 (Notarisbarometer T3 2025) × 2–3 % ereloon (housing-service.be, 2026)]. Hoeveel het kantoor netto overhoudt, is onbekend. |
| **Wat werkt** [code] | LeadRevive-flow (na de fixes op branch `ccr-02331f64-4fd2md`: alle zes categorieën uit een CSV, ontdubbeling op naam + adres, intake-scan, export) met een importpreview in 2 stappen en een diff per rij. Multi-tenant met een test die ontbrekende kantoorfilters opspoort (`tests/tenancy.test.ts`). Rollen, inlogvergrendeling, intrekbare sessies, `/api/health` en `/api/ready`, JSON-logs zonder persoonsgegevens, bewaartermijnen, wissen per persoon (`redactCrmContact`), een volledig kantoor verwijderen (`scripts/purge-agency.ts`). ~148 Vitest- en 9 Playwright-tests. Abonnementsstatus per kantoor (actief, gepauzeerd, opgezegd, einddatum, maximum kansen per dag). |
| **Wat ontbreekt** | Een legale marktbron (blokkerend voor de radar). Prijzen en betalingen (facturatie is manueel en zo bedoeld [docs]). Een export van kantoorgegevens. Meldingen per e-mail (alleen Telegram). Self-service wachtwoordherstel. CRM-koppelingen (alleen CSV). **CI draait niet**: het bestand staat in `.github/ci.yml` in plaats van `.github/workflows/` [code]. |
| **Klaar voor betalende klanten?** | **Ja voor een begeleide LeadRevive-pilot**, na een paar praktische en juridische stappen (zie `technical-backlog.md`). **Nee** voor de marktradar. |
| **Onderhoud en infra** | Laag. Geen AI-API's, geen betaalde externe diensten. Render Frankfurt met web + worker + Postgres ≈ $20–25/maand [docs: `docs/DEPLOY-RENDER.md`]. Support is vooral het begeleiden van imports. |

### 1.2 Muslim Life (repo `muslim-life`)

- [code] Lifestyleplatform voor moslims: gebedstijden en -tracking, planner, gewoontes,
  "Explore" (zaken en deals), AI-assistent, NL/FR/AR met RTL. ~679 testgevallen, AVG-export
  en gefaseerd verwijderen, art. 9-toestemming opgeslagen.
- [code] Betalingen staan op `stub`, de AI staat op `mock` (ook in `render.free.yaml`), en de
  zaken in Explore zijn demodata. Premium kost €7,99/maand of €79/jaar [code: `src/config/plans.ts`].
- [docs] Nog open: merknaamcheck, juridische review, verwerkersovereenkomsten, review van de
  religieuze inhoud, echte zakelijke partners.
- **Oordeel:** technisch het meest afgewerkte consumentenproduct, maar B2C met lage prijzen.
  Muslim Pro rekent ~$34,99/jaar [App Store], en een AI-assistent kost per gebruiker geld.
  Om dit te laten renderen moet je een groot publiek bereiken, en dat kanaal heb je niet [aanname].

### 1.3 Barakah (repo `barakah2`)

- [code] Zakatberekening met versiebeheerde regelsets en bigint-rekenwerk, sadaqah-doelen,
  een goede-doelengids met bronvermelding, herinneringen en een jaar-PDF. ~590 tests en een
  CI die echt draait.
- [code] Geen betaalintegratie en geen prijzen. Het "Organization"-plan is een lege huls.
- [docs] De regelset moet nog door een geleerde nagekeken worden. Er zijn gratis
  zakatcalculators bij grote goede doelen [aanname].
- **Oordeel:** goed gebouwd, maar weinig betalingsbereidheid. Zakat is één keer per jaar, en
  vertrouwen in een fiqh-regelset moet je eerst verdienen.

### 1.4 Noor Printables (`coude/printable-generator`)

- [code] 51 pagina's en 56 API-routes, gebouwd op één dag (alle migraties op 01-04-2026).
  De werkbladgenerator maakt PDF's met PDFKit, maar **het thema verandert de tekening niet**.
  Stripe-abonnementen werken (Pro $12/maand, School $49/maand).
- [code] Veel betaalde stromen leveren niets: Printful-boeken worden aangerekend maar nooit
  besteld, white-label-subdomeinen worden niet gerouteerd, uitnodigingen sturen geen e-mail en
  het watermerk wordt niet toegepast. **Admin-endpoints zijn onveilig**: `api/admin/stats` heeft
  geen authenticatie, en als `ADMIN_PASSWORD` niet gezet is, wordt elk verzoek doorgelaten.
  Er zijn geen privacypagina's, terwijl de app kindernamen en -leeftijden verzamelt.
- **Oordeel:** te breed en te dun. Zo kan je geen geld vragen zonder terugbetalingen en
  klachten te riskeren.

### 1.5 Noor Tracker (`coude/noor-tracker`)

- [code] Gewoontetracker voor kinderen met sterren en badges, een wekelijkse e-mail en Stripe
  Pro (€4,99/maand, kaart en iDEAL). Klein en samenhangend. Het schema staat hard op SQLite,
  er is geen account-verwijdering, en `cookies.txt` (sessiecookies) staat in git.
- **Oordeel:** de netste kleine consumentenapp, maar €4,99 B2C met religieuze data van
  minderjarigen = veel compliance voor weinig omzet.

### 1.6 Noor App, Salaat, Noor Growth Funnel

- **noor-app** [code]: een UI-schil van ~500 regels. De gebedstijden zijn demotijden, de spellen
  zijn een lijst namen en de login werkt niet (bearer-token tegenover een NextAuth-cookie).
- **Salaat** [code]: werkende gebedstijden en qibla op het toestel zelf. De meldingen zijn nooit
  aangesloten en de assets ontbreken, dus de build faalt. De markt is verzadigd.
- **noor-growth-funnel** [code]: een validatieformulier dat leads alleen in `localStorage`
  bewaart, dus er komt nooit een lead bij jou aan.

### 1.7 Webshops: Layali (`jamal-jamila`), `luxe-store`, `eid-luxe-shop`, `webshop`

- [code] Layali heeft echte Mollie- en Stripe-checkouts met webhooks en e-mails, maar alle
  producten, verkopers en reviews zijn verzonnen (picsum-foto's). Er is geen btw-afhandeling, en
  de marketplace bestaat alleen visueel (geen Connect, geen commissie). luxe-store is de
  template waarvan Layali geforkt is (bug: gastbestellingen worden betaald maar niet aangemaakt).
  eid-luxe-shop en webshop zijn frontend-mockups zonder betaling.
- **Oordeel:** geld verdienen met een webshop vraagt product, voorraad en marketingbudget. Dat
  is een ander bedrijf. Als **portfolio** voor maatwerk kan het wel dienen.

### 1.8 Kleine tools

- **resume-roaster** [code]: een werkende Claude-roast van cv's. Geen authenticatie en geen
  rate limit, dus wie de URL kent laat jouw API-tegoed leeglopen. Een cv bevat persoonsgegevens,
  maar er is geen privacyverklaring. Viraal speeltje, geen bedrijf.
- **TankSlim / brandstofprijzen** [code]: alleen de Franse prijzen komen uit legitieme open data.
  NL gebruikt een ANWB-sleutel die hard in de client staat, BE scrapet carbu.com via een
  CORS-proxy, en de prijzen voor LU en de fallback zijn **willekeurig gegenereerd**. Niet
  verkopen in deze vorm.
- **Hikmar AI** (`coude/Assitant`, repo `hikmar-ai` is leeg) [code + docs]: een prototype van
  een stemassistent met keyword-routering naar Claude, GPT-4o en Gemini. Het smart-home-deel is
  een mock, er is geen authenticatie en `/status` toont welke sleutels gezet zijn. Het
  businessplan mikt op €330k omzet in jaar 1. Kloof tussen plan en code: zeer groot.
- **marktonderzoek** (repo) [code]: een enquête voor je eigen islamitische webshop. Ze vraagt
  religieuze praktijk en etnische achtergrond naast een optioneel e-mailadres, terwijl de tekst
  "anoniem" belooft. Pas dat aan voordat je ze opnieuw gebruikt.
- **simple-webapp**: een todo-starter. `rwina`, `clodeproject` en `barakah` zijn leeg, en
  `clodeproject1` is een oudere kopie van `coude`.

---

## 2. Vergelijking van het commerciële potentieel

Gescoord op **urgentie van het probleem × budget × bereikbaarheid voor jou**. Technische
kwaliteit telt niet als pluspunt.

| App | Doelgroep en probleem | Bestaande alternatieven | Mogelijk onderscheidend voordeel | Bereikbaarheid | Verdienmodel | Tijd tot 1e verkoop | Kosten en risico's | Prioriteit |
|---|---|---|---|---|---|---|---|---|
| **ImmoRadar → LeadRevive** | Zaakvoerders van onafhankelijke vastgoedkantoren: te weinig verkoopopdrachten, oude contacten worden niet opgevolgd | CRM's zoals Whise (>2.000 kantoren in BE/FR, [village.ai](https://village.ai/company/whise)) en SweepBright (prijs op aanvraag); prospectietools zoals [Immo Estate](https://immo.estate/) (€45–95), [ProspectScope](https://prospectscope.be/) (€99–149/maand) en [Ledoux](https://www.ledoux.app/makelaar-inkoop-crm) (€149/maand, niet bevestigd: pagina gaf 404); leadbureaus zoals [Converted](https://converted.be/diensten/leadgeneratie/vastgoed/) (vanaf €499/maand + €250 opstart + ≥ €500 advertentiebudget) | Werkt op het **eigen** bestand: geen koude lead maar een naam met historiek. Belgische CSV-kennis. Een uitlegbare reden per contact. Jouw data-expertise maakt van de "import" een dienst | **Middel–hoog**: duizenden kantoren met publieke contactgegevens, lokaal benaderbaar. Jouw netwerk loopt via data en BI, niet via vastgoed [aanname] | Pilot in twee fasen (€350 + €600), daarna per kwartaal (done-for-you) | **4–8 weken**, inclusief juristenreview | Infra ~€20–45/maand. Risico's: AVG (jij bent verwerker; GBA 01/2025 over oude relaties), Bel-me-niet-meer, "zelf in Excel doen", gebrek aan CRM-koppeling, verkoopcyclus bij kleine kantoren | **1** |
| Muslim Life | Moslims van 22–45: dag- en gebedsplanning | Muslim Pro (~$35/jaar), gratis gebedsapps, Notion | Alles in één, NL/FR/AR | Laag: B2C, je hebt geen publiek of kanaal [aanname] | Freemium-abonnement €7,99/maand | 3–6 maanden | AI-kosten per gebruiker, art. 9, religieuze review, merknaam | 4 |
| Barakah | Moslims die zakat berekenen | Gratis calculators van goede doelen, imams | Transparante regelsets, PDF | Laag | Freemium / gezinsplan (geen prijzen) | 4+ maanden (voor Ramadan 2027) | Fiqh-vertrouwen, seizoensgebonden | 5 |
| Noor Printables | Ouders en weekendscholen: islamitische werkbladen | [Noor Kids](https://noorkids.com/) ($89,99/jaar), Gumroad-packs à $5–9 | On-demand generatie (maar het thema verandert de tekening niet) | Middel via Instagram/Pinterest [aanname] | Abonnement $12 / School $49 | 2–3 maanden na een grote opkuis | Betaalde stromen zonder levering, onveilige admin, kinderdata | 6 |
| Noor Tracker | Ouders: islamitische gewoontes van kinderen | Algemene gewoonteapps, Noor Kids | Eenvoudig, iDEAL | Laag–middel | €4,99/maand | 2 maanden | Art. 9 + minderjarigen | 7 |
| Layali-webshop | Consumenten in BE/NL: oriental lifestyle-producten | Bol, Etsy, gevestigde shops | Geen (geen product) | Kost advertentiebudget | Marge op producten | Onbepaald | Voorraad, btw, retouren | 8 |
| resume-roaster | Werkzoekenden | ChatGPT, gratis cv-checkers | Fun-formaat | Viraal of niet | Per roast | Weken, maar minieme omzet | API-misbruik, AVG | 9 |
| TankSlim | Automobilisten in de Benelux | ANWB-app, carbu.com, Waze | Grensoverschrijdend | B2C | Advertenties | — | Onrechtmatige bronnen, verzonnen prijzen | 10 |
| Hikmar AI | Huishoudens in de diaspora, kmo's | Siri, Alexa, ChatGPT voice | Darija/Arabisch (niet gebouwd) | Laag | Abonnement / hardware | >6 maanden | Hoge bouwkost, geen authenticatie, API-kosten | 11 |
| noor-app, Salaat, eid-luxe-shop, webshop, simple-webapp, marktonderzoek | — | — | — | — | — | — | Prototypes of interne tools | — |

**Wat er niet in de tabel staat, maar wel telt:** je kan je repo's ook als **portfolio** inzetten
voor maatwerk (Next.js-apps met Stripe of Mollie, multi-tenant, AVG). Dat is geen product, maar
het verkoopt jou als freelancer. Gebruik ImmoRadar en Barakah als referentiewerk.

---

## 3. Waarom ImmoRadar (als LeadRevive), en waarom niet de rest

**Voor:**
- **B2B met echt budget.** Eén gewonnen mandaat (~€10k ereloon) betaalt jaren abonnement. Het
  rendement is in één zin uit te leggen.
- **Het werkt vandaag al**, zonder het blokkerende databronprobleem.
- **Het past bij jouw expertise.** De kern is datakwaliteit: rommelige exports, ontdubbelen,
  matchen, uitlegbare scores. Dat werk lever je als data engineer geloofwaardiger dan een
  generieke SaaS-verkoper.
- **De verkoop gaat via een gesprek, niet via advertenties.** Tien goede gesprekken kan je
  zelf voeren.
- **De variabele kosten zijn bijna nul.** Er is geen AI-verbruik.

**Tegen (en hoe je ermee omgaat):**
- *"Mijn CRM kan ook filteren op laatste contact."* Klopt, en precies dat test je in de
  gesprekken. Je meerwaarde: het opschonen en ontdubbelen over meerdere exports heen, de
  6 categorieën met een reden en een belscript per contact, en dat jij het voor hen doet.
  Haakt het merendeel hierop af, dan stop je (zie de criteria in `first-customers-plan.md`).
- *Jij bent verwerker van persoonsgegevens.* Je hebt een verwerkersovereenkomst nodig vóór je
  één bestand aanraakt. Dat is een papierwerk-taak, geen bouwtaak.
- *Je netwerk zit niet in vastgoed* [aanname]. Daarom bevat het 30-dagenplan een
  warme-introductieroute (je eigen makelaar, notarissen, boekhouders) naast koude outreach.

**Waarom geen consumentenapp eerst:** lage prijzen, de noodzaak van een groot publiek, en
gevoelige data (art. 9, kinderen). Ook als het lukt, levert het per klant weinig op, en jouw
voordeel als data engineer speelt er niet. De zeven moslimapps overlappen elkaar bovendien (twee
keer gebedstijden, twee keer gewoontes, Barakah als ontbrekende module van Muslim Life). Moet je
er later één verderzetten, voeg dan Muslim Life en Barakah samen en bevries de rest.

---

## 4. Hygiëne die los van de keuze nodig is (niet blokkerend voor de pilot)

Ik heb niets aangepast. Wel aan te raden:
- `coude/noor-tracker/cookies.txt` uit git halen (sessiecookies).
- `resume-roaster` offline halen of een rate limit toevoegen (open endpoint dat API-tegoed verbruikt).
- `printable-generator`: `api/admin/stats` heeft geen authenticatie, en een ontbrekend
  `ADMIN_PASSWORD` laat elk verzoek door. Niet publiek laten draaien.
- `brandstofprijzen.html`: de ANWB-sleutel staat in de client. Willekeurige prijzen als
  "indicatief" tonen misleidt gebruikers.
- `marktonderzoek`: de tekst belooft anonimiteit terwijl er art. 9-data en een e-mailadres
  worden gevraagd.
- `render.yaml` in `coude` verwijst naar de lege map `marktonderzoek/`, dus die service faalt.

### Bronnen (geraadpleegd 20-10-2026)
- Immo Estate (Propenda), prijzen en functies: https://immo.estate/
- ProspectScope, prijzen: https://prospectscope.be/
- Ledoux inkoop-CRM: https://www.ledoux.app/makelaar-inkoop-crm
- Converted, leadgeneratie vastgoed: https://converted.be/diensten/leadgeneratie/vastgoed/
- Whise, profiel (>2.000 kantoren): https://village.ai/company/whise
- SweepBright, prijs op aanvraag: https://g2.com/products/sweepbright/pricing
- Ereloon makelaar, geen wettelijk barema: https://www.housing-service.be/?p=1153
- Notarisbarometer T3 2025 (gemiddelde huisprijs): https://www.notaris.be/sites/default/files/files/2025-10/Notarisbarometer%20T3%202025.pdf
- Muslim Pro, prijs: https://apps.apple.com/us/app/muslim-pro-quran-prayer-times/id388389451
- Noor Kids, prijs: https://noorkids.com/products/noor-kids-character-building-program-99-trial-1
- Databankrecht en scraping (algemeen): https://legalnews.be/?p=64036
