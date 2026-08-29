# iRail API — gebruik en pollingstrategie

> Geverifieerd tegen de live API op **2026-08-29**. Alle veldnamen en -types hieronder zijn
> waargenomen in echte responses, niet uit documentatie overgenomen.
> Bron: https://docs.irail.be/ (geraadpleegd 2026-08-29).

## Basis

- Base URL: **`https://api.irail.be/v1`**
- `https://api.irail.be/stations/?...` antwoordt met **HTTP 303** naar `/v1/stations?...`.
  Wij roepen daarom meteen `/v1/` aan en besparen zo een round-trip per request.
- Geen API-key nodig. Open data.
- TLS 1.1+ vereist.

## Fair use — hoe wij ons eraan houden

De policy (docs.irail.be): **3 requests/seconde per bron-IP**, met een burst van 5
(dus 8 requests in 1 seconde, of 15 in 3 seconden). Overschrijding geeft **HTTP 429**.
Zonder identificerende `User-Agent` kan een IP **zonder waarschuwing** geblokkeerd worden; mét
User-Agent nemen de beheerders eerst contact op.

Onze maatregelen, alle geïmplementeerd in `src/lib/irail/client.ts`:

| Maatregel | Implementatie |
|---|---|
| Identificerende User-Agent | `RailClaim/<version> (<APP_URL>; <IRAIL_CONTACT_EMAIL>)` — verplichte env-var, de app weigert te starten zonder. |
| Rate limiting | Client-side token bucket op **2 req/s** met burst 4 — ruim onder de toegestane 3/s. Eén gedeelde bucket per proces. |
| Retry | Exponentiële backoff met jitter, **alleen** op 429/5xx/netwerkfouten, max 3 pogingen. `Retry-After` wordt gerespecteerd als de header aanwezig is. |
| Caching | `stations` wordt **24 u** in-memory gecached (de lijst wijzigt zelden; 714 stations, ~120 KB). ETag/`If-None-Match` wordt meegestuurd waar de API het ondersteunt. |
| Niet agressiever pollen dan nodig | Zie [pollingstrategie](#pollingstrategie) — **2 requests per gemonitorde rit per dag**, niet meer. |
| Geen polling zonder reden | De worker slaat routes over die vandaag niet rijden (`days_of_week`) en gebruikers zonder entitlement. |

## Endpoints die wij gebruiken

### 1. `GET /v1/stations/?format=json&lang=nl`

Volledige stationslijst. Waargenomen: **714 stations**.

```json
{ "id": "BE.NMBS.008892007", "name": "Gent-Sint-Pieters",
  "locationX": "3.710675", "locationY": "51.035896",
  "standardname": "Gent-Sint-Pieters" }
```

- `id` is de stabiele identifier die wij opslaan in `commute_routes.departure_station_id` /
  `arrival_station_id`. **Nooit vrije tekst.**
- `name` is taalafhankelijk (`lang`), `standardname` is de tweetalige officiële naam
  (bv. `Brussel-Zuid/Bruxelles-Midi`). De autocomplete zoekt op beide.

### 2. `GET /v1/connections/?from=<id>&to=<id>&date=DDMMYY&time=HHMM&timesel=departure`

Bepaalt **welke concrete trein** bij de opgegeven vertrektijd van de gebruiker hoort.

Response per connection: `id, departure, arrival, duration, remarks, alerts` (+ `vias` bij overstap).

```json
"departure": { "delay": "0", "time": "1787976180",
               "vehicle": "BE.NMBS.IC527",
               "vehicleinfo": { "shortname": "IC 527", "number": "527", "type": "IC" },
               "platform": "7", "canceled": "0", "left": "0" }
"arrival":   { "delay": "-60", "time": "1787977860", "canceled": "0", "arrived": "0" }
```

### 3. `GET /v1/vehicle/?id=BE.NMBS.IC527&date=DDMMYY`

**Dit is onze bron voor de aankomstvertraging.** Geeft alle stops van de trein met per stop:

```
id, station, stationinfo, time, platform, scheduledDepartureTime, scheduledArrivalTime,
delay, canceled, departureDelay, departureCanceled, arrivalDelay, arrivalCanceled,
left, arrived, isExtraStop, occupancy
```

Wij lezen bij de stop waarvan `stationinfo.id === arrival_station_id`:
**`arrivalDelay`** en **`arrivalCanceled`**. Dat is exact de grootheid die NMBS hanteert
(verschil geplande vs. werkelijke aankomst — zie `nmbs-regels.md` §1).

### 4. `GET /v1/liveboard/?id=<id>` — *niet gebruikt in de detectiepijplijn*

Enkel voor de "meld handmatig een rit aan"-flow, om de gebruiker te helpen de juiste trein te
kiezen. Niet nodig voor monitoring.

## Valstrikken die wij expliciet afhandelen

Deze zijn allemaal waargenomen in echte responses en afgedekt met unit tests:

1. **Alle waarden zijn strings.** `"delay": "0"`, `"canceled": "0"`. Nooit direct als getal of
   boolean behandelen. Geparsed via Zod-schema's met coercion in `src/lib/irail/schemas.ts`.
2. **`delay` is in SECONDEN, niet in minuten.** Waargenomen `"-60"` = één minuut te vroeg.
   Dit is de meest kostbare denkfout in dit domein: 60 seconden vertraging zou anders als
   60 minuten gelezen worden en meteen een 100 %-claim genereren. Conversie gebeurt op één
   plaats: `secondsToDelayMinutes()`, met tests op precies dit geval.
3. **`delay` kan negatief zijn** (trein rijdt voor op schema). Voor compensatie clampen wij op 0.
4. **Tijden zijn Unix-timestamps in seconden, als string.** Wij converteren naar `Date` en
   presenteren altijd in **Europe/Brussels** (zie [Tijdzone](#tijdzone)).
5. **`canceled` bestaat op drie niveaus**: connection-breed (`departure.canceled`), en per stop
   (`arrivalCanceled`, `departureCanceled`). Voor een afgeschafte aankomst kijken wij naar
   `arrivalCanceled` op de bestemmingsstop.
6. **Overstappen zitten in `vias`.** `vias.via[i].departure.vehicleinfo` is de trein van de leg
   **ná** die via. De trein die op de eindbestemming aankomt is dus de `departure.vehicle` van de
   **laatste** via — of de top-level `departure.vehicle` als er geen vias zijn. Dit bepaalt welke
   `vehicle`-call wij doen. Geïmplementeerd in `resolveFinalLegVehicle()`.
7. **`isExtraStop`** komt voor; extra stops veranderen de aankomstvertraging niet maar mogen de
   stop-matching niet in de war sturen — wij matchen op `stationinfo.id`, niet op index.
8. **Stationsnamen zijn taalafhankelijk**, ID's niet. Matchen gebeurt uitsluitend op ID.

## Pollingstrategie

Doel: betrouwbaar meten met een **minimaal** aantal requests.

Per actieve route, alleen op de dagen in `days_of_week`, en alleen voor gebruikers met entitlement:

| Stap | Wanneer | Requests | Doel |
|---|---|---|---|
| **A. Trip-resolutie** | 's ochtends, ± 60 min vóór `preferred_departure_time` | 1 × `connections` | Bepaalt de concrete trein van vandaag (treinnummer, geplande vertrek- en aankomsttijd) en legt `monitored_trips` aan. |
| **B. Uitkomstmeting** | 20 min ná de geplande aankomst (marge voor grote vertragingen: herhaald tot max. 3 u ná planning, met oplopende interval, zolang `arrived === "0"`) | 1–3 × `vehicle` | Leest `arrivalDelay` / `arrivalCanceled` op de bestemmingsstop en sluit de rit af. |

**Kosten:** in het normale geval **2 requests per rit per dag**. Bij 1 000 actieve routes is dat
~2 000 requests over een werkdag — verspreid door de scheduler over de spitsvensters komt dat neer
op ruim onder 1 request/seconde gemiddeld, met de token bucket als harde bovengrens.

**Waarom niet continu pollen?** Voor compensatie telt uitsluitend de *eindtoestand* van de rit
(aankomstvertraging). Live volgen tijdens de rit voegt niets toe aan het dossier en zou het
requestvolume vertienvoudigen. Wij pollen dus pas ná de geplande aankomst.

**Afsluitregel.** Een rit wordt definitief afgesloten zodra `arrived === "1"` op de bestemmingsstop,
of uiterlijk 3 uur na de geplande aankomst. Blijft de rit onbeslist, dan wordt hij gemarkeerd als
`INCONCLUSIVE` en ontstaat er **geen** claim — wij dienen nooit een dossier in op onvolledige data.

### Tijdzone

iRail werkt met Unix-timestamps; de dienstregeling is Belgisch. Alle datumlogica (welke dag van de
week, `service_date`, `DDMMYY`-parameters) gebeurt in **`Europe/Brussels`** via `@date-fns/tz`.
Nooit in server-lokale tijd of UTC — anders schuift bij zomertijd de dagindeling en mist de worker
ritten rond middernacht. `service_date` is de Brusselse kalenderdag van het **geplande vertrek**.

## Foutafhandeling

| Situatie | Gedrag |
|---|---|
| HTTP 429 | Backoff volgens `Retry-After`, anders exponentieel; rit wordt in de volgende cyclus opnieuw geprobeerd. |
| HTTP 5xx / netwerk | Max 3 pogingen met jitter, daarna rit markeren voor hercontrole. |
| Trein niet gevonden op `vehicle` | Rit `INCONCLUSIVE`, geen claim. Gelogd met route-id voor onderzoek. |
| Bestemmingsstop ontbreekt in de stops | Rit `INCONCLUSIVE`, geen claim. Kan optreden bij omleidingen. |
| Response valideert niet tegen Zod-schema | Harde fout, gelogd met het ruwe payload-fragment; geen claim. Wij raden nooit naar ontbrekende velden. |

Elke geslaagde meting bewaart de ruwe response in `monitored_trips.irail_snapshot` (JSONB). Dat is
het bewijsmateriaal onder het dossier: als NMBS de vertraging betwist, kunnen wij exact tonen wat de
open data op dat moment zei.

## Attributie

iRail is een project van iRail vzw / Open Knowledge Belgium, gevoed door NMBS-open data. De
applicatie vermeldt dit in de footer en op de "over"-pagina. RailClaim is **niet** verbonden aan of
goedgekeurd door NMBS/SNCB — dat wordt expliciet vermeld (zie `docs/decisions/0001-indieningskanaal.md`).
