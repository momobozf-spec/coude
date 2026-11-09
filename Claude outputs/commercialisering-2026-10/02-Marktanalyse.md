# 02 — Marktanalyse (synthese)

*Raadpleegdatum van alle bronnen: 23-10-2026. Volledige rapporten met concurrentietabellen, reviews en bronnenlijsten: `bijlagen/M1-kids.md`, `M2-muslim-adult.md`, `M3-b2b.md`, `M4-consumer.md`.*
*Labels: **[L]** = claim van de leverancier · **[O]** = onafhankelijk (pers, overheid, store-data, review) · **[C]** = eigen conclusie.*
*Er zijn bewust geen zoekvolumes, downloads, omzet, marktaandelen of conversiecijfers gebruikt: die zijn niet gevonden.*

## 1. Scorebord van alle onderzochte concepten

| Concept | Betaal-bereidheid | Bereik-baarheid | Concurrentie (5 = weinig) | Onder-scheid | Laag handwerk | Totaal /25 |
|---|---|---|---|---|---|---|
| RailClaim | 1 | 3 | 4 | 3 | 4 | 15 |
| **TenderKompas** | 2 | 3 | 2 | 3 | 4 | **14** |
| RentGuard | 2 | 3 | 3 | 3 | 3 | 14 |
| **Kids-platform (Kleine Qamar / Noor)** | 2 | 3 | 3 | 3 | 2 | **13** |
| Barakah (zakat) | 2 | 3 | 3 | 3 | 2 | 13 |
| Parking Guard | 1 | 3 | 4 | 2 | 3 | 13 |
| ImmoRadar / LeadRevive | 3 | 3 | 2 | 2 | 2 | 12 |
| BrainVoice | 2 | 2 | 1 | 2 | 4 | 11 |
| Halal-scanner | 2 | 3 | 2 | 2 | 2 | 11 |
| Warmtepomp-leads / KetelCheck | 3 | 2 | 1 | 2 | 2 | 10 |
| WoningAlert | 1 (BE) | 3 | 1 | 1 | 2 | 10 |
| Muslim Life | 2 | 2 | 1 | 1 | 3 | 9 |

[C] RailClaim scoort het hoogst op totaal maar heeft betaalbereidheid 1: NMBS betaalde in 2024 €278.900 uit op 41.400 claims (81% aanvaard) [O, NewMobility/antwoord minister], gemiddeld ± €8 per aanvaarde claim — een commissie daarop levert niets op. Daarom niet in de top 2.

## 2. TenderKompas — data/BI-tenderradar (top 1)

