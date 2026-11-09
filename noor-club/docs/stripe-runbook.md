# Stripe: opzetten en aantoonbaar testen

De betaalflow is bewust in twee stappen gebouwd (zie de README, "De €1 innen").
Dit document laat zien hoe je hem opzet en hoe je bewijst dat hij klopt.

---

## 1. Wat je aanmaakt in Stripe (testmodus)

Twee **prijzen**, allebei in EUR:

| Wat | Type | Bedrag | Env-variabele |
|---|---|---|---|
| Jaarabonnement | Recurring, jaarlijks | € 79,00 | `STRIPE_PRICE_ANNUAL` |
| Eerste maand | Eenmalig | € 1,00 | `STRIPE_PRICE_TRIPWIRE` |

En in `.env`:

```
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_PRICE_ANNUAL="price_..."
STRIPE_PRICE_TRIPWIRE="price_..."
STRIPE_WEBHOOK_SECRET="whsec_..."   # uit `stripe listen`
```

De webhook is essentieel: **zonder werkende webhook wordt het jaarabonnement
nooit aangemaakt.** De €1 is dan wel geïnd, maar er staat niets gepland.

Lokaal:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Neem de `whsec_...` die dat commando toont over in `.env` en herstart de app.

In productie: dashboard → Developers → Webhooks → endpoint
`https://<domein>/api/stripe/webhook`, met minimaal deze events:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

---

## 2. De testkaarten

Log in, bevestig je e-mailadres (anders blokkeert het afrekenen — met opzet),
ga naar `/nl/account`, vink het herroepingsvakje aan en klik **Start voor €1**.

### 2.1 `4242 4242 4242 4242` — geslaagd

Verwacht:

- [ ] Stripe → Payments toont een **geslaagde betaling van € 1,00**, meteen.
      Niet "pending", niet € 0,00.
- [ ] Stripe → Customers → deze klant heeft een **opgeslagen betaalmethode**.
- [ ] Stripe → Subscriptions toont één abonnement, status **trialing**, met
      `trial_end` over 30 dagen en de jaarprijs van € 79.
- [ ] In de app: `/nl/account` toont "Eerste maand loopt".
- [ ] In de database: `subStatus = TRIALING` en `trialEndsAt` gevuld.

Controleren kan ook zo:

```bash
stripe payment_intents list --limit 1
stripe subscriptions list --limit 1
```

### 2.2 `4000 0000 0000 0002` — geweigerd

- [ ] Stripe weigert de betaling op de checkout-pagina zelf.
- [ ] Er wordt **geen** abonnement aangemaakt.
- [ ] De app geeft geen toegang: `subStatus` blijft `NONE`.

### 2.3 `4000 0025 0000 3155` — 3D Secure

- [ ] Er verschijnt een 3DS-scherm; bevestigen rondt de betaling af.
- [ ] Daarna hetzelfde eindplaatje als bij 2.1.

### 2.4 Webhook tweemaal

```bash
stripe events resend <evt_...>
```

- [ ] Stripe → Subscriptions toont nog steeds **één** abonnement.
      De webhook slaat het aanmaken over zodra er al een niet-geannuleerd
      abonnement bestaat.

### 2.5 Opzeggen via het portaal

- [ ] Klik in `/nl/account` op "Abonnement beheren" en zeg op.
- [ ] Toegang blijft bestaan tot `currentPeriodEnd`, en vervalt daarna —
      niet meteen.

---

## 3. Wat je moet zien in de logs

Elke stap logt één JSON-regel. Zoek op `scope`:

```
billing.checkout   checkout session created      mode=payment
stripe.webhook     trial subscription created    trialEnd=...
funnel             checkout_completed            amountCents=100
```

Zie je `checkout_completed` met `amountCents: 100` maar géén
`trial subscription created`, dan is de €1 geïnd zonder dat er een abonnement
staat. Dat is het scenario om meteen op te lossen: controleer de webhook-secret
en of `STRIPE_PRICE_ANNUAL` gezet is.

---

## 4. Waarom niet één checkout met een trial

Voor de duidelijkheid, omdat het de voor de hand liggende variant is:

`mode: "subscription"` met `trial_period_days: 30` maakt een abonnement dat
begint in een proefperiode. De eerste factuur is dan € 0,00 en Stripe belast de
kaart pas als de trial afloopt. Een eenmalig item van € 1 dat je daaraan hangt
komt op diezelfde eerste factuur terecht — en het gedrag rond wanneer die
factuur daadwerkelijk geïncasseerd wordt, verschilt per API-versie en per
instelling.

Het risico is asymmetrisch: als het misgaat merk je het pas op dag 30, bij alle
klanten tegelijk, met kaarten die nooit gevalideerd zijn. De twee-stapsvariant
heeft dat probleem niet, kost één extra webhook-afhandeling, en levert je
bovendien een echte betaling van € 1 waarmee de kaart bewezen is.
