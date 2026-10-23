# Architectuur

Beslissingen die in fase 1 zijn genomen en die latere fases niet mogen omkeren zonder
uitdrukkelijke reden.

## 1. Lagen

```
src/
├── app/              Routes. Server components halen data via services, nooit via Prisma.
│   ├── (public)/     Marketing + publieke goede-doelengids
│   ├── (auth)/       Login / registratie
│   ├── (dashboard)/  Ingelogde app-shell
│   └── api/          Route handlers
├── modules/          Client-side feature-slices (formulieren, presentatiecomponenten)
├── components/       Herbruikbare UI zonder domeinkennis
├── config/           Waarden zonder logica: plannen, valuta, navigatie, env
├── lib/              Pure functies: geld, datums, fouten, logging
└── server/           Alles wat 'server-only' is
    ├── auth/         Sessie, actor, scoping-helpers, guards
    ├── db/           Prisma-singleton
    ├── http/         Response-vertaling, rate limiting
    ├── modules/      Domeinservices per module
    └── services/     Cross-cutting: entitlements, audit
```

ESLint dwingt af dat componenten `@/server/db/prisma` niet importeren. Business-logica
zit in een service, niet in een React-component.

## 2. Geld en precisie

Alle bedragen worden in de database als `Decimal` opgeslagen en in **integer minor
units** gerekend (`src/lib/money.ts`). Floating point komt nergens in een lopend totaal
voor: `0.1 + 0.2 !== 0.3` is in een religieuze verplichting geen afrondingsdetail maar
een fout.

Een Zakat-berekening vermenigvuldigt bedragen echter ook met waarden die géén geheel
getal zijn: een wisselkoers, een goudprijs per gram, een gewicht, het tarief. Die gaan
daarom door `src/lib/decimal.ts`, dat alles als `bigint` op een vaste schaal rekent.
**Geen enkele JS `number` doet mee aan rekenwerk dat een opgeslagen bedrag bereikt.**

| Grootheid              | Schaal | Kolom             |
| ---------------------- | ------ | ----------------- |
| Geld                   | 2      | `Decimal(18,2)`   |
| Gewicht in gram        | 3      | `Decimal(12,3)`   |
| Zakat-tarief           | 5      | `Decimal(6,5)`    |
| Metaalprijs per gram   | 6      | `Decimal(18,6)`   |
| Wisselkoers            | 8      | `Decimal(18,8)`   |
| Zakatable percentage   | 2      | `Decimal(5,2)`    |

**Afrondingsmodus: half away from zero** (2,345 → 2,35; −2,345 → −2,35). Nooit
banker's rounding — een verplichting hoort niet af te hangen van de pariteit van het
voorgaande cijfer, en half-away-from-zero is wat iemand met een rekenmachine
reproduceert.

Er wordt op precies drie gedocumenteerde momenten afgerond, en nergens anders:

1. wanneer gewicht × prijs een geldbedrag wordt;
2. wanneer een bedrag via een koers een andere valuta in gaat;
3. wanneer een percentage of tarief op een bedrag wordt toegepast.

Tussenproducten worden nooit afgerond. Een post wordt één keer afgerond en daarna als
geheel getal opgeteld.

## 3. Reproduceerbaarheid van berekeningen

Een `ZakatCalculation` met status `FINALIZED` is onveranderlijk. De rij bewaart:

- de gebruikte nisab-basis, het gewicht, de prijs per gram, de bron en het tijdstip;
- de wisselkoersen (`ZakatCalculationRate`) per valutapaar;
- het `rulesVersion` van de gebruikte `ZakatRuleSet` én de `engineVersion`;
- per post een `ZakatCalculationItem` met bedrag, oorspronkelijk bedrag, koers,
  percentage, en de reden waarom die post wel of niet meetelde.

`ZakatCalculationItem.sourceEntityId` is bewust **geen** foreign key: een asset
verwijderen mag een afgesloten jaar niet muteren of mee-cascaden.

