# Rollback-scripts

Prisma kent geen automatische "down"-migraties. Deze scripts zijn gegenereerd
met `prisma migrate diff` (van het nieuwe naar het oude schema) en draaien
een migratie handmatig terug. **Ze verwijderen tabellen en dus gegevens.**
Gebruik ze alleen na een backup en alleen als een deployment echt terug moet.

| Script | Draait terug | Verliest |
|---|---|---|
| `20261024120000_compare_feed_push.down.sql` | tabel `CompareFeed` (aangeleverde feeds) | de laatst gepushte feed per keten; geïmporteerde prijzen blijven |
| `20261004210000_sessies_privacy_jobs.down.sql` | sessies, jobleases, `emailNotifications`, `termsReviewed`, enumwaarde `PARTNER_FEED`* | alle ingelogde sessies (gebruikers loggen opnieuw in), e-mailvoorkeur |
| `20261004180000_supermarktvergelijker.down.sql` | de hele vergelijker | lijsten, alerts, meldingen, prijzen, geschiedenis, matches |

\* Het script bouwt de enum opnieuw zonder `PARTNER_FEED`. Dat faalt als een
rij die waarde al gebruikt; zet zulke rijen dan eerst op `MERCHANT_FEED`.

Procedure:

```bash
# 1. backup (zie docs/DATABASE.md)
# 2. applicatie stoppen of in onderhoudsmodus zetten
cd apps/api
npx prisma db execute --url "$DATABASE_URL" --file prisma/rollback/<script>.down.sql
# 3. de migratie uit de migratietabel halen (`migrate resolve --rolled-back`
#    werkt alleen voor een migratie die MISLUKT is; een geslaagde migratie
#    terugdraaien = down-script + rij verwijderen)
echo "DELETE FROM \"_prisma_migrations\" WHERE migration_name = '<migratienaam>';" \
  | npx prisma db execute --url "$DATABASE_URL" --stdin
npx prisma migrate status   # toont de migratie nu als "not yet applied"
# 4. de vorige applicatieversie deployen en /health/ready controleren
```

Geoefend in `apps/api/scripts/migration-test.sh` (stap D): down-script,
rij verwijderen, `migrate deploy` past de migratie opnieuw toe.
