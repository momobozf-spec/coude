# Layali — Deployment Guide (online ready)

Deploy the Layali marketplace to **Vercel** with a **Turso** (hosted libsql)
database. This keeps the exact same database driver as local development, so no
code changes are needed between dev and prod.

> Estimated time: ~20 minutes. You need (free) accounts for Vercel, Turso,
> Mollie and Resend.

---

## 0. Overview of what you'll set

| Service | What | Where to get it |
|---|---|---|
| Turso | Production database | https://turso.tech |
| Vercel | Hosting | https://vercel.com |
| Mollie | Payments (Bancontact/iDEAL/card) | https://my.mollie.com |
| Resend | Transactional e-mail | https://resend.com |

---

## 1. Database — Turso

Install the Turso CLI and create a database:

```bash
# macOS/Linux
curl -sSfL https://get.tur.so/install.sh | bash
turso auth signup        # or: turso auth login

turso db create layali
turso db show layali --url            # → libsql://layali-<org>.turso.io
turso db tokens create layali         # → the auth token
```

You now have two values:
- `DATABASE_URL = libsql://layali-<org>.turso.io`
- `DATABASE_AUTH_TOKEN = <token>`

### Create the schema + seed data on Turso

Run these locally, pointing the env vars at Turso (PowerShell example):

```powershell
$env:DATABASE_URL="libsql://layali-<org>.turso.io"
$env:DATABASE_AUTH_TOKEN="<token>"
npm run db:deploy     # creates all tables on Turso
npm run db:seed       # loads 38 products, 11 categories, vendors, services, coupons, admin
```

bash/zsh equivalent:

```bash
DATABASE_URL="libsql://layali-<org>.turso.io" DATABASE_AUTH_TOKEN="<token>" npm run db:deploy
DATABASE_URL="libsql://layali-<org>.turso.io" DATABASE_AUTH_TOKEN="<token>" npm run db:seed
```

> `db:deploy` generates the SQL from `prisma/schema.prisma` and applies it over
> the libsql connection (the Prisma CLI can't push to `libsql://` directly).
> It's safe to re-run — existing tables are skipped.

---

## 2. Hosting — Vercel

1. Push this repo to GitHub.
2. In Vercel → **New Project** → import the repo. Framework auto-detects as Next.js.
3. Add the environment variables below (Project → Settings → Environment Variables).
4. **Deploy**. `postinstall` runs `prisma generate` automatically.

### Required environment variables (Production)

```
DATABASE_URL            = libsql://layali-<org>.turso.io
DATABASE_AUTH_TOKEN     = <turso token>
NEXTAUTH_URL            = https://<your-domain>
NEXTAUTH_SECRET         = <openssl rand -base64 32>
NEXT_PUBLIC_APP_URL     = https://<your-domain>

MOLLIE_API_KEY          = live_xxx   (or test_xxx while testing)
RESEND_API_KEY          = re_xxx
RESEND_FROM             = Layali <noreply@your-domain>
ADMIN_EMAIL             = orders@your-domain
SUPPORT_EMAIL           = hello@your-domain
```

### Optional

```
GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET     # social login
STRIPE_SECRET_KEY / STRIPE_PUBLISHABLE_KEY / STRIPE_WEBHOOK_SECRET   # alt. provider
NEXT_PUBLIC_GA_ID / NEXT_PUBLIC_META_PIXEL_ID / NEXT_PUBLIC_TIKTOK_PIXEL_ID
```

> `NEXT_PUBLIC_APP_URL` must be your real https domain — it's used for Mollie
> redirect/webhook URLs, the sitemap, canonical tags and e-mail links.

---

## 3. Payments — Mollie

1. Create a Mollie account, complete onboarding to enable **live** payments.
2. Copy your API key (test_… first, live_… when ready) → `MOLLIE_API_KEY`.
3. No manual webhook registration needed — the app passes the webhook URL with
   every payment: `https://<your-domain>/api/webhooks/mollie`.
4. Test the flow end-to-end with `test_…` before switching to `live_…`.

> The success page also reconciles payment status directly with Mollie, so order
> status is correct even if a webhook is delayed.

---

## 4. E-mail — Resend

1. Create a Resend account and **verify your sending domain** (DNS records).
2. Set `RESEND_FROM` to an address on that domain (e.g. `noreply@your-domain`).
3. Without `RESEND_API_KEY` the app still works — e-mails are skipped gracefully.

---

## 5. Domain & HTTPS

1. Add your custom domain in Vercel → Settings → Domains (HTTPS is automatic).
2. Update `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` to the final https domain and redeploy.

---

## 6. Post-deploy checklist

- [ ] Homepage, `/products`, `/services`, `/vendors`, `/sell` load
- [ ] Register + login work (NextAuth)
- [ ] Add to cart → checkout → Mollie test payment → success page
- [ ] Order appears in `/admin/orders` and seller `/account/dashboard`
- [ ] Order confirmation + admin e-mails arrive (Resend)
- [ ] `/sitemap.xml` and `/robots.txt` resolve
- [ ] Admin login: `admin@layali.shop` / `admin123456` → **change this password**

---

## Admin & demo accounts (from seed)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@layali.shop` | `admin123456` |
| Customer/seller demo | `klant@layali.shop` | `klant123456` |

**Change the admin password immediately after the first deploy.**

---

## Alternative: PostgreSQL instead of Turso

If you prefer Postgres (Supabase/Neon): set `provider = "postgresql"` in
`prisma/schema.prisma`, replace the `PrismaLibSql` adapter in `src/lib/prisma.ts`
and the two seed files with the standard Prisma client, then use
`prisma migrate deploy` + `npm run db:seed`. Turso is recommended because it
requires no code changes from the current setup.
