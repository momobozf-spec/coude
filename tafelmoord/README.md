# Tafelmoord · Speurfeest – speurspellen voor thuis

Downloadbare speurspellen in meerdere talen en categorieën, verkocht door Marhaba Cooperation BV.

| Spel | Categorie | Talen | Spelers | Prijs |
| --- | --- | --- | --- | --- |
| `oudejaar` – Moord op Oudejaar / Meurtre au Réveillon (merk Tafelmoord) | volwassenen, 16+ | NL, FR | 6–12 | €29 |
| `taart` – Wie verstopte de taart? / Qui a caché le gâteau ? (merk Speurfeest / Fête Enquête) | kinderen, 8–12 | NL, FR | 6–10 | €19 |

```
content/i18n/<taal>.json                 vaste teksten per taal (bestandsnamen, labels, verplichte secties)
content/games/<spel>/<taal>/             game.json, shop.json, host.md, solution.md, characters/, evidence/
build/build.py                           inhoud -> pdf's + QR + zip, per spel en taal, met validatie
build/site.py                            verkoopsite per taal + productcatalogus voor de shop
web/                                     sjablonen, vaste pagina's (voorwaarden, privacy), sitetekst per taal
supabase/                                edge functions (checkout, download, webhook), migratie, tests
```

## Een nieuwe taal of een nieuw spel toevoegen

- **Nieuwe taal** (bv. `en`): maak `content/i18n/en.json` en `web/strings/en.json`, vertaal elk spel naar `content/games/<spel>/en/`, en zet voorwaarden/privacy in `web/static/en/`. De kruiscontrole eist dezelfde rollen, spelersaantallen, dader, prijs en tijdstippen als de andere talen.
- **Nieuw spel of nieuwe categorie**: maak `content/games/<nieuw-spel>/<taal>/` met dezelfde bestanden. `category` in `game.json` bepaalt de groep op de site en het kleurenthema (`volwassenen` of `kinderen`; een nieuwe categorie krijgt ook een label `category_<naam>` in `web/strings/*.json`). `host_plays: false` betekent een volwassen spelleider die de oplossing mag kennen.

## 1. Bouwen en testen

```bash
pip install weasyprint qrcode markdown jinja2 pytest     # eenmalig
python3 build/build.py --check                           # valideert alles, ook tussen talen
python3 build/build.py --site-url https://JOUWDOMEIN --support-email hallo@JOUWDOMEIN
python3 build/site.py  --site-url https://JOUWDOMEIN
python3 -m pytest build/ -q                              # 48 tests: inhoud, pakketten, site
```

Resultaat:

- `dist/pakketten/<spel>-<taal>.zip` – wat de klant downloadt (upload naar de Supabase-bucket)
- `dist/site/` – de volledige site, inclusief `oplossing/<spel>-<taal>.html` (doel van de QR-code)
- `supabase/functions/_shared/catalog.json` – productcatalogus voor de shop (opnieuw deployen na wijzigingen)

## 2. Supabase

```bash
supabase link --project-ref JOUW_PROJECT
supabase db push                                         # tabel orders + privé-bucket 'pakketten'
for f in dist/pakketten/*.zip; do supabase storage cp "$f" "ss:///pakketten/$(basename "$f")"; done
supabase secrets set \
  SITE_URL=https://JOUWDOMEIN \
  STRIPE_SECRET_KEY=sk_live_... \
  STRIPE_PRICES='{"oudejaar-nl":"price_...","oudejaar-fr":"price_...","taart-nl":"price_...","taart-fr":"price_..."}' \
  STRIPE_TAX_RATE_ID=txr_... \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  RESEND_API_KEY=re_... \
  MAIL_FROM="Tafelmoord <hallo@JOUWDOMEIN>"
supabase functions deploy create-checkout download stripe-webhook
```

Zonder `STRIPE_PRICES` gebruikt de checkout de prijs uit `game.json` (`price_cents`). Met Price ID's beheer je prijzen in Stripe zelf.

## 3. Stripe (dashboard)

1. Producten + prijzen per spel en taal (of één product per spel met prijzen per taal) → `STRIPE_PRICES`.
2. Btw-tarief 21%, inclusief, België → `STRIPE_TAX_RATE_ID`.
3. Bancontact, kaarten en Apple Pay aanzetten.
4. URL van je algemene voorwaarden invullen bij de openbare gegevens (nodig voor de akkoordbox).
5. Webhook naar `https://PROJECT.supabase.co/functions/v1/stripe-webhook` voor `checkout.session.completed` en `checkout.session.async_payment_succeeded` → `STRIPE_WEBHOOK_SECRET`.
6. Bedrijfsgegevens van Marhaba Cooperation BV op de facturen.

Test eerst met `sk_test_...` en kaart 4242 4242 4242 4242.

## 4. Site publiceren

Zet `dist/site/` op een statische host (Cloudflare Pages of Netlify). Vul eerst `web/static/config.js` in en bouw de site opnieuw:

```js
window.TAFELMOORD = { functionsUrl: "https://PROJECT.supabase.co/functions/v1", supportEmail: "hallo@JOUWDOMEIN" };
```

Adressen: `/` stuurt naar `/nl/` of `/fr/` volgens de browsertaal; `/nl/oudejaar.html`, `/fr/taart.html`, enz.

## 5. Shoptests

```bash
node --experimental-strip-types --test supabase/functions/_shared/lib.test.ts   # 15 tests
bash supabase/tests/smoke.sh                                                    # 26 checks, functies end-to-end (vereist deno)
```

## Hoe een verkoop verloopt

1. Klant kiest een spel op `/<taal>/<spel>.html`, vinkt de afstand van herroepingsrecht aan → `create-checkout` controleert het product in de catalogus en maakt een Stripe-sessie in de juiste taal.
2. Klant betaalt bij Stripe, gaat akkoord met de voorwaarden en krijgt een factuur.
3. Webhook → bestelling in `orders` (met product), mail met downloadlink in de taal van het spel.
4. Bedankpagina → `download` controleert de betaling bij Stripe en geeft een tijdelijke link naar het juiste pakket.
