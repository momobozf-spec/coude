# Investeringsbeslissing

*20 oktober 2026.* Doel van de eigenaar: een schaalbaar digitaal product of
abonnement, klanten via website en socials, eerst één duidelijke markt en daarna
internationaal. Startbudget maximaal €10.000, intensieve eigen inzet, geen
verkoop- of leveringsuren per klant. Eerdere bouwtijd telt **niet** mee.

Labels: **[CODE]**, **[BRON]**, **[REKENING]**, **[AANNAME]**, zoals in de andere documenten.

## 1. De drie opties voor LeadRevive

| | **A. Beperkt als dienst** | **B. Ombouwen tot self-service product** | **C. Parkeren, nieuw product valideren** |
|---|---|---|---|
| Tijd tot eerste omzet | 4–8 weken | 4–6 maanden (bouw, juridisch, eerste werving) | 2 weken tot het eerste betalingsbewijs; 2–3 maanden tot terugkerende omzet, **als** de validatie slaagt |
| Investering (cash) | €500–1.500 (juridisch) + hosting | €2.000–5.000 (juridisch, hosting, advertenties) + 25–40 werkdagen | Validatie ≤ €750; bouw pas na bewijs, ≤ €3.000 cash |
| Marge per klant | Laag: ~24 u voor de eerste klant, ~€40/u bij €950 [REKENING] | Negatief: kost per klant €200–1.000 tegenover €88–285 opbrengst [REKENING op AANNAME] | Hoog als het een software-abonnement wordt (> 85 % excl. eigen tijd) [AANNAME] |
| Menselijke inzet per klant | Hoog: verkoopgesprek, intake, check-ins | Laag na de bouw, maar import- en juridische vragen blijven | Laag, als het product zo ontworpen is (dat is een selectiecriterium) |
| Internationaal | Slecht: Belgische CRM's, taal, telemarketingregels | Slecht: telemarketing schuift overal naar opt-in | Afhankelijk van het idee; criterium bij de selectie |
| Juridisch risico | Middel tot hoog (belangenafweging, Bel-me-niet-meer) | Hoog (wetsvoorstel opt-in DOC 56 1081) | Laag gehouden door de keuze van het idee |
| Past bij je doel | Nee (arbeidsintensief) | Nee (economie klopt niet) | **Ja, als de validatie slaagt** |

### Advies: **C — LeadRevive commercieel parkeren en een nieuw product valideren**

Waarom:
1. **A** is precies het werk dat je wil vermijden: elke klant vraagt opnieuw een
   verkoopgesprek, een intake en opvolging.
2. **B** verdient zijn werving niet terug, heeft een klein marktplafond en botst op een juridische trend (opt-in) die internationaal schalen bemoeilijkt.
3. De code is niet verloren:
   - de importlogica (normaliseren, ontdubbelen, diffs) en de exportfunctie zijn herbruikbaar [CODE];
   - ImmoRadar blijft een sterk referentieproject voor je freelancewerk;
   - komt er spontaan een kantoor op je af, dan kan je A alsnog als losse opdracht doen. Investeer er niet actief in.

## 2. Selectiecriteria voor een nieuw product

1. **Klant koopt zelf** via website, zonder gesprek.
2. **Terugkerende waarde zit in de data**: er komt elke week of maand nieuwe input binnen, en de klant wil daar iets over weten.
3. **Weinig persoonsgegevens, geen marketing naar consumenten.**
4. **Past bij je vaardigheden**: data-pipelines, datamodellen, Power BI, Python, Azure.
5. **Internationale uitbreiding** via een gemeenschappelijke standaard of community.
6. **Werkt zonder virale hit**: vindbaar via zoekgedrag, betaalde advertenties met meetbare conversie, of een kanaal van tussenpersonen.

## 3. Drie productideeën

### Idee 1 — "Factuurwaakhond": prijsstijgingen en dubbele facturen opsporen in e-facturen (aanbevolen)

**Wat:** een kmo, eerst horeca en daarna andere sectoren met veel leveranciers, laat zijn inkomende Peppol-e-facturen binnenkomen. De dienst leest elke factuurlijn en meldt:
- prijsstijgingen per artikel ten opzichte van vorige leveringen;
- dubbele of bijna-dubbele facturen;
- nieuwe of ongewone kosten (transport, toeslagen);
- een maandoverzicht van de grootste stijgers.

