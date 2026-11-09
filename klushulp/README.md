# Klushulp (werktitel)

Lokale marktplaats voor loodgieters, elektriciens en klushulp. Klant plaatst een klus in één minuut zonder account, gematchte vakbedrijven sturen een voorstel met prijs en eerste vrije moment, klant vergelijkt en bevestigt, beoordeelt na afronding.

Exploitant: Marhaba Cooperation BV. Startregio: Antwerpen. Talen: NL/FR.

## Status (1 nov 2026)

Werkende verticale keten: **aanvraag → matching → voorstel → acceptatie → afspraak → afronding → beoordeling**, getest (20 tests) en in de browser doorlopen (zie `demo-output/`).

| Onderdeel | Status |
|---|---|
| Klant: home, 3-staps wizard zonder account, foto's, gemeente-opzoeking, categoriesuggestie op trefwoorden | werkt |
| Klant: persoonlijke link, voorstellen vergelijken, accepteren, berichten, annuleren, melden, beoordelen, aanvraag uitbreiden | werkt |
| Secundaire route: dienstverleners zoeken, publiek profiel, gerichte aanvraag | werkt |
| Dienstverlener: registratie (KBO), profiel, werkgebied, beschikbaarheid, verificaties, relevante aanvragen, voorstel, berichten, opdrachten afronden | werkt |
| Beheer: overzicht, dienstverleners + verificaties, activeren (geblokkeerd tot vereiste verificaties goedgekeurd), schorsen, gebruikers, aanvragen, boekingen, meldingen, moderatie beoordelingen, categorieën/regio's, platformkosten | werkt |
| Platformkosten per bevestigde afspraak (configureerbaar, aangerekend aan dienstverlener) | werkt, **registratie gesimuleerd** |
| Betalingen via Stripe Connect | **niet geïmplementeerd** — integratiegrens in `src/lib/payments.ts` |
| E-mail (bevestiging, notificaties) | **niet ingesteld** — link wordt op het scherm getoond |
| AI-verduidelijking van de beschrijving | **niet ingeschakeld** — trefwoordsuggestie werkt zonder AI |
| Particuliere klushulp (deeleconomie) | **bewust uitgeschakeld** (zie Juridisch) |

## Productkeuzes

- **Geen account voor klanten.** Toegang tot de aanvraag via een persoonlijke link (32-byte token). Contactgegevens worden pas gevraagd bij verzenden en pas gedeeld met de dienstverlener na acceptatie van diens voorstel. Exact adres idem.
- **Alleen vakbedrijven (KBO) in fase 1.** Loodgieter, elektricien én klushulp vereisen een goedgekeurde KBO-verificatie vóór activering. Badges tonen uitsluitend goedgekeurde verificaties; de admin controleert handmatig (KBO Public Search).
- **Matching = categorie × werkgebied (basis + straal) × wekelijkse beschikbaarheid in de gewenste periode.** Geen aanbod → eerlijke melding + uitbreiding (straal, data). Niets wordt verzonnen.
- **Prijssoorten:** vaste prijs, uurtarief (met geschatte uren), raming (nooit als eindprijs gepresenteerd), plaatsbezoek/diagnose. Inbegrepen/uitgesloten, verplaatsing en materiaal expliciet.
- **Verdienmodel:** platformkosten (standaard 10 %, min. € 5) op het referentiebedrag van het geaccepteerde voorstel, gedragen door de dienstverlener, alleen bij bevestigde afspraak. Klant betaalt de vakman rechtstreeks (factuur). Geen geldbewaring, geen escrow.
- **Eén boeking per aanvraag** is een database-constraint (`booking.request_id UNIQUE`) + rij-lock bij acceptatie: dubbele boeking is fysiek onmogelijk.
- **Beoordelingen** alleen bij `booking.status = completed`, één per boeking (unieke index).
- **Autorisatie server-side:** dienstverleners zien enkel aanvragen waarvoor een `request_match` bestaat; berichten zijn per aanvraag × dienstverlener; bestanden staan buiten `public/` en worden na controle geserveerd (`/files/...`).
- **Demo-data** is gemarkeerd (`is_demo`, e-mails op `klushulp.local`, "Demo" in de naam) en wordt geweigerd in productie.

## Lokaal starten

