# Importbestanden per supermarktketen

Leg hier per keten een bestand `<adapterkey>.json` of `<adapterkey>.csv` neer
(bv. `delhaize.json`, `lidl.csv`). De adapter leest het bij elke
synchronisatie. Zonder bestand gebruikt de adapter buiten productie
**demogegevens** (`source = DEMO`), in productie niets.

Adaptersleutels: `delhaize`, `lidl`, `colruyt`, `spar`, `albert-heijn`, `jumbo`, `carrefour`.

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
  databankrechten en rate limits van de oorspronkelijke bron zijn nagekeken;
- datums in ISO-8601 met tijdzone (`2026-10-04T08:00:00+02:00`).

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
