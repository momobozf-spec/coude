# Noor Growth Funnel

Een losse webapp om snel vraag te meten, leads te verzamelen en betaalbereidheid te testen voor je Noor-ecosysteem.

## Wat deze app doet

- toont een conversion-focused landing page
- verzamelt lead data via een intakeformulier
- meet interesse per aanbod
- meet koopbereidheid en prijsgevoel
- toont een lokaal dashboard met leads
- laat leads exporteren als JSON of CSV

## Voor wie deze funnel is

Gebaseerd op je bestaande projecten richt deze funnel zich op:

- moslimouders
- homeschool ouders
- islamitische educators
- moslimvrouwen en modest lifestyle shoppers

## Hoe je hem opent

Open `index.html` in je browser.

## Waar de data staat

De leads worden in deze MVP opgeslagen in `localStorage` onder:

`noor-growth-funnel-leads`

Dat betekent:

- snel testen zonder backend
- data blijft lokaal in dezelfde browser
- export naar CSV of JSON is ingebouwd

## Welke data je verzamelt

- naam
- e-mail
- telefoon / WhatsApp optioneel
- land
- persona
- leeftijd van kinderen
- interesses
- grootste probleem
- top aanbod
- budgetindicatie
- urgentie
- bereidheid om te betalen

## Slimme volgende stappen

1. Koppel het formulier aan Supabase, Firebase of een simpele API.
2. Stuur leads automatisch door naar Mailchimp, ConvertKit of Resend.
3. Voeg Stripe links toe voor een founding member aanbod of betaalde pilot.
4. Zet Meta Pixel, GA4 of PostHog erop om conversie te meten.
5. Maak aparte landingspagina's per aanbod als je ziet welke categorie het best converteert.

## Idee voor snelle monetisatie

- verkoop direct een printable starter bundle
- bied een founding member deal aan voor Noor membership
- verkoop school packs aan weekendscholen
- gebruik WhatsApp follow-up voor warme leads die "Ja, direct" invullen
