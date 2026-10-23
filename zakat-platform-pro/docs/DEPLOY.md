# In productie zetten

Het draaiboek van een lege server tot de eerste gebruiker die een Zakat-berekening
afrondt. Wat er juridisch, religieus en commercieel nog moet gebeuren vóór je
live gaat, staat apart in [LAUNCH-CHECKLIST.md](LAUNCH-CHECKLIST.md).

## Wat er draait

| Onderdeel | Commando | Opmerking |
| --- | --- | --- |
| PostgreSQL 17 | — | Managed (Neon, Supabase, Scaleway, OVH…) in de EU. Back-ups met point-in-time recovery aan. |
| Web | `npm start` | Pagina's, API, `/api/health`, `/api/ready`. **Eén instantie** (rate limiting zit in het geheugen). |
| Worker | `npm run worker` | Herinneringen (elke minuut), ECB-koersen en prijscontrole (elk uur), opruimen (dagelijks). Eén instantie. |
| Opslag | volume op `/data` | Donatiebewijzen en jaarrapporten. Moet persistent zijn en mee in de back-up. |

Web en worker gebruiken dezelfde image (`Dockerfile`); alleen het startcommando
verschilt. De web-service migreert bij het opstarten, de worker nooit.

## Omgevingsvariabelen

Volledige lijst met uitleg in [`.env.example`](../.env.example). Web en worker
**weigeren te starten** in productie als een van deze ontbreekt of fout staat
(`productionProblems()` in `src/config/env.ts`):

| Variabele | Waarde |
| --- | --- |
| `DATABASE_URL` | Met `sslmode=require` bij een managed database. |
| `AUTH_SECRET` | Minstens 32 willekeurige tekens: `npx auth secret`. |
| `NEXT_PUBLIC_APP_URL`, `AUTH_URL` | De publieke URL, met `https://`. Staat ook in links in e-mails. |
| `METAL_PRICE_PROVIDER=published` | Fixture-prijzen zijn in productie verboden. |
| `FX_PROVIDER=published` | Idem voor wisselkoersen. |
| `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM` | Zonder e-mail geen wachtwoordherstel. Het afzenderdomein moet in Resend geverifieerd zijn (SPF/DKIM). |

Sterk aanbevolen:

| Variabele | Waarom |
| --- | --- |
| `FX_SYNC=frankfurter` | De worker vult elk uur de ECB-koersen (USD, GBP, TRY) aan. |
| `LEGAL_ENTITY_NAME`, `LEGAL_ENTITY_VAT`, `LEGAL_ENTITY_ADDRESS`, `LEGAL_CONTACT_EMAIL` | Verschijnen op `/privacy` en `/voorwaarden`. Zonder staan daar invulvelden. |
| `TRUSTED_PROXY_HOPS` | Aantal proxies vóór de app (Render/Fly/Railway/Caddy: 1). Verplicht ≥ 1 in productie. Fout = de IP-limiet telt het verkeerde adres. De app-poort mag alleen voor de proxy bereikbaar zijn. |
| `DATABASE_POOL_MAX` | Web + worker samen onder de verbindingslimiet van je database. |
| `STORAGE_LOCAL_DIR` | In de image al `/data/storage`. |

## Eerste installatie

```bash
# 1. Schema en referentiedata (regelset + categorieën) op de lege database
npx prisma migrate deploy
npm run db:reference

# 2. Web en worker starten
npm start            # of de web-service van je platform
npm run worker       # aparte service, één instantie
```

Draai **nooit** `npm run db:seed` op productie: die maakt accounts met een
bekend wachtwoord en fictieve organisaties. Hij weigert met `NODE_ENV=production`.

Daarna:

1. Registreer je eigen account op `/register`.
2. Maak het beheerder: `ADMIN_EMAIL=jij@voorbeeld.be npm run admin:grant`
   (in de container: `docker compose exec web npm run admin:grant`). Log opnieuw in.
3. Ga naar **Beheer: prijzen** (`/admin/prijzen`) en publiceer voor vandaag de
   goudprijs en zilverprijs in EUR per gram, met bron. Klik *ECB-koersen nu
   ophalen* en publiceer MAD, SAR en AED met de hand. Tot dan weigert elke
   berekening die een metaalprijs of koers nodig heeft — met een duidelijke melding.
4. Neem de eerste goede doelen op (zie hieronder).

## Dagelijkse taak: prijzen publiceren

De nisab rust op de goud- of zilverprijs. Is de laatst gepubliceerde prijs ouder
dan `MAX_PRICE_AGE_DAYS` (standaard 4), dan weigert de app te rekenen in plaats
van een verouderde nisab te tonen. Dat is bewust.

