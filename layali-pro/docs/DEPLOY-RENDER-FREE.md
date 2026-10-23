# Layali gratis testen op Render

Testopstelling zonder kosten: `render.free.yaml`. **Mollie in testmodus, alleen
testbestellingen.**

Beperkingen van gratis:

- De app slaapt na 15 minuten zonder bezoek; het eerste verzoek daarna duurt
  ongeveer een minuut.
- Met `SEED_DEMO=1` wordt bij elke start de demo-catalogus opnieuw geladen
  (voorbeeldproducten met placeholderfoto's). Wijzigingen aan die
  demoproducten worden dan overschreven.

## 1. Database bij Neon

1. Neon → **All projects** → **New project**: naam `layali`, Postgres **17**,
   region **AWS Europe Central 1 (Frankfurt)**.
2. **Connect** → **Connection pooling uit** → **Copy snippet**.
3. Haal `&channel_binding=require` aan het einde weg. Bewaar de rest voor stap 4.

## 2. Mollie (testmodus)

1. Account op [mollie.com](https://www.mollie.com) (gratis aanmaken).
2. **Developers → API keys** → kopieer de **Test API key** (`test_…`).

## 3. Code naar GitHub

Maak op GitHub een **privé**-repository `layali` (zonder README). In
PowerShell, in `coude\layali-pro`:

```powershell
New-Item -ItemType Directory -Force .github\workflows | Out-Null
Copy-Item deploy\github-cron.yml .github\workflows\cron.yml
git init
git add .
git commit -m "Layali"
git remote add origin https://github.com/momobozf-spec/layali.git
git branch -M main
git push -u origin main
```

## 4. Blueprint

Render → **New** → **Blueprint** → `layali` → **Blueprint Path:**
`render.free.yaml`. Vul in:

| Variabele | Waarde |
| --- | --- |
| `DATABASE_URL` | de Neon-string |
| `APP_URL` en `NEXTAUTH_URL` | `https://layali-test.onrender.com` (beide hetzelfde) |
| `MOLLIE_API_KEY` | de `test_…`-sleutel |
| `RESEND_API_KEY` | je Resend-sleutel |
| `RESEND_FROM` | `Layali <onboarding@resend.dev>` |
| `ADMIN_EMAIL`, `SUPPORT_EMAIL` | het e-mailadres van je Resend-account |
| `LEGAL_ENTITY_*` | naam, btw-nummer, volledig adres en contactmail van de verkoper |
| `BOOTSTRAP_ADMIN_EMAIL` | het e-mailadres waarmee je beheert |

Zonder geverifieerd domein mailt Resend alleen naar het adres van je eigen
Resend-account.

Controleer **$0**, dan **Apply**. De app weigert te starten met een te kort
geheim of zonder https-adres; de reden staat bovenaan in **Logs**.

## 5. Inloggen

Render → layali-test → **Logs** → zoek `Tijdelijk wachtwoord`. Log in op
`/nl/login`, ga naar **Account → Instellingen** en kies een eigen wachtwoord.
Verwijder daarna `BOOTSTRAP_ADMIN_EMAIL` in **Environment**.

## 6. Testbestelling

Bestel iets, betaal op de Mollie-testpagina met status **Paid**. De bestelling
staat daarna in `/admin/orders` op betaald. Probeer ook **Failed** of
**Expired**: de bestelling wordt geannuleerd en de voorraad komt terug.

## 7. Vangnet (GitHub Actions)

GitHub → repository → **Settings → Secrets and variables → Actions**:
`APP_URL` en `CRON_SECRET` (waarde uit Render → Environment). Daarna
**Actions → cron → Run workflow**. Groen = werkt.
