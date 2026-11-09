# RentGuard Brussels

Mobile-first PWA voor huurders in het Brussels Hoofdstedelijk Gewest, tweetalig
NL/FR.

Vier pijlers:

1. **Plaatsbeschrijving** — begeleide fotodocumentatie bij intrek en vertrek, met
   bewijsintegriteit (SHA-256 + servertijdstempel) en PDF-rapporten
2. **Waarborg-terugeis** — termijnbewaking en ingebrekestellingen uit
   versioneerde templates
3. **Huurprijs- & indexatie-auditor** — toetsing aan het indicatieve huurrooster
   en de wettelijke indexatieformule
4. **Contract- & gebrekenassistent** — clausulescan en Q&A met bronvermelding

## Status (2026-10-24)

Lanceerbaar in beperkte scope: **plaatsbeschrijving + PDF + AI-vergelijking +
medeondertekening**, met Stripe-betaling per woning en wachtwoordherstel.
Waarborgbrieven staan achter een feature-flag (uit) tot na juridische review.
Auditors en contractscan zijn nog niet gebouwd. Zie [PROGRESS.md](PROGRESS.md).

| | |
|---|---|
| Typecheck / lint / tests / build | groen (228 unit tests) |
| Databankschema + RLS | klaar, nog niet tegen een echte DB uitgerold |
| Betalingen (Stripe Checkout + webhook) | code klaar, wacht op Stripe-account |
| Privacyverklaring / voorwaarden | `/nl|fr/legal/privacy`, `/nl|fr/legal/terms` — **concept, te laten nalezen** |

## Aan de slag

```bash
npm install
cp .env.example .env.local     # vul minstens de Supabase-waarden in
npm run dev
```

Verificatie-gate:

```bash
npm run verify                 # typecheck + lint + test + build
```

Migraties:

```bash
supabase link --project-ref <ref>
supabase db push
```

## Integraties

Zie [INTEGRATIONS.md](INTEGRATIONS.md) voor de volledige tabel.

| Integratie | Status |
|---|---|
| Supabase | CONFIGURATION REQUIRED |
| Vision-analyse (Anthropic) | CONFIGURATION REQUIRED |
| Resend | CONFIGURATION REQUIRED |
| Stripe | CONFIGURATION REQUIRED |
| Aangetekende zending | CONFIGURATION REQUIRED |
| Sentry | CONFIGURATION REQUIRED |
| Eigen huurrooster-berekening | NOT AVAILABLE — [reden](docs/decisions/0002-huurrooster-geen-eigen-berekening.md) |

Zonder enige integratie werkt nog steeds: de check-in- en check-outwizard met
handmatige classificatie, de PDF-rapporten als download, en de
"verstuur zelf"-route voor aangetekende zending.

## Feature-flags

Alles staat standaard **uit**; aanzetten kan alleen met een expliciete env-var.

| Flag | Wat | Waarom uit |
|---|---|---|
| `FEATURE_DEPOSIT_LETTERS` | Ingebrekestelling / waarborgbrieven (`buildLetter` weigert met `FEATURE_DISABLED`) | Templates staan op `PLACEHOLDER`; juridische review ontbreekt |
| `FEATURE_TENANT_PROTECT_SUBSCRIPTION` | Abonnement te koop | Ontgrendelt assistent/contractscan/audits die nog niet bestaan |

## Betalingen (Stripe)

Flow: `/[locale]/billing` → server action maakt een Checkout Session (met
`user_id`, `plan_key`, `property_id` als metadata en een verplicht vinkje
"onmiddellijke uitvoering / verlies herroepingsrecht") → Stripe → webhook
`/api/stripe/webhook` kent het pakket toe in `entitlements`.

De webhook:

- controleert de `Stripe-Signature` (HMAC over de ruwe body, met tijdstolerantie);
- is idempotent via `stripe_events` (dubbele levering = no-op; mislukte
  verwerking wordt bij de volgende poging opnieuw gedaan) én via de unieke
  `stripe_checkout_session_id`;
- kent pas toegang toe bij `payment_status = paid` (Bancontact/SEPA wachten op
  `checkout.session.async_payment_succeeded`);
- controleert dat de woning in de databank van de koper is;
- trekt het pakket in bij een volledige terugbetaling (`charge.refunded`);
- synchroniseert abonnementsstatus (`customer.subscription.*`) naar `profiles`.

Tests: `src/lib/billing/webhook.test.ts` (gemockte events, echte
signatuurcontrole), `checkout.test.ts`.

**Wat jij in Stripe moet aanmaken** (bedragen uit de migratie — **te bevestigen**):

| Product | Prijs | Env-var |
|---|---|---|
| Deposit Recovery | eenmalig € 29,99 incl. btw | `STRIPE_PRICE_DEPOSIT_RECOVERY` |
| All-in Relocation Pass | eenmalig € 49,99 incl. btw | `STRIPE_PRICE_RELOCATION_PASS` |
| Tenant Protect (optioneel, flag) | € 4,99 / maand | `STRIPE_PRICE_TENANT_PROTECT` |

Pas je een bedrag aan, wijzig dan ook `pricing_config.amount_cents` (daar
haalt de app het getoonde bedrag).

Webhook-endpoint in Stripe: `https://<domein>/api/stripe/webhook`, events:
`checkout.session.completed`, `checkout.session.async_payment_succeeded`,
`checkout.session.async_payment_failed`, `charge.refunded`,
`customer.subscription.created`, `customer.subscription.updated`,
`customer.subscription.deleted`. Het signing secret gaat in
`STRIPE_WEBHOOK_SECRET`.

Lokaal testen: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

## Wachtwoordherstel

