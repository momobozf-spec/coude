# RentGuard Brussels

Mobile-first PWA voor huurders in het Brussels Hoofdstedelijk Gewest, tweetalig
NL/FR.

Vier pijlers:

1. **Plaatsbeschrijving** — begeleide fotodocumentatie bij intrek en vertrek, met
   bewijsintegriteit (SHA-256 + servertijdstempel) en PDF-rapporten
2. **Waarborg-terugeis** — termijnbewaking en ingebrekestellingen uit
   versioneerde templates
3. **Huurprijs- & indexatie-auditor** — toetsing aan het indicatieve huurrooster
   en de wettelijke indexatieformule
4. **Contract- & gebrekenassistent** — clausulescan en Q&A met bronvermelding

## Status

**Fase 0 afgerond** — juridisch onderzoek en fundament. Zie [PROGRESS.md](PROGRESS.md).

| | |
|---|---|
| Typecheck / lint / tests / build | groen (102 tests) |
| Databankschema + RLS | klaar, nog niet uitgerold |
| UI | nog niet gebouwd (Fase 1) |

## Aan de slag

```bash
npm install
cp .env.example .env.local     # vul minstens de Supabase-waarden in
npm run dev
```

Verificatie-gate:

```bash
npm run verify                 # typecheck + lint + test + build
```

Migraties:

```bash
supabase link --project-ref <ref>
supabase db push
```

## Integraties

Zie [INTEGRATIONS.md](INTEGRATIONS.md) voor de volledige tabel.

| Integratie | Status |
|---|---|
| Supabase | CONFIGURATION REQUIRED |
| Vision-analyse (Anthropic) | CONFIGURATION REQUIRED |
| Resend | CONFIGURATION REQUIRED |
| Stripe | CONFIGURATION REQUIRED |
| Aangetekende zending | CONFIGURATION REQUIRED |
| Sentry | CONFIGURATION REQUIRED |
| Eigen huurrooster-berekening | NOT AVAILABLE — [reden](docs/decisions/0002-huurrooster-geen-eigen-berekening.md) |

Zonder enige integratie werkt nog steeds: de check-in- en check-outwizard met
handmatige classificatie, de PDF-rapporten als download, en de
"verstuur zelf"-route voor aangetekende zending.

## Juridische review vereist vóór lancering

Dit product raakt aan rechten van mensen die er geld en woonzekerheid aan
ophangen. De volgende punten moeten door een jurist zijn nagekeken vóór er
één echte gebruiker op komt:

1. **Brieftemplates.** Alle templates staan op `PLACEHOLDER`. De app toont die
   status aan de gebruiker, maar dat vervangt geen review.
2. **Artikelverwijzingen.** De geconsolideerde Brusselse Huisvestingscode kon in
   Fase 0 niet automatisch worden uitgelezen. Art. 220, 224/2, 248 en 249 moeten
   woordelijk worden nagelezen. Zie [docs/juridisch.md](docs/juridisch.md) §0.
3. **EPB-indexatieregels.** Drie bronnen, drie onverenigbare lezingen. De regel
   staat op `UNVERIFIED` en draagt geen enkele brief.
4. **De boete van 10 % per maand** bij laattijdige waarborg: loopt die van
   rechtswege of vereist ze een ingebrekestelling? Bepaalt of onze brief het
   bedrag mag vorderen.
5. **Privacyverantwoording** — zie [docs/privacy.md](docs/privacy.md), met zeven
   openstaande vragen, waaronder of een DPIA vereist is.
6. **Disclaimers en framing** — zie
   [ADR 0003](docs/decisions/0003-bewijswaarde-framing.md).

## Wat dit product niet is

- Geen advocatenkantoor, geen juridisch advies, geen procesvertegenwoordiging.
- Een eenzijdig fotorapport is **geen** tegensprekelijke plaatsbeschrijving. Het
  is bewijsmateriaal dat een rechter vrij beoordeelt. De app legt dat verschil
  uit in gewone taal.
- Wij garanderen geen enkele uitkomst. De termen "juridisch waterdicht",
  "gegarandeerd" en "rechtsgeldig aangetekend" staan op een verbodslijst die
  door een test wordt afgedwongen — de build faalt als ze terugkomen.

## Documentatie

| | |
|---|---|
| [docs/juridisch.md](docs/juridisch.md) | Alle juridische regels met bron, raadpleegdatum en verificatiestatus |
| [docs/privacy.md](docs/privacy.md) | Aanzet tot verwerkingsregister |
| [docs/decisions/](docs/decisions/) | Architectuurbeslissingen |
| [INTEGRATIONS.md](INTEGRATIONS.md) | Wat je moet configureren |
| [PROGRESS.md](PROGRESS.md) | Voortgang per fase |
