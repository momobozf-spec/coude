# Deployment

## Components

| Component              | Runtime                             | Scale                                                                                                                                 |
| ---------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| API (`apps/api`)       | Node 22, `node dist/main.js`        | Stateless and horizontal. With several instances, set `REDIS_URL` so rate limits, the cache version and Socket.IO fan-out are shared. |
| Worker (`apps/worker`) | Node 22                             | 1+ instances. Concurrency via `WORKER_CONCURRENCY`.                                                                                   |
| PostgreSQL 16          | managed (with `pg_trgm`)            | Backups with PITR                                                                                                                     |
| Redis 7                | managed                             | Persistence optional (BullMQ jobs)                                                                                                    |
| Admin (`apps/admin`)   | static files (`vite build`)         | CDN. Restrict access (VPN/SSO) in addition to admin login.                                                                            |
| Mobile                 | EAS Build → App Store / Google Play |                                                                                                                                       |

A multi-stage image for API and worker: `docker build -f infra/Dockerfile --build-arg APP_TARGET=api .` (or `worker`). _This Dockerfile has not been built in CI yet. Validate it before relying on it._

## Release steps

1. `pnpm check` (lint, typecheck, unit tests, build) plus `pnpm test:integration` against a disposable database. CI runs all of these: `.github/workflows/mijn-superrette.yml`.
2. Apply migrations: `DATABASE_URL=… pnpm db:migrate`. Migrations are forward-only SQL in `packages/database/drizzle`.
3. Seed reference data (idempotent). Call `seedReferenceData(db)` from a one-off task. **Never run `db:seed:dev` in production**; it refuses to.
4. Deploy the API, then the worker.
5. Check `GET /health`. It must report `database: ok`, `redis: ok`, and in production `developmentData: none`.

## Production configuration

| Variable                               | Notes                                                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `APP_ENV=production`                   | Forces `ALLOW_DEVELOPMENT_DATA=false` and switches push to Expo                                         |
| `DATABASE_URL`, `REDIS_URL`            | From a secret manager                                                                                   |
| `JWT_SECRET`                           | ≥ 32 random chars. Rotating it signs everyone out of their access tokens (refresh tokens remain valid). |
| `CORS_ORIGINS`                         | The admin origin(s)                                                                                     |
| `PUBLIC_APP_URL`                       | Used in invite links (`/invite/<token>`). Configure universal links / app links for this domain.        |
| `OPEN_PRICES_ENABLED`, `CONTACT_EMAIL` | Enable the crowdsourced source. A real contact address is required by the Open Food Facts policy.       |
| `SYNC_SCHEDULES`                       | e.g. `open-prices:PRICES:0 5 * * *`                                                                     |
| `EXPO_ACCESS_TOKEN`                    | Only if enhanced push security is enabled                                                               |

## Mobile release

1. Create an EAS project and set `EAS_PROJECT_ID`. Configure APNs (Apple Developer) and FCM v1 credentials in EAS.
2. `eas build --profile production --platform all`, then `eas submit`.
3. Store listing:
   - **Apple 5.2.2:** only show third-party content (retailer prices and names) that you are permitted to use. Keep proof of the licences behind every enabled provider.
   - Crowdsourced prices must credit Open Prices (ODbL).
   - The sample-data banner must never appear in production. That is guaranteed server-side.

## Subscriptions <a id="subscriptions"></a>

Plans and entitlements are live and server-configurable (`app.plans`, `app.plan_entitlements`). Operators can grant Plus with a `MANUAL` subscription row. **Store billing is not implemented yet.** `POST /v1/subscriptions/{apple|google}/verify` returns 501. The planned implementation:

- **Apple:** StoreKit 2 in the app, with `appAccountToken` set to the user id. The backend verifies through the App Store Server API (_Get Transaction Info_ / _Get All Subscription Statuses_, ES256 JWT with an App Store Connect key), and listens to **App Store Server Notifications V2** (signed JWS, verified against the Apple root chain) to keep `app.subscriptions` current. `verifyReceipt` is deprecated and must not be used.
- **Google:** Play Billing in the app. The backend calls `purchases.subscriptionsv2.get`, **acknowledges within 3 days**, and handles Real-time developer notifications (Pub/Sub, deduplicated on `messageId`, always re-fetching state).
- **Store rules:** Apple guideline 3.1.1 and Google Play's payments policy require in-app purchase for the Plus subscription.

## Operations

- **Admin → Providers & syncs:** trigger syncs and inspect counters. **Importfouten:** records that failed a stage. **Match review:** the human loop.
- Monitor the BullMQ failed-jobs count, sync FAILED/PARTIAL rates, alert evaluation latency, and API 5xx and latency.
- Backups: daily plus PITR. Test restores quarterly.
