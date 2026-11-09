# Huurklaar

Huurdossier-coach en advertentie-check voor huurders in België. NL/FR.
Een dienst van Marhaba Cooperation BV.

## Wat zit erin

| Onderdeel | Waar | Opmerking |
|---|---|---|
| Dossiercoach (score, 3x-budgetcheck, waakhond, brief) | `/[lang]/dossier` | Gratis. Gegevens blijven in de browser (localStorage). |
| Dossier-PDF met bijlagen | `src/lib/pdf.ts` | Wordt **in de browser** gemaakt. Bijlagen worden nooit geüpload. Betaald. |
| Advertentie-check (Claude API) | `/[lang]/check`, `src/app/api/check` | Login nodig. 3 gratis, daarna Zoekpas. Tekst wordt niet opgeslagen. |
| Login zonder wachtwoord | Supabase magic link | `/auth/callback` |
| Betalingen | Stripe Checkout + webhook + klantportaal | €19 eenmalig, €14,99/maand |
| Mijn matches | `/[lang]/matches`, `src/app/api/inbound` | Zoekpas. Gebruiker stuurt eigen zoekmeldingen door; AI haalt panden eruit, matchscore tegen zoekprofiel. |
| Kandidaturen-opvolging | `/[lang]/kandidaturen` | Zoekpas. Status, datums, notities, opvolgherinnering. |
| Statistieken | Vercel Web Analytics | Zonder cookies. Events: `checkout_start`, `listing_check`, `dossier_pdf`, `match_applied`. |
| Privacy & voorwaarden | `src/lib/legal.ts` | **Sjabloon: laten nakijken door een jurist.** |

Kernregels (`src/lib/rules.ts`) en PDF zijn getest: `npm test`.

## Lokaal draaien

```bash
npm install
cp .env.example .env.local   # vul de waarden in
npm run dev                  # http://localhost:3000
npm test                     # unit tests
npm run build                # productie-build
```

## Live zetten (± 1 uur)

### 1. Supabase
1. Maak een project aan op supabase.com, **regio EU (Frankfurt)**.
2. SQL Editor → run **in volgorde** `supabase/migrations/0001_init.sql`, `0002_matching_kandidaturen.sql`, `0003_security.sql`.
   Zet daarna de dagelijkse opruiming aan (Database → Cron): `select cron.schedule('huurklaar-cleanup', '17 3 * * *', 'select public.cleanup_old_data()');`
3. Authentication → URL Configuration: Site URL = je domein, Redirect URL = `https://JOUWDOMEIN/auth/callback`.
4. Authentication → Emails: stel een eigen SMTP in (bv. Resend of Brevo). De standaard Supabase-mail is alleen voor testen en sterk beperkt.
5. Aanrader tegen nep-accounts: Authentication → Attack Protection → CAPTCHA aanzetten.
6. Kopieer URL, anon key en service role key naar de env-variabelen.

### 2. Stripe
1. Products: maak **Dossier Klaar** (€19, eenmalig) en **Zoekpas** (€14,99, maandelijks). Prijzen **inclusief btw** (Tax behavior: inclusive).
2. Settings → Payment methods: zet **Bancontact** aan (belangrijk in België), plus kaart. Voor het abonnement werkt Bancontact via SEPA-domiciliëring.
3. Settings → Public details: vul de URL van je **voorwaarden** in (`/nl/voorwaarden`). Verplicht, want Checkout vraagt akkoord + afstand van herroepingsrecht.
4. Settings → Billing → Customer portal: activeer opzeggen en facturen.
5. Developers → Webhooks: endpoint `https://JOUWDOMEIN/api/stripe/webhook` met events:
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`,
   `charge.succeeded`, `charge.updated`, `charge.refunded` (voor omzet en Stripe-kosten in het beheerplatform).
6. Kopieer secret key, webhook secret en de twee price-ID's naar de env-variabelen.

### 3. Anthropic
API-sleutel op console.anthropic.com. Zet een maandelijkse uitgavenlimiet in de console.

### 4. Postmark (doorgestuurde meldingen)
1. Maak een Postmark-account en een **Inbound stream**.
2. DNS: zet een MX-record voor `in.huurklaar.be` naar `inbound.postmarkapp.com` en stel dat domein in als inbound domain.
3. Webhook-URL: `https://INBOUND_WEBHOOK_USER:INBOUND_WEBHOOK_PASSWORD@JOUWDOMEIN/api/inbound`.
4. Test met een **echte** Immoweb-, Zimmo- en Immovlan-meldingsmail. Belangrijk: als die sites hun links via een extern trackingdomein laten lopen, worden ze nu geweigerd (alleen links naar immoweb.be, zimmo.be, immovlan.be en realo.be worden aanvaard). Voeg dan het trackingdomein toe in `src/lib/matching.ts` (`SOURCES`).
5. Laat juridisch bevestigen dat het doorsturen van meldingsmails door de gebruiker past binnen de voorwaarden van die sites.

