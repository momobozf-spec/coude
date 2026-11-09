# Vóór de eerste echte bestelling

De code is klaar; dit zijn de beslissingen en gegevens die alleen jij kunt
aanleveren. Niets hiervan is in de code verzonnen.

## Gegevens en accounts

- [ ] **Verkoper**: Marhaba Data & AI Agent BV, ondernemingsnummer BE 1003.552.102,
      Zaventem, momobozf@gmail.com — staan als standaard in `src/lib/legal.ts`.
      **Nog invullen:** `LEGAL_ENTITY_ADDRESS` (straat, huisnummer, postcode van de
      maatschappelijke zetel). Zonder adres toont de site alleen "Zaventem" en
      logt de app een waarschuwing; een webshop moet het volledige adres tonen.
- [ ] **Domein kopen** (bv. layali.be, ± €10 per jaar) en in Resend verifiëren
      (SPF/DKIM). **Zonder eigen domein krijgen klanten geen orderbevestiging,
      verzendmail of wachtwoordherstel**: Resend mailt dan alleen naar je eigen
      account. Daarna `RESEND_FROM` = `Layali <bestellingen@jouwdomein.be>`.
- [ ] **Mollie**: account geverifieerd (op naam van de BV), betaalmethodes
      geactiveerd (Bancontact, iDEAL, kaart), `live_…`-sleutel. In productie
      zonder `STAGING=1` weigert de app te starten met een `test_…`-sleutel.
- [ ] **Hosting**: betaald plan met back-ups (de gratis opstelling is alleen voor testen).

## Catalogus

- [ ] Eigen producten met **echte foto's** en echte voorraad. De demo-catalogus
      gebruikt placeholderfoto's en verzonnen aantallen; zet `SEED_DEMO=0` en
      verwijder `STAGING`.
- [ ] **Kaarsen, wierook en huisparfum (GPSR/CLP)**: per product in het beheer
      de veiligheidsinformatie (NL én FR: H-/P-zinnen, allergenen, gebruik),
      CLP-pictogrammen en de fabrikant (naam, postadres, e-mail) invullen; zit de
      fabrikant buiten de EU, ook de verantwoordelijke marktdeelnemer in de EU.
      Neem dit over van het etiket/veiligheidsinformatieblad van je leverancier.
      Het beheer weigert zo'n product actief te zetten zonder deze gegevens.
      Controleer ook dat het fysieke etiket in het Nederlands en Frans is.
- [ ] Afbeeldingen van een andere host dan Unsplash/Cloudinary/Google/picsum?
      Voeg de host toe aan `images.remotePatterns` in `next.config.ts`.
- [ ] **Marktplaats** staat uit (`MARKETPLACE_ENABLED=0`). De demo-verkopers
      bestaan niet. Pas aanzetten met echte verkopers, een verkopersovereenkomst
      en de DSA-verplichtingen (verkopers identificeren, meldprocedure).

## Beslissingen voor de voorwaarden

- [ ] **Retourkosten**: standaard draagt de klant de kosten van het terugsturen
      (`RETURN_COSTS_PAID_BY=customer`). Wil je die zelf betalen: `seller`.
      Voorwaarden, retourpagina en herroepingsformulier passen zich aan.
- [ ] **Levertermijnen** (nu "3-5 werkdagen", express "1-2 werkdagen"): klopt dat
      met je pakketdienst?
- [ ] Voorwaarden, privacybeleid, cookiebeleid, retourpagina en
      herroepingsformulier (NL en FR) laten nalezen door een jurist. Daarna
      `LEGAL_TEXTS_REVIEWED=1`: dan verdwijnt de melding "Concept".

- [ ] **Herroepen** (`/withdrawal`): elke herroeping komt als e-mail binnen op
      `ADMIN_EMAIL` en als notitie op de bestelling (`needsAttention`). Terugbetalen
      in het Mollie-dashboard binnen 14 dagen. Laat de jurist de knopteksten
      ("Hier de overeenkomst herroepen") toetsen aan de Belgische omzetting van
      Richtlijn (EU) 2023/2673.

## Techniek

- [ ] `npm run verify` en `npm test` groen, ook de integratietests met
      `TEST_DATABASE_URL` (echte PostgreSQL).
- [ ] `npx prisma migrate deploy` (nieuwe migratie `20261024090000_product_safety`).
- [ ] Een testbestelling end-to-end in Mollie-testmodus (paid, failed, expired).
- [ ] GitHub Actions `cron` groen.
- [ ] Uptime-monitor op `/api/ready`.
