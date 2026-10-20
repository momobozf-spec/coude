# Technische backlog — ImmoRadar voor het LeadRevive-pilotmodel

Uitgangspunt: **geen nieuwe SaaS-architectuur.** De app is multi-tenant, beveiligd en getest
[code]. Wat volgt is het minimum per fase. Code is in deze fase niet gewijzigd.

Paden zijn relatief ten opzichte van de repo `immoradar`.

---

## A. Nodig vóór de eerste betaalde pilot

| # | Onderwerp | Wat | Waarom (verkoop) | Inschatting |
|---|---|---|---|---|
| A1 | Hosting en data in de EU | Render **Frankfurt** op betaalde plannen (web, worker en Postgres; `render.yaml` bevat dit al). **Niet** `render.free.yaml`, want die DB wordt na 30 dagen gewist [docs] | De verwerkersovereenkomst belooft EU-hosting en continuïteit | 1–2 u |
| A2 | Juridisch minimum | Verwerkersovereenkomst (art. 28), voorwaarden, privacy, register van verwerkingen. `LEGAL_ENTITY_ADDRESS` en `LEGAL_CONTACT_EMAIL` invullen [docs: `LAUNCH-CHECKLIST.md` §2]. Een jurist laten nalezen, inclusief de vraag of kantoren hun oud-klanten mogen bellen (gerechtvaardigd belang, Bel-me-niet-meer) | Zonder overeenkomst mag je geen klantenbestand ontvangen | 2–4 u + jurist |
| A3 | Eigen domein + https | `APP_BASE_URL` erop zetten (de app weigert te starten zonder https [code]) | Vertrouwen bij de eerste login | 30 min |
| A4 | Back-up + hersteltest | Point-in-time restore van Render aanzetten en **één keer** testen. Daarnaast een wekelijkse `pg_dump` naar EU-opslag | Een verlies van het klantenbestand is fataal voor het vertrouwen | 1–2 u |
| A5 | Data-export per kantoor | Er is **geen exporttool**, terwijl de overeenkomst teruggave belooft [code]. Voor de pilot volstaat een eenvoudig CLI-script (zoals `scripts/purge-agency.ts`) dat de contacten en kansen van één kantoor als CSV wegschrijft. Verwijderen bestaat al | Het einde van de pilot moet netjes kunnen ("data blijft van jullie") | 2–3 u |
| A6 | Marktradar uit beeld | Met `COLLECTOR_ENABLED_SOURCES` leeg in productie [code: `render.yaml`] blijft `/market` leeg. Verberg het menu-item of toon "niet actief" in `src/app/(dashboard)/Nav.tsx`, zodat een pilotklant niet denkt dat er iets kapot is | Voorkomt verwachtingen die je niet kan waarmaken | 30 min |
| A7 | CI laten draaien | `.github/ci.yml` verplaatsen naar `.github/workflows/ci.yml` (de workflow draait nu nooit) [code] | Elke fix voor een klant moet de tests passeren | 15 min |
| A8 | Monitoring | Uptime-check op `/api/ready` met melding naar jou (bv. UptimeRobot) [docs] | Jij ziet een storing vóór de klant | 30 min |
| A9 | Kantoor aanmaken en limieten | Via `/admin/agencies`: plan `pilot`, `endsAt` op dag 60, `maxOpportunitiesPerDay` [code]. Tijdelijk wachtwoord persoonlijk doorgeven | Het abonnement loopt automatisch af. Bij opzegging worden gegevens afgesloten zonder ze te wissen | 15 min |
| A10 | Veilige aanlevering van exports | Laat de klant zelf uploaden via `/imports` tijdens de kick-off, of gebruik een gedeelde EU-map met vervaldatum. **Geen e-mailbijlagen** | AVG en vertrouwen | proces |

**Betalingen voor de pilot:** **geen integratie**. Stuur een factuur vanuit je boekhouding
(overschrijving), zoals de documentatie ook adviseert [docs: §4]. Dat kost bij een handvol
klanten niets en vraagt geen code.