### 5. Vercel
1. Importeer de repo, framework Next.js.
2. Zet alle variabelen uit `.env.example`.
3. Koppel je domein (bv. huurklaar.be).
4. Zet **Web Analytics** aan in het project (custom events vragen een Pro-plan).
5. Test de volledige flow in **Stripe testmodus** (kaart `4242 4242 4242 4242`) vóór je live sleutels zet.

## Checklist vóór lancering

- [ ] `[ADRES]` invullen in `src/lib/legal.ts`; privacy en voorwaarden laten nakijken
- [ ] Mailadres privacy@ en support@ aanmaken
- [ ] Verwerkersovereenkomsten (DPA) bevestigen met Supabase, Stripe, Anthropic, Postmark, Vercel
- [ ] Naam en domein checken (merk Huurklaar nog niet geverifieerd)
- [ ] Volledige testaankoop in testmodus, daarna 1 echte aankoop en terugbetaling
- [ ] Spend-limiet Anthropic en budgetalarm Vercel

## Bewuste keuzes

- **Geen documenten op de server.** Minder risico, minder AVG-gedoe, en een sterk verkoopargument.
- **Geen scraping** van Immoweb/Zimmo: de gebruiker plakt zelf de advertentie.
- **Geen marktprijzen** in de check: er is geen betrouwbare bron, dus de AI mag ze niet verzinnen.
- **Atomische teller** (`claim_listing_check`) zodat de gratis limiet niet te omzeilen is met snelle dubbele klikken; mislukte AI-calls worden teruggeboekt.

## Beheerplatform (`/admin`)

| Pagina | Wat | Rol nodig |
|---|---|---|
| Overzicht | Omzet excl. btw, kosten, marge, trechter, grafiek per dag | iedereen in het team (financiën alleen voor Eigenaar, Beheerder, Analist) |
| Gebruikers | Zoeken, plan zien, bonuschecks, gratis dossier, blokkeren, wissen | Support+ (blokkeren: Beheerder, wissen: Eigenaar) |
| Betalingen | Alle Stripe-betalingen met btw en Stripe-kosten, terugbetalen | Analist kijkt, Beheerder betaalt terug |
| Kosten | AI-kosten per functie en model, Stripe-kosten, vaste kosten beheren | Analist kijkt, Beheerder beheert |
| Team en rollen | Rollen toekennen en intrekken, overzicht van rechten | Eigenaar |
| Auditlog | Elke beheeractie, onwijzigbaar | Eigenaar, Beheerder |

**Rollen:** Eigenaar · Beheerder · Support · Analist. De volledige matrix staat in `src/lib/roles.ts` en op de teampagina.

**Eerste keer instellen**
1. Run migratie `0004_admin.sql`.
2. Supabase → Authentication → Multi-Factor: zet **TOTP** aan.
3. Log één keer in op de site met je eigen e-mail.
4. SQL Editor: `insert into public.staff_roles (user_id, role) select id, 'owner' from auth.users where email = 'jouw@email.be';`
5. Ga naar `/admin`, stel je authenticator-app in. Daarna voeg je teamleden toe via Team en rollen.

