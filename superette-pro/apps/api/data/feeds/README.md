# Importbestanden per supermarktketen

Leg hier per keten een bestand `<adapterkey>.json` of `<adapterkey>.csv` neer
(bv. `delhaize.json`, `lidl.csv`). De adapter leest het bij elke
synchronisatie. Zonder bestand gebruikt de adapter buiten productie
**demogegevens** (`source = DEMO`), in productie niets.

Adaptersleutels: `delhaize`, `lidl`, `colruyt`, `spar`, `albert-heijn`, `jumbo`, `carrefour`, `aldi`.

De map kan verplaatst worden met `COMPARE_FEED_DIR` (relatief aan `apps/api`).

## JSON-formaat (versie 1)

Zie `example.json` in deze map. Validatie: `apps/api/src/compare/adapters/feed-schema.ts`.

Belangrijke regels:

- bedragen in **centen** (`priceCents: 179` = €1,79), nooit floats;
- `priceCents` is wat je vandaag voor **één** verpakking betaalt, zonder statiegeld, met
  onvoorwaardelijke promoties (vaste promoprijs, −30 %) al verrekend; zet dan `originalPriceCents`;
- voorwaardelijke promoties ("2 voor €5", "1+1 gratis") staan in `promotionRule`; `priceCents`
  is dan de gewone prijs;
- `sourceReference` is per keten uniek en stabiel over imports heen (bv. `"<sku>:regular"`);
- `source.termsReviewed: true` is een verklaring dat de gebruiksvoorwaarden, robots-regels,
  databankrechten en rate limits van de oorspronkelijke bron zijn nagekeken. Dat is een
  menselijke, juridische beslissing van de uitbater: laat het op `false` (status UNVERIFIED)
  tot die beoordeling er is. Een CSV-bestand erft de declaratie van de adapter (standaard `false`);
- datums in ISO-8601 met tijdzone (`2026-10-04T08:00:00+02:00`).

## Naar productie: `npm run feeds:push`

De productieserver heeft geen blijvende schijf. Na een scrape- of importrun op de laptop:

```bash
PUSH_API_URL=https://api.<domein>/api/v1 PUSH_JOB_KEY=<COMPARE_JOB_KEY van de server> npm run feeds:push
npm run feeds:push -- --dry-run          # alleen lokaal valideren
npm run feeds:push -- delhaize aldi      # alleen deze ketens
```

Elke `<adapterkey>.json` wordt lokaal gevalideerd met hetzelfde schema, gzip-gecomprimeerd en
naar `POST /api/v1/compare/internal/feeds/:chain` gestuurd (header `x-job-key`). De API bewaart de
feed in de database (`CompareFeed`) en synchroniseert die keten; daarna leest ook de dagelijkse
`compare:sync` hem. Zijn er zowel een bestand als een opgeslagen feed, dan wint de jongste
`observedAt`. Alleen `.json` wordt verstuurd, geen `.csv`.

## CSV-formaat

Eén rij per aanbieding, productvelden herhaald. Kolommen (volgorde vrij):

```
productExternalId,name,brand,barcode,packageQuantity,packageUnit,packCount,categorySlug,imageUrl,productUrl,
locationExternalId,sourceReference,priceCents,originalPriceCents,promotionType,promotionText,promotionRule,
conditions,requiresLoyaltyCard,isPersonalized,channel,minimumQuantity,depositCents,availability,startsAt,endsAt,observedAt
```

`promotionRule` is JSON in één cel, bv. `{"kind":"MULTIBUY","quantity":2,"totalCents":500}`.
Scheidingsteken `,` of `;`; aanhalingstekens volgens RFC 4180.

## Wat deze bestanden niet zijn

Geen scrape-uitvoer. Een importbestand mag alleen gegevens bevatten waarvoor
toestemming bestaat: een officiële API, een gelicentieerde feed, gegevens van een
deelnemende handelaar, of handmatig overgenomen prijzen uit een toegestane bron.
