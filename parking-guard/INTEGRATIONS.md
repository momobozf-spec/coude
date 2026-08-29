# Integraties — status en wat er nog nodig is

Bijgewerkt: 2026-08-29 (einde fase 0)

Drie statussen, en ze betekenen precies wat ze zeggen:

- **LIVE** — werkt nu, aantoonbaar, zonder dat jij iets moet aanleveren.
- **CONFIGURATION REQUIRED** — de code is geschreven en compleet, maar er zijn
  credentials nodig voordat het iets doet. Nooit als "werkend" gepresenteerd.
- **NOT AVAILABLE** — bestaat nog niet.

---

## LIVE

| Integratie | Details |
|---|---|
| **PostgreSQL** | Echte database via `embedded-postgres` op poort 5434 (`npm run dev:db`). Geen Docker nodig. Migrations draaien. |
| **Prisma** | Volledig datamodel, eerste migration toegepast, client gegenereerd. |
| **Gemeente-registry** | 19 gemeenten geseed uit `docs/gemeenten.md`, met eerlijke verificatiestatussen. |
| **Verzendblokkade** | `decideSubmission()` blokkeert verzending naar niet-geverifieerde gemeenten en naar kanalen die de gebruiker zelf moet gebruiken. 16 unit tests. |
| **Healthcheck** | `GET /api/health` — test de database echt, geeft 503 bij een storing. |
| **Auth.js v5** | Geïnstalleerd en compatibel met Next 16. Inlogflows komen in fase 1. |

## CONFIGURATION REQUIRED

Niets hiervan is nu actief. Alles hieronder is nodig vóór lancering.

### Documentopslag — S3-compatibel (fase 1)

Cloudflare R2 of Scaleway, **EU-regio**, server-side encryptie aan.

```
STORAGE_DRIVER="s3"
S3_ENDPOINT=""          # bv. https://<account>.r2.cloudflarestorage.com
S3_REGION="eu-central-1"
S3_BUCKET=""
S3_ACCESS_KEY_ID=""
S3_SECRET_ACCESS_KEY=""
```

Tot die tijd draait de lokale driver (`.storage/`, AES-256-GCM). Die is echt en
volledig, maar hoort niet in productie: de env-validatie weigert
`STORAGE_DRIVER="local"` als `NODE_ENV=production`.

**Kosten:** R2 heeft een gratis laag; verwacht enkele euro's per maand bij lage
volumes. Ik maak geen account aan zonder jouw akkoord.

### Vision / OCR (fase 2)

Eén adapter wordt volledig gebouwd; de interface maakt de tweede triviaal.

```
EXTRACTION_PROVIDER="anthropic"   # of "openai"
ANTHROPIC_API_KEY=""
OPENAI_API_KEY=""
```

Let op bij het aanmaken: kies waar mogelijk een **EU-endpoint** en zet
**no-training** aan. Dit zijn identiteitskaarten. Zonder sleutel valt de wizard
terug op handmatige invoer — er wordt nooit stilzwijgend doorgegaan.

**Kosten:** per document, afhankelijk van provider en resolutie. Ik kom met een
schatting per dossier vóór fase 2 live gaat.

### E-mail uit én in (fase 4)

```
RESEND_API_KEY=""
MAIL_FROM="Parking Guard <noreply@jouwdomein.be>"
DOSSIER_INBOX="dossiers@jouwdomein.be"
INBOUND_WEBHOOK_SECRET=""
```

Nodig: een domein met geverifieerde SPF/DKIM, en een **inbound webhook** (Resend
inbound of Postmark inbound) die antwoorden van gemeenten op `DOSSIER_INBOX` naar
ons doorzet. Zonder sleutel logt de mailer alleen; in productie weigert de
applicatie dan te starten.

### Betalingen — Mollie (fase 5)

```
MOLLIE_API_KEY=""
MOLLIE_WEBHOOK_SECRET=""
```

iDEAL, Bancontact en creditcard. Test eerst met een sandbox-sleutel.

### Sentry (optioneel)

```
SENTRY_DSN=""
```

### Redis / BullMQ (optioneel)

```
REDIS_URL=""
```

Leeg laten is een geldige keuze: de Postgres-queue werkt volledig (ADR 0002).
Zodra `REDIS_URL` gezet is, schakelt de worker over op BullMQ. Die driver is
geschreven maar **niet in productie bewezen** zolang er geen Redis is.

## NOT AVAILABLE

| Wat | Toelichting |
|---|---|
| **Indienen bij 18 van de 19 gemeenten** | Geen technische beperking van ons, maar van de administraties. parking.brussels sloot het e-mailkanaal op 16-03-2026; Brussel-Stad vereist de eID met pincode van de aanvrager. Zie ADR 0005. |
| **Pijler 1 — Live Alerts** | Niet gebouwd. Plek gereserveerd in `src/domain/alerts/`. |
| **Pijler 2 — Boete aanvechten** | Niet gebouwd. Plek gereserveerd in `src/domain/appeals/`. |
| **Automatische statusupdates van gemeenten** | Bestaat niet. Statussen komen uit antwoordmail-parsing of handmatige invoer, altijd met admin-bevestiging. |

---

## Wat ik van jou nodig heb, in volgorde

1. **Nu niets** — fase 1 (opslag) is te bouwen en te testen op de lokale driver.
2. **Vóór productie:** R2/Scaleway-bucket, Resend-domein + inbound webhook,
   Mollie-sleutels, vision-API-sleutel.
3. **Een beslissing** over papieren post (ADR 0005): versturen wij zelf, of krijgt
   de gebruiker een print-klaar dossier? Dit bepaalt het aanbod voor 13 van de 19
   gemeenten.
4. **Juridische review** van de volmacht- en consentteksten vóór lancering.