**Cijfers zijn echt, niet geschat:** omzet en Stripe-kosten komen uit de Stripe-webhook, AI-kosten uit het werkelijke tokengebruik × de tarieven die jij instelt in `AI_PRICES_USD` en `USD_TO_EUR`, vaste kosten uit wat je zelf invoert. Ontbreekt een tarief, dan toont het platform "onvolledig" in plaats van te gokken.

**Let op:** een geblokkeerde gebruiker kan zijn huidige sessie nog tot ongeveer een uur gebruiken (tot het token verloopt). Omzet bij klanten buiten België in de EU kan onder OSS-btw vallen; dat rekent het platform niet apart.

## Beveiliging

Wat er ingebouwd is:

| Risico | Maatregel | Waar |
|---|---|---|
| XSS / script-injectie | CSP met nonce + `strict-dynamic`, geen `dangerouslySetInnerHTML`, links alleen http(s) van bekende domeinen | `src/proxy.ts`, `src/lib/security.ts`, `src/lib/matching.ts` |
| Clickjacking | `frame-ancestors 'none'` + `X-Frame-Options: DENY` | proxy, `next.config.ts` |
| CSRF | Origin/Referer-check op alle POST/PATCH/DELETE (behalve server-webhooks met eigen auth); cookies SameSite=Lax | `src/proxy.ts` |
| Open redirect | Alleen interne paden na login, ook gecodeerde trucs geblokkeerd | `safeRedirectPath` |
| Toegang tot andermans data | Row Level Security op elke tabel, kolomrechten: gebruikers kunnen hun plan, matches of tellers niet zelf wijzigen | migraties 0001–0003 |
| Gratis limiet omzeilen | Atomische teller in de database, functies niet aanroepbaar door gebruikers | `claim_listing_check` |
| Misbruik / kosten-aanval | Rate limits per gebruiker en IP, body-limieten, dagelijkse limieten, faalt dicht | `src/lib/ratelimit.ts`, proxy |
| Valse betalingen | Stripe-webhook met handtekening, idempotent; rechten alleen via webhook | `api/stripe/webhook` |
| Vervalste meldingsmails | Basic auth met timing-safe vergelijking + geheim token per gebruiker | `api/inbound` |
| Prompt injection | Advertentie/mail als data gemarkeerd, gestructureerde output, URL's gecontroleerd tegen de bron, output alleen als tekst getoond | `src/lib/listing.ts`, `src/lib/inbound.ts` |
| Gevoelige documenten | Bijlagen en dossier verlaten het toestel niet | `src/lib/pdf.ts` |
| Geheimen | `server-only` op alle servermodules, enkel URL + anon key publiek | `src/lib/*` |
| Afhankelijkheden | `npm audit` schoon bij oplevering; zet Dependabot aan op GitHub | |
| Beheerplatform | Verplichte TOTP-tweestapsverificatie, rol per actie server-side gecontroleerd, gevaarlijke acties met bevestiging (wissen: e-mail intypen), laatste eigenaar beschermd, auditlog alleen-toevoegen, `noindex` | `src/lib/staff.ts`, `0004_admin.sql` |
| Melden van lekken | `/.well-known/security.txt` | `public/.well-known` |

Getest: `npm test` (36 tests, incl. rollenmatrix en kostenberekening, incl. open redirect, CSRF-check, CSP) en handmatig: CSRF 403, body 413, webhook zonder auth 401, redirect naar vreemd domein geblokkeerd.

Nog te doen vóór lancering:
- [ ] Supabase: e-mailbevestiging + CAPTCHA aan, wachtwoordloze login rate limits nakijken, Point-in-Time Recovery of dagelijkse back-up
- [ ] Supabase Security Advisor draaien (Database → Advisors) na de migraties
- [ ] Vercel: Firewall/attack challenge mode kennen, logs niet langer dan 30 dagen
- [ ] GitHub: Dependabot en secret scanning aan
- [ ] Een externe pentest of minstens een scan (bv. OWASP ZAP) op de live testomgeving
- [ ] security@huurklaar.be aanmaken
