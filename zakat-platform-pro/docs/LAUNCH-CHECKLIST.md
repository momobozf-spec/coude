# Vóór de lancering

De code is klaar voor productie op het gratis plan. Dit zijn de dingen die geen
code zijn en die niemand anders voor je kan afvinken.

## Religieus

- [ ] **Regelset laten nakijken.** De standaardregelset (`prisma/seed/rulesets.ts`:
  2,5 %, 85 g goud, 595 g zilver, aftrekbare kortlopende schulden) door een
  geleerde laten bevestigen, met naam en datum. Leg dat vast als bron.
- [ ] **Kennisbankartikelen** staan op `IN_REVIEW` en worden niet mee in productie
  gezet (`db:reference` slaat ze over). Pas na nakijken publiceren.
- [ ] De disclaimer ("geen vervanging voor religieus advies") staat op elke
  berekening — laten bevestigen dat de formulering klopt.

## Juridisch

- [ ] `/privacy` en `/voorwaarden` door een jurist laten nalezen. Het gaat om
  financiële gegevens en (art. 9) religieuze overtuiging; de teksten zijn een
  degelijke basis, geen juridisch advies. Daarna `LEGAL_TEXTS_REVIEWED=1`.
- [ ] Uitbater: Marhaba Data & AI Agent BV, BE 1003.552.102, Zaventem,
  momobozf@gmail.com (standaard in `src/modules/legal/identity.tsx`). Nog
  invullen: `LEGAL_ENTITY_ADDRESS` (straat, nr, postcode van de zetel).
- [ ] Registratie vraagt nu uitdrukkelijke toestemming (art. 9.2.a) en bewaart
  het tijdstip (`users.specialDataConsentAt`). Google-login vraagt dat nog niet:
  laat `AUTH_GOOGLE_ID/SECRET` leeg tot dat ook daar gebeurt.
- [ ] Betaalde plannen staan als "nog niet beschikbaar" (`PAID_PLANS_AVAILABLE`
  in `src/config/plans.ts`). Pas op `true` met een betaalprovider en prijzen.
- [ ] Verwerkersovereenkomsten (DPA) met je hosting-/databaseprovider en met
  Resend. Kies EU-regio's.
- [ ] Register van verwerkingsactiviteiten bijhouden (AVG art. 30).
- [ ] Procedure voor een datalek: wie beslist, binnen 72 uur melden bij de GBA.

## Gegevens

- [ ] **Prijzen**: wie publiceert elke werkdag goud en zilver, en wie neemt over
  bij vakantie? Zonder actuele prijs weigert de app te rekenen.
- [ ] Bron voor goud/zilver gekozen en toegestaan om te gebruiken (licentie).
- [ ] MAD, SAR en AED: zelf publiceren of uit de valutalijst halen.
- [ ] **Goede doelen**: alleen opnemen met echte, gecontroleerde bronnen
  (`npm run charity:import`). Geen organisaties tonen zonder hun medeweten als je
  daar twijfel over hebt.

## Technisch

- [ ] Domein met TLS; `NEXT_PUBLIC_APP_URL` en `AUTH_URL` op `https://…`.
- [ ] Resend: afzenderdomein geverifieerd (SPF, DKIM, DMARC). Test een herstelmail
  naar Gmail en Outlook — komt hij niet in spam?
- [ ] Persistent volume voor `/data` en back-up daarvan; hersteltest gedaan.
- [ ] Alert op `worker.prices_stale`, `reminders.email_failed`, `ready.failed`
  en op `/api/ready` (uptime-monitor).
- [ ] CI groen (`.github/workflows/ci.yml`), inclusief e2e.
- [ ] Eén webinstantie (zie rate limiting in README → Bekende beperkingen).

## Commercieel

- [ ] **Betalingen** zitten niet in v1. Lanceer op het gratis plan. Voor
  betaalde plannen zijn nodig: Mollie of Stripe, webhooks die de `Subscription`
  bijwerken, btw-facturen, herroepingsrecht (14 dagen) en aangepaste voorwaarden.
- [ ] Ramadan 2027 begint rond 8 februari (afhankelijk van de maanwaarneming): plan de lancering ruim vóór die
  periode, zodat prijspublicatie en support ingelopen zijn.
