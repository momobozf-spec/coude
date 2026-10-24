# Beveiliging

Wat de API en de Superette-app beschermen, hoe, en wat bewust niet (nog) is
gedaan. Testbewijs: `npm run smoke:auth` (API) en `npm run walkthrough:superette`
(browser); zie `PRODUCTION-READINESS.md` voor de laatste meting.

## Authenticatie en sessies

Twee clients, één controller (`apps/api/src/auth`):

| | Superette-app (`x-superette-client: web`) | Boetiek-PWA, scanners, tests |
|---|---|---|
| Token | `sup_access`-cookie: JWT (15 min, `WEB_ACCESS_TTL_SECONDS`) met `sub`, `sid`, `client`, `jti` | Bearer-JWT in JSON (`JWT_TTL_SECONDS`, ≤ 1 u in productie) |
| Vernieuwen | `sup_refresh`-cookie: opaque token (30 d, `WEB_REFRESH_TTL_DAYS`), `POST /auth/refresh` roteert | opnieuw inloggen |
| Opslag server | `Session`: SHA-256 van het huidige én vorige refresh-token, `expiresAt`, `revokedAt`, user-agent | geen |
| Intrekken | `POST /auth/logout`, accountverwijdering, hergebruik-detectie, `purge` na 30 d | niet mogelijk (bestaand gedrag) |
| Cookies | `HttpOnly`, `Secure` (productie, niet uit te zetten), `sup_access` Path `/api/v1` SameSite=Lax; `sup_refresh` Path `/api/v1/auth` SameSite=Strict; host-only tenzij `COOKIE_DOMAIN` | – |

- **Hergebruik van een refresh-token** (het vorige token na een rotatie)
  beëindigt de hele sessie (`SESSION_REUSE`): een gestolen cookie wordt
  waardeloos zodra de rechtmatige client of de dief één keer ververst.
- Elke beschermde request controleert naast de JWT-handtekening of de sessie
  (`sid`) nog actief is en de gebruiker `ACTIVE`. Een geldige JWT na logout
  wordt dus geweigerd (getest).
- Cookies worden **alleen** als credential gelezen wanneer de clientheader
  `web` is; zonder header is een cookie-request anoniem.
- Wachtwoorden: Argon2id (`@node-rs/argon2`), minimaal 12 tekens, geen
  samenstellingsregels (NIST 800-63B). Geen e-mailverificatie (open punt).
- De browserbundel bevat geen token en gebruikt `localStorage` alleen voor
  taal/thema (`scripts/check-bundle-secrets.mjs`, walkthrough).

## CSRF

Een wijzigend verzoek (`POST/PUT/PATCH/DELETE`) dat een sessiecookie meestuurt
moet (1) de header `x-superette-client: web` dragen en (2) een `Origin` uit de
toegestane set hebben als de browser er een meestuurt. Anders `403
CSRF_REJECTED`. Samen met `SameSite` zijn dat drie onafhankelijke grendels; de
header komt niet door een cross-origin preflight zonder onze CORS-toestemming.

## CORS

`origin`: alleen `APP_URL`, `SUPERETTE_WEB_URL` en `CORS_ORIGINS` (exact);
`credentials: true`; `allowedHeaders`: `content-type, authorization,
x-superette-client, x-request-id` (**niet** `x-job-key`); `exposedHeaders`:
`x-request-id, retry-after`. Een vreemde origin krijgt geen
`Access-Control-Allow-Origin`.

## Autorisatie

Alle Superette-resources (lijsten, alerts, meldingen, voorkeuren, export,
verwijdering) worden met `userId` uit de sessie gefilterd in de service-laag;
een vreemd id geeft 404 (geen 403, geen bestaan lekken). Rooktest
`smoke:compare` dekt lezen/wijzigen/verwijderen van andermans alert en lijst.

## Invoer en limieten

- Zod-schema's uit `@superette/contracts` op elke body en query (`ZodValidationPipe`);
  fouten als `400` met `issues[]`.
- Body-limieten: JSON 64 kB, urlencoded 16 kB → `413 PAYLOAD_TOO_LARGE`;
  ongeldige JSON → `400 INVALID_JSON`.
- Rate limiting (`@nestjs/throttler`, per IP, per minuut; achter de proxy met
  `TRUST_PROXY`):

| Route | Limiet |
|---|---|
| standaard (alle routes) | 100 |
| `POST /auth/login`, `/auth/register`, `/auth/register-superette` | 5 |
| `POST /auth/refresh`, `/auth/logout` | 20 |
| `GET /account/export` | 5 |
| `DELETE /account` | 5 |
| `GET /compare/search` | 60 |
| `GET /compare/search/suggest` (autocomplete) | 10 |
| `POST /compare/alerts` | 20 · preview 30 |
| `POST /compare/lists/:id/compare` | 20 |
| `POST /compare/internal/sync` | 5 · status 30 |
| `GET /health/status` | 30 |
| boetiek: `/access/token` 30, `/gate/*` 60, checkout 300 | ongewijzigd |

