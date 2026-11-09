# Familiestem — MVP

Verkooppagina, bestelling + cadeaubon, toestemming verteller, mobiele opnamepagina, transcriptie (pluggable),
correctie en goedkeuring, foto's, familie-toegang, PDF-boek, ZIP-export, wissen, bewaartermijnen, meetpunten.

## Starten (lokaal)

```bash
pip install fastapi uvicorn jinja2 python-multipart httpx pillow reportlab
# ffmpeg moet geïnstalleerd zijn
export FS_DATA_DIR=./data FS_PUBLIC_URL=http://localhost:8000 FS_OPS_KEY=kies-iets-langs
python3 -m app.seed_demo          # laadt één FICTIEF voorbeeld (testtoon, geen echte stem)
python3 -m uvicorn app.main:app --port 8000
python3 -m pytest -q              # 22 tests: klantreis, toegangsrechten, limieten, pincode, webhook, wissen
```

## Modi

| Koppeling | Zonder sleutel | Met sleutel |
| --- | --- | --- |
| Betaling | DEMO: bestelling wordt meteen "betaald", banner op elke pagina | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` → Stripe Checkout (kaart + Bancontact) |
| Transcriptie | DEMO: tekst zegt letterlijk dat er geen spraakherkenning is | `OPENAI_API_KEY` (EU-project, `OPENAI_BASE_URL=https://eu.api.openai.com/v1`) |
| E-mail | Mails komen in `data/outbox` als .eml | `SMTP_*` → bevestiging met cadeaubon, seintjes, bewaarbericht |

De Stripe- en OpenAI-codepaden zijn geschreven maar **niet live getest** (geen sleutels). Nederlandstalige en
Franstalige transcriptiekwaliteit is **niet getest**.

## Rollen

- Koper `/k/<token>` — vragen, familie uitnodigen, voortgang, enkel gedeelde verhalen.
- Verteller `/v/<token>` — toestemming, optionele pincode, opnemen, goedkeuren, delen, familie toelaten, wissen.
- Familie `/f/<token>` — enkel na toelating door de verteller; downloaden enkel als de verteller dat toelaat.
- Ops `/ops?key=...` — funnel bezoek → bestelling → betaling → start → eerste opname → 5+ verhalen.

## Productkwaliteit

`app/text.py`: de leesbare versie wordt geweigerd als ze woorden bevat die niet in de transcriptie staan
(namen, getallen, plaatsen, gevoelens); dan blijft de letterlijke, opgeschoonde tekst staan. Onzekere woorden
(lage logprob) worden gemarkeerd in de editor en onderlijnd in het boek. De transcriptie wordt aan het
taalmodel doorgegeven als afgebakend bronmateriaal, nooit als instructie.

## Live zetten

Zie `deploy/DEPLOY.md`: Hetzner (EU) + Docker + Caddy (automatisch HTTPS), Stripe, OpenAI EU-project, Brevo SMTP.
In productie (`FS_ENV=production`) weigert de app te starten zolang een sleutel ontbreekt.

## Productie-checklist (oud)

HTTPS-hosting in de EU, back-ups van `data/`, dagelijkse `purge_expired`, e-mailkoppeling, juridische
nalezing van `templates/terms.html`, verwerkersovereenkomsten (hosting, spraakdienst, Stripe).
