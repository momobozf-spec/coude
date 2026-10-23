# Ritna — taximarktplaats

Klanten boeken een rit, erkende taxibedrijven voeren hem uit, Ritna verdient commissie per uitgevoerde rit.

## Status

**Fase 1 — kern + API: klaar en getest (45/45 tests groen).**
De mijlpaal "klant boekt → vervoerder aanvaardt → chauffeur voert uit → commissie correct verwerkt → uitbetaling" draait volledig tegen echte PostgreSQL.

| Onderdeel | Status |
|---|---|
| `packages/core` — ritstatus, vaste prijs, commissie, annulering, dienstgebied | ✅ 22 unit tests |
| `apps/api` — API voor klant, chauffeur, taxibedrijf, platformbeheer | ✅ 23 end-to-end tests |
| Webversie voor klant, taxibedrijf, chauffeur en beheer (`apps/api/web`, zelfde poort als de API) | ✅ lokaal testbaar |
| Webdashboard taxibedrijf + beheeromgeving (Next.js) | ⏭ fase 2 |
| Klantenapp + chauffeursapp (React Native/Expo) | ⏭ fase 3 |

## Wat de API al doet

**Klant:** registreren, zoeken (vervoerders met vaste prijs, rating, annuleringsvoorwaarden), boeken bij gekozen vervoerder of open aanvraag, rit volgen met tijdlijn, annuleren, beoordelen, favorieten, incident melden. Talen NL/FR/EN voor statuslabels.

**Taxibedrijf:** aanmelden (KBO-check), profiel en voorwaarden, tarieven per categorie, voertuigen, chauffeurs, documenten indienen, aanvragen aanvaarden/weigeren, chauffeur toewijzen/wisselen, annuleren, ritoverzicht, verdiensten en uitbetalingen.

**Chauffeur:** beschikbaarheid, voertuig kiezen, toegewezen ritten, aanvragen aanvaarden namens bedrijf (indien toegestaan), status onderweg → aangekomen → gestart → voltooid, no-show na wachttijd, historiek.

**Platformbeheer:** documenten goedkeuren, vervoerders/chauffeurs activeren (alleen met geldige documenten), schorsen, commissie per vervoerder, aandachtslijst (bijna verlopen aanvragen, ritten zonder chauffeur, incidenten, vervallende documenten), cijfers uit het grootboek, rit-detail met betaling en boekingen, uitbetalingsrun.

## Spelregels in de code

- Een aanvraag is **geen** boeking. Bevestigd = vervoerder heeft aanvaard (`confirmed: true`).
- Gekozen vervoerder weigert of reageert niet → klant krijgt alternatieven, nooit stille vervanging.
- Open aanvraag → goedkoopste vervoerder eerst, dan de volgende; klant betaalt de prijs van wie aanvaardt, nooit boven het aanvaarde maximum.
- Betaling: autoriseren bij boeken, capturen bij voltooien, vrijgeven bij weigering/annulering. Mislukte betaling = geen rit.
- Grootboek per rit: `customer_charge = platform_commission + commission_vat + operator_payable` (getest).
- Bedragen altijd in centen, percentages in basispunten.
- Elke statuswijziging staat in `ride_events` (audit trail).

## Lokaal draaien

Vereist Node 20+ en PostgreSQL 14+.

```bash
npm install
export DATABASE_URL="postgres://USER@localhost:5432/ritna_dev"
export JWT_SECRET="minstens-32-tekens-willekeurige-string"
export SEED_PASSWORD="kies-een-demowachtwoord"
npm run db:migrate
npm run db:seed          # demo: admin@, taxi@, chauffeur@, klant@ritna.local
npm run build -w @ritna/core
npm run dev:api          # http://localhost:3000 (webversie) en /health

# tests (aparte database, wordt leeggemaakt!)
export TEST_DATABASE_URL="postgres://USER@localhost:5432/ritna_test"
npm test
```

## Vóór de eerste echte rit

De server weigert te starten met `NODE_ENV=production` zolang deze twee nog dev-adapters zijn:

1. **Betaalprovider** — `FakePaymentProvider` vervangen door Stripe Connect of Mollie Connect (marktplaatsbetalingen met uitbetaling naar vervoerders). Interface staat klaar in `apps/api/src/adapters.ts`.
2. **Routering** — `StraightLineRouting` (hemelsbreed × 1,35) vervangen door een echte routeringsdienst; de vaste prijs hangt ervan af.

Verder buiten de code:
- Erkenning als bemiddelaar voor taxireservaties in Brussel.
- BTW-tarieven (`COMMISSION_VAT_BPS`, standaard 2100) en facturatieflow laten bevestigen door je boekhouder.
- Algemene voorwaarden klant + partnercontract vervoerder (wie is vervoerder, wie factureert, aansprakelijkheid).
- Privacyverklaring (locatie- en persoonsgegevens).

Demo-tarieven in de seed zijn testwaarden, geen markttarieven.

## Structuur

```
packages/core     domeinlogica zonder I/O
apps/api          Fastify + PostgreSQL
  migrations/     SQL-migraties
  src/services/   rides, operators, admin, accounts
  src/adapters.ts betalingen, routering, notificaties
  src/e2e.test.ts mijlpaal-test
```