Vereist Node 20+ en PostgreSQL. In de `coude`-map start `start-lokaal.cmd` alles (database op poort 54329, Klushulp op http://localhost:4500). Handmatig:

```bash
cp .env.example .env        # vul BETTER_AUTH_SECRET in; ALLOW_DEMO_DATA=true en DEMO_PASSWORD voor demo
npm ci
npm run db:migrate
npm run db:seed-catalog      # regio Antwerpen, gemeenten, categorieën (ook in productie)
npm run demo:seed            # demo-accounts (nooit in productie)
npm run dev                  # http://localhost:3000
```

Demo-accounts (wachtwoord = `DEMO_PASSWORD`): `beheer@klushulp.local` (beheer), `loodgieter1@`, `loodgieter2@`, `elektricien1@`, `elektricien2@`, `klushulp1@klushulp.local` (actief), `wachtend@klushulp.local` (in afwachting).

Eerste echte beheerder: `ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run admin:create`.

## Testen

```bash
npm run typecheck && npm run lint
npm test                     # vitest, aparte database TEST_DATABASE_URL (wordt leeggemaakt)
npm run build
```

Browser-e2e (Playwright, mobiel viewport) staat in `demo-output/e2e.cjs`; resultaat en screenshots in `demo-output/`.

## Structuur

```
src/app/[locale]/        pagina's (nl, fr): home, aanvraag, a/[token], zoeken, dienstverlener/[id], login, dienstverlener-worden, dashboard/*, beheer/*, juridisch
src/app/api/             auth (better-auth), gemeenten, uploads, health
src/app/files/           beveiligde bestandslevering
src/lib/services/        domeinlogica: requests, matching, proposals, bookings, messages, providers, admin
src/lib/                 auth, session, money, geo, availability, fees, payments (grens), uploads, rate-limit, production-guard
src/db/schema.ts         Drizzle-schema; drizzle/ migraties
src/i18n/                nl.ts, fr.ts
scripts/                 migrate, seed-catalog, demo-seed, admin-create
tests/                   unit + integratie
```

## Activering externe diensten

- **Stripe Connect** (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`): implementeer `StripeConnectProvider` in `src/lib/payments.ts` (Express-account per dienstverlener, incasso platformkosten via Billing of PaymentIntent met application fee), webhook-route `/api/stripe/webhook`, onboarding-stap in dashboard. Tot dan: `payment_provider = simulated`, zichtbaar in beheer en opdrachtdetail.
- **SMTP** (`SMTP_*`): bevestigingsmail met klantlink, notificaties bij nieuw voorstel/bericht/acceptatie. Nu: link op het scherm.
- **AI** (`ANTHROPIC_API_KEY`): optionele verduidelijking van de beschrijving; de wizard werkt zonder.
- **Gemeentedata:** `scripts/seed-catalog.ts` bevat benaderende centroïden voor 39 gemeenten in regio Antwerpen; vóór lancering vervangen door een officiële dataset.

## Juridisch — vóór publieke lancering

Geen van onderstaande punten is afgehandeld; het platform maakt er geen claims over.

1. **Deeleconomie / particuliere klushulp.** Diensten tussen particulieren via een platform vallen enkel onder het gunstregime (10 % belasting, geen sociale bijdragen) als het platform **erkend is door de FOD Financiën** en de betaling via het platform loopt (Unizo ondernemersgids "deeleconomie"; circulaire 2021/C/44, geraadpleegd 1 nov 2026). Zonder erkenning: alleen ondernemingen toelaten (huidige keuze).
2. **Toegang tot het beroep** elektricien/loodgieter: in Vlaanderen afgeschaft; Brussel/Wallonië controleren bij uitbreiding.
3. **Consumentenbescherming:** herroepingsrecht en informatieplicht bij overeenkomsten op afstand (Wetboek Economisch Recht, boek VI) — voorwaarden laten opstellen, incl. rol van het platform als bemiddelaar.
4. **GDPR:** privacyverklaring, verwerkingsregister, bewaartermijnen (aanvragen verlopen na 14 dagen; opschoning van foto's/tokens nog te plannen), verwerkersovereenkomst met Render (EU-regio Frankfurt).
5. **Platformkosten en btw:** factuur van Marhaba Cooperation BV aan de dienstverlener per bevestigde afspraak; btw-behandeling laten bevestigen door de boekhouder.
6. **Verzekering/aansprakelijkheid:** het platform biedt geen verzekering en claimt dat ook niet; badge "Verzekering gecontroleerd" betekent enkel dat een attest werd gezien.