**Doelgroep en koopreden.** Belgische data/BI/cloud-bureaus (3–30 FTE). Het gratis e-Procurement-profiel filtert op CPV en regio, niet op trefwoorden in bestekken ([TenderWolf kennisbank](https://www.tenderwolf.com/en/knowledge-base/e-procurement-belgium) — belanghebbende bron). IT/data-opdrachten zitten onder brede CPV-codes → veel ruis [C]. Beleid duwt richting kmo-toegang: federale doelstelling 80% kmo-deelname ([UNIZO, 13-02-2025](https://www.unizo.be/betere-toegang-voor-kmos-tot-overheidsopdrachten)) [O]; Vlaamse omzendbrief kmo-vriendelijk aanbesteden 22-05-2026 ([VLAIO](https://www.vlaio.be/nl/nieuws/kmo-vriendelijk-aanbesteden-omzendbrief-en-concrete-tips)) [O].

**Alternatieven (≥ 5).**

| Alternatief | Prijs | Opmerking |
|---|---|---|
| [e-Procurement (FOD BOSA)](https://www.publicprocurement.be) | gratis | CPV/regio-meldingen, dagelijks [O] |
| [TED-alerts](https://ted.europa.eu) | gratis | Opgeslagen zoekopdrachten; enkel boven EU-drempels [O] |
| [TenderWolf](https://tenderwolf.com/en/help-center/tenderwolf-pricing/) | €0 / €79 / €149 p.m. | Belgisch, NL/FR/EN, AI-matching [L] — **directe concurrent** |
| [TenderApp](https://tender.app) | €149–699 p.m. + setup | NL-gericht, jaarcontract [L] |
| [Jorpex](https://jorpex.com/nl/compare/tenderapp-alternatief/) | vanaf USD 49 p.m. | BE-dekking onduidelijk [L] |
| [Mercell](https://info.mercell.com/en/procurement-insights/mercell-for-suppliers/) | vanaf €1.100/jaar (Capterra) | pan-Europees, complex [O] |
| [Govex](https://www.govex.be) | niet publiek | BE, advies [L] |
| Huidige werkwijze | €0 + tijd | zelf zoeken, netwerk, onderaanneming via hoofdaannemers |

**Klachten in de markt:** lange contracten en complexiteit (Capterra-reviews Negometrix; concurrentieclaims over jaarcontracten) [O/L]. Weinig publieke reviews: TenderWolf heeft 0 reviews op [Capterra](https://www.capterra.com/p/10039773/TenderWolf/) [O].

**Waarom iemand níét betaalt:** gratis overheidsalerts dekken de basis; TenderWolf is goedkoper dan de oorspronkelijke €299; kleine bureaus winnen zelden rechtstreeks; het aantal relevante BE data/BI-tenders per maand is **onbekend** [C].

**Wat we realistisch onderscheidend kunnen leveren** [C]: verticale classificatie op tekst (Fabric, Databricks, Power BI, DWH) i.p.v. CPV; en een *raamcontract-radar* (wie won welk raamcontract → potentiële hoofdaannemer voor onderaanneming). Daarom prijs €59/€119 i.p.v. €299.

**Taalmarkten:** NL (TenderNed gratis + TenderApp/Altura/Jorpex), FR-BE (TenderWolf FR, Govex), EN (Stotles, Tussell — UK). [C] Uitbreiding naar NL is logisch na BE (TenderNed is open data); FR (Frankrijk) niet onderzocht.

**Juridisch:** TED is open data voor hergebruik ([EU-Publicatiebureau](https://op.europa.eu/en/web/ted-reusers-workshops/questions-and-answers-2025)) [O]. Voor e-Procurement BE werd geen publieke API gevonden → eerst gebruiksvoorwaarden checken [C]. Laag GDPR-risico [C]. **Let op belangenconflict:** jij werkt freelance voor Digitaal Vlaanderen (een aanbestedende overheid) — enkel publieke data gebruiken en je contract via Cronos nakijken [C].

## 3. Kleine Qamar — Islamitische kinderapp NL/FR (top 2)

**Doelgroep en koopreden.** Moslimouders van kinderen 4–8 in Vlaanderen/Brussel; aanbod is overwegend Engels of Arabisch [O, Miraj-review: "some of the stories are all in Arabic"]. Een Nederlandstalige Islamitische kinderapp met abonnement: **niet gevonden** [C] — dat is het gat, maar mogelijk ook een teken dat de markt klein is.

**Alternatieven (≥ 5).**

| Alternatief | Prijs | Taal | Opmerking |
|---|---|---|---|
| [Miraj](https://apps.apple.com/US/app/id1222528421) | $3,49–8,90 p.m.; $60,99–89/jaar | EN (+AR) | 4,6★ (740) [O] |
| [Muslim Kids TV](https://apps.apple.com/app/id1189900377) | $9,99 p.m.; $79,99/jaar | EN | billing-klachten [O] |
| [Durioo+ (Omar & Hana)](https://apps.apple.com/app/id1605538612) | $17,99 p.m. | EN | "Do not sign up for a free trial!!" [O] |
| [Kahf Kids](https://apps.apple.com/app/id6605937095) | $4,99–29,99 | EN/AR/… | grote bibliotheek [L] |
| [BDouin – Awlad](https://apps.apple.com/FR/app/id1669010427) | gratis/donatie | FR | 4,9★ (313) — sterk in FR [O] |
| [Histoires des Prophètes](https://apps.apple.com/us/app/id6446229626) | $3,99 p.m.; $29,99/jaar | FR | kleine basis [O] |
| [Noor Kids](https://noorkids.com/cbp) | $89,99/jaar (fysiek) | EN | **merkrisico voor "Noor"** [L] |
| Huidige werkwijze | gratis | divers | YouTube, WhatsApp-printables, moskeeles |

**Terugkerende klachten:** opzeggen/trials (#1), bugs, content enkel in het Arabisch [O]. → Eerlijk abonnement + NL/FR is een realistisch onderscheid [C].

**Waarom iemand níét betaalt:** gratis YouTube en printables; schermtijd-schuldgevoel; "wie keurde dit goed, welke stroming?"; versnipperde gemeenschap; seizoensgebonden (Ramadan) [C].

**Bereikbaarheid:** Brussel ± 25 erkende moskeeën + tientallen niet-erkende ([VRT 10-04-2026](https://www.vrt.be/vrtnws/nl/2026/04/10/moskeeen-willen-massaal-uitbreiden-mensen-moeten-nu-soms-buiten/)) [O]; NL bijna 100 islamitische basisscholen ([NOS](https://nos.nl/l/2567509)) [O]; aantal voor Vlaanderen niet gevonden.

**Regels:** Apple Kids-categorie — aankopen en externe links alleen achter ouderlijke poort, geen third-party analytics/ads ([Apple guidelines 1.3/5.1.4](https://developer.apple.com/app-store/review/guidelines/)); Google Play Families-beleid ([link](https://support.google.com/googleplay/android-developer/answer/9893335?hl=en)); digitale toestemmingsleeftijd BE 13 / NL 16 / FR 15 → account op naam van de ouder [O]. Gebedsdata zou art. 9 AVG-gevoelig zijn → **geen tracker in v1** [C].

## 4. Waarom de rest afvalt (één regel per concept)

- **RentGuard:** het probleem is reëel (± 300.000 huurdershuishoudens in Brussel), maar alles wat ertoe doet is gratis via het Gewest, de Paritaire Huurcommissie en Test-Aankoop; juridische grens informatie/advies [M4].
- **ImmoRadar/LeadRevive:** Realo Pro biedt al Prospection voor €89/m [L]; PriceHubble lanceerde op 27-05-2026 een "Property Lead Engine" [O]; FSBO-scraping botst met databankenrecht (C-762/19), art. XII.13 WER en GDPR [O/C] [M3].
- **Barakah:** alle calculators gratis; zelf giften innen valt onder PSD2; alleen erkende vzw's mogen een fiscaal attest geven [M2].
- **Halal-scanner:** juistheid is onmogelijk te garanderen (herkomst E-nummers staat niet op etiket); concurrent TagHalal: veel negatieve reviews over fouten [M2].
- **Muslim Life:** Muslim Pro (600K ratings), Pillars, Mawaqit (gratis, standaard in BE/FR-moskeeën) [M2].
- **BrainVoice:** Todoist Ramble ondersteunt NL/FR, Gemini Live, Apple Intelligence in het NL sinds iOS 26.1 [M4].
- **Warmtepomp-leads/KetelCheck:** Bobex sinds 1999 (4,4★ op 2.778 reviews), installateurs zijn schaars en vol; gratis Mijn VerbouwBegeleiding beoordeelt offertes [M3].
- **WoningAlert / Parking Guard:** gratis alternatieven in BE; scraping-risico; betwisten is gratis [M4].

## 5. Belangrijkste bronnen (selectie; volledige lijsten in bijlagen)

- TenderWolf prijzen — https://tenderwolf.com/en/help-center/tenderwolf-pricing/
- e-Procurement — https://www.publicprocurement.be
- UNIZO kmo-toegang — https://www.unizo.be/betere-toegang-voor-kmos-tot-overheidsopdrachten
- VLAIO omzendbrief — https://www.vlaio.be/nl/nieuws/kmo-vriendelijk-aanbesteden-omzendbrief-en-concrete-tips
- Databricks User Group Belgium — https://usergroups.databricks.com/databricks-user-group-belgium/
- Miraj — https://apps.apple.com/US/app/id1222528421
- Muslim Kids TV — https://apps.apple.com/app/id1189900377
- BDouin Awlad — https://apps.apple.com/FR/app/id1669010427
- Apple Kids — https://developer.apple.com/app-store/kids-apps/
- Apple Small Business Program — https://developer.apple.com/app-store/small-business-program/
- Google Play-servicekosten — https://support.google.com/googleplay/android-developer/answer/112622
- Realo Pro prijzen — https://pro.realo.be/en/pricing
- VRT moskeeën Brussel — https://www.vrt.be/vrtnws/nl/2026/04/10/moskeeen-willen-massaal-uitbreiden-mensen-moeten-nu-soms-buiten/