`429` draagt `code: RATE_LIMITED` en `Retry-After`. De limieten leven in het
geheugen per instance; met meerdere instances zijn ze effectief ×n (acceptabel;
een gedeelde store is een latere stap).

## Foutafhandeling

Eén vorm: `{ statusCode, code, message, requestId, issues? }`. Onbekende fouten
worden een generieke `500 INTERNAL_ERROR`; details (stack, query) gaan alleen
naar het log, met redactie van geheimen. `x-powered-by` is uit.

## Headers en CSP

**API** (`security-headers.middleware.ts`): `Content-Security-Policy:
default-src 'none'; frame-ancestors 'none'`, `X-Content-Type-Options:
nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`,
`Permissions-Policy` (alles uit), `Cross-Origin-Resource-Policy: same-site`,
`Cache-Control: no-store` op geauthenticeerde en niet-GET-antwoorden, HSTS in
productie.

**App** (`middleware.ts`): per request een nonce; `script-src 'self'
'nonce-…' 'strict-dynamic'` (geen `unsafe-inline`, geen `unsafe-eval` in
productie), `style-src 'self' 'unsafe-inline'` (React-inline-styles voor
ketenkleuren en tooltips; geen gebruikers-CSS), `connect-src 'self' <API>`,
`img-src 'self' data: blob:` (+ `NEXT_PUBLIC_IMAGE_HOSTS`), `frame-ancestors
'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`,
`upgrade-insecure-requests`; verder nosniff, `Referrer-Policy`,
`Permissions-Policy`, `X-Frame-Options`, COOP, HSTS. Geen `*`-bronnen.

XSS-review: React escapet alle tekst; er is geen `dangerouslySetInnerHTML` in
`apps/superette-web`; e-mails (`email-templates.ts`) escapen productnamen en
winkelnamen expliciet (unit-getest). Productnamen uit importbestanden worden
nooit als HTML geïnterpreteerd. De boetiek-PWA bevat één
`dangerouslySetInnerHTML` voor een QR-SVG uit eigen code (bestaand, buiten de
scope van deze opdracht).

## Interne jobs

- `COMPARE_JOB_KEY` (≥ 16 tekens; genereer 24+ random bytes) in de header
  `x-job-key`; vergelijking in constante tijd op SHA-256-digests; rotatie via
  `COMPARE_JOB_KEY_PREVIOUS`. Zonder sleutel bestaat het endpoint niet (404).
- Verzoeken met `Origin` of `Sec-Fetch-Site` worden geweigerd (`403
  INTERNAL_ONLY`): een browser stuurt die altijd, een server nooit. Extra
  signaal, geen vervanging voor de sleutel.
- Elke weigering wordt gelogd met `requestId`, pad en reden, nooit met de
  sleutel; elke run met `requestId`, duur en mislukte adapters (`SyncAudit`).
- Eén synchronisatie tegelijk per cluster: databaselease `JobLease` met
  heartbeat; een crash geeft de lease na `COMPARE_SYNC_LEASE_MINUTES` vrij.
  Twee gelijktijdige verzoeken → één `409 SYNC_ALREADY_RUNNING` (getest).
- Adapters: timeout (`COMPARE_ADAPTER_TIMEOUT_MS`) en één nieuwe poging;
  een bestand dat > 20 % van de aanbiedingen zou deactiveren, deactiveert
  niets (`PARTIAL` + note): een half bestand beschadigt geen geldige prijzen.
- Idempotent: dezelfde snapshot twee keer → geen dubbele rijen; meldingen
  hebben een idempotency-key per gebruiker/alert/dag.

## Geheimen en configuratie

- Validatie bij het starten (`env.ts`); productie weigert onveilige waarden
  (zie `DEPLOYMENT.md`).
- Geen geheimen in de repository, images of de browserbundel; `.dockerignore`
  sluit `.env*` uit; CI draait gitleaks en de bundelcontrole.
- Logredactie voor tokens, wachtwoorden, sleutels, cookies en database-URL's.

## Afhankelijkheden

`npm audit --omit=dev` (4 oktober 2026): 3 high, alle via `prisma → @prisma/config
→ deepmerge-ts < 8` (stack exhaustion bij recursieve objecten). Dat pad wordt
alleen door de Prisma **CLI** bij het lezen van configuratie gebruikt, niet
door `@prisma/client` tijdens runtime; de enige "fix" die npm aanbiedt is een
downgrade naar Prisma 6.12. **Geaccepteerd risico**, te herzien bij de
volgende Prisma-release. De overige meldingen (next, sharp, multer, qs,
nanoid, postcss, ip-address) zijn met gerichte `npm update` opgelost zonder
breaking changes. CI blokkeert op `critical` en rapporteert `high`.

## Bekende beperkingen en open punten

1. Geen e-mailverificatie bij registratie en geen wachtwoord-reset (vereist
   e-mailprovider).
2. Rate limits per instance, niet gedeeld.
3. Geen 2FA.
4. Geen geautomatiseerde pentest; alleen de eigen rooktests.
5. Boetiek-PWA bewaart haar Bearer-token nog in `localStorage` (bestaand,
   buiten scope; de API ondersteunt nu cookies voor een latere migratie).
