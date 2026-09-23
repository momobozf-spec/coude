# Web version

Mijn Superrette also runs in the browser. The web version is **the same Expo app**, built with React Native Web. There is no second codebase: every feature, the API client, i18n and the design system are shared with iOS and Android.

```bash
pnpm dev:web                                        # development server (Expo)
EXPO_PUBLIC_API_URL=https://api.example.org pnpm build:web   # static export → apps/mobile/dist-web
```

The output is a static single-page app (`index.html` + JS bundle + assets). Any static host works, provided **every unknown path is rewritten to `/index.html`**. That keeps deep links such as `/product/<id>` and invite links `/invite/<token>` working.

## Responsive layout

| Width                       | Layout                                                                                                                                                                                                                                              |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| < 900 px (phones)           | Same as the mobile app: bottom tab bar, single column                                                                                                                                                                                               |
| ≥ 900 px (tablets, laptops) | **Persistent sidebar** (logo, sections, "Scan barcode") on every page, content centred (max 960 px), card grids with 2 columns, **two-column product page** (prices left, equivalents and price history right), shopping-list receipts side by side |
| ≥ 1240 px (desktops)        | 3-column grids, content up to 1120 px                                                                                                                                                                                                               |

Forms and dialogs (login, onboarding, alerts, settings, the shopping list itself) keep a readable width of 560 px. The layout is driven by `useLayout()` (`src/lib/layout.ts`), `Grid` / `Columns` (`src/components/Grid.tsx`) and the `Sidebar` in the root layout.

## Web-specific behaviour

| Feature                                | Web behaviour                                                                                                                                |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Confirmations and messages             | `window.confirm` / `window.alert`. React Native Web does not implement `Alert.alert` (`src/lib/platform.ts`).                                |
| Sharing invite links                   | Web Share API when available, otherwise **copy to clipboard**. The link is always shown so it can be copied manually.                        |
| "Download mijn gegevens" (GDPR export) | Downloads `mijn-superrette-export.json`                                                                                                      |
| Barcode scanner                        | **Type the barcode** (works on every computer), or opt in to the **webcam**. expo-camera uses the browser `BarcodeDetector` or its polyfill. |
| Push notifications                     | Not available on the web (in-app notifications still work). Web Push is not implemented.                                                     |
| Session tokens                         | `localStorage` (native apps use the Keychain/Keystore). See the security notes below.                                                        |
| Installable (PWA-style)                | Web manifest, theme colour and icons (`public/`). No offline service worker.                                                                 |

## Configuration

- `EXPO_PUBLIC_API_URL`: the API base URL, inlined at build time. It is public, and no secrets belong in the web bundle.
- The API must allow the web origin: `CORS_ORIGINS=https://<web-host>`.
- `PUBLIC_APP_URL` should point to the web host, so invitation links (`/invite/<token>`) open in the web app.

## Hosting on Render (repository blueprint)

The repository's `render.yaml` defines a **demo environment**:

- `mijn-superrette-api`: Node web service. `APP_ENV=staging` with **sample data** loaded at start.
- `mijn-superrette-web`: static site, with the SPA rewrite `/* → /index.html`.
- `mijn-superrette-db`: PostgreSQL.

After the first deploy, fill in the `sync: false` values in the Render dashboard, then redeploy:

1. `EXPO_PUBLIC_API_URL` on **mijn-superrette-web**: the API's https URL.
2. `CORS_ORIGINS` and `PUBLIC_APP_URL` on **mijn-superrette-api**: the web app's https URL.

The demo password for `demo@superrette.local` is generated by Render (`DEV_SEED_PASSWORD`, visible in the dashboard). Prices are fictitious, and every price shows the **VOORBEELDDATA** label. This blueprint has **not been deployed from this repository yet**, so validate it on first use. The free Render database expires after 30 days, and free web services sleep when idle.

## Security notes for the web

- Serve over HTTPS only. Add a Content-Security-Policy on the host (`default-src 'self'; connect-src 'self' https://<api-host> wss://<api-host>; img-src 'self' data: https:`) to limit the impact of any XSS on tokens in `localStorage`.
- Access tokens are short-lived (15 min). Refresh tokens rotate, and reuse revokes every session.

## Verified

- `pnpm build:web` produces the static export (also in CI).
- A Playwright walkthrough against a running API at 1440×900 (desktop) and 390×844 (phone): welcome, login, home, search grid, two-column product page, basket comparison, manual barcode entry → product. No page errors.
