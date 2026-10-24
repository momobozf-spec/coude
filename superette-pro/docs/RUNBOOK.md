# Runbook

Voor wie Superette draaiende houdt. Elke sectie: symptoom → controle → actie.
Alle interne endpoints vereisen de header `x-job-key` en weigeren verzoeken met
een `Origin`-header (alleen server-side).

## Dagelijkse controle (2 minuten)

```bash
curl -fsS https://api.superette.be/api/v1/health/ready
curl -fsS -H "x-job-key: $COMPARE_JOB_KEY" https://api.superette.be/api/v1/health/status | jq
```

Kijk naar: `version` (= laatste release), `sync.lease.active` (false buiten een
run), per adapter `lastRun.status` en `finishedAt` (< 25 u oud),
`alerts.lastCheckedAt` (< 2 u na de laatste synchronisatie),
`notifications.failed24h` (0) en `pending` (laag).

## Storingen

### API antwoordt niet / 503 op `/health/ready`

1. `/health/live` 200 maar `/ready` 503 → database onbereikbaar of trager dan
   2 s. Controleer de provider-status, `max_connections`, `pg_stat_activity`.
2. Beide down → container/instance gecrasht. Logs (`LOG_FORMAT=json`): zoek
   `"level":"fatal"` of `Ongeldige omgevingsvariabelen` (env-validatie faalt bij
   het starten; de boodschap noemt de variabele).
3. Herstart één instance; blijft het falen, rol de vorige image uit
   (`DEPLOYMENT.md`, Rollback).

### Veel 429-antwoorden

- Eén IP voor iedereen? Dan staat `TRUST_PROXY` fout of geeft de proxy
  `X-Forwarded-For` niet door. Controleer in de logs of `requestId`-regels van
  verschillende gebruikers hetzelfde IP tonen (IP wordt niet gelogd; test met
  twee clients en kijk of de tweede 429 krijgt).
- Echte piek: limieten staan per route in `SECURITY.md`; verhoog alleen de
  globale limiet (100/min/IP) via code, nooit de login- of jobsleutellimieten.

### Gebruikers worden uitgelogd

- `JWT_SECRET` gewijzigd → alle access-tokens ongeldig; de app vernieuwt stil
  via het refresh-token. Alleen als ook de `Session`-tabel leeg is (rollback van
  migratie `20261004210000`) moet iedereen opnieuw inloggen.
- Cookies komen niet aan: app en API niet op dezelfde site, of `COOKIE_DOMAIN`
  verkeerd. Controleer in de browser: `sup_access` (Path `/api/v1`) en
  `sup_refresh` (Path `/api/v1/auth`) moeten bij de API-host horen.
- Melding `SESSION_REUSE` in de logs: een refresh-token is twee keer gebruikt
  (gestolen cookie of een client met dubbele tabbladen vóór de single-flight
  fix). De sessie is uit veiligheid beëindigd; de gebruiker logt opnieuw in.

### Synchronisatie draait niet of blijft "running"

1. `/health/status` → `sync.lease`: `active: true` met `expiresAt` in de
   toekomst terwijl er geen werker draait → de houder is gecrasht. De lease
   verloopt vanzelf na `COMPARE_SYNC_LEASE_MINUTES` (20). Wachten, of de rij
   `JobLease` met `name = 'compare-sync'` handmatig laten verlopen — **in UTC**,
   want Prisma bewaart tijdstempels zonder tijdzone:
   `UPDATE "JobLease" SET "expiresAt" = (now() at time zone 'utc') WHERE name = 'compare-sync';`
2. `409 SYNC_ALREADY_RUNNING` op een handmatige sync: gewoon, er loopt er een.
3. Een adapter `FAILED`: `lastRun.errorCount` en `note`. Bestand ontbreekt of is
   ongeldig (`COMPARE_FEED_DIR`); de overige ketens zijn wel bijgewerkt.
