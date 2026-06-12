# How to run your projects locally

Double-click **`run.bat`** in this folder to open the menu, then pick a project number. Everything boots with **no external setup** — local SQLite databases are created automatically on first launch, and dummy keys are wired up so the apps don't crash on missing config.

Press `Ctrl+C` in the launcher window to stop a server before launching another (only one Next.js app at a time on port 3000).

## Prerequisites

- **Node.js 20+** (https://nodejs.org). Verify with `node -v` in PowerShell. That's it. No Postgres, no Docker.
- **Expo Go** on your phone — only for `noor-app` (mobile).

## What "first run" does

For the four Next.js apps (jamal-jamila, luxe-store, noor-tracker, printable-generator), the launcher does this once on the first launch:

1. `npm install` — pulls dependencies into `node_modules` (~1–2 min)
2. Removes the old `src/generated/prisma/` folder if present (it was for the Postgres adapter)
3. `npx prisma generate` — builds the SQLite Prisma client into `node_modules/.prisma/client`
4. `npx prisma db push` — creates the SQLite file at `prisma/dev.db` and applies the schema
5. `npm run dev` — starts the dev server

After that, subsequent launches skip steps 1–4 and just start the server.

## Project notes

| # | Project | Port | Notes |
|---|---|---|---|
| 1 | brandstofprijzen.html | — | Static HTML, opens directly |
| 2 | noor-growth-funnel | — | Static HTML/JS/CSS |
| 3 | simple-webapp | — | Static HTML/JS/CSS |
| 4 | webshop | 5173 | Vite/React, zero-config |
| 5 | marktonderzoek | 3000 | Express survey, zero-config |
| 6 | resume-roaster | 5173 | Needs `ANTHROPIC_API_KEY` in `resume-roaster/.env` for the AI roast (page loads without it) |
| 7 | jamal-jamila | 3000 | Local SQLite — converted from Postgres. Sign up flow works. |
| 8 | luxe-store | 3000 | Local SQLite — converted from Postgres. Sign up flow works. |
| 9 | noor-tracker | 3000 | Local SQLite. Sign up flow works. |
| 10 | printable-generator | 3000 | Local SQLite. Sign up flow works. |
| 11 | noor-app | — | Expo: pick option 11, then scan the QR code with Expo Go on a phone on the same Wi-Fi |

## What was changed for "no setup" mode

For the four Next.js apps, this folder ships with patched files so they boot with zero external services:

- **`prisma/schema.prisma`** — switched datasource from `postgresql` to `sqlite`. Postgres-only types (`String[]` arrays, `Json`, `@db.Text`, enums) were converted to plain `String` columns that store JSON-encoded data.
- **`src/lib/prisma.ts`** — wraps the Prisma client with a `$extends` layer that auto-stringifies arrays/objects on write and parses them back on read, so the rest of the app keeps using native arrays/objects without any other code changes.
- **`src/lib/stripe.ts`** — Stripe client now lazy-initialises behind a Proxy and falls back to a dummy key, so missing `STRIPE_SECRET_KEY` doesn't crash module load.
- **`.env`** — populated with a real random `NEXTAUTH_SECRET` and dummy Stripe keys.

## Things that still need real keys (optional)

| App | Feature | Key |
|---|---|---|
| All Next.js | Stripe checkout pages | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, etc. in the project's `.env` |
| All Next.js | Sign in with Google | `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` |
| jamal-jamila / noor-tracker / printable-generator | Email send | `RESEND_API_KEY` |
| resume-roaster | AI roast | `ANTHROPIC_API_KEY` |

Email/password signup, browsing, dashboards, and most pages work without any of those keys.

## Default admin credentials

If you want to test admin flows on jamal-jamila or luxe-store, run the seed manually inside that project folder:

```powershell
cd jamal-jamila
npx prisma db seed
```

That creates an admin login:

- **jamal-jamila** — `admin@jamalandjamila.com` / `admin123456`
- **luxe-store** — `admin@luxestore.com` / `admin123456`

## Resetting an app's database

Delete `prisma/dev.db` and `prisma/dev.db-journal` inside the project folder. Next launch will recreate it empty.

## Empty / abandoned folders

`noortrackter` and `onprem online` have no code. Safe to delete.

## Stopping a stuck port

```powershell
netstat -ano | findstr :3000
taskkill /PID <pid> /F
```
