# Vóór de eerste echte bestelling

De code is klaar; dit zijn de beslissingen en gegevens die alleen jij kunt
aanleveren. Niets hiervan is in de code verzonnen.

## Gegevens en accounts

- [ ] **Verkoper**: Marhaba Cooperation BV — `LEGAL_ENTITY_VAT` (ondernemingsnummer),
      `LEGAL_ENTITY_ADDRESS` (maatschappelijke zetel) en `LEGAL_CONTACT_EMAIL` ingevuld.
      Verschijnt op contact, voorwaarden, privacybeleid en in de footer.
- [ ] **Domein kopen** (bv. layali.be, ± €10 per jaar) en in Resend verifiëren
      (SPF/DKIM). **Zonder eigen domein krijgen klanten geen orderbevestiging,
      verzendmail of wachtwoordherstel**: Resend mailt dan alleen naar je eigen
      account. Daarna `RESEND_FROM` = `Layali <bestellingen@jouwdomein.be>`.
- [ ] **Mollie**: account geverifieerd, betaalmethodes geactiveerd, `live_…`-sleutel.
- [ ] **Hosting**: betaald plan met back-ups (de gratis opstelling is alleen voor testen).

## Catalogus

- [ ] Eigen producten met **echte foto's** en echte voorraad. De demo-catalogus
      gebruikt placeholderfoto's en verzonnen aantallen; zet `SEED_DEMO=0`.
- [ ] Afbeeldingen van een andere host dan Unsplash/Cloudinary/Google/picsum?
      Voeg de host toe aan `images.remotePatterns` in `next.config.ts`.
- [ ] **Marktplaats** staat uit (`MARKETPLACE_ENABLED=0`). De demo-verkopers
      bestaan niet. Pas aanzetten met echte verkopers en een verkopersovereenkomst.

## Beslissingen voor de voorwaarden

- [ ] **Retourkosten**: wie betaalt het terugsturen? Staat dat niet in de
      voorwaarden, dan draag jij die kosten volgens de wet.
- [ ] **Levertermijnen** (nu "3-5 werkdagen", express "1-2 werkdagen"): klopt dat
      met je pakketdienst?
- [ ] Voorwaarden en privacybeleid laten nalezen door een jurist.

## Techniek

- [ ] `npm run verify` en `npm test` groen.
- [ ] Een testbestelling end-to-end in Mollie-testmodus (paid, failed, expired).
- [ ] GitHub Actions `cron` groen.
- [ ] Uptime-monitor op `/api/ready`.
