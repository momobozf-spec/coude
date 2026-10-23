# Vóór echte leden

De code is klaar voor productie. Dit zijn de beslissingen en gegevens die alleen
jij kunt aanleveren — niets hiervan is in de code verzonnen.

## Gegevens en accounts

- [ ] Uitbater: **Marhaba Data & AI Agent BV**, BE 1003.552.102, Zaventem,
      momobozf@gmail.com — standaard in `src/config/legal.ts`. Nog invullen:
      `LEGAL_ENTITY_ADDRESS` (straat, nr, postcode van de zetel). Verschijnt in de
      voorwaarden, het privacybeleid en de footer.
- [ ] Productie zonder `STAGING`: de app weigert dan te starten met mock-AI,
      stub-betalingen, demo-vermeldingen of een Stripe-testsleutel.
- [ ] **Domein** kopen en in Resend verifiëren (SPF/DKIM). Zonder domein krijgen
      leden geen mail voor wachtwoordherstel. Daarna `EMAIL_FROM` =
      `Muslim Life <noreply@jouwdomein>` en `APP_URL`/`AUTH_URL` naar het domein.
- [ ] **Naam "Muslim Life"**: controleer bij het BOIP/EUIPO of de naam vrij is.
- [ ] **Hosting** op een betaald plan met back-ups (gratis = alleen testen).

## Betalingen (Stripe)

- [ ] Stripe-account geverifieerd voor je BV.
- [ ] Product "Muslim Life Premium" met twee prijzen: €7,99/maand en €79/jaar,
      **btw inbegrepen** (zo staat het op de site).
- [ ] Customer Portal aanzetten (opzeggen, kaart wijzigen).
- [ ] Webhook naar `https://<domein>/api/webhooks/stripe` met events
      `checkout.session.completed`, `customer.subscription.created`,
      `customer.subscription.updated`, `customer.subscription.deleted`,
      `invoice.paid`, `invoice.payment_failed`.
- [ ] Env: `PAYMENTS_PROVIDER=stripe`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
      `STRIPE_PRICE_PREMIUM_MONTHLY`, `STRIPE_PRICE_PREMIUM_YEARLY`.
- [ ] Eerst volledig testen met `sk_test_…` (met `STAGING=1`): kopen, proefperiode,
      opzeggen, mislukte betaling. Bij het afrekenen moet het vakje "Premium meteen
      starten / herroeping = betalen voor geleverde periode" aangevinkt worden.

- [ ] **Herroepen** (`/legal/withdrawal`): elke herroeping komt per e-mail binnen
      op `LEGAL_CONTACT_EMAIL` (met het Stripe-abonnement). Terugbetalen pro rata in
      Stripe binnen 14 dagen en het abonnement stopzetten.

## Inhoud en juridisch

- [ ] Voorwaarden en privacybeleid (EN/NL/FR, concept) laten nalezen door een
      jurist; daarna `LEGAL_TEXTS_REVIEWED=1` (haalt de concept-melding weg).
      Arabische lezers krijgen de Engelse tekst.
- [ ] Verwerkersovereenkomsten (DPA) met hosting, database, Stripe, Resend en de
      AI-aanbieder.
- [ ] **Religieuze inhoud** (dagelijkse verzen, hadith en dua's in
      `prisma/seed/content.ts`) laten nakijken door iemand met kennis: tekst,
      vertaling en bronvermelding. Tot dan toont elke dagelijkse herinnering
      "Inhoud wordt nagelezen"; pas na de review `RELIGIOUS_CONTENT_REVIEWED=1`.
- [ ] **Vertalingen** NL/FR/AR laten nalezen (de app toont tot dan zelf dat ze
      machinaal zijn). Pas na nalezing `_meta.reviewedBy` invullen.
- [ ] **Demo-vermeldingen** uitzetten (`SEED_DEMO_LISTINGS` weg) zodra er echte
      partners zijn. Bestaande demo-rijen verwijder je via `/admin`.
- [ ] Ledenaanbiedingen: zonder echte partners heeft Premium geen ledendeals —
      dat staat zo ook op de site ("as they join").

## Techniek

- [ ] `npm run verify` en `npm run test:integration` groen.
- [ ] `npm run db:drift` op een lege database na de migraties: geen afwijkingen.
- [ ] GitHub Actions `maintenance` groen.
- [ ] Uptime-monitor op `/api/ready`.
- [ ] Google-login pas aanzetten nadat ook daar de expliciete toestemming wordt
      gevraagd (nu alleen bij registratie met e-mail).
