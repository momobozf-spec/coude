# Security

## Authentication

- E-mail + password. Passwords are hashed with **scrypt** (N=2¹⁵, r=8, p=1, 16-byte salt) and compared in constant time. Login does the same amount of work for unknown e-mails, to limit user enumeration.
- **Access tokens:** JWT HS256, 15 minutes, with issuer and audience checked (`jose`).
- **Refresh tokens:** 256-bit random, only the SHA-256 is stored (`app.sessions`), 30 days, **rotated on every use**. Presenting an already-rotated token revokes all of that user's sessions (theft detection). This is tested.
- Mobile stores tokens in the Keychain/Keystore. The admin uses `sessionStorage`, so its session ends with the tab.
- Rate limits: register 10/min, login 20/min, refresh 60/min per IP. They are shared via Redis when configured.

## Authorisation

- A global guard requires authentication unless an endpoint is `@Public()`. `@Roles('ADMIN')` protects `/v1/admin/*`, and admin tokens are checked on every request.
- List access is checked per request and per WebSocket room join. Non-members get **404**, so list ids don't leak. Roles are OWNER, EDITOR and VIEWER.
- Invites: 192-bit random tokens, only hashes stored, **single use**, 7-day expiry, consumed atomically.
- Entitlements are checked server-side (`ENTITLEMENT_REQUIRED`, `LIMIT_REACHED`). The client never decides access.

## Input and output

- Every request body and query is validated with shared Zod schemas. UUID path parameters are validated too.
- Errors return `{statusCode, code, message}`. Unexpected errors are logged server-side and returned as `INTERNAL_ERROR` without internals.
- SQL is always parameterised (Drizzle `sql` templates).
- CORS is restricted to configured origins. `x-powered-by` is disabled.

## Secrets

- No secrets are in Git. `.env` is git-ignored and `.env.example` holds placeholders. `JWT_SECRET` must be at least 32 characters, or the API refuses to start.
- **No production credentials in the mobile source.** The app knows only the public API URL.
- Provider credentials (licensed feeds) and `EXPO_ACCESS_TOKEN` come from the environment or a secret manager.

## Data integrity

- Development data cannot reach production. It is filtered at query level, the seed refuses production, `DevelopmentSeedProvider` throws in production, the dev import endpoint is disabled, and the health check flags any `DEVELOPMENT_SEED` rows.
- Human match decisions cannot be overwritten by imports.

## Known gaps / TODO

- No e-mail verification or password reset flow yet.
- No account lockout beyond IP rate limits. No 2FA for admins yet (recommended before production).
- Store-purchase verification (Apple/Google) is not implemented; the endpoints return 501. See DEPLOYMENT.
- No automated dependency or SAST scanning in CI yet.
