# Noor Growth Funnel

Statische landingspagina + aanmeldformulier ("vroege toegang") om vraag en betaalbereidheid voor het Noor-ecosysteem te meten. Uitbater: Marhaba Data & AI Agent BV.

## Hoe het werkt

- Het formulier stuurt de aanmelding als JSON (POST) naar **één configureerbaar endpoint**: `LEAD_ENDPOINT` in `config.js`.
- **Standaard is `LEAD_ENDPOINT` leeg**: de pagina toont dan "aanmelden is nog niet actief" en verstuurt of bewaart niets.
- Er wordt **niets in de browser van de bezoeker bewaard** (geen localStorage, geen cookies). Leads die de vroegere versie in localStorage zette, worden bij bezoek automatisch gewist.
- Het vroegere publieke dashboard en de JSON/CSV-export zijn **verwijderd**. Leads bekijk/exporteer je in de dienst achter het endpoint (bv. Formspree-inbox, Google Sheet via Make/Zapier, CRM).
- Over kinderen gaat alleen een optionele leeftijdsgroep uit een vaste lijst mee (`childrenAgeGroup`); vrije invoer wordt geweigerd.
- `privacy.html` = privacyverklaring (concept), gelinkt vanuit de toestemmingstekst en de footer.

## Velden die naar het endpoint gaan

`submittedAt, name, email, phone, country, persona, childrenAgeGroup, interests[], biggestProblem, topOffer, budget, urgency, willingToPay, consent, consentText, source`

## Testen

```powershell
npm.cmd run check   # syntaxcontrole
npm.cmd test        # 8 tests (endpoint leeg/ok/fout, dataminimalisatie, geen opslag, geen dashboard, privacy)
```

Lokaal bekijken: open `index.html` in je browser (of `npx serve .`).

## Live zetten

1. Kies een formulierdienst met EU-opslag waar mogelijk (bv. Formspree, Basin, of een Make/Zapier-webhook naar een Google Sheet/Brevo). Sluit de verwerkersovereenkomst (DPA) af.
2. Zet de endpoint-URL in `config.js` → `LEAD_ENDPOINT`.
3. Voeg de origin toe aan `connect-src` in `_headers` (bv. `connect-src 'self' https://formspree.io`).
4. Vul in `privacy.html` sectie 5 de naam en het land van die dienst in (TODO-commentaar staat er).
5. Vul `config.js` → `legal.address` (straat + nr + postcode van de zetel) in.
6. Cloudflare Pages: Create → Pages → Upload assets: `index.html`, `privacy.html`, `styles.css`, `config.js`, `funnel.js`, `app.js`, `legal.js`, `_headers`. Custom domain koppelen.
7. Test: één aanmelding versturen en controleren dat ze in de dienst aankomt. Marketingmails alleen via een mailtool met afmeldlink.

## Volgende stappen (optioneel)

- Founding-member-aanbod via Stripe Payment Links pas als de aanmeldingen dat rechtvaardigen.
- Analytics alleen cookieloos/EU of met toestemmingsbanner (staat nu bewust niet op de site).
