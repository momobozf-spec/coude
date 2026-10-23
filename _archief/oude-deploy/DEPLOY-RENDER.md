# Alles online zetten op Render

Deze repo is deploy-klaar gemaakt. In de root staat **`render.yaml`** (een Render "Blueprint"):
één bestand dat in één keer al je projecten als aparte services aanmaakt.

## Wat er online komt

| Service | Type | URL na deploy (voorbeeld) |
|---|---|---|
| brandstofprijzen | statische site | https://brandstofprijzen.onrender.com |
| noor-growth-funnel | statische site | https://noor-growth-funnel.onrender.com |
| simple-webapp | statische site | https://simple-webapp.onrender.com |
| webshop | Vite/React (static build) | https://webshop.onrender.com |
| marktonderzoek | Express web service | https://marktonderzoek.onrender.com |
| resume-roaster | Node web service | https://resume-roaster.onrender.com |
| jamal-jamila | Next.js web service | https://jamal-jamila.onrender.com |
| luxe-store | Next.js web service | https://luxe-store.onrender.com |
| noor-tracker | Next.js web service | https://noor-tracker.onrender.com |
| printable-generator | Next.js web service | https://printable-generator.onrender.com |

> `noor-app` (Expo/mobiel) en de lege mappen `noortrackter` / `onprem online` doen niet mee —
> een mobiele app hoort niet als website gehost te worden.

## Stappen (eenmalig, ~15 min)

### 1. Lockbestand opruimen (op je eigen pc)
Er stond een vastgelopen git-lock. Verwijder die even in PowerShell:
```powershell
cd "C:\Users\mo-bo\OneDrive\Documenten\coude"
del .git\index.lock
git rm -r --cached --quiet "**/node_modules" 2>$null
git add .gitignore render.yaml sites/ DEPLOY-RENDER.md
git commit -m "Render deploy-klaar: blueprint + gitignore"
```

### 2. Naar GitHub pushen
Render deployt vanaf een Git-repo. Als je nog geen GitHub-repo hebt:
1. Maak een lege repo op https://github.com/new (bijv. `coude`).
2. Koppel en push:
```powershell
git remote add origin https://github.com/<jouw-naam>/coude.git
git branch -M main
git push -u origin main
```

### 3. Blueprint koppelen op Render
1. Ga naar https://dashboard.render.com → **New +** → **Blueprint**.
2. Kies je GitHub-repo. Render vindt `render.yaml` automatisch.
3. Klik **Apply** — Render bouwt en lanceert alle 10 services.

### 4. Na de eerste deploy (alleen voor de 4 Next.js-apps)
NextAuth heeft de echte URL nodig. Per Next.js-service in Render → **Environment**:
- zet `NEXTAUTH_URL` op de https-URL van die service (bv. `https://jamal-jamila.onrender.com`)
- klik **Save** (de service redeployt automatisch).

`NEXTAUTH_SECRET` wordt automatisch gegenereerd, dus dat hoef je niet te doen.

## Belangrijk om te weten

- **Gratis plan slaapt:** web services gaan na ~15 min inactiviteit slapen en starten daarna in
  30–60s weer op. De eerste klik na een pauze is dus traag. Statische sites slapen niet.
- **SQLite reset:** de 4 Next.js-apps draaien op SQLite op een tijdelijke schijf. Accounts en data
  verdwijnen bij elke herstart/redeploy. Prima om te tonen; niet voor echte gebruikers.
  - Wil je blijvende data? Maak op Render een gratis **Postgres**, zet het Prisma-`datasource`-blok
    terug op `postgresql` en vul `DATABASE_URL` in. Zeg het me en ik bouw dat per app om.
- **Optionele sleutels:** `resume-roaster` heeft een `ANTHROPIC_API_KEY` nodig voor de AI-roast
  (de pagina laadt ook zonder). Stripe/Google-login op de Next.js-apps werken pas met echte keys.

## Wil je dat ik de GitHub- en Render-stappen samen met je doe?
Ik kan je via de browser door stap 2 en 3 heen loodsen zodra je ingelogd bent op GitHub en Render.