**Waarom nu** [BRON]:
- Sinds **1 januari 2026** is B2B-e-facturatie via Peppol verplicht tussen Belgische btw-plichtigen; pdf telt niet meer als e-factuur. Elke leveranciersfactuur aan een restaurant komt dus als gestructureerde UBL binnen.
- In Peppol BIS Billing 3.0 is de **netto artikelprijs per factuurlijn verplicht** (BT-146, kardinaliteit 1..1). Prijsvergelijking werkt dus zonder OCR en zonder giswerk.
- Andere landen volgen: Frankrijk vanaf september 2026 (grote en middelgrote ondernemingen) en 2027 (kmo's), Polen (KSeF, 2026), Duitsland met verplichte ontvangst sinds 2025 en versturen gefaseerd vanaf 2027, EU-brede ViDA tegen 2030. De datamodellen delen de Europese norm EN 16931. Exacte data per land zijn **niet** in officiële bronnen nagekeken.

**Bewijs van vraag** [BRON, beperkt]:
- MarketMan, voorraad- en kostenbeheer voor restaurants met factuurscanning, vraagt **$249–449/maand**.
- PriceShield verkoopt prijsstijgingsalerts op facturen (prijs niet publiek).
- Invoiceless verkoopt dubbele-factuurdetectie voor kleine teams aan **€9,99–19,99/maand**.

Er wordt dus betaald voor dit probleem. Het verschil zit in de prijs (€19–39 in
plaats van $249) en in het feit dat Peppol de data al gestructureerd aanlevert.
Het is **niet** bewezen dat Belgische horeca-uitbaters hiervoor zelf betalen; dat moet de validatie aantonen.

**Terugkerende waarde:** er komen elke week nieuwe facturen binnen, dus elke week is er een nieuwe uitkomst. De waarde is meetbaar in euro: "deze maand €212 aan prijsstijgingen gevonden".

**Economie** [AANNAME]:

| | Waarde |
|---|---|
| Prijs | €29/maand per vestiging |
| Netto per maand | ~€27 na betaalkosten en hosting; ~€20 inclusief 6 min support aan €75/u |
| Kost per klant via advertenties | €50–330 (klik €0,80–2,00, bezoek → proef 3–5 %, proef → betalend 20–30 %) |
| Levensduur | 12–33 maanden (churn 3–8 %/maand) → LTV €250–660 inclusief support |
| Met €6.000 advertentiebudget | 15–50 klanten → €435–1.450 per maand terugkerend |

**Risico's:**
- **Toegang tot de data**: hoe krijgt de klant zijn UBL-bestanden bij jou? Dat
  hangt af van zijn access point. Billit heeft een API, voor anderen moet het via
  export of e-mail. Dit is risico nr. 1 en wordt in de validatie getest.
- Boekhoudpakketten of access points kunnen de functie zelf toevoegen.
- Niet-technische kopers vragen meer uitleg.
- Persoonsgegevens: beperkt (leveranciers zijn bedrijven; eenmanszaken zijn wel personen). Een online verwerkersovereenkomst is nodig. Er is geen marketing naar consumenten.

### Idee 2 — "Model Guard": kwaliteitscontrole van Power BI-modellen bij elke wijziging

**Wat:** een GitHub/Azure DevOps-integratie voor Power BI-projecten (PBIP/TMDL in Git). Bij elke pull request:
- best-practice-regels;
- een leesbare samenvatting van wat er in het model veranderde (maten, relaties, kolommen);
- automatische documentatie;
- een overzicht van de kwaliteit over alle repo's heen.

**Waarom** [BRON]:
- Power BI heeft volgens Microsoft **30 miljoen maandelijkse gebruikers**.
- TMDL is algemeen beschikbaar en het formaat van Power BI-projecten, dus modellen staan als tekst in Git.
- Er zijn SQLBits 2026-sessies en blogreeksen over het **zelf** bouwen van zulke pipelines; dat zie je vaak bij een gat in de markt.
- Ontwikkelaars betalen voor tooling: **Tabular Editor 3 Business** kost ~$350 per gebruiker per jaar.

**Concurrentie:** gratis bouwstenen (Best Practice Analyzer in Tabular Editor 2,
PBI Inspector van een Microsoft-engineer), eigen scripts, en Microsoft kan dit zelf toevoegen.

**Terugkerende waarde:** elke pull request is een nieuw gebruiksmoment.

**Economie** [AANNAME]: €39/maand per team of repo, ~€38 netto. De ontwikkelaarsdoelgroep vraagt zeer weinig support en koopt internationaal in het Engels. Werving via inhoud en zoekgedrag ("power bi ci cd", "best practice analyzer github action") en via de GitHub Marketplace. Hoeveel teams PBIP met Git écht gebruiken, is onbekend; daar zit de onzekerheid.

**Waarom niet als eerste:** de betalingsbereidheid tegenover gratis
alternatieven is onzeker en de markt kleiner dan "30 miljoen gebruikers"
suggereert. Het is wel de logische tweede kandidaat: hij past het best bij je profiel en schaalt het best internationaal.

### Idee 3 — Kant-en-klaar Power BI-rapportpakket voor Exact Online / Teamleader / Odoo (niet aanbevolen)

**Wat:** een connector met sjablonen voor kmo's en hun boekhouders.

**Waarom niet:** de markt is druk. CData vraagt $499/jaar per connector, er zijn
Odoo-apps van $120–750 en Peliqan biedt Teamleader → Power BI aan. Je kan je
moeilijk onderscheiden; dit is vooral eenmalige verkoop en vraagt support bij
elke API-wijziging. Ik vermeld het alleen voor de volledigheid.

## 4. Validatie van 14 dagen voor idee 1 (nog niet uitvoeren)

**Doel:** in 14 dagen, voor maximaal €750, aantonen dat (1) kmo's hun e-facturen
binnen 15 minuten kunnen aanleveren, (2) de analyse geld vindt, en (3) ze er
vooraf voor willen betalen. **Geen productcode**: een landingspagina, een
betaallink en een analyse die je met de hand in een notebook draait.

| Dag | Wat | Kost |
|---|---|---:|
| 1 | Naam, domein, landingspagina met de belofte "Ontdek elke maand welke leverancier stilletjes duurder werd", prijs (€29/maand, founder-aanbod €99 voor 6 maanden), voorbeeldrapport op fictieve facturen | €20–50 |
| 1 | Betaallink (Stripe/Mollie) voor het founder-aanbod, terugbetaalbaar als de dienst niet start; online verwerkersovereenkomst en privacytekst (zelf, op basis van een template) | €0 |
| 2–3 | **Data-toegang testen**: hoe exporteer je inkomende UBL bij de 6 meest gebruikte access points of boekhoudpakketten (Billit, Banqup, Peppol-boxen van Exact, Yuki, Octopus, Accountable)? Gratis proefaccounts, documentatie, support vragen. Resultaat: een tabel met "export mogelijk / API / e-mail doorsturen / niet" | €0 |
| 2 | Notebook (Python) dat een map UBL-bestanden inleest en het rapport maakt: prijsevolutie per artikel, dubbels, nieuwe kosten | €0 (eigen tijd) |
| 3–12 | **Verkeer zonder virale hit**: (a) Meta-advertenties naar zaakvoerders in horeca en voeding in Vlaanderen, €400 budget; (b) 3 berichten per week in horecagroepen op Facebook en LinkedIn waar dat volgens de groepsregels mag; (c) een SEO-pagina "prijsstijging leverancier controleren" | €400 |
| 4–12 | **Concierge-test**: 3–5 zaken sturen 3 maanden facturen door; jij maakt met de hand het rapport | €0 |
| 4–12 | 10 korte gesprekken: 5 uitbaters, 5 boekhouders (een mogelijk kanaal: één boekhouder bedient tientallen klanten) | €0–100 |
| 13–14 | Cijfers optellen, beslissen | — |

**Meetpunten en drempels:**

| Meetpunt | Doorgaan als | Stoppen als |
|---|---|---|
| Landingspagina → e-mailadres | ≥ 8 % van ≥ 300 bezoekers | < 3 % |
| Founder-voorbestelling (betaald) | ≥ 3 | 0 |
| Concierge: rapport vindt minstens één prijsstijging, dubbel of kostenpost die meer waard is dan een maandabonnement | bij ≥ 60 % van de deelnemers | bij < 30 % |
| Data aanleveren lukt binnen 15 minuten | bij ≥ 70 % | bij < 40 %: dan is toegang het echte product, en ben je afhankelijk van access points |
| Kost per e-mailadres via advertenties | ≤ €10 | > €30 |

**Beslissing op dag 14:**
- **Alle "doorgaan"-drempels gehaald** → bouw het minimale product (UBL-import
  plus wekelijkse e-mail, geen dashboard) in 3–4 weken, met een cashbudget van
  maximaal €2.000. De rest van de €10.000 blijft achter de hand tot er ≥ 20
  betalende klanten zijn.
- **Interesse, maar data-toegang faalt** → onderzoek een samenwerking met één access point of een boekhoudkantoor voor je verder bouwt.
- **Stopdrempels** → stop; draai dezelfde 14-dagenvalidatie voor idee 2, met een
  GitHub-landingspagina en voorbestelling, verkeer via LinkedIn-inhoud en
  Power BI-communities, en ≥ 3 betaalde teams als drempel.

**Totale validatiekost: €420–750 van de €10.000.** Meer uitgeven pas na bewezen betalingsbereidheid.

## 5. Bronnen (volledige links)

E-facturatie en Peppol:
- Peppol BIS Billing 3.0, artikelprijs verplicht (BT-146, 1..1): https://docs.peppol.eu/poacc/billing/3.0/syntax/ubl-invoice/cac-InvoiceLine/cac-Price/cbc-PriceAmount/
- E-facturatie België vanaf 1 januari 2026 (Lexgo): https://www.lexgo.be/nl/nieuws-en-publicaties/14132-e-facturatie-vanaf-1-januari-2026-verplicht-in-belgie
- België, e-facturatie 2026 en e-rapportering 2028 (Edicom): https://edicomgroup.com/nl/blog/belgie-gaat-b2b-elektronische-facturatie-verplicht-stellen
- Ervaringen met de Belgische e-facturatieverplichting: https://blog.forumforthefuture.be/nl/article/de-belgische-e-facturatieverplichting-van-2026-wat-hebben-we-tot-nu-toe-geleerd/30900
- EU-tijdlijn e-facturatie (secundair): https://www.fonoa.com/resources/blog/e-invoicing-and-digital-reporting-in-the-eu-upcoming-changes
- EU-tijdlijn e-facturatie (secundair): https://econnect.eu/en/docs/knowledge/regulations/europe/vida/timeline
- Billit Peppol access point en API: https://blog.billit.be/en-int/peppol-access-point
- Billit API-documentatie: https://docs.billit.be/docs/specific-for-v1peppol-sendxml

Concurrenten en betalingsbereidheid:
- MarketMan-prijzen: https://web-v2.prod.trustradius.com/products/marketman/pricing
- MarketMan, factuurscanning: https://MarketMan.com/platform/marketman-snap-expense-tracking
- Invoiceless (GetApp): https://www.getapp.co.uk/software/2084287/invoiceless
- PriceShield (Trustpilot): https://www.trustpilot.com/review/trypriceshield.com
- Horeca: meer stoppers dan starters (RetailDetail): https://www.retaildetail.be/nl/news/food/voor-het-eerst-meer-stoppers-dan-starters-de-horeca/

Power BI:
- 30 miljoen maandelijkse gebruikers (Power BI-blog): https://community.fabric.microsoft.com/t5/Power-BI-Updates-Blog/Power-BI-2025-holiday-recap-A-decade-of-innovation-and-impact/ba-p/5173964
- TMDL algemeen beschikbaar: https://powerbi.microsoft.com/fr-ca/blog/author/ruiromano
- Tabular Editor 3-prijzen: https://tabulareditor.com/pricing
- Tabular Editor 3-edities: https://docs.tabulareditor.com/te3/editions.html
- Zelfbouw BPA-pipeline met GitHub Actions: https://fabricatedinsights.substack.com/p/building-your-power-bi-cicd-pipeline
- SQLBits 2026, GitHub Actions voor Power BI: https://sqlbits.com/sessions/event2026/Beyond_Version_Control_GitHub_Actions_for_Power_BI_Development
- PBI Inspector: https://blog.crossjoin.co.uk/2023/10/01/visops-for-power-bi-with-pbi-inspector/

Connectoren (idee 3):
- CData Exact Online-connector: https://www.cdata.com/drivers/exact/order/powerbi/
- CData Odoo-connector: https://www.cdata.com/drivers/odoo/order/powerbi/
- Odoo Power BI-connector (Odoo Apps): https://apps.odoo.com/apps/modules/19.0/powerbi_desktop_connector
- Peliqan Teamleader → Power BI: https://peliqan.io/blog/teamleader-to-power-bi/

LeadRevive-markt:
- Whise-profiel: https://village.ai/company/whise
