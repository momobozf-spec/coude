# Monitoring en logging

## Logs

De API logt JSON (`LOG_FORMAT=json`, standaard in productie), één object per
regel, naar stdout. De container-runtime of de hostingprovider verzamelt ze.

Vaste velden: `time`, `level` (`debug|info|warn|error|fatal`), `service`
(`superette-api`), `env`, `version` (`APP_VERSION`), `context` (Nest-klasse) en
`message`. HTTP-regels (`type: "http"`) dragen `method`, `path`, `status`,
`durationMs`, `requestId` en `userId` (als ingelogd). Geen query-strings, geen
headers, geen body's, geen e-mailadressen, geen IP-adressen.

Redactie (`StructuredLogger.redact`, unit-getest): Bearer-tokens, JWT's,
velden `password|secret|token|refresh|api-key|job-key|authorization|cookie`,
Postgres-URL's en `x-job-key`-headers worden `[redacted]`, ook wanneer ze in
een foutboodschap of stacktrace terechtkomen.

Request-id: elke response draagt `x-request-id`; een client mag er zelf een
meegeven (alfanumeriek, ≤ 64 tekens), anders wordt een UUID gemaakt. Elke
foutrespons bevat hetzelfde id, zodat een gebruikersmelding aan een logregel
te koppelen is.

## Health-endpoints

| Endpoint | Doel | Antwoord |
|---|---|---|
| `GET /api/v1/health/live` | proces leeft (container-healthcheck) | `200 {status:"ok"}` |
| `GET /api/v1/health/ready` | klaar voor verkeer (load balancer) | `200` of `503` als `SELECT 1` niet binnen 2 s lukt |
| `GET /api/v1/health/status` | operationele status (met `x-job-key`) | versie, omgeving, uptime, demo-stand, sync-lease, laatste import per adapter (status, bron, `termsReviewed`, tijdstippen, tellingen), laatste alertcontrole, meldingen (pending, mislukt 24 u, verstuurd 24 u) |

Health-checks met status 200 worden niet gelogd (ruis); een 503 wel.

## Foutmonitoring

Met `ERROR_REPORTING_DSN` gezet (`https://<publieke sleutel>@<host>/<project>`)
stuurt de API elke `error`- en `fatal`-logregel als Sentry-envelope (protocol
v7) naar de provider: Sentry, GlitchTip, Bugsink of een self-hosted
instantie. Implementatie: `apps/api/src/common/error-reporter.ts`, gekoppeld
aan de `StructuredLogger` in `main.ts`; geen SDK, geen automatische
instrumentatie.

Wat er vertrekt: fouttype, boodschap en stacktrace (allebei door dezelfde
redactie als de logs), `logger` (Nest-context), omgeving, release
(`superette-api@APP_VERSION`), hostnaam en de tag `requestId`. Wat er **niet**
vertrekt: request-body's, headers, cookies, e-mailadressen, IP-adressen,
gebruikers-id's. Best effort: time-out 5 s, hoogstens 30 events per minuut,
een onbereikbare provider wordt één keer per minuut als `warn` gelogd en
vertraagt de API nooit. Zonder DSN blijven fouten alleen in de logs.

Testen na configuratie: `POST /api/v1/health/test-error` met `x-job-key`
(server-side, 3/min) gooit een opzettelijke fout; de client krijgt de gewone
generieke 500 met request-id en het event moet binnen enkele seconden bij de
provider staan met dezelfde `requestId`-tag. Geoefend tegen een lokale
envelope-ontvanger (zie `STAGING-EVIDENCE.md`); een echte provider vereist
een account en DSN.

## Alarmdefinities

Richtwaarden; stel ze in op de log-/metricsprovider.

| Alarm | Voorwaarde | Ernst | Eerste actie (RUNBOOK) |
|---|---|---|---|
| API down | `/health/live` faalt 3× binnen 1 min | kritiek | "API antwoordt niet" |
| Database | `/health/ready` 503 ≥ 2 min | kritiek | idem |
| Foutpercentage | status ≥ 500 > 1 % van de requests over 5 min | hoog | logs op `requestId`, rollback overwegen |
| Latency | p95 `durationMs` > 1 500 ms over 10 min op `/compare/search` | middel | database-load, indexen, N+1 |
| Rate limiting | 429 > 5 % over 10 min | middel | `TRUST_PROXY`, echte piek? |
| Synchronisatie oud | geen adapter met `lastRun.finishedAt` < 25 u | hoog | werker/cron |
| Lease hangt | `sync.lease.active` > 30 min | middel | gecrashte houder |
| Import deels | adapter `PARTIAL`/`FAILED` 2 runs op rij | middel | importbestand |
| Prijzen oud | `/compare/chains` toont `STALE` voor een live keten | middel | synchronisatie |
| Alerts niet gecontroleerd | `alerts.lastCheckedAt` > 2 u na een import | hoog | dispatcher/werker |
| Meldingen falen | `notifications.failed24h` > 0 of `pending` > 1 000 | middel | e-mailprovider |
| Jobsleutel | > 10 `intern endpoint geweigerd` per uur | hoog | sleutel roteren |
| CSRF/sessie | > 50 `CSRF_REJECTED` of `SESSION_REUSE` per uur | middel | onderzoeken |
| Certificaat | TLS verloopt < 14 dagen | hoog | proxy/provider |
| Schijf/DB | opslag > 80 %, verbindingen > 80 % van `max_connections` | hoog | opschalen, pool |

## Metrieken (aanbevolen, niet ingebouwd)

Uit de logs af te leiden: requests per route en status, p50/p95/p99 van
`durationMs`, 429-aandeel, synchronisatieduur (`sync klaar in … ms`),
aantallen per import. Een `/metrics`-endpoint (Prometheus) is niet aanwezig;
voeg het toe achter de jobsleutel als de provider het verwacht.

## Belastingstest

`node scripts/loadtest.mjs` (zie `PRODUCTION-READINESS.md` voor de meting):
rapporteert aantal, foutpercentage, 429's, mediaan, p95, p99 per endpoint.
Draai hem tegen staging met realistische data, nooit tegen productie zonder
afspraak.