Het draft/finalized-onderscheid is de kern van het model:

| | `DRAFT` | `FINALIZED` |
| --- | --- | --- |
| Bij openen | opnieuw berekend uit huidige gegevens | uit eigen rijen teruggelezen |
| Asset wijzigt | verandert mee | verandert niet |
| Goudprijs beweegt | verandert mee | verandert niet |
| Nieuwe regelset actief | gebruikt de nieuwe | houdt de oude |
| `PATCH` | herberekent | 409 `CALCULATION_ALREADY_FINALIZED` |

`readCalculation()` is de enige ingang voor beide en herberekent nooit. Wie een verse
berekening wil, vraagt daar expliciet om.

De engine (`src/server/modules/zakat/engine.ts`) is een **pure functie**: geen Prisma,
geen klok, geen netwerk, geen AI. Prijzen, koersen en regels gaan er als argument in.
Dat is precies wat een snapshot reproduceerbaar maakt — en waarom de seed de engine
rechtstreeks vanuit een gewoon Node-script kan aansturen.

## 4. Religieuze regels zijn data

`ZakatRuleSet` + `ZakatAssetRule` + `ZakatLiabilityRule` bepalen wat meetelt, tegen welk
percentage, en welke schulden aftrekbaar zijn. De engine leest die rijen; er staat geen
`if (madhhab === 'HANAFI')` in de code. Elke regelset kan via `RuleSetSource` naar een
bron verwijzen, en een berekening verwijst altijd naar de versie die op dat moment gold.

De standaardregelset (`2026.1-default`) hanteert 2,5%, 85 g goud, 595 g zilver, en
aftrekbaarheid van verplichtingen die binnen twaalf maanden opeisbaar zijn. Dat is een
transparant gedocumenteerde standaard, geen uitspraak namens een madhhab. Gebruikers
worden niet gedwongen een madhhab te kiezen.

## 4b. Betalingsstatus is afgeleid, nooit gecacht

Er is bewust **geen** `paidAmount`-kolom op `ZakatCalculation`. De betaalde som is:

```
paid = Σ actieve ZAKAT-donaties gekoppeld aan deze berekening
```

Een gecachte teller drift zodra twee betalingen tegelijk binnenkomen, een donatie
wordt ingetrokken, of een correctie er één vervangt — en een verkeerd Zakat-saldo
merkt een gebruiker pas een jaar later. Optellen kost één geïndexeerde query en kan
niet fout staan.

Daarbij horen twee harde regels:

- Een betaling koppelt alleen aan een **FINALIZED** berekening. Aan een concept
  betalen zou betekenen dat je een bedrag afrekent dat nog kan veranderen.
- Een betaling moet in dezelfde valuta staan als de berekening. Omrekenen met de
  koers van vandaag zou een historische verplichting herformuleren.

Een donatie wordt nooit hard verwijderd, alleen **gevoid**: de rij blijft auditbaar
en telt nergens meer mee.

## 4c. Historische valuta

Donaties dragen geen FX-snapshot — er is op dat moment niets omgerekend. Jaartotalen
worden daarom **per valuta** gerapporteerd. Een jaar met euro's en dollars toont twee
totalen in plaats van één verkeerd totaal. Een omgerekende weergave vraagt om een
koers die bij de donatie is vastgelegd, niet één die bij het lezen wordt opgehaald.

## 4d. Bewijs per claim, niet per organisatie

Een bron bewijst **één specifieke uitspraak**, nooit de hele organisatie. Een
registerinschrijving bewijst dat de entiteit bestaat; ze zegt niets over Zakat-beleid.
`CharityClaim` koppelt daarom elk bewijsstuk aan precies de claim die het ondersteunt.

Regels die deze laag afdwingt:

