# Overdracht — hosting, opslag, scheduler, back-up en herstel

## Componenten
| Onderdeel | Minimum voor de pilot | Opmerking |
|---|---|---|
| App | 1 container/VM met Node ≥ 20.9, ~1 GB RAM | `npm ci && npm run build && npm start` (poort 3000) achter een HTTPS-reverse proxy. Eén instantie volstaat. |
| Database | PostgreSQL ≥ 14 (getest op 16), beheerde instantie met dagelijkse snapshots | Migraties: `npm run db:migrate` bij elke release, vóór de start. |
| Documentopslag | Persistent volume gemount op `STORAGE_DIR` | Bestanden staan op schijf (sha256-namen), niet publiek; downloads enkel via `/api/documents/:id` met autorisatie. Blob-opslag vereist een kleine aanpassing in `src/lib/services/documents.ts`. |
| Scheduler | Cron of containerjob, dagelijks | `npm run ted:import` (incrementeel, idempotent). Optioneel maandelijks bewaartermijnen via Beheer → Regels & gewichten. Er draait geen interne scheduler. |
| E-mail | SMTP-provider met eigen domein (SPF/DKIM) | Optioneel. Voor bevestigde aflevering is later een provider-webhook nodig. |
| Netwerk uitgaand | `api.ted.europa.eu:443` (verplicht voor TED), SMTP-host, `api.anthropic.com` (optioneel) | Documentophaling via URL: willekeurige publieke https-hosts (SSRF-beveiligd). |
| Geheimen | omgevingsvariabelen van het hostingplatform | `BETTER_AUTH_SECRET`, `DATABASE_URL`, `SMTP_PASSWORD`, `ANTHROPIC_API_KEY`. Nooit in de repo. |

Zet in productie `NODE_ENV=production`, `BETTER_AUTH_URL=https://<domein>` en laat `ALLOW_DEMO_DATA` leeg.

## Releaseprocedure
```bash
npm ci
npm run typecheck && npm test        # vereist TEST_DATABASE_URL
npm run build
npm run db:migrate                   # tegen productie-DATABASE_URL
npm start
npm run admin:create -- --email jij@domein.be   # enkel de eerste keer
```

## Back-up
Dagelijks, minimaal 30 dagen bewaren, buiten de hostingomgeving:
```bash
pg_dump --format=custom --no-owner -f tenderkompas-$(date +%F).dump "$DATABASE_URL"
tar -czf storage-$(date +%F).tgz -C "$(dirname "$STORAGE_DIR")" "$(basename "$STORAGE_DIR")"
```
Database en documentmap horen samen: documenten staan in `document.storage_path` (relatief aan `STORAGE_DIR`).

## Herstel (getest op 23-10-2026)
```bash
createdb tenderkompas_restore
pg_restore --no-owner -d postgres://…/tenderkompas_restore tenderkompas-JJJJ-MM-DD.dump
tar -xzf storage-JJJJ-MM-DD.tgz -C /pad/naar/parent-van-STORAGE_DIR
# DATABASE_URL naar de herstelde DB, app starten, steekproef: aanmelden, kans + document openen
```
Test: dump van de ontwikkel-DB hersteld in een lege database; aantallen in procedure, assessment, notice, fact, requirement, email_delivery, audit_log en user identiek; migratietabel aanwezig (3 migraties), zodat `db:migrate` na herstel niets opnieuw uitvoert.

## Zonder AI-sleutel of SMTP
| Werkt volledig handmatig | Niet beschikbaar |
|---|---|
| Opdrachten invoeren, publicaties, percelen, feiten met bronbewijs, voorwaarden, documenten opladen/ophalen met tekstcontrole, samenvatting schrijven, beoordelen, reviewen, publiceren, klantportaal, feedback, digest maken/goedkeuren, **preview en export (HTML/tekst)**, TED-import | AI-extractie (knop uitgeschakeld, nooit gesimuleerde uitvoer) · e-mailverzending (status "niet ingesteld"; testverzending ook niet) |

## Testen buiten de bouwomgeving
- Live TED-controle: `node scripts/ted-live-check.mjs > ted-live-report.json`
- Steekproef 90 dagen: `npm run ted:sample`
- HTTP-isolatiecheck tegen een draaiende app (enkel lokaal/test): `ALLOW_DEMO_DATA=true CHROME_PATH=/pad/naar/chrome npx tsx scripts/security-check.ts`
- Lokale SMTP-sink (levert niets af): `node scripts/smtp-sink.mjs 2525` en start de app met `SMTP_HOST=127.0.0.1 SMTP_PORT=2525`.