- **Goud en zilver**: elke werkdag publiceren op `/admin/prijzen`, in EUR per
  gram (24k goud, 999 zilver), met de bron (bv. "LBMA Gold Price PM, omgerekend").
- **Wisselkoersen**: met `FX_SYNC=frankfurter` automatisch voor USD/GBP/TRY.
  MAD, SAR en AED staan niet in de ECB-reeks; publiceer die zelf of beperk je
  tot EUR.
- De worker logt `worker.prices_stale` als iets ontbreekt of te oud is. Zet daar
  een alert op in je logplatform.

Afgeronde berekeningen bewaren hun eigen kopie van prijs, koers en datum; een
nieuwe publicatie verandert nooit een historisch bedrag.

## Goede doelen opnemen

Elke bewering over een organisatie heeft een bron nodig. Daarom gaat dat via een
JSON-bestand dat je in versiebeheer bewaart (het spoor van wie wat nakeek):

```bash
cp docs/charity-example.json charities/naam-vzw.json   # invullen met échte bronnen
ADMIN_EMAIL=jij@voorbeeld.be CHARITY_FILE=charities/naam-vzw.json npm run charity:import
```

Opnieuw importeren is veilig (bronnen herkend aan hun URL, ongewijzigde claims
niet dubbel). Het badge *geverifieerd* lukt alleen met een geverifieerde
`REGISTERED_ENTITY`-claim uit een onafhankelijk register (bv. de KBO).
Fijnmaziger beheer kan via de admin-API's onder `/api/admin/charities/:id/…`.

## Op Render (voorbeeld)

- **Web Service**, Docker, health check path `/api/ready`, start command
  `sh -c "npx prisma migrate deploy && npm run db:reference && npm start"`,
  een **persistent disk** op `/data`.
- **Background Worker**, dezelfde Dockerfile, start command `npm run worker`.
  (Een disk kan maar aan één service hangen; de worker schrijft geen bestanden,
  dus die heeft er geen nodig.)
- **PostgreSQL**, regio Frankfurt.
- De omgevingsvariabelen in een *environment group* die beide services delen.

Met Docker Compose op een eigen server: `docker compose --profile app up -d --build`
(web, worker en database; vul eerst `.env` in). Zet er een reverse proxy met
TLS voor (Caddy of Traefik) en `TRUSTED_PROXY_HOPS=1`.

## Health checks

| Route | Betekenis | Gebruik |
| --- | --- | --- |
| `GET /api/health` | Het webproces draait. Raakt de database niet. | Liveness / container-healthcheck |
| `GET /api/ready` | De database antwoordt binnen 2 s. | Readiness / load balancer |

Beide zonder inlog en zonder foutdetails in het antwoord.

## Accounts en beveiliging

- **Vergrendeling**: 5 foute pogingen → 15 minuten op slot, daarna telkens het
  dubbele (max. een dag; na een dag rust begint de teller opnieuw). Plus max. 30
  pogingen per IP per kwartier. De melding is altijd dezelfde, zodat ze niet
  verraadt of een adres bestaat. Ontgrendelen: de gebruiker zelf via
  *Wachtwoord vergeten*, of `UNLOCK_EMAIL=… npm run unlock:user`.
- **Sessies intrekken**: een wachtwoordwijziging, een herstel via e-mail en
  *Overal afmelden* (Profiel) maken alle lopende sessies onmiddellijk ongeldig.
  Ook `admin:grant` doet dat, zodat een nieuwe rol meteen geldt.
- **Wachtwoordherstel**: link één uur geldig, één keer bruikbaar, alleen de
  SHA-256-hash staat in de database. Maximaal 3 mails per adres per uur.
- **AVG**: Profiel → *Je gegevens* geeft een JSON-export en definitieve
  verwijdering (met e-mail en wachtwoord ter bevestiging; bestanden worden mee
  gewist, het auditlog blijft zonder koppeling aan de persoon).

## Een nieuwe versie uitrollen

```bash
npm ci                       # genereert ook de Prisma-client
npm run verify               # schema, types, lint, alle tests
npm run build
npx prisma migrate deploy    # vóór de nieuwe web-instantie verkeer krijgt
```

Schemawijzigingen: lokaal `npm run db:migrate` en de migratie mee committen.
Nooit `db:push` op productie.

## Back-ups en herstel

Dagelijkse database-back-ups met point-in-time recovery, én een back-up van het
`/data`-volume (bewijsstukken en rapporten). Test één keer per kwartaal een
herstel naar een aparte omgeving en controleer dat een oude berekening en een
bijlage nog openen. Een back-up die nooit hersteld is, is een hoop.