- **UNKNOWN ≠ NEE.** Een onbekende factor valt buiten de noemer van de score. Dat alleen
  zou één geverifieerde factor een score van 100 geven, dus het resultaat rapporteert
  altijd óók `coverage` — hoeveel van de factorenset onderzocht is — en waarschuwt
  onder de 40%.
- **Claims worden gesupersedeerd, niet bewerkt.** De oude rij blijft staan met een
  tijdstempel, zodat het bewijs achter een eerdere score navertelbaar blijft.
- **Zakat kent een ladder**, geen vinkje: `UNKNOWN → SELF_DECLARED → POLICY_PUBLISHED
  → ALLOCATION_DESCRIBED → INDEPENDENTLY_VERIFIED`. Alleen de bovenste trede vereist
  een bron buiten de organisatie, en zelfs die wordt gepresenteerd als een vaststelling
  over documentatie — niet als religieus oordeel.
- **`verified` betekent exact één ding**: de identiteit is gecontroleerd tegen een
  officieel register. De servicelaag weigert de badge zonder die bron.
- **Verouderd bewijs wordt gelabeld, nooit verwijderd**: `FRESH / STALE / EXPIRED /
  UNKNOWN`, met per factor een eigen venster.

De score is deterministisch, geversioneerd (`transparency@1`) en geeft per factor terug
wat er verdiend is en waarom. `Charity.transparencyScore` is uitsluitend een cache voor
sorteren in SQL; de detailpagina herberekent altijd.

## 4e. Planning, kalender en meldingen

**Reminder ≠ Notification.** Een `Reminder` is een *intentie met een schema*; een
`Notification` is één concrete bezorging. Eén jaarlijkse reminder produceert over de
jaren meerdere notifications. Notification is nooit de bron van planningsstatus.

**Reminder ≠ betaling.** Een bezorgde melding zegt niets over of Zakat voldaan is. De
fase-3 regel blijft ongewijzigd: `paid = Σ actieve gekoppelde ZAKAT-donaties`.

**Tijdzones.** `Reminder.timezone` is een IANA-naam, nooit een offset — "UTC+2" klopt
in Brussel maar de helft van het jaar. De lokale wandkloktijd wordt bij elke
occurrence opnieuw naar een UTC-instant opgelost, zodat 09:00 lokaal ook 09:00 lokaal
blijft na de zomer-/wintertijdwissel. DST-randgevallen zijn expliciet beslist:

- **Spring forward** — 02:30 bestaat niet; de herinnering schuift naar 03:00, de rand
  van het gat, niet naar 03:30.
- **Fall back** — 02:30 bestaat twee keer; de vroegste wordt gekozen.

**Clamp-beleid.** Maandelijks op de 31e klapt in februari naar de 28e/29e en keert in
maart terug naar de 31e — de ankerdag blijft bewaard. Jaarlijks op 29 februari klapt
in gewone jaren naar 28 februari. Nooit overslaan, nooit doorrollen.

**At-least-once.** De scheduler mag dezelfde due reminder twee keer aanbieden. Elke
occurrence heeft een deterministische sleutel (`reminder:<id>:<occurrenceISO>`), en de
unique index op `(userId, dedupeKey)` — niet applicatielogica — zorgt dat er precies
één notification ontstaat.

**Hijri.** Conversie gebruikt de rekenkundige Umm al-Qura-kalender uit ICU. Dat is een
technische berekening, geen religieuze bepaling: elke datum draagt het label
*geschat* en een `manualAdjustmentDays`-correctie van maximaal drie dagen.

## 4f. Jaarrapporten

Preview is live; **genereren** bevriest een `AnnualReport`-snapshot met een kopie van
de data plus het gerenderde bestand. Een rapport dat in januari is gedownload leest in
juni nog hetzelfde, ook nadat een goed doel is hernoemd of een donatie is ingetrokken
— dezelfde discipline als de Zakat-berekening en de donatiehistorie.

Valuta blijven gescheiden (fase 3-regel). Het rapport is expliciet **geen** fiscaal
attest, geen officieel donatiebewijs en geen religieuze bevestiging.

