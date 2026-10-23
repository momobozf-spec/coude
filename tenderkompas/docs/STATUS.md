# Status pilot v0.1 — wat werkt, wat handmatig is, wat nog niet aangesloten is

## Werkt (gebouwd, getest)
| Onderdeel | Hoe geverifieerd |
|---|---|
| Datamodel + migraties (25 tabellen) | `drizzle/0000_init.sql` toegepast op Postgres 16 (dev + test) |
| Auth (better-auth, e-mail/wachtwoord, geen open registratie), rollen beheerder/klant, isolatie | HTTP-check met echte browser: 18/18 (vervalste ids, rechtstreekse server actions) |
| Landingpage + aanvraagformulier (honeypot, toestemming) | UI-test |
| Bedrijfsprofiel (diensten, techniek, uitsluitingen, talen, regio, capaciteit, omvang, bedrijfs- vs. individuele referenties en certificeringen, tri-state velden, optionele omzet, klantbevestiging, versie) | Integratietests + UI |
| Handmatige broninvoer: procedure, publicaties (rectificatie/gunning/intrekking), percelen, feiten, voorwaarden, documenten, samenvatting, statuscorrectie | UI-test (`demo-output/03-admin-procedure.png`) |
| Bronbewijs per feit/voorwaarde (bron, versie, locatie, citaat, methode, verificatie) + bevestigen/afwijzen | UI + tests |
| Beoordelingsengine A/B/C + eindadvies, configureerbare gewichten (geversioneerd) | 16 unit tests |
| Reviewworkflow concept → te controleren → goedgekeurd → gepubliceerd, versies, reviewbesluiten | Integratie + UI |
| Invalidatie bij bronwijziging/profielwijziging, banner in portaal | Integratietests |
| Klantportaal: kansen, opgeslagen/gevolgd, detail met feiten vs. interpretatie, feedback (6 types, reden verplicht bij “niet relevant”) | UI (`06-portal.png`, `07-portal-detail.png`) |
| Digest + wijzigingsmelding, preview, goedkeuring, testverzending, idempotente klantverzending met retry, historiek, export, voorkeuren | Integratietest met echte lokale SMTP-server; status "aanvaard door SMTP" ≠ "afgeleverd" |
| TED-import (client, mapping, importer, cursor, dedup, wijzigingen, intrekkingen, geweigerde velden, foutzichtbaarheid) | Velden en codes gecontroleerd tegen officiële docs; tests met fixtures — **niet live** |
| AI-extractie met Zod-schema, deterministische citaatcontrole, kosten/tokens, hergebruik over klanten | Integratietest met gesimuleerde modelaanroep (enkel in test) — **niet live** |
| PDF/tekst-upload met type-sniffing, groottelimiet, dekkingscontrole; beschermde download | Tests |
| SSRF-veilige URL-ophaling | Unit tests op validatie/IP-ranges |
| Gegevensverwijdering per klant, bewaartermijnen | Code + UI-actie |

## Gebeurt handmatig (bewust, pilot)
- Belgische e-Procurement-publicaties invoeren.
- Verificatie van elk feit/elke voorwaarde tegen de bron.
- Voorwaarden toetsen aan het profiel (suggesties worden getoond, nooit toegepast).
- Publiceren én verzenden (expliciete beheerdersactie).
- Klantaccounts en abonnementstatus; facturatie buiten de app.
- Plannen van `npm run ted:import` (cron of containerjob) — er draait geen interne scheduler.

## Nog niet aangesloten
| Wat | Nodig |
|---|---|
| Live TED-import | Netwerktoegang tot `api.ted.europa.eu`; eerst `node scripts/ted-live-check.mjs` |
| Bevestigde aflevering van e-mail | Provider-webhook/bounceverwerking |
| AI-extractie live | `ANTHROPIC_API_KEY` + actuele tarieven in `AI_PRICE_*` |
| E-mailverzending | SMTP-provider (`SMTP_*`) |
| Belgische e-Procurement-koppeling | Bevestigde, toegestane export/API van BOSA |
| Word-documenten (.docx) | Enkel PDF en tekst ondersteund |
| Wachtwoordreset per e-mail | Hangt af van e-mailprovider; nu: beheerder maakt nieuwe gebruiker |
| Betaalintegratie | Bewust niet gebouwd |
| 90-dagensteekproef | Live TED-toegang |

## End-to-end demonstratie (`ALLOW_DEMO_DATA=true npm run demo:e2e`, uitgevoerd)
Expliciet testprofiel met **enkel door de eigenaar opgegeven gegevens** (geen referenties, omzet, certificeringen, regio of capaciteit ingevuld).
1. Echte Belgische bron: Zorgband Leie & Schelde (Fabric/Power BI) → diensten passen, deadline verstreken ⇒ momenteel niet passend (zie VALIDATIE.md §2).
2. Echte buitenlandse bron: TED 40211-2026 (Fusion for Energy) → verstreken ⇒ niet passend, gepubliceerd, klantdetail toont "geen open kans".
3. Digest: 0 kansen → eerlijk bericht; zonder SMTP niets verzonden. Feedback "niet relevant" met reden.
Positief pad (fictief, apart): `demo-output/1-…5-*.png` en `digest-demo-fictief.html`.
