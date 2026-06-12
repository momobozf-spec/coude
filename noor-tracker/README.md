# Noor Tracker

Islamitische dagelijkse gewoonte-tracker voor moslimkinderen van 4-8 jaar. Ouders maken een account aan, voegen hun kinderen toe en houden dagelijks islamitische gewoontes bij. Kinderen verdienen sterren voor elke afgeronde gewoonte.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Taal:** TypeScript (strict)
- **Styling:** Tailwind CSS
- **Database:** PostgreSQL + Prisma ORM
- **Authenticatie:** NextAuth v5 (credentials + Google OAuth)
- **Betalingen:** Stripe (subscriptions)
- **E-mail:** Resend
- **Deploy:** Vercel

## Aan de slag

### 1. Installeer dependencies

```bash
npm install
```

### 2. Configureer environment variables

Kopieer `.env.example` naar `.env` en vul de waardes in:

```bash
cp .env.example .env
```

### 3. Database setup

Zorg dat je een PostgreSQL database hebt draaien en configureer `DATABASE_URL` in `.env`.

```bash
npx prisma migrate dev --name init
npx prisma generate
```

### 4. Start de development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Beschrijving |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Willekeurige geheime string voor sessies |
| `NEXTAUTH_URL` | URL van je applicatie |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_PRICE_ID` | Stripe price ID voor Pro plan |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `RESEND_API_KEY` | Resend API key voor e-mails |
| `CRON_SECRET` | Secret voor Vercel cron jobs |

## Stripe Setup

1. Maak een product "Noor Tracker Pro" aan in Stripe Dashboard
2. Stel prijs in op EUR 4,99/maand recurring
3. Kopieer de price ID naar `STRIPE_PRICE_ID`
4. Configureer webhook endpoint: `yourdomain.com/api/webhooks/stripe`
5. Events: `checkout.session.completed`, `customer.subscription.deleted`

## Plannen

| Feature | Gratis | Pro (EUR 4,99/maand) |
|---|---|---|
| Kinderen | 1 | 3 |
| Gewoontes | 10 | 14+ |
| Geschiedenis | 7 dagen | Volledig |
| Wekelijks rapport | Nee | Ja |

## Deploy naar Vercel

1. Push naar GitHub
2. Verbind met Vercel
3. Configureer environment variables
4. Deploy!

De `vercel.json` bevat security headers en cron configuratie voor wekelijkse e-mails (elke zondag om 09:00 UTC).
