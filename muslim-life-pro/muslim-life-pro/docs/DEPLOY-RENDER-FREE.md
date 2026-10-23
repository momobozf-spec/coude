# Muslim Life gratis online zetten (Render + Neon)

Testopstelling, €0 per maand. Dezelfde werkwijze als Barakah.

Wat je krijgt: de volledige app op `https://muslim-life-test.onrender.com`, met de
gemarkeerde demo-vermeldingen, de assistent in demomodus en betalingen **uit**.

Beperkingen van gratis: de app slaapt na 15 minuten zonder bezoek (eerste
bezoek daarna duurt ±1 minuut), geen back-ups, Premium kan niet gekocht worden.

---

## Stap 1 — Database bij Neon

1. Neon → **New project** → naam `muslim-life`, Postgres-versie standaard,
   regio **AWS Europe Central 1 (Frankfurt)**.
2. **Connect** → zet **Connection pooling uit**.
3. Kopieer de connection string. Haal `&channel_binding=require` eraf als die
   erin staat. Hij eindigt dan op `?sslmode=require`.
4. Bewaar hem even in Kladblok. **Niet in de chat plakken.**

## Stap 2 — Code op GitHub

Maak op GitHub een lege, **private** repository `muslim-life` (zonder README).
Dan in PowerShell:

```powershell
cd C:\Users\mo-bo\OneDrive\Documenten\coude\muslim-life-pro
git init
git add .
git commit -m "Muslim Life production-ready"
git branch -M main
git remote add origin https://github.com/momobozf-spec/muslim-life.git
git push -u origin main
```

## Stap 3 — Blueprint op Render

1. Render → **New** → **Blueprint** → kies repository `muslim-life`.
2. **Blueprint Path**: `render.free.yaml`.
3. Render vraagt de waarden die je zelf moet invullen:

| Variabele | Wat erin moet |
| --- | --- |
| `DATABASE_URL` | de Neon-string uit stap 1 |
| `APP_URL` | `https://muslim-life-test.onrender.com` |
| `AUTH_URL` | exact hetzelfde als `APP_URL` |
| `LEGAL_ENTITY_VAT` | ondernemingsnummer (BE…) |
| `LEGAL_ENTITY_ADDRESS` | maatschappelijke zetel |
| `LEGAL_CONTACT_EMAIL` | het adres waarop je mails leest |
| `BOOTSTRAP_ADMIN_EMAIL` | leeg laten (stap 5) |
| `RESEND_API_KEY` / `EMAIL_FROM` | leeg laten, of zie stap 6 |

4. **Apply**. De eerste build duurt 5–10 minuten.

Lukt de start niet? Render → `muslim-life-test` → **Logs**. Regels met
`config.error` zeggen precies welke variabele fout is.

## Stap 4 — Testen

Open de URL → **Start free** → account maken (vink de toestemming aan) →
onboarding → je dag.

## Stap 5 — Jezelf admin maken

1. Registreer eerst normaal met je eigen e-mailadres.
2. Render → Environment → `BOOTSTRAP_ADMIN_EMAIL` = dat adres → **Save** (herstart).
3. Afmelden en opnieuw aanmelden → `/admin` werkt.
4. Daarna `BOOTSTRAP_ADMIN_EMAIL` weer leegmaken.

## Stap 6 — Wachtwoord vergeten (optioneel)

Zonder e-mail toont de pagina "Wachtwoord vergeten" je contactadres.
Met Resend: API-key aanmaken → `RESEND_API_KEY` en
`EMAIL_FROM` = `Muslim Life <onboarding@resend.dev>`.
**Let op:** zonder eigen domein mailt Resend alleen naar je eigen Resend-adres.
Voor echte leden heb je een domein nodig (zie LAUNCH-CHECKLIST).

## Stap 7 — Dagelijks onderhoud (GitHub Actions)

Voltooit accountverwijderingen na de bedenktijd en ruimt tellers op.

1. Kopieer `deploy/github-cron.yml` naar `.github/workflows/cron.yml`, commit, push.
2. GitHub → repo → Settings → Secrets and variables → Actions → twee secrets:
   - `APP_URL` = je Render-URL
   - `HEALTH_CHECK_TOKEN` = de waarde die Render aanmaakte (Environment-tab, oogje)
3. Actions → **maintenance** → **Run workflow** om te testen.

## De assistent echt laten antwoorden (optioneel, kost geld)

Render → Environment: `AI_PROVIDER` = `anthropic`, `ANTHROPIC_API_KEY` = je sleutel
(plakken in Render, niet in de chat), en `ALLOW_MOCK_AI_IN_PRODUCTION` verwijderen.
Lees eerst sectie 3 van het privacybeleid: berichten gaan dan naar die aanbieder.
