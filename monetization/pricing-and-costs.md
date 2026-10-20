# Prijzen, kosten en scenario's — LeadRevive

> Dit zijn **rekenvoorbeelden, geen omzetvoorspellingen**. Alle bedragen zijn excl. btw, per
> maand, in een stabiele situatie (na de pilot). Wisselkoers: $1 ≈ €0,92 [aanname].

## 1. Prijs

| Onderdeel | Prijs |
|---|---|
| Pilot (60 dagen, eenmalig) | €750 |
| Abonnement per kantoor | €249/maand |

## 2. Aannames over kosten

| Kostenpost | Aanname | Onderbouwing |
|---|---|---|
| Hosting (Render, Frankfurt) | Web $7 + worker $7 + Postgres $6–19 + opslag | [Render-prijzen](https://render.com/pricing.md). Eén multi-tenant installatie voor alle kantoren [code: tenant-isolatie op `agencyId`] |
| Back-ups / grotere DB | Van Basic-256mb naar Basic-1gb (~$19) vanaf ~10 kantoren | Een groter klantenbestand per kantoor [aanname] |
| Domein, uptime-monitoring, e-mail | ~€10–30/maand | Domein ~€15/jaar, UptimeRobot of Better Stack gratis tot een klein abonnement [aanname] |
| AI of API-verbruik | **€0** | ImmoRadar gebruikt geen LLM of betaalde API [code: alleen next, react, prisma, pg, zod] |
| Telegram | €0 | Gratis Bot API |
| Betaaltransacties | ~€0,30 per factuur | Facturatie per overschrijving of SEPA-incasso. Mollie SEPA ~€0,25 ([Finexer](https://blog.finexer.com/mollie-pricing/)), Stripe SEPA ~0,35–0,8 % (niet officieel bevestigd). Bij een manuele factuur ~€0 |
| Supporttijd | Aan **€75/uur** (opportuniteitskost) | Lager dan je freelance-tarief, maar het gaat om korte blokken. 1,0 u per kantoor per maand bij 5 klanten, 0,8 u bij 10, 0,6 u bij 25 (imports worden routine) [aanname] |

**Vaste kosten buiten de brutomarge** (eenmalig of jaarlijks, wel budgetteren):
- juridische review van de verwerkersovereenkomst, voorwaarden en privacy: €500–1.500 eenmalig [aanname];
- beroepsaansprakelijkheid / cyberverzekering: €400–900 per jaar [aanname];
- boekhoudsoftware: die heb je als freelancer waarschijnlijk al.

## 3. Scenario's per maand

| | **5 kantoren** | **10 kantoren** | **25 kantoren** |
|---|---:|---:|---:|
| Omzet (MRR à €249) | **€1.245** | **€2.490** | **€6.225** |
| Hosting en DB | €20 | €40 | €110 |
| Domein, monitoring, e-mail | €10 | €15 | €30 |
| AI / API | €0 | €0 | €0 |
| Betaaltransacties | €1,50 | €3 | €7,50 |
| Supporttijd | 5 u → €375 | 8 u → €600 | 15 u → €1.125 |
| **Directe kosten** | **€406,50** | **€658** | **€1.272,50** |
| **Brutomarge** | **€838,50 (67 %)** | **€1.832 (74 %)** | **€4.952,50 (80 %)** |
| Op jaarbasis (omzet) | ~€14.900 | ~€29.900 | ~€74.700 |

**Pilots:** elke pilot levert €750 op, tegenover ~6–8 uur werk (≈ €450–600 aan €75/uur).
Een pilot is dus kostendekkend, niet winstgevend. Dat is ook het doel.

## 4. Eerlijke kanttekening

- Bij 5 klanten verdien je **~€840 per maand bruto**. Dat is ruwweg 8–9 uur freelance
  data-engineering. Het product is pas interessant vanaf ~10 kantoren, of als het pilotmodel zich
  zonder veel supporttijd laat herhalen.
- De grootste kostenpost is **jouw tijd**, niet de infrastructuur. Daarom staat in fase B een
  e-maildigest en zelf importeren (`technical-backlog.md`): minder support per klant.
- Churn is niet gemodelleerd. Een kantoor dat na 3 maanden geen mandaat uit de lijst haalt,
  zegt op [aanname]. Meet dit vanaf de eerste pilot.

## 5. Gevoeligheid

| Wijziging | Effect bij 10 kantoren |
|---|---|
| Prijs €199 in plaats van €249 | Omzet €1.990, marge ~€1.330 (67 %) |
| Prijs €349 | Omzet €3.490, marge ~€2.830 (81 %) |
| Support 1,5 u in plaats van 0,8 u per kantoor | Marge daalt met ~€525 tot ~€1.305 |
