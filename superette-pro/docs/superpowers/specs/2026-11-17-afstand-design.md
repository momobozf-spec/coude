# Ontwerp: afstand tot de supermarkt

Datum: 17 november 2026. Status: uitgevoerd in deze sessie, zonder
tussentijdse goedkeuring (de opdracht was "werk verder aan de Superette-app").
Elke keuze hieronder is een keuze van de bouwer; corrigeer wat niet klopt.

## Waarom

De app heeft al een postcodeveld en een "maximale reisafstand" in de
voorkeuren, en de documentatie belooft "sorteren op afstand". Geen van die
drie doet iets: `docs/COMPARE.md` noemt het als open punt (§7, §11, §15), de
mandje-optimizer krijgt altijd `distanceKm: null`. Een knop die niets doet is
erger dan geen knop. Dit ontwerp maakt afstand echt, zonder externe dienst,
zonder locatietoestemming en zonder nieuwe gegevens over de gebruiker.

## Doelen

- Met alleen een postcode (account of bezoeker) weet de app hoe ver elke
  supermarkt is en kan ze daarop sorteren en filteren.
- Mandjevergelijking respecteert de maximale reisafstand.
- Alles blijft uitlegbaar: "hemelsbreed, vanaf het midden van postcode 3870".

## Niet-doelen

- Geen GPS/geolocatie-API, geen routeafstand, geen externe geocoder.
- Geen bezorgkosten of reiskosten in euro.
- Geen adresinvoer: postcode is genoeg en is al wat we bewaren.

## Anti-doelen

- Ketens zonder gekende filialen mogen nooit uit de resultaten verdwijnen:
  onbekende afstand is "onbekend", niet "ver".
- Geen extra persoonsgegevens; de postcode stond al in de voorkeuren en in
  de privacyverklaring.

## Benaderingen

1. **Postcode-centroïde + hemelsbrede afstand (gekozen).** Een ingebakken
   tabel postcode → coördinaat (bpost-lijst met OpenStreetMap-coördinaten,
   ~1 150 postcodes, ~35 kB). Haversine naar het dichtstbijzijnde filiaal met
   coördinaten. Geen netwerk, deterministisch, testbaar, nauwkeurig tot op
   enkele kilometer. Past bij "geen AI, geen magie".
2. Externe geocoder (Nominatim/Google) per adres. Nauwkeuriger, maar een
   verwerker erbij, netwerk in het verzoekpad, rate limits, en een adres dat
   we niet willen bewaren. Afgewezen.
3. Locatie van de browser (Geolocation API). Nauwkeuriger, maar een
   toestemmingsprompt, geen waarde voor de server-side mandjevergelijking, en
   een nieuw gegeven. Kan later bovenop 1 (coördinaat i.p.v. postcode).

## De beslissingen

- **Bron.** `apps/api/src/compare/geo/belgian-postal-codes.ts` is gegenereerd
  door `apps/api/scripts/geo/generate-postal-codes.mjs` uit de lijst van
  jief/zipcode-belgium (postcodes van bpost, coördinaten uit OpenStreetMap,
  © OpenStreetMap-bijdragers, ODbL). Per postcode het rekenkundig midden van
  de deelgemeenten. Vermelding op `/over-de-gegevens` (nl/fr/en).
- **Afstand.** Hemelsbreed (haversine), afgerond op 0,1 km. Per keten: het
  dichtstbijzijnde actieve filiaal met coördinaten. Een aanbod dat aan een
  filiaal hangt: dat filiaal. Geen filiaal met coördinaten → `null`.
- **API (additief, geen breaking changes).**
  - `GET /compare/chains?postalCode=2000` → per keten `distanceKm` en
    `nearestLocation` (ref) als een postcode meegaat, anders `null`.
  - `GET /compare/search` en `GET /compare/products/:id` krijgen optioneel
    `postalCode` en `maxDistanceKm`; elk aanbod krijgt `distanceKm`
    (`null` als onbekend). `maxDistanceKm` laat aanbiedingen verder weg
    weg (onbekend blijft). Nieuwe sortering `DISTANCE`: dichtstbij eerst,
    dan eenheidsprijs; zonder postcode gedraagt `DISTANCE` zich als
    `UNIT_PRICE`.
  - Mandje: `distanceKm` komt uit de postcode van de voorkeuren;
    `StoreBasketResult.distanceKm` wordt zichtbaar. Ligt geen enkele winkel
    binnen de grens, dan wordt de grens losgelaten en staat dat als eerste
    regel in de uitleg (een lege combinatie helpt niemand).
- **App.**
  - Zoeken: sorteeroptie "Dichtstbij"; zonder postcode staat ze uit met de
    hint "Vul je postcode in bij voorkeuren". Postcode en maximale
    reisafstand uit de voorkeuren (account of bezoeker) gaan mee.
  - Prijsregels tonen "· 3,2 km" bij de keten als de afstand bekend is.
  - Startpagina: afstand bij elke supermarkt als er een postcode is.
  - Voorkeuren: de hint "werkt zodra…" wordt een uitleg van wat het doet.
- **Documentatie.** COMPARE.md (§7/§11/§15 en "Bekende beperkingen"),
  PRIVACY.md (postcode wordt alleen omgezet naar een punt), bronvermelding.

## Bijvangst

- Een `.env` die letterlijk uit `.env.example` komt (`COOKIE_SECURE=` en
  `HSTS_ENABLED=` leeg) werd door de validatie geweigerd; lege waarden gelden
  nu als "niet gezet", met test.
- `npm run dev:db` stond in de README maar niet in `package.json`; toegevoegd.

## Aan de bouwer gelaten

- Hoe de postcodetabel compact wordt opgeslagen (array van tuples).
- Of de ketenafstanden per verzoek berekend of kort gecachet worden (de
  tabel met filialen is klein; per verzoek is prima).