4. Een run `PARTIAL` met note "deactivatie overgeslagen": meer dan 20 % van de
   aanbiedingen zou verdwijnen; de oude prijzen blijven staan tot een volledig
   bestand binnenkomt. Controleer het importbestand, niet de database.

### Prijzen tonen "mogelijk verouderd" (STALE)

Laatste geslaagde import ouder dan `COMPARE_PRICE_FRESH_HOURS` (48). Werker
of cron uitgevallen → zie hierboven. Handmatig: `POST
/api/v1/compare/internal/sync` met de jobsleutel.

### Meldingen komen niet aan

- In-app: `notifications.pending` groeit → de dispatcher draait niet (werker).
- E-mail: `EMAIL_PROVIDER=none` → bewust uit (`EMAIL_UNAVAILABLE`); gebruiker
  zonder opt-in → `EMAIL_DISABLED_BY_USER`; `failed24h` > 0 → providerfout in de
  logs (`e-mailoverzicht mislukt`, zonder adres). Permanente fouten (4xx)
  worden niet opnieuw geprobeerd; tijdelijke wel bij de volgende run.

### Verdachte activiteit

- Logregels `intern endpoint geweigerd` (jobsleutel fout of browser-signaal)
  met `requestId` en pad: bij herhaling de jobsleutel roteren (`DEPLOYMENT.md`).
- Veel `CSRF_REJECTED`: een site probeert met cookies te posten; de blokkade
  werkt. Controleer of de eigen app niet per ongeluk op een andere origin draait.
- Herhaalde `REAUTH_FAILED` op `DELETE /account`: wachtwoord raden via de
  verwijderroute; 5/min/IP geblokkeerd. Overweeg een IP-blokkade op de proxy.

## Geplande handelingen

### Jobsleutel roteren

1. Nieuwe sleutel genereren.
2. `COMPARE_JOB_KEY_PREVIOUS=<oud>`, `COMPARE_JOB_KEY=<nieuw>`; API herstarten.
3. Cron/werker/monitoring bijwerken naar de nieuwe sleutel.
4. `COMPARE_JOB_KEY_PREVIOUS` leegmaken; herstarten.

### Een keten live zetten

Zie `COMPARE.md`, "Live-criteria": overeenkomst/voorwaarden gecontroleerd
(`termsReviewed: true` in de adapterbron), bronconfiguratie, een geslaagde
import, validatie van een steekproef, verse data. Pas dan toont de app `LIVE`
in plaats van `UNVERIFIED`. Nooit een scraper toevoegen.

### Accountverzoek van een gebruiker (inzage/wissing) zonder de app

Zelfbediening zit in Profiel → Jouw gegevens. Kan de gebruiker niet inloggen:
identiteit vaststellen, daarna `AccountService.export`/`deleteAccount` via een
beheerdersscript (nog te schrijven; noteer het verzoek met datum, 30 dagen
termijn onder de AVG).

### Back-up terugzetten (oefening)

`PG_BIN=… DATABASE_ADMIN_URL=… bash apps/api/scripts/backup-drill.sh ./backups`
(zie `DATABASE.md`). Noteer datum, duur en gevonden problemen hieronder.

| Datum | Omgeving | Duur | Opmerkingen |
|---|---|---|---|
| 2026-10-05 | staging (lokaal, PostgreSQL 18.4, TLS) | dump 1 s, herstel 1 s | 35 tabellen, rijtellingen en md5-sommen identiek, migratiestatus up to date |

### Foutmonitoring testen

`curl -X POST -H "x-job-key: $COMPARE_JOB_KEY" https://api…/api/v1/health/test-error`
geeft een generieke 500 met `requestId`; binnen enkele seconden moet het event
met dezelfde `requestId`-tag bij de provider staan. Komt er niets aan: controleer
`ERROR_REPORTING_DSN` en zoek `foutmonitoring onbereikbaar` in de logs.

## Releaselogboek

| Datum | Versie | Omgeving | Wie | Resultaat |
|---|---|---|---|---|
| – | – | – | – | nog geen deployment |
