# ADR 0001 — Indieningskanaal: begeleide indiening, geen geautomatiseerde inzending

- **Status:** aanvaard
- **Datum:** 2026-08-29
- **Context-bron:** `docs/nmbs-regels.md` §5 (geverifieerd op belgiantrain.be, 2026-08-29)

## Context

De opdracht vraagt om in fase 0 te onderzoeken hoe NMBS compensatieaanvragen aanvaardt, en de
indieningsflow daarop te bouwen. Onderzoek levert precies drie kanalen op:

1. **My NMBS** — het online aanvraagformulier, achter de persoonlijke login van de reiziger.
   Aanbevolen kanaal. Voor frequente vertragingen is dit expliciet het aangewezen kanaal
   ("Vul je frequente vertragingen in via My NMBS").
2. **Loket** — papieren formulier, ter plaatse invullen en afgeven.
3. **Post** — NMBS Customer Services 10-14 B-CS.6423, Hallepoortlaan 40, 1060 Brussel.
   De Franstalige bron voegt toe dat het **originele vervoersbewijs** meegestuurd moet worden,
   **behalve** bij abonnementen op MoBIB-kaart.

Wat er **niet** is: een publieke API, een partnerkoppeling, of een gedocumenteerd e-mailadres voor
compensatieaanvragen. Wij hebben hier actief naar gezocht en niets gevonden.

## Beslissing

**RailClaim dient niet zelf in bij NMBS. Wij bouwen een "begeleide indiening".**

Concreet, na bevestiging door de gebruiker en goedkeuring in de admin-reviewqueue:

- Het volledige dossier wordt deterministisch samengesteld uit een template (NL of FR), met alle
  door NMBS gevraagde velden ingevuld — zie `docs/nmbs-regels.md` §7.
- De gebruiker krijgt een **stap-voor-stap begeleide flow** die het My NMBS-formulier volgt, met
  **per veld een kopieerknop**, zodat invullen een kwestie is van plakken, niet van opzoeken.
- Daarnaast een **PDF** in private storage (signed URL), bruikbaar voor het loket- of postkanaal.
- Bij het postkanaal toont de UI de waarschuwing over het originele vervoersbewijs, inclusief de
  MoBIB-uitzondering.

### Wat wij expliciet NIET doen

- **Geen inloggen op My NMBS namens de gebruiker.** Wij vragen nooit de My NMBS-credentials van de
  gebruiker, en wij automatiseren die sessie niet — niet met scraping, niet met browserautomatisering.
  Dat zou de gebruiksvoorwaarden van NMBS schenden, de accountbeveiliging van de gebruiker
  ondermijnen, en het onmogelijk maken om te garanderen wat er precies namens hem verstuurd is.
- **Geen inzending zonder expliciete bevestiging per claim.** Zie het kernprincipe van het product;
  afgedwongen in de database (`claims.user_confirmed_at`) én bewezen door een test.

## Gevolgen

### Voor de gebruiker

De belofte verschuift van "wij dienen in" naar **"wij zorgen dat je niets mist en het indienen 30
seconden duurt"**. Dat is nog steeds het overgrote deel van de waarde: de echte drempel voor
pendelaars is niet het invullen van één formulier, maar (a) niet weten dát je recht hebt,
(b) niet bijhouden welke ritten kwalificeerden, en (c) de termijn missen. Dat lossen wij volledig op.

Bij de regeling herhaaldelijke vertragingen is dat verschil zelfs dramatisch: NMBS vereist
**10 vertragingen van minstens 30 minuten op hetzelfde traject binnen 6 maanden**, in te dienen
**tussen 6 en 9 maanden na de eerste vertraging**. Zonder hulpmiddel houdt vrijwel niemand dat zes
maanden lang correct bij, met datums en trajecten. Dát is het product.

### Voor de UI-teksten (bindend)

Nergens mag "automatisch geld terug", "wij dienen in" of "automatische compensatie" staan. De
toegestane formulering is **"wij bereiden je dossier voor, jij bevestigt en dient in"**. Dit is
vastgelegd als een lintregel: `scripts/check-claims-language.ts` faalt de build op een lijst
verboden formuleringen in de i18n-bestanden.

Daarnaast toont de app een permanente disclaimer: **RailClaim is een onafhankelijke dienst en is niet
verbonden aan, goedgekeurd door of gelieerd aan NMBS/SNCB.**

### Voor de architectuur

Het kanaal is een **strategy-interface**, niet ingebakken logica:

```ts
interface SubmissionChannel {
  key: 'GUIDED_MY_NMBS' | 'POSTAL' | 'PARTNER_API'
  prepare(claim): Promise<PreparedSubmission>
  submit?(claim): Promise<SubmissionReceipt>   // optioneel — bestaat vandaag niet
}
```

Vandaag is alleen `GUIDED_MY_NMBS` (met `POSTAL` als variant) geïmplementeerd; `submit()` bestaat
niet. Komt er ooit een officieel kanaal of een partnership, dan is dat één nieuwe implementatie van
deze interface plus een `compensation_rules`-parameter — zonder de claimpijplijn te herschrijven.
De statuslifecycle (`SUBMITTED`, `AWAITING_NMBS`, ...) is nu al kanaalneutraal.

### Voor de statusopvolging

Omdat wij niet zelf indienen, kunnen wij `SUBMITTED` niet zelf waarnemen. De gebruiker markeert in
de app dat hij ingediend heeft (`source: USER`), en registreert later de uitkomst (goedgekeurd bedrag
of afwijzing). De admin kan corrigeren (`source: ADMIN`). Dat is eerlijk en verifieerbaar, en het
levert nog steeds de conversiemetrics op die het admin-dashboard nodig heeft.

## Overwogen alternatieven

| Alternatief | Waarom afgewezen |
|---|---|
| Browserautomatisering op My NMBS namens de gebruiker | Vereist de credentials van de gebruiker, vrijwel zeker in strijd met de gebruiksvoorwaarden, fragiel bij elke UI-wijziging, en onverenigbaar met de belofte dat wij exact weten wat er namens de gebruiker verstuurd is. |
| Alles per post versturen namens de gebruiker | Het originele vervoersbewijs moet mee (behalve MoBIB). Dat kunnen wij niet: wij hebben het fysieke ticket niet. Voor MoBIB-abonnees zou het theoretisch kunnen, maar dan nog vereist het een volmacht per dossier plus fysieke logistiek — buiten proportie voor de waarde, en het kanaal blijft traag en niet-traceerbaar. |
| Wachten op een officieel partnerkanaal | Blokkeert het hele product op iets waar wij geen controle over hebben. De architectuur houdt de deur open. |

## Herzien wanneer

- NMBS publiceert een API of partnerprogramma voor compensatieaanvragen;
- of het postkanaal blijkt in de praktijk wél werkbaar voor MoBIB-abonnees (te toetsen met een
  reële testindiening vóór dit overwogen wordt).
