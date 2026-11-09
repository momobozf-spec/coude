# ADR 0004 — Auth.js (next-auth v5) voor authenticatie

Datum: 2026-08-29
Status: aanvaard

## Context

De brief: "Auth: bestaand systeem hergebruiken; anders Auth.js met
e-mailverificatie". Er is geen bestaand systeem — Parking Guard is een nieuw
project (ADR 0001).

Er was wel een reden om te twijfelen. De huisconventie in de buurprojecten is een
zelfgebouwde sessielaag, en `immoradar-belgium/src/lib/session.ts` documenteert
expliciet waarom next-auth daar is afgewezen: één inlogvorm, geen
zelfregistratie, geen OAuth, geen magic links — een compleet auth-framework zou
daar vooral configuratie en aanvalsoppervlak toevoegen.

Dat argument is goed, maar het gold een B2B-dashboard met door de beheerder
uitgegeven accounts. Parking Guard is een consumentenproduct: zelfregistratie,
e-mailverificatie, wachtwoordherstel, later mogelijk itsme of een sociale login.
Daar kantelt de afweging.

De echte open vraag was technisch: draait next-auth v5 op Next 16? De v5-lijn is
al lang beta, en een auth-laag die de build breekt zet de hele Definition of Done
op losse schroeven. Ik heb dat gemeten in plaats van gegokt.

## Meting

```
$ npm view next-auth@beta version
5.0.0-beta.32
$ npm view next-auth@beta peerDependencies
{ next: '^14.0.0-0 || ^15.0.0 || ^16.0.0', react: '^18.2.0 || ^19.0.0', … }
```

Next 16 en React 19 staan expliciet in de peer range. Installatie tegen de
bestaande boom:

```
$ npm install next-auth@beta @auth/prisma-adapter
added 8 packages in 9s        # geen peer-conflicten, geen overrides
```

## Beslissing

Auth.js v5 (`next-auth@5.0.0-beta.32`) met `@auth/prisma-adapter`.

- **Credentials-provider** met e-mail en wachtwoord. Wachtwoorden gehasht met
  `crypto.scrypt` uit de standaardbibliotheek, in het zelfbeschrijvende formaat
  `scrypt$N$r$p$salt$hash` — memory-hard, geen native module die per platform
  opnieuw gebouwd moet worden, en de parameters zijn later te verhogen zonder
  bestaande hashes ongeldig te maken.
- **E-mailverificatie verplicht.** Inloggen kan pas als `emailVerified` gezet is.
  Het verificatietoken staat alleen als hash in de database
  (`VerificationToken.tokenHash`), zodat databasetoegang geen accountovername
  oplevert.
- **JWT-sessiestrategie**, met `role` in het token. `Account` en `Session` staan
  wel in het schema: een latere OAuth-provider of databasesessie hoort geen
  migration op het kritieke pad te worden.
- **RBAC** via `role` op `User` (`USER` / `ADMIN`), server-side afgedwongen in de
  admin-routes. Nooit alleen in de UI.

Verificatiemails lopen via de `Mailer`-interface, niet rechtstreeks via Resend.
Lokaal logt de console-driver de verificatielink; met `RESEND_API_KEY` gaat hij
echt de deur uit. De env-validatie weigert te starten met een lege
`RESEND_API_KEY` als `NODE_ENV=production`, zodat de console-driver nooit
stilzwijgend in productie belandt.

## Gevolgen

- We nemen een beta-afhankelijkheid op een centrale plek. Beperkt door alles wat
  echt van next-auth is achter onze eigen `getCurrentUser()` / `requireAdmin()`
  te houden, zodat een migratie weg van Auth.js een handvol bestanden raakt en
  niet elke route.
- De versie wordt gepind (geen caret op een beta) zodat een nieuwe beta de build
  niet onaangekondigd verandert.
- Afwijking van de huisconventie in de buurprojecten. Bewust, en om de reden die
  `session.ts` daar zelf noemt: die afweging hing aan het ontbreken van
  zelfregistratie, en dat verschil is hier precies andersom.
