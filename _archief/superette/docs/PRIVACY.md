# Privacy en gegevensbescherming

Verwerkingsregister en ontwerpkeuzes voor Superette (supermarktvergelijker).
De boetiek Jamal & Jamila deelt dezelfde gebruikerstabel; haar verwerkingen
staan hier alleen waar ze een Superette-gebruiker raken.

> **Juridische controle vereist.** De privacyverklaring in de app
> (`/privacy`) en dit register zijn een voorstel op basis van wat de software
> doet. Een jurist moet rechtsgronden, bewaartermijnen, de identiteit van de
> verwerkingsverantwoordelijke en de tekst goedkeuren vóór publicatie. De
> Franse en Engelse vertaling van de verklaring ontbreken nog.

## Verwerkingsregister

| # | Verwerking | Gegevens | Betrokkenen | Rechtsgrond (voorstel) | Bewaartermijn | Verwerker(s) |
|---|---|---|---|---|---|---|
| 1 | Account en authenticatie | e-mail, naam, wachtwoord-hash (Argon2id), taal, status | gebruikers | overeenkomst (6.1.b) | tot verwijdering | hosting, database |
| 2 | Sessies | sessie-id, token-hashes (SHA-256), client, user-agent, tijdstippen | gebruikers | overeenkomst (6.1.b) / gerechtvaardigd belang beveiliging (6.1.f) | 30 dagen na verlopen of intrekken, daarna gewist door `purge` | hosting, database |
| 3 | Boodschappenlijsten | lijstnamen, regels (product of vrije tekst), aantallen | gebruikers | overeenkomst | tot verwijdering door gebruiker/account | database |
| 4 | Voorkeuren | ketens, favorieten, klantenkaartbezit, postcode/gemeente (optioneel), afstand, merkvoorkeur, e-mail-opt-in | gebruikers | overeenkomst; opt-in = toestemming (6.1.a) | tot verwijdering | database |
| 5 | Prijsalerts en meldingen | product/categorie, doelprijs, ketens, kanaal, meldingsgeschiedenis | gebruikers | overeenkomst | tot verwijdering | database |
| 6 | E-mailmeldingen | e-mailadres, overzicht van alerts | gebruikers met opt-in | toestemming (6.1.a), intrekbaar in voorkeuren | afleverstatus 90 dagen (aanbevolen; opruimtaak nog te maken) | e-mailprovider (verwerkersovereenkomst nodig) |
| 7 | Nieuwsbrief | e-mailadres | gebruikers met opt-in | toestemming | tot intrekking | (nog geen tool) |
| 8 | Beveiliging, rate limiting | IP-adres (in-memory, niet opgeslagen), request-id | iedereen | gerechtvaardigd belang | logs 30 dagen (aanbevolen) | hosting, logprovider |
| 9 | Gegevensexport | alle bovenstaande, als download | gebruiker zelf | wettelijke verplichting (art. 15/20) | niet bewaard | – |
| 10 | Accountverwijdering | zie hieronder | gebruiker zelf | wettelijke verplichting (art. 17) | – | – |
| 11 | Boetiek (zelfde account) | toestemmingen, toegangslogs, bestellingen, kasbonnen | boetiekklanten | overeenkomst, wettelijke plicht (btw 7 jaar, camerawet) | volgens boetiekbeleid | – |

**Niet verwerkt**: locatie van het toestel, trackingcookies, advertentie-id's,
third-party analytics (CSP laat alleen een expliciet geconfigureerde
`NEXT_PUBLIC_ANALYTICS_ORIGIN` toe; standaard niets), betaalgegevens in
Superette.

## Rechten van betrokkenen

| Recht | Hoe | Status |
|---|---|---|
| Inzage / overdraagbaarheid (15, 20) | Profiel → Jouw gegevens → Download (`GET /api/v1/account/export`, JSON, 5/min) | geïmplementeerd |
| Rectificatie (16) | lijsten/voorkeuren/alerts zelf; naam/e-mail via contact | deels (geen zelfbediening voor naam/e-mail) |
| Wissing (17) | Profiel → Jouw gegevens → Account verwijderen (wachtwoord + bevestigingszin, `DELETE /api/v1/account`) | geïmplementeerd |
| Intrekken toestemming (7.3) | e-mail-opt-in uitzetten in voorkeuren | geïmplementeerd |
| Bezwaar (21) | contact | procedure nodig |
| Klacht | Gegevensbeschermingsautoriteit | vermeld in verklaring |

## Verwijderings- en anonimiseringsbeleid

Bij verwijdering (`AccountService.deleteAccount`, één transactie):

**Gewist**: boodschappenlijsten en regels, meldingen, prijsalerts, favoriete
winkels, ketenvoorkeuren, vergelijkingsvoorkeuren, boetiek-QR-sleutels
(`AccessToken`), alle sessies. Matchrapporten verliezen hun koppeling aan de
gebruiker (`userId = null`).

**Geanonimiseerd**: het `User`-record blijft bestaan met e-mail
`verwijderd+<id>@anoniem.superette.invalid`, naam "Verwijderde gebruiker",
telefoon/wachtwoord/externe identiteit `null`, status `ERASED`, `deletedAt`.
Inloggen is daarna onmogelijk; het e-mailadres is weer vrij.

**Bewaard (met reden)**: boetiekbestellingen en kasbonnen (fiscale bewaarplicht
7 jaar) en toestemmingen/toegangslogs van de boetiek (bewijs onder AVG art. 7
en de camerawet), alle zonder naam of e-mail. Dit staat letterlijk in de
verwijderdialoog.

**Automatische retentie**: sessies 30 dagen na afloop (`purge` bij elke
synchronisatie); prijshistorie 400 dagen; logs volgens de provider (30 dagen
aanbevolen). Een opruimtaak voor oude meldingen van verwijderde accounts
bestaat niet (ze zijn al gewist bij verwijdering).

## Beveiligingsmaatregelen (art. 32)

Zie `SECURITY.md`: Argon2id, HttpOnly/Secure/SameSite-cookies met korte
access-tokens en server-side intrekbare sessies, CSRF-grendels, CSP, rate
limiting, redactie in logs, minimale databaserechten, TLS verplicht in
productie, geen geheimen in de browserbundel.

## Verwerkers en doorgifte

| Verwerker | Rol | Doorgifte buiten EER | Status |
|---|---|---|---|
| Hostingprovider | API, app, logs | afhankelijk van regio | te kiezen; EU-regio vereist |
| Databaseprovider | opslag | idem | te kiezen |
| E-mailprovider | meldingen (opt-in) | idem | nog niet gekoppeld |
| Supermarktketens | **geen** doorgifte van gebruikersgegevens; alleen hun prijsdata inwaarts | – | – |

Verwerkersovereenkomsten afsluiten vóór productie.

## Open punten voor de jurist

1. Identiteit en contact van de verwerkingsverantwoordelijke (placeholder in
   `/privacy`).
2. Rechtsgrond per verwerking bevestigen (met name 2 en 8).
3. Bewaartermijnen voor logs en e-mailafleverstatus vastleggen.
4. Of een DPIA nodig is (geen bijzondere categorieën, geen profilering met
   rechtsgevolg; vermoedelijk niet).
5. Franse en Engelse versie van de verklaring.
6. Cookie-informatie: alleen strikt noodzakelijke cookies (sessie) en
   `localStorage` voor taal/thema; geen banner vereist, wel vermelden.
7. Gebruiksvoorwaarden (de registratie verwijst ernaar; tekst ontbreekt).
