# Barakah gratis testen op Render

Testopstelling zonder kosten: `render.free.yaml`. **Alleen testdata.** Voor
echte gebruikers: `docs/DEPLOY.md`.

Beperkingen:

- Geen persistente schijf: geüploade bewijsstukken en jaarrapporten verdwijnen
  bij elke herstart of deploy.
- De app slaapt na 15 minuten zonder bezoek; eerste verzoek daarna ± een minuut.
- Herinneringen worden elk uur verwerkt (niet elke minuut).
- ECB-koersen niet automatisch: knop *ECB-koersen nu ophalen* op `/admin/prijzen`.

## 1. Database bij Neon (gratis)

1. Account op [neon.tech](https://neon.tech) → **New project**.
2. Region: **AWS Europe Central 1 (Frankfurt)**, Postgres 17, naam `barakah`.
3. **Connect** → kopieer de connection string (met `sslmode=require`).
   Die plak je straks in Render, nergens anders.

## 2. E-mail bij Resend (gratis)

1. Account op [resend.com](https://resend.com) → **API Keys** → **Create API Key**.
2. Zonder geverifieerd domein mag Resend alleen mailen naar het adres van je
   eigen Resend-account. Voor testen volstaat dat: gebruik als `EMAIL_FROM`
   `Barakah <onboarding@resend.dev>` en registreer in de app met dat adres.

## 3. Code naar GitHub

Maak op GitHub een **privé**-repository `barakah` (zonder README). In PowerShell,
in `coude\zakat-platform-pro`:

```powershell
tar -xf EERST-UITPAKKEN-diepe-bestanden.zip
Remove-Item EERST-UITPAKKEN-diepe-bestanden.zip
New-Item -ItemType Directory -Force .github\workflows | Out-Null
Copy-Item deploy\github-cron.yml .github\workflows\cron.yml
git init
git add .
git commit -m "Barakah"
git remote add origin https://github.com/momobozf-spec/barakah.git
git branch -M main
git push -u origin main
```

Controleer op GitHub dat er geen `.env` tussen staat.

## 4. Blueprint

Render → **Blueprints** → **New Blueprint Instance** → `barakah` →
**Blueprint Path:** `render.free.yaml`. Vul in:

| Variabele | Waarde |
| --- | --- |
| `DATABASE_URL` | de Neon-string |
| `NEXT_PUBLIC_APP_URL`, `AUTH_URL` | `https://barakah-test.onrender.com` |
| `RESEND_API_KEY` | de Resend-sleutel |
| `EMAIL_FROM` | `Barakah <onboarding@resend.dev>` |
| `LEGAL_ENTITY_ADDRESS` | straat, nr en postcode van de zetel van Marhaba Data & AI Agent BV (naam, ondernemingsnummer en e-mail staan al in de blueprint) |
| `ADMIN_EMAIL` | het e-mailadres van je Resend-account |

Controleer **$0**, dan **Apply**. De app weigert te starten als er iets
ontbreekt; de reden staat bovenaan in **Logs**.

## 5. Beheerder worden

1. Registreer op `https://<adres>/register` met het adres uit `ADMIN_EMAIL`.
2. Render → barakah-test → **Manual Deploy → Restart service**. Bij het
   opstarten krijgt je account de beheerdersrol. Log opnieuw in.
3. `/admin/prijzen`: publiceer goud en zilver (EUR per gram, met bron) en klik
   *ECB-koersen nu ophalen*. Zonder prijzen weigert elke berekening.

## 6. Proxy en planning

- Inloglimiet: de app staat op `TRUSTED_PROXY_HOPS=1`. Lukt inloggen niet meer na
  een paar pogingen voor *iedereen* tegelijk, verhoog dan naar 2.
- GitHub → repository → **Settings → Secrets and variables → Actions**:
  `APP_URL` en `CRON_SECRET` (waarde uit Render → Environment). Dan
  **Actions → cron → Run workflow**. Groen = werkt.
