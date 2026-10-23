# KetelCheck — MVP v2 "tweede offerte voor de vervanging van je gasketel"

Startdienst: **vervanging van een gasketel** bij eigenaars (bewoner of verhuurder).
Startregio: **Brussel (1000–1299) + Vlaamse Rand / Halle-Vilvoorde (1500–1999)**.
Eén partner tegelijk, max. 2 na elkaar. Elke aanvraag wordt maximaal één keer verkocht. Betaling per aanvaarde aanvraag.

```
web/                 statische site (NL /, FR /fr/, privacy, partners)
  assets/app.js      formulier + validatie + UTM + bot-timing; CONFIG.endpoint invullen
apps-script/
  Code.gs            backend (Sheet als database)
  appsscript.json    manifest
sales/
  pilotaanbod-en-scripts.md   pilotvoorwaarden, belscript, opvolgmail NL/FR (concept, niets verstuurd)
```

## Eerlijke schattingen (onbewezen tot gemeten)

| Claim v1 | Correctie v2 |
|---|---|
| "€0 software" | €0 voor het leadbeheer zelf (Google Sheet + Apps Script + gratis static hosting). Wel: domein (±€10–15/jaar), eventueel professionele mailbox, en **Peppol-facturatiesoftware**. Die heeft Marhaba BV waarschijnlijk al nodig sinds 1/1/2026 (te bevestigen). Gratis Gmail-account: max. ±100 mailontvangers/dag via Apps Script (quota-controle zit in de code). |
| "10 min per dag" | Model v2: **±35–90 min per werkdag** bij 20–100 inzendingen/maand, inclusief controle, afhandeling, credits, facturatie, partnerbeheer en ads. Meten tijdens de pilot. |
| "45 min om live te gaan" | **±2–4 uur deploy** (Sheet, script, autorisatie, hosting, domein/DNS) **+ ±2 uur echte end-to-end test**. Alleen te meten als je het doet. |

## Live zetten

1. **Aparte Google-account** voor KetelCheck (2FA aan). De Sheet nooit delen.
2. Nieuwe Google Sheet → Extensies → Apps Script → plak `Code.gs`. Toon het manifest en plak `appsscript.json`.
3. Run `setup` vanuit de editor of het menu. Dat maakt de tabs, statuslijsten, waarschuwingsbeveiliging en triggers aan.
4. Tab Config: vul `ADMIN_EMAIL` en `REPLY_TO` in.
5. Deploy → Web-app (uitvoeren als: ik · toegang: iedereen). Zet de `/exec`-URL in `Config!WEB_APP_URL` en in `web/assets/app.js` (`CONFIG.endpoint`).
6. Host `web/` (Render Static Site of Cloudflare Pages) en koppel een domein. Vul `privacy@JOUWDOMEIN.be` in.
7. **Voer de echte testlijst uit** (zie hieronder) met fictieve gegevens en je eigen mailadressen, vóór de eerste echte aanvraag.

## Partners

- In tab Partners: `diensten` moet `vervanging_gas` bevatten.
- `pilot_getekend_op` moet ingevuld zijn, anders krijgt de partner niets.
- `prijs_per_aanvraag` moet > 0 zijn.
- `postcodes` bv. `1000-1299;1930`.
- Erkenningsnummer + bron + controledatum invullen: de erkenning is persoonlijk, noteer welke technicus/adviseur bij het bedrijf werkt.

## Dagelijkse flow

Nieuwe aanvraag → controleren → status `gecontroleerd` → menu **Doorsturen**. De partner krijgt een link. Openen toont de aanvraag; pas een klik op **Aanvaarden** of **Weigeren** telt. Na 24 u zonder antwoord gaat de aanvraag naar de volgende partner. Credits behandel je via het menu. Maandbegin: **Factuurvoorstel** opbouwen. Dat is een CONCEPT: maak de echte factuur in je Peppol-software. Daarna **Markeer maand als gefactureerd**, later `betaald` of `oninbaar`.

## Echte testlijst in Apps Script (NOG NIET UITGEVOERD)

Gebruik fictieve aanvragers en je eigen 2–3 mailadressen als "partners".

1. Formulier NL en FR versturen. Rij verschijnt in Leads. Telefoonnummer staat als tekst. Adminmail bevat geen contactgegevens.
2. Dezelfde aanvraag nog eens versturen → status `duplicaat`.
3. Doorsturen → partnermail zonder naam, telefoon of e-mail.
4. Link openen in Gmail, Outlook en op mobiel, ook de linkpreview → status blijft `doorgestuurd`.
5. Aanvaarden → contactmail naar de partner en mail naar de aanvrager. Nog eens klikken → "al aanvaard", geen extra mails.
6. Twee browsers tegelijk op Aanvaarden met twee verschillende tokens → maar één aanvaard. (LockService; in de mock niet echt parallel getest.)
7. Weigeren → tweede partner krijgt de aanvraag. De oude link werkt niet meer.
8. `vervalt_op` in Toewijzingen in het verleden zetten en `expireAssignments` draaien → volgende partner of `geen_partner` + mail naar de aanvrager.
9. Credit vragen → menu goedkeuren of weigeren → mail naar de partner.
10. Een menufunctie aanroepen via de web-app (bv. `google.script.run.setup()` in de devtools van de partnerpagina) → moet falen op `getUi`.
11. Ongeldig partneradres → rij in Fouten, lead blijft `gecontroleerd`.
12. `applyRetention` met een oude testdatum → contactgegevens gewist.
13. Gmail "Verzonden" controleren: kopieën van partnermails bevatten contactgegevens. Zie de blokkade over bewaartermijnen.

## Bekende beperkingen

- Verzonden mails (Gmail Sent) bewaren contactgegevens buiten de Sheet. Bewaartermijn daar manueel beheren (maandelijks verwijderen > 6 maanden) of privacyverklaring aanpassen.
- Een Factuurvoorstel is geen factuur.
- Geen sms-verificatie. De telefoon wordt formeel gecontroleerd; bereikbaarheid toets je bij de controle.
- Volledig getest in een nagebootste omgeving: 25 mock-tests. In echte Apps Script: nog niets.
