# Resume Roaster

Plak of upload een cv (PDF/TXT) en krijg een eerlijke, AI-gegenereerde review (Claude via de Anthropic API).
Frontend: React 19 + Vite 8 + Tailwind 4. Backend: Express 5 (`server.js` → `server/app.js`).

Uitbater: Marhaba Data & AI Agent BV (BE 1003.552.102, Zaventem).

## Lokaal draaien

```bash
npm install
cp .env.example .env        # vul ANTHROPIC_API_KEY in
npm run server              # API op http://localhost:3001
npm run dev                 # frontend op http://localhost:5173 (proxy /api → 3001)
npm test                    # node:test, 24 tests, geen API-key nodig (Anthropic wordt gemockt)
```

## Beveiliging (samengevat)

- Per-IP rate limit (`RATE_LIMIT_MAX` per `RATE_LIMIT_WINDOW_MINUTES`) en globale daglimiet (`DAILY_ROAST_LIMIT`).
- Origin-check op `/api`: alleen de eigen origin + `ALLOWED_ORIGINS`; vreemde origins krijgen 403.
- Upload max `MAX_UPLOAD_MB` (multer 2), alleen PDF (magic bytes gecontroleerd) of TXT; tekst max `MAX_RESUME_CHARS`.
- cv-inhoud, prompt en modelantwoord worden nooit gelogd (alleen fouttype/statuscode). Test bewijst dit.
- Modelantwoord wordt robuust geparsed en gevalideerd (`server/parse.js`).
- Prompt-injectie: cv staat als data tussen `<resume>`-tags, systeemprompt negeert instructies erin.
- Helmet security headers (CSP). Geen Google Fonts-CDN meer (self-hosted via @fontsource).
- Productie-guard: met `NODE_ENV=production` start de server niet zonder echte `ANTHROPIC_API_KEY`.
- `GET /api/health` voor health checks.

## Live zetten (Render, EU-regio)

1. Anthropic: maak een API-key aan op console.anthropic.com, zet een **maandelijkse spend limit** in de console
   (extra vangnet bovenop `DAILY_ROAST_LIMIT`), en accepteer de DPA (Commercial Terms) — nodig voor de privacyverklaring.
2. Render → New → Web Service → repo `coude`, Root Directory `resume-roaster`, **Region: Frankfurt (EU Central)**.
3. Build command: `npm ci && npm run build` — Start command: `node server.js` — Health check path: `/api/health`.
4. Environment:
   - `NODE_ENV=production` (verplicht; anders geen productie-guard)
   - `NODE_VERSION=22`
   - `ANTHROPIC_API_KEY=<je sleutel>`
   - `ANTHROPIC_MODEL=claude-sonnet-5-5` (of `claude-haiku-5-5` voor lagere kosten)
   - `TRUST_PROXY=1`
   - `DAILY_ROAST_LIMIT=200`, `RATE_LIMIT_MAX=5`, `RATE_LIMIT_WINDOW_MINUTES=60` (naar wens)
   - `VITE_LEGAL_ENTITY_ADDRESS=<straat + nr, postcode Zaventem>` (build-time; vereist een nieuwe build na wijzigen)
   - `ALLOWED_ORIGINS` alleen nodig als de frontend op een ander domein draait.
5. Deploy, open `/api/health` → `{"status":"ok",...}`, test een roast, controleer `/privacy` en `/terms`.
6. Eigen domein: koppel het in Render (Custom Domains); de eigen origin wordt automatisch toegelaten.

Let op: de daglimiet en rate limit zitten in het geheugen van één instance. Draai één instance, of vervang ze
door een gedeelde store (Redis) als je opschaalt.

## Juridisch

`/privacy` en `/terms` (Engels, zoals de app) staan in `src/components/LegalPage.jsx` en zijn een
**concept — laten nalezen door een jurist**. Adres van de maatschappelijke zetel via `VITE_LEGAL_ENTITY_ADDRESS`.
Geen cookies of trackers in de app; als je analytics toevoegt, eerst een cookiebanner/consent.