**Totaal fase A:** ~1,5 dag eigen werk + juristenreview.

---

## B. Nodig vóór meerdere betalende klanten (≥ 3–5)

| # | Onderwerp | Wat | Waarom |
|---|---|---|---|
| B1 | **E-maildigest** in plaats van (of naast) Telegram | De ochtendsamenvatting per e-mail (Telegram is ongebruikelijk bij Belgische makelaars [aanname]). Er bestaat al een notificatielaag in `src/notifications/` | Zonder dagelijkse prikkel loggen makelaars niet in, en dan zeggen ze op |
| B2 | Self-service wachtwoordherstel | Nu reset alleen een admin [code]. Vereist een e-mailprovider (bv. Resend of Postmark, EU-regio controleren) | Minder support per klant |
| B3 | Zelf importeren met begeleiding | De preview in 2 stappen bestaat al. Voeg een korte uitleg per CRM toe ("zo exporteer je uit Whise / SweepBright / Omnicasa") | Supporttijd per kantoor van ~1 u naar ~0,5 u (zie `pricing-and-costs.md`) |
| B4 | Exporttool in de UI | De CLI uit A5 als knop voor de kantoorbeheerder | Rechten van betrokkenen, en vertrouwen bij de aankoop |
| B5 | Plannen en limieten formaliseren | `Subscription.plan` is vrije tekst. Leg 2 plannen vast (bv. `pilot`, `standard`) met gebruikerslimiet en kansen per dag | Duidelijke facturatie, voorkomt discussie |
| B6 | Facturatie | Bij ≥ 5 klanten: terugkerende facturen in je boekhoudpakket, of SEPA-incasso via Mollie of Stripe. **Pas kiezen na een controle van de actuele tarieven** (Mollie SEPA ~€0,25; Stripe-tarieven niet officieel bevestigd, zie bronnen). Een betaalintegratie in de app is nog niet nodig | Minder opvolging van onbetaalde facturen |
| B7 | Foutopvolging | Een foutmeldingsdienst (bv. Sentry, EU-regio) of op zijn minst doorzoekbare logs met bewaartermijn [docs: §3] | Problemen bij klanten snel vinden |
| B8 | DPIA-check | Beoordelen of een DPIA nodig is zodra het om meerdere kantoren met grote bestanden gaat [docs: §2] | Aantoonbare AVG-naleving |

---

## C. Kan wachten (tot er bewezen vraag is)

| Onderwerp | Waarom wachten |
|---|---|
| Een betaalprovider en self-service checkout in de app | Bij een B2B-verkoop met een handvol klanten is een factuur sneller en goedkoper |
| CRM-API-koppelingen (Whise, SweepBright…) | Ze vragen partnercontracten. CSV levert dezelfde contacten op [docs: `leadrevive.md`]. Pas zinvol als klanten afhaken *omdat* ze moeten exporteren |
| **Marktradar met een externe databron** | Eerst een legale bron (feed, partnerschap) en een juridisch advies. Nooit scrapen [docs: `adding-a-data-source.md`] |
| Regionale exclusiviteit per postcode | Pas relevant als de marktradar live is (marktdata is gedeeld tussen kantoren [code]) |
| Terugschrijven naar het CRM (`pushOpportunity`) | Bewust niet geïmplementeerd [docs] |
| AI-functies (belscripts genereren e.d.) | Geen verkoopargument dat nu ontbreekt, en het voegt variabele kosten toe |
| White-label | Pas na ≥ 3 succesvolle kantoren |
| Franstalige interface | Pas als je naar Brussel of Wallonië gaat |

---

## Bronnen voor de kostenkeuzes
- Render-prijzen: https://render.com/pricing.md
- Mollie-tarieven (derde partij): https://blog.finexer.com/mollie-pricing/
- Mollie, vast Bancontact-tarief: https://www.emerce.nl/wire/mollie-introduceert-vast-tarief-bancontact
- Stripe Bancontact (tarieven via de prijspagina): https://stripe.com/en-dk/payment-method/bancontact
