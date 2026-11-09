# LUXE Store — Setup Guide

## Prerequisites

- Node.js 20.9+
- PostgreSQL database
- Stripe account (for payments)
- Google OAuth credentials (optional, for Google login)

## 1. Install Dependencies

```bash
cd luxe-store
npm install
```

## 2. Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

### Required Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_URL` | Your app URL (http://localhost:3000 for dev) |
| `NEXTAUTH_SECRET` | Random secret — generate with `openssl rand -base64 32` |
| `STRIPE_SECRET_KEY` | From Stripe Dashboard → Developers → API keys |
| `STRIPE_PUBLISHABLE_KEY` | From Stripe Dashboard → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | From Stripe CLI or Dashboard → Webhooks |
| `NEXT_PUBLIC_APP_URL` | Your app URL (same as NEXTAUTH_URL) |

### Optional Variables

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console |

## 3. Database Setup

### Option A: Local PostgreSQL

```bash
# Create the database
createdb luxestore

# Push the schema
npm run db:push

# Seed with sample data
npm run db:seed
```

### Option B: Cloud PostgreSQL (e.g., Neon, Supabase, Railway)

1. Create a new PostgreSQL database
2. Copy the connection string to `DATABASE_URL` in `.env`
3. Run migrations:

```bash
npm run db:push
npm run db:seed
```

## 4. Stripe Setup

### Test Mode

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Toggle to **Test mode**
3. Copy your test API keys to `.env`

### Webhook (Local Development)

```bash
# Install Stripe CLI
# Then forward webhooks to your local server:
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`.

## 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 6. Admin Access

After seeding, log in with:

- **Email:** admin@luxestore.com
- **Password:** admin123456

Then visit `/admin` for the admin panel.

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:push` | Push schema to database |
| `npm run db:migrate` | Create migration |
| `npm run db:seed` | Seed database with sample data |
| `npm run db:studio` | Open Prisma Studio (DB GUI) |

---

## Deploy to Vercel

1. Push your code to GitHub
2. Import the repository in [Vercel](https://vercel.com)
3. Add all environment variables in Vercel project settings
4. Set the build command: `npm run build`
5. Set the output directory: `.next`
6. Deploy!

### Post-Deploy

- Run `npm run db:push` against your production database
- Set up Stripe webhook endpoint: `https://your-domain.com/api/webhooks/stripe`
- Update `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` to your production domain

## Project Structure

```
luxe-store/
├── prisma/
│   ├── schema.prisma          # Database models
│   └── seed.ts                # Seed data
├── src/
│   ├── app/
│   │   ├── (auth)/            # Auth pages (login, register)
│   │   ├── (shop)/            # Storefront (home, products, cart, etc.)
│   │   ├── admin/             # Admin panel
│   │   └── api/               # API routes
│   ├── components/
│   │   ├── admin/             # Admin components
│   │   ├── layout/            # Header, Footer
│   │   ├── products/          # Product cards, grid, filters
│   │   └── ui/                # Reusable UI components
│   ├── generated/prisma/      # Generated Prisma client
│   ├── lib/                   # Utilities (prisma, stripe, auth, etc.)
│   ├── store/                 # Zustand cart store
│   └── types/                 # TypeScript types
├── .env.example
├── next.config.ts
└── package.json
```