`/[locale]/login` → "Wachtwoord vergeten?" → `/[locale]/forgot-password`
(antwoordt altijd hetzelfde, geen account-enumeratie) → e-mail van Supabase →
`/auth/callback` of `/auth/confirm` → `/[locale]/reset-password` (nieuw
wachtwoord, andere sessies worden afgemeld). Redirects gaan door een allowlist
(`src/lib/auth/redirect.ts`).

Supabase-instellingen (Authentication → URL Configuration):

- Site URL: `https://<domein>`
- Redirect URLs: `https://<domein>/auth/callback**`, `https://<domein>/auth/confirm**`
- Aanbevolen: e-mailtemplate *Reset Password* met link
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&locale=nl`
  (werkt ook als de mail in een andere browser geopend wordt).
- Stel een eigen SMTP in (bv. Resend) — de ingebouwde Supabase-mailer is
  sterk rate-limited.

## Live zetten (Vercel + Supabase, EU)

1. **Supabase**: nieuw project in regio **eu-central-1 (Frankfurt)**.
   `supabase link --project-ref <ref>` en `supabase db push`. Controleer dat de
   buckets `inspection-photos`, `reports`, `contracts` privé zijn. Stel Auth-URL's
   en SMTP in zoals hierboven.
2. **Vercel**: importeer de repo, root directory `rentguard`, framework Next.js,
   *Function Region* `fra1` (Frankfurt). Zet alle env-vars uit `.env.example`
   (Production): minimaal `APP_URL`, de drie Supabase-waarden en
   `LEGAL_ENTITY_ADDRESS`.
3. **Stripe**: live-sleutels, producten/prijzen en webhook zoals in §Betalingen;
   Bancontact activeren.
4. **Optioneel**: `ANTHROPIC_API_KEY` (AI-vergelijking), `RESEND_API_KEY` +
   `RESEND_FROM_EMAIL` (uitnodiging verhuurder; domein verifiëren in Resend).
5. **Domein** koppelen in Vercel en `APP_URL` erop zetten; daarna Supabase
   Site URL + Stripe-webhook-URL op hetzelfde domein.
6. Controle na deploy: `GET /api/health` → `{"status":"ok"}`; registreren,
   wachtwoord herstellen, testaankoop met Stripe-testmodus op een preview.

**Productie-guard** (`src/lib/production-guard.ts`, via
`src/instrumentation.ts`): in productie stopt de server bij een niet-https
`APP_URL`, placeholder-Supabase-waarden, ontbrekend `LEGAL_ENTITY_ADDRESS`, een
Stripe-sleutel zonder webhookgeheim, of een `sk_test_`-sleutel (tenzij
`ALLOW_STRIPE_TEST_KEYS_IN_PRODUCTION=true`).

## Juridische review vereist vóór lancering

Dit product raakt aan rechten van mensen die er geld en woonzekerheid aan
ophangen. De volgende punten moeten door een jurist zijn nagekeken vóór er
één echte gebruiker op komt:

1. **Brieftemplates.** Alle templates staan op `PLACEHOLDER` en de functie staat
   achter `FEATURE_DEPOSIT_LETTERS` (uit). Pas aanzetten na review.
2. **Artikelverwijzingen.** De geconsolideerde Brusselse Huisvestingscode kon in
   Fase 0 niet automatisch worden uitgelezen. Art. 220, 224/2, 248 en 249 moeten
   woordelijk worden nagelezen. Zie [docs/juridisch.md](docs/juridisch.md) §0.
3. **EPB-indexatieregels.** Drie bronnen, drie onverenigbare lezingen. De regel
   staat op `UNVERIFIED` en draagt geen enkele brief.
4. **De boete van 10 % per maand** bij laattijdige waarborg: loopt die van
   rechtswege of vereist ze een ingebrekestelling? Bepaalt of onze brief het
   bedrag mag vorderen.
5. **Privacyverantwoording** — zie [docs/privacy.md](docs/privacy.md), met zeven
   openstaande vragen, waaronder of een DPIA vereist is.
6. **Disclaimers en framing** — zie
   [ADR 0003](docs/decisions/0003-bewijswaarde-framing.md).
7. **Privacyverklaring en algemene voorwaarden** (concept, NL/FR) onder
   `src/app/[locale]/legal/`. Uitbater: Marhaba Data & AI Agent BV,
   BE 1003.552.102, Zaventem (adres via `LEGAL_ENTITY_ADDRESS`).
8. **Verwerkersovereenkomsten** met Supabase, Vercel, Anthropic, Resend en
   Stripe afsluiten/accepteren; DPIA-vraag uit `docs/privacy.md` beantwoorden.

## Wat dit product niet is

- Geen advocatenkantoor, geen juridisch advies, geen procesvertegenwoordiging.
- Een eenzijdig fotorapport is **geen** tegensprekelijke plaatsbeschrijving. Het
  is bewijsmateriaal dat een rechter vrij beoordeelt. De app legt dat verschil
  uit in gewone taal.
- Wij garanderen geen enkele uitkomst. De termen "juridisch waterdicht",
  "gegarandeerd" en "rechtsgeldig aangetekend" staan op een verbodslijst die
  door een test wordt afgedwongen — de build faalt als ze terugkomen.

## Documentatie

| | |
|---|---|
| [docs/juridisch.md](docs/juridisch.md) | Alle juridische regels met bron, raadpleegdatum en verificatiestatus |
| [docs/privacy.md](docs/privacy.md) | Aanzet tot verwerkingsregister |
| [docs/decisions/](docs/decisions/) | Architectuurbeslissingen |
| [INTEGRATIONS.md](INTEGRATIONS.md) | Wat je moet configureren |
| [PROGRESS.md](PROGRESS.md) | Voortgang per fase |
