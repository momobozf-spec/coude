# `src/domain/` — de rekenlaag

Pure functies. Geen database, geen netwerk, geen Next. ESLint dwingt dat af via
een import-restrictie in `eslint.config.mjs`.

De reden staat in `municipality/submission-policy.ts`: de vraag "mag dit dossier
met iemands identiteitskaart de deur uit" moet los te testen zijn, zonder
database en zonder mockserver. Zodra deze laag Prisma mag aanraken, verhuist die
beslissing ongemerkt naar de services en is ze niet meer te bewijzen.

Data komt binnen als argument. Resultaten gaan terug als waarde.

## Indeling

| Map | Pijler | Status |
|---|---|---|
| `municipality/` | 3 — bewonerskaart | in gebruik |
| `residentcard/` | 3 — bewonerskaart | komt in fase 2–3 (validatieregels, dossierlogica) |
| `alerts/` | 1 — live alerts | gereserveerd, nog leeg |
| `appeals/` | 2 — boete aanvechten | gereserveerd, nog leeg |

De mappen voor pijler 1 en 2 staan er bewust vóór er code in zit. Ze maken bij
het lezen van de repository meteen duidelijk dat dit platform drie pijlers heeft
en waar de volgende hoort te landen — in plaats van dat iemand later een plek
moet verzinnen en de gedeelde lagen alsnog moet openbreken.
