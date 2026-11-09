# Familiestem live zetten

Doorlooptijd: ±2 uur werk, plus wachttijd voor Stripe-verificatie en DNS.
De app weigert te starten zolang een sleutel ontbreekt en zegt dan precies welke.

## 1. Accounts (jij, op naam van Marhaba Cooperation BV)

| Wat | Waar | Wat je nodig hebt |
| --- | --- | --- |
| Domein | Belgische registrar (bv. combell.com, one.com) | Naam kiezen. `familiestem.be` lijkt al in gebruik: controleer of kies een andere naam |
| Server | hetzner.com/cloud → kleinste server, Ubuntu 24.04, locatie Duitsland of Finland | IP-adres, SSH-sleutel |
| Betalingen | dashboard.stripe.com → bedrijf activeren, Bancontact aanzetten | `sk_live_…` en straks `whsec_…` |
| Spraakherkenning | platform.openai.com → nieuw **project met regio Europa** → API-sleutel; zet een maandlimiet | `sk-…` |
| E-mail | brevo.com → Transactional → SMTP & API; domein authenticeren | SMTP-login en -wachtwoord |

## 2. DNS

- `A`-record: `jouwdomein.be` → IP van de server
- `A`-record: `www.jouwdomein.be` → zelfde IP
- De SPF- en DKIM-records die Brevo toont bij domeinauthenticatie

## 3. Server klaarmaken (eenmalig)

```bash
scp deploy/server-setup.sh root@SERVER_IP:/root/
ssh root@SERVER_IP bash /root/server-setup.sh
```

## 4. Sleutels invullen

```bash
scp .env.example root@SERVER_IP:/srv/familiestem/.env
ssh root@SERVER_IP nano /srv/familiestem/.env      # alles invullen; FS_OPS_KEY = openssl rand -hex 24
```

## 5. Stripe-webhook

Stripe → Developers → Webhooks → endpoint toevoegen:
- URL: `https://jouwdomein.be/stripe/webhook`
- Event: `checkout.session.completed`
- Kopieer het signing secret (`whsec_…`) naar `STRIPE_WEBHOOK_SECRET` in `.env`.

## 6. Deployen (en bij elke update)

```bash
scripts/push.sh root@SERVER_IP
python3 scripts/smoke.py https://jouwdomein.be      # moet eindigen met "Alles in orde."
```

## 7. Vóór de eerste klant

- [ ] Volledige reis zelf doen: bestellen met je eigen kaart (€49), mail ontvangen, cadeaubon openen, als verteller 2 vragen opnemen, tekst goedkeuren, familie toelaten, PDF en ZIP downloaden
- [ ] Die betaling terugbetalen in Stripe
- [ ] 5 echte Nederlandse opnames (met toestemming) laten uitschrijven en nalezen
- [ ] `/ops?key=…` openen en controleren dat je eigen test er staat
- [ ] Voorwaarden laten nalezen; daarna de banner "ONTWERPTEKST" uit `app/templates/terms.html` halen

## Dagelijks automatisch

Om 03:15 UTC: wissen na bewaartermijn, mislukte bevestigingsmails opnieuw, seintjes na 10 dagen stilte,
bericht 60 dagen vóór einde bewaring, back-up (14 dagen) in `data/backups`.
Back-ups staan op dezelfde server: zet in Hetzner ook **Backups** aan voor de server, zodat er een kopie
buiten de machine bestaat.

## Problemen

```bash
ssh root@SERVER_IP "cd /srv/familiestem && docker compose logs --tail=100 app"
ssh root@SERVER_IP "cd /srv/familiestem && docker compose exec app python -m app.jobs"   # job met de hand
```
