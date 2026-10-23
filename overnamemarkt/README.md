# Overnamemarkt

Marktplaats waar eigenaars van online bedrijven (SaaS, websites, apps, webshops, online diensten) in België en Nederland hun bedrijf aanbieden en kopers interesse tonen. Jij controleert elke aanbieding vóór publicatie en legt zelf het contact tussen koper en verkoper.

**Stack:** Next.js 16 (App Router, server actions) · React 19 · Supabase (Postgres, aanmelden via e-maillink, Row Level Security) · Vercel.
Kost bij de start: €0 op de gratis plannen van Supabase en Vercel, plus je domeinnaam.

## Wat erin zit

| Onderdeel | Pad |
| --- | --- |
| Aanbod met filters (type, land, max. prijs, sortering op prijs of multiple) | `/` |
| Detailpagina met interesse-formulier | `/aanbod/[id]` |
| Aanbieding indienen (na aanmelden) | `/verkopen` |
| Mijn aanbiedingen, status, aantal geïnteresseerden, intrekken; mijn interesse | `/account` |
| Beheer: controleren, publiceren, afwijzen met reden, status, verwijderen, kopersberichten | `/beheer` (alleen admin) |
| Aanmelden met e-maillink, geen wachtwoorden | `/login`, `/auth/callback` |
| Hoe het werkt, voorwaarden, privacyverklaring | `/hoe-het-werkt`, `/voorwaarden`, `/privacy` |
| Database, toegangsregels en beveiligde functies | `supabase/migrations/0001_init.sql` |
| Tests (validatie + toegangsregels tegen echte Postgres) | `tests/` |

## Beveiliging in het kort

- Alle toegang wordt in de database afgedwongen met Row Level Security, niet alleen in de app.
- Een nieuwe aanbieding staat altijd op "ter controle", ook als iemand de API rechtstreeks aanspreekt.
- Verkopers kunnen hun gepubliceerde aanbieding niet zelf wijzigen; alleen intrekken.
- Contactadressen van verkopers zitten in een aparte tabel die nooit publiek leesbaar is.
- Kopersberichten zijn alleen zichtbaar voor de koper zelf en de admin. De verkoper ziet alleen het aantal.
- Niemand kan zichzelf admin maken.
- Limieten: max. 5 aanbiedingen tegelijk ter controle per gebruiker, max. 20 keer interesse per dag.
- Alle invoer wordt server-side gevalideerd (zod) en nog eens door de database (check-constraints).
- Security-headers: CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy.
- Alleen noodzakelijke cookies (aanmelding), dus geen cookiebanner nodig.

## Live zetten (± 1 uur)

### 1. Supabase

1. Maak een project op [supabase.com](https://supabase.com). Kies regio **Central EU (Frankfurt)**.
2. Open **SQL Editor**, plak de volledige inhoud van `supabase/migrations/0001_init.sql` en klik **Run**.
3. Ga naar **Authentication → URL Configuration**:
   - **Site URL**: `https://jouwdomein.be`
   - **Redirect URLs**: voeg `https://jouwdomein.be/auth/callback` toe, en voor lokaal testen `http://localhost:3000/auth/callback`.
4. Ga naar **Authentication → Providers → Email**: laat Email aan. Wachtwoorden zijn niet nodig.
5. **E-mail versturen**: de ingebouwde mailer van Supabase is alleen bedoeld om te testen en verstuurt maar enkele mails per uur. Stel voor productie eigen SMTP in onder **Authentication → Emails → SMTP Settings** (bijv. via je e-mailprovider of een dienst als Brevo of Resend).
6. Pas eventueel de tekst van de aanmeldmail aan onder **Authentication → Emails → Templates → Magic Link**.
7. Noteer onder **Project Settings → API** de **Project URL** en de **anon public key**.

### 2. Vercel

1. Zet deze map in een (privé) GitHub-repository.
2. Op [vercel.com](https://vercel.com): **Add New → Project**, kies de repository.
3. Vul de omgevingsvariabelen in uit `.env.example`:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL` = `https://jouwdomein.be` (zonder slash op het einde)
   - `NEXT_PUBLIC_SITE_NAME`, `NEXT_PUBLIC_COMPANY_NAME`, `NEXT_PUBLIC_COMPANY_VAT`, `NEXT_PUBLIC_COMPANY_ADDRESS`, `NEXT_PUBLIC_CONTACT_EMAIL`
4. Klik **Deploy**. Koppel daarna je domein onder **Settings → Domains**.
5. Wijzig je later een omgevingsvariabele, deploy dan opnieuw: de CSP-header en de links worden bij de build vastgelegd.

### 3. Jezelf admin maken

1. Meld je op de live site aan met je eigen e-mailadres.
2. Voer in de Supabase **SQL Editor** uit:

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'jouw@email.be');
```

3. Herlaad de site: **Beheer** verschijnt in het menu.

## Lokaal draaien

```bash
cp .env.example .env.local   # vul je Supabase-gegevens in, NEXT_PUBLIC_SITE_URL=http://localhost:3000
npm install
npm run dev                  # http://localhost:3000
npm test                     # validatie + toegangsregels (draait een Postgres in het geheugen, geen Supabase nodig)
npm run typecheck
npm run build
```

Node.js 20.9 of nieuwer.

## Dagelijks gebruik

1. Nieuwe aanbieding → **Beheer → Ter controle**. Check de cijfers en de beschrijving. **Publiceren** of **Afwijzen** met een reden (die ziet de verkoper).
2. Nieuwe interesse → **Beheer → Interesse van kopers**. Je ziet het bericht, het e-mailadres van de koper en het contactadres van de verkoper. Mail de verkoper het bericht door en zet de status op **Doorgestuurd**.
3. Onder bod of verkocht → pas de status aan bij **Alle aanbiedingen**.
4. Verwijderingsverzoek (GDPR) → verwijder de gebruiker in Supabase onder **Authentication → Users**. Zijn aanbiedingen en interesse worden automatisch mee verwijderd.

## Vóór je publiek gaat

- **Juridisch:** laat `/voorwaarden` en `/privacy` nakijken door een jurist, ook de vraag of het in contact brengen van kopers en verkopers van (aandelen van) bedrijven onder FSMA-regels valt. Dat is nog niet bevestigd.
- **Adres:** vul je volledige maatschappelijke zetel in via `NEXT_PUBLIC_COMPANY_ADDRESS`.
- **SMTP:** zonder eigen mailserver komen aanmeldlinks traag of niet aan zodra meer mensen zich aanmelden.
- **Back-ups:** controleer welke back-ups je Supabase-plan biedt. Exporteer anders zelf regelmatig de database.

## Bewust niet in versie 1

Betalingen of escrow, waarderingen, AI-matching, uploads van bestanden, automatische e-mailmeldingen bij nieuwe interesse, berichten tussen gebruikers onderling, zelf je account verwijderen (gebeurt nu op verzoek). Toevoegen als de marktplaats tractie heeft.
