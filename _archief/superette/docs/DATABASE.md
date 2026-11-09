# Database

PostgreSQL via Prisma 6. Lokaal een embedded Postgres (`npm run dev:db`) of
Docker; in staging en productie een **beheerde** PostgreSQL (Neon, Supabase,
Render, RDS, Scaleway …) met automatische back-ups en point-in-time recovery.

## Verbinding

```
DATABASE_URL="postgresql://superette_app:<wachtwoord>@<host>:5432/superette?schema=public&sslmode=require&connection_limit=10&pool_timeout=10&connect_timeout=10"
```

| Parameter | Waarde | Waarom |
|---|---|---|
| `sslmode=require` | verplicht buiten localhost | versleutelde verbinding; gebruik `verify-full` + `sslrootcert=` als de provider een CA aanbiedt |
| `connection_limit` | 10 per API-instance, 5 per werker | Prisma's pool; som over alle instances < `max_connections` van de server minus reserve |
| `pool_timeout` | 10 | wachten op een vrije verbinding; daarna een fout in plaats van een hangende request |
| `connect_timeout` | 10 | opstartfout snel zichtbaar in `/health/ready` |

Met een externe pooler (PgBouncer, Neon pooler, Supabase pooler) in
**transaction mode**: voeg `pgbouncer=true` toe en zet `connection_limit` laag
(3–5). Migraties draaien **niet** via de pooler maar via de directe URL.

## Gebruikers en rechten

- **Eigenaar / migrator** (`superette_migrator` of het beheerdersaccount van de
  provider): voert `prisma migrate deploy` uit. Alleen in de migratiejob.
- **Runtime** (`superette_app`): alleen `SELECT, INSERT, UPDATE, DELETE` op
  `public`, geen DDL, geen rechten op `_prisma_migrations` behalve lezen,
  `statement_timeout 15s`, `idle_in_transaction_session_timeout 30s`,
  `CONNECTION LIMIT 40`. Script: `infra/db/create-runtime-user.sql`.
- Back-upgebruiker: alleen `SELECT` (of de snapshot-functie van de provider).

## Migraties

- Bron van waarheid: `apps/api/prisma/migrations/`. Drie migraties:
  `0_init_jamal_jamila` (boetiek, baseline), `20261004180000_supermarktvergelijker`,
  `20261004210000_sessies_privacy_jobs`.
- **Nooit `prisma db push` tegen staging of productie.** Alleen
  `npm run db:migrate:deploy` (= `prisma migrate deploy`), in de migratiejob,
  vóór de nieuwe applicatieversie start.
- Status: `npm run db:migrate:status`.
- Een bestaande boetiekdatabase van vóór de vergelijker: eerst
  `prisma migrate resolve --applied 0_init_jamal_jamila`, dan `migrate deploy`
  (geoefend in `apps/api/scripts/migration-test.sh`, stap C).
- Driftcontrole (CI): `prisma migrate diff --from-migrations … --to-schema-datamodel … --exit-code`.

### Getest (4 oktober 2026, lokaal, Postgres 18.4)

| Scenario | Resultaat |
|---|---|
| A. drift migraties ↔ schema | geen verschil |
| B. lege database → `migrate deploy` → demo-seed | 3 migraties toegepast; 7 ketens, 62 catalogusproducten, 209 historierijen |
| C. database met boetiekdata (1 gebruiker, 8 producten, 1 bestelling, 1 kasbon, 2 toestemmingen) → `migrate deploy` | boetiekrijen identiek vóór/ná, kasbon-snapshot intact |
| D. rollback laatste migratie (down-script + rij verwijderen) → `migrate deploy` | sessietabel weg en terug; boetiek- en vergelijkerdata ongewijzigd; status "up to date" |

Script: `DATABASE_ADMIN_URL=… bash apps/api/scripts/migration-test.sh`.

## Rollback van een migratie

Zie `apps/api/prisma/rollback/README.md`. Kort: back-up → applicatie stoppen →
down-script uitvoeren → rij uit `_prisma_migrations` verwijderen → vorige
applicatieversie. `prisma migrate resolve --rolled-back` is alleen voor een
migratie die **mislukt** is.

## Back-up en herstel

- **Provider-snapshots** dagelijks + PITR (minstens 7 dagen) als basis.
- **Logische back-up** vóór elke migratie en wekelijks extern:
  ```bash
  pg_dump "$DATABASE_ADMIN_URL" --format=custom --no-owner --no-privileges \
    --file "superette-$(date +%F).dump"
  ```
- **Herstel** in een lege database:
  ```bash
  createdb superette_restore
  pg_restore --dbname "postgresql://…/superette_restore" --no-owner --no-privileges superette-2026-10-04.dump
  ```
  Daarna `DATABASE_URL` wisselen of de inhoud terugzetten. Oefen dit per
  kwartaal op staging en noteer de duur (zie `RUNBOOK.md`).
- Controle na herstel: rijtellingen van `User`, `Order`, `Receipt`,
  `StoreChain`, `CatalogProduct`, `ProductOffer`, `PriceAlert`,
  `AlertNotification`, `Session` vergelijken met de bron; `/health/ready` → 200.
- **Oefening geautomatiseerd**: `apps/api/scripts/backup-drill.sh` maakt een
  dump, herstelt in een lege database, vergelijkt rijtellingen per tabel en
  md5-sommen over gebruikers en aanbiedingen, controleert de migratiestatus
  en ruimt op. Geoefend op 5 oktober 2026 tegen de staging-database (PostgreSQL
  18.4, TLS): 35 tabellen, dump 148 kB in 1 s, herstel in 1 s, alle
  controles geslaagd (`docs/STAGING-EVIDENCE.md`).
  ```bash
  PG_BIN=/pad/naar/pgsql/bin DATABASE_ADMIN_URL="postgresql://eigenaar:…@host:5432/superette?sslmode=require" \
    bash apps/api/scripts/backup-drill.sh ./backups
  ```

## Retentie en opruiming

| Gegevens | Bewaartermijn | Mechanisme |
|---|---|---|
| Sessies (`Session`) | verwijderd 30 dagen na verlopen/intrekken | `SessionsService.purge` in elke synchronisatie |
| Prijshistorie | 400 dagen | `ImportService` (bestaand) |
| Meldingen | tot verwijdering door gebruiker/account | – |
| Verwijderde accounts | profiel geanonimiseerd, status `ERASED` | `AccountService.deleteAccount` |
| Kasbonnen / bestellingen (boetiek) | 7 jaar (fiscaal) | blijven aan het geanonimiseerde account hangen |

## Groei en indexen

Aantallen bij 7 ketens × ~5 000 producten: ~35 000 `ProductOffer`, ~1 historie-
rij per aanbod per import (dagelijks → ~13 M/jaar). Partitionering van
`PriceHistory` op maand wordt nodig boven ~50 M rijen; nu volstaan de indexen
op `(offerId, observedAt)`. Volg `pg_stat_user_tables` en de traagste queries
via `pg_stat_statements`.