## 5. User isolation

Één `Actor` (`src/server/auth/actor.ts`) draagt gebruiker, plan en
huishoudlidmaatschappen. Alle queries lopen via `src/server/auth/scope.ts`:

- **Schrijven** — alleen de eigenaar. Lid zijn van een huishouden geeft nooit
  schrijfrecht op andermans vermogen. Bezit verhuist niet door samen te wonen (§40).
- **Lezen** — de eigenaar, plus leden van een huishouden waarin de rij expliciet is
  getagd. Taggen is een handeling van de eigenaar zelf.
- **Niet-eigenaar krijgt 404, geen 403.** "Dit bestaat maar is niet van jou" bevestigt
  aan een probende partij dat het id echt is.

De proxy (`src/proxy.ts`) verifieert de JWT op de edge en is een snelkoppeling, geen
autorisatie: elke pagina roept `requireActorOrRedirect()` en elke service checkt
opnieuw.

## 6. Entitlements

`src/config/plans.ts` is de enige plek waar staat wat een plan mag.
`src/server/services/entitlements.ts` is de enige plek die dat leest voor een
beslissing. Nergens anders staat `if (plan === 'PLUS')`. Een tier wijzigen is één
bestand aanpassen. Tests bewaken dat de tiers monotoon zijn: een hoger plan mag nooit
minder kunnen.

## 7. Providers

Externe afhankelijkheden zitten achter een interface met een deterministische
fixture-implementatie als default: AI (`mock`), metaalprijzen (`fixture`),
wisselkoersen (`fixture`), opslag (`local`), e-mail (`none`). Een ontbrekende
omgevingsvariabele zet nooit stilzwijgend een betaalde of externe provider aan —
`src/config/env.ts` valideert dat bij het opstarten en de test dekt het af.

## 8. Privacy & beveiliging

- Financiële gegevens zijn standaard privé. Geen enkele charity ziet donorinformatie.
- De logger redigeert bedragen, e-mailadressen en tokens (`src/lib/logger.ts`).
- De audit log bewaart wie/wat/wanneer, geen bedragen — die staan al in de rij zelf.
- API-responses krijgen `Cache-Control: no-store`; CSP, HSTS en frame-deny staan in
  `next.config.ts`.
- Rate limiting op auth, schrijfacties en AI (`src/server/http/rate-limit.ts`,
  in-process — Redis pas nodig bij meerdere instances).
- Bewijsstukken gaan naar private storage, nooit naar een publieke bucket. Een
  download passeert drie poorten: geldige sessie, geldig ondertekend token
  (gebonden aan document én gebruiker, tien minuten geldig), en een verse
  eigendomscheck in de database. Het token alleen is bewust niet genoeg.
- Uploads: MIME-allowlist, magic-byte-controle tegen het opgegeven type, maximaal
  8 MB, en een gegenereerde opslagsleutel — de bestandsnaam van de gebruiker raakt
  het bestandssysteem nooit.

## Faseplanning

| Fase | Inhoud                                                                  | Status |
| ---- | ----------------------------------------------------------------------- | ------ |
| 1    | Foundation: schema, auth, isolation, entitlements, dashboard shell, seed | ✅     |
| 2    | Zakat-engine: profiel, onboarding, assets, liabilities, nisab, wizard    | ✅     |
| 3    | Donaties, Zakat-betaling volgen, Sadaqah, bewijsstukken, historie        | ✅     |
| 4    | Charity directory: filters, transparantiescore, favorieten, detailpagina | ✅     |
| 5    | Kalender, herinneringen, jaarrapporten, notificaties                     | ✅     |
| 6    | Huishouden: leden, rollen, gedeeld dashboard                             |        |
| 7    | AI-assistent, kennisbank, uitleg-engine                                  |        |
| 8    | Hardening: PWA, Docker-release, logging, toegankelijkheid, productie     |        |
