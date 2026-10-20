# Opleverstatus — 20 oktober 2026

## 0. Eerst doen: accountacties (alleen jij kan dit)

Code aanpassen trekt niets in. Alles hieronder blijft open tot jij het doet.
Details en achtergrond staan in [beveiliging-acties.md](beveiliging-acties.md).

| # | Actie | Waar | Waarom dringend |
|---|---|---|---|
| 0 | **Vercel en Render nakijken**: welke projecten zijn aan `coude`, `marktonderzoek`, `immoradar` of `clodeproject1` gekoppeld, staat auto-deploy aan, en zijn er preview-deployments van branch `ccr-02331f64-4fd2md`? | Vercel → Deployments; Render → Services | Productie is niet gecontroleerd; Vercel maakt bij elke branch-push een preview |
| 1 | **ANWB-API-sleutel intrekken** (als je hem zelf aanvroeg) of niet meer gebruiken | ANWB-ontwikkelaarsaccount | Staat publiek in de git-geschiedenis van `coude` **en** in de huidige code van de publieke repo `clodeproject1` |
| 2 | **Firebase-browsersleutel beperken** tot je domein(en) en Firebase-API's; Firestore-regels nakijken | Google Cloud Console → Credentials; Firebase Console → Rules | Sleutel staat publiek in `coude` en `clodeproject1`; de regels kon ik niet zien |
| 3 | **Verbruik van AI-sleutels nakijken**, uitgavenlimiet instellen, roteren bij onverklaard verbruik | Anthropic Console (resume-roaster, Hikmar), OpenAI, Google AI Studio (Hikmar) | De endpoints die deze sleutels gebruiken, stonden open |
| 4 | **Logs van printable-generator nakijken** op verzoeken naar `/api/admin/stats` | Vercel/Render, als de app online stond | Gaf namen en e-mailadressen van gebruikers vrij. Bij misbruik: binnen 72 uur beoordelen of je dit bij de GBA moet melden |
| 5 | **Admin-wachtwoorden wijzigen** van webshops die online geseed werden (Layali, luxe-store), inclusief de demoklant | In de app of de database | De standaardwachtwoorden staan publiek in de code |
| 6 | `ADMIN_PASS` (≥ 12) en `SESSION_SECRET` zetten voor marktonderzoek; oud wachtwoord nergens anders meer gebruiken | Render → marktonderzoek → Environment | De nieuwe code start niet zonder deze variabelen; het oude standaardwachtwoord stond in de code |
| 7 | Lokaal `AUTH_SECRET`/`NEXTAUTH_SECRET` van noor-tracker vervangen | `noor-tracker/.env` | Maakt de oude sessiecookies ongeldig (ze waren al verlopen) |
| 8 | **`clodeproject1` en `immoradar` privé maken** of archiveren; secret scanning en push protection aanzetten; 2FA op GitHub, Render, Railway, Vercel, Google en Anthropic | GitHub → Settings | `clodeproject1` is een publieke kopie met dezelfde lekken en kwetsbare code; mijn fixes staan daar **niet** in |

## 1. Live of alleen in code? — productie **niet gecontroleerd**

Ik heb geen toegang tot Render, Vercel, Railway of Firebase. Of en welke versie
van een app online staat, is dus **niet gecontroleerd**. Dat ik zelf niets
gedeployed heb, bewijst niet dat er niets live staat.

**Wat mijn push mogelijk wél heeft veroorzaakt:**
- **Vercel** maakt standaard bij *elke* push naar *elke* branch een
  preview-deployment ("automatic deployments on every branch push",
  https://vercel.com/docs/git). `printable-generator`, `noor-tracker` en
  `jamal-jamila` hebben een `vercel.json`. Zijn die projecten op Vercel gekoppeld
  aan `coude`, dan staat mijn branch er mogelijk al als preview-URL, met de
  preview-variabelen. → **Nakijken in Vercel → Deployments.**
- **Render** deployt alleen de gekoppelde branch (standaard de default branch
  `main` of de branch van de Blueprint; https://render.com/docs/blueprint-spec).
  In `coude/render.yaml` staan PR-previews uit. Een push naar mijn branch
  deployt daar dus normaal gezien niets. **Niet gecontroleerd.**

**Wat een merge naar `main` waarschijnlijk start** (niet gecontroleerd):

| Repo | Host | Auto-deploy bij merge naar `main`? |
|---|---|---|
| `coude` | Render-Blueprint (`render.yaml`, geen `autoDeployTrigger`) | Ja voor nieuwe services (standaard `commit`); voor bestaande services blijft de huidige instelling |
| `coude` | Vercel (3 apps, als gekoppeld) | Ja: productie-deployment bij merge naar de productiebranch |
| `marktonderzoek` | Render | Ja: `autoDeploy: true` staat expliciet in `render.yaml` |
| `immoradar` | Render-Blueprint | Standaard ja (`commit`); niet gecontroleerd of er een service bestaat |

**Juiste volgorde** (vervangt "mergen, variabelen zetten, deployen"):
1. In Render en Vercel nakijken welke services aan welke repo en branch gekoppeld zijn, en of auto-deploy aanstaat.
2. **Eerst** de nodige variabelen zetten: `ADMIN_PASSWORD` (printable-generator), `HIKMAR_ACCESS_TOKEN`, `ADMIN_PASS` en `SESSION_SECRET` (marktonderzoek).
3. Pas dan mergen; dat start vermoedelijk de deploy.
4. Na de deploy controleren: admin-routes geven 401 zonder wachtwoord; resume-roaster geeft 429 boven de limiet; marktonderzoek start.
5. Verwijder eventuele Vercel-previews van mijn branch, of bescherm ze, als je ze niet wil laten openstaan.

| Beveiligingsfix | In code (branch) | Productie |
|---|---|---|
| printable-generator: admin-routes dicht, stats beschermd | ✅ `coude` | niet gecontroleerd; mogelijk preview op Vercel |
| resume-roaster: limieten, geen CORS | ✅ `coude` | niet gecontroleerd |
| brandstofprijzen: ANWB-sleutel en verzonnen prijzen weg | ✅ `coude` | niet gecontroleerd; **sleutel blijft geldig tot actie 1** |
| Hikmar: toegangscode, limieten | ✅ `coude` | niet gecontroleerd |
| noor-tracker: `cookies.txt` uit de repo | ✅ `coude` | staat nog in de git-geschiedenis |
| Webshops: seed weigert publiek wachtwoord online | ✅ `coude` | bestaande admin-accounts ongewijzigd tot actie 5 |
| marktonderzoek: geen standaardwachtwoord, geen CORS | ✅ `marktonderzoek` | niet gecontroleerd |
| `clodeproject1` | ❌ niet aangepast | niet gecontroleerd |

### Openstaand datakwaliteitsrisico (immoradar): samenvoegen op een gedeeld telefoonnummer

- De import voegt twee contacten samen als ze hetzelfde telefoonnummer hebben.
  Dat gold al op `main` (oude `findExistingContact`) en geldt ook op mijn branch
  (via `findDuplicate`). Gezinsleden met één vast nummer, of meerdere mensen met
  een bedrijfsnummer, worden dan **één contact**, en de gegevens van de één
  overschrijven gedeeltelijk die van de ander.
- Mijn branch voegt daar samenvoegen op naam + exact adres aan toe. Dat maakt
  het aantal samenvoegingen groter.
- **Advies: merge de importwijzigingen niet onvoorwaardelijk.** Opties:
  - (a) eerst een regel toevoegen: niet automatisch samenvoegen op een vast
    nummer of op een nummer dat al bij een contact met een andere naam hoort,
    maar markeren ter controle;
  - (b) alleen de veilige delen mergen (CI-bestand, export, documentatie) en de
    importcommit apart houden.

  LeadRevive is geparkeerd, dus dit heeft geen haast. Laat het open tot je beslist.

## 2. Per repository

### `momobozf-spec/coude` — branch `ccr-02331f64-4fd2md` (geen PR)

| Commit | Inhoud |
|---|---|
| `1dba402` | Eerste commercieel onderzoek (`monetization/`) |
| `d9b17ba` | Beveiligingsfixes in 6 apps |
| `9fe537e` | Bronnen, verdienmodellen, pilotaanbod, beveiligingsacties |
| `c4e3e3e` | Correcties, juridisch kader, productcheck, investeringsbeslissing, opleverstatus |

**Uitgevoerde tests:**

| App | Test | Resultaat |
|---|---|---|
| printable-generator | `tsc --noEmit` | geslaagd (geen tests in die app) |
| resume-roaster | server lokaal gestart, 7 verzoeken | 5× doorgelaten, daarna 429; geen CORS-headers |
| Hikmar | FastAPI-testclient | 401 zonder code, 413 te lang, 429 boven de limiet, 503 zonder ingestelde code |
| brandstofprijzen | `node --check` op het script | geslaagd |
| seeds jamal-jamila / luxe-store | **niet** uitgevoerd | — |
| repo | geen CI | — |

**Resterend:** de volgorde uit §1 volgen: koppelingen controleren, variabelen zetten, dan pas mergen.

### `momobozf-spec/immoradar` — branch `ccr-02331f64-4fd2md` (geen PR)

| Commit | Inhoud |
|---|---|
| `a729d56` | Intake-scan, demo, export per kantoor, vier fixes in de motor, CI-bestand verplaatst, `docs/pilot/` |
| `f656549` | Transparantieherinnering in het rapport |

**Lokaal uitgevoerde tests:**

| Test | Resultaat |
|---|---|
| `npm run verify` | 163 tests geslaagd, 5 overgeslagen (databasetests) |
| Integratietests tegen PostgreSQL 16 | 168 tests geslaagd (CI gebruikt PostgreSQL 17) |
| `npm run build` | geslaagd |
| `npm run smoke` | alle schermen; tenantgrens geeft 404 |
| Playwright | 9/9 geslaagd |
| Import + LeadRevive-taak op de demo-CSV | 18 contacten, 12 geselecteerde kansen |

- **CI op GitHub heeft niet gedraaid**: de workflow start alleen bij een push naar `main` of bij een PR.
- **Let op:** wat het rapport "bruikbare kansen" noemt, is *geselecteerd + bereikbaar*, niet *mag benaderd worden*. Zie [leadrevive-productcheck.md](leadrevive-productcheck.md) §3. De tekst in het rapport is niet aangepast (geen nieuwe features).

**Resterend:**
- **niet onvoorwaardelijk mergen**: zie het datakwaliteitsrisico in §1;
- de repo privé maken.

### `momobozf-spec/marktonderzoek` — branch `ccr-02331f64-4fd2md` (geen PR)

| Commit | Inhoud |
|---|---|
| `9f59120` | Geen standaardwachtwoord, geen open CORS, eerlijke tekst over anonimiteit, religievraag optioneel |

**Tests:** `node --check`; start met `NODE_ENV=production` zonder variabelen geweigerd (verwacht); lokale start geeft health OK. Geen automatische tests.

**Resterend:** actie 6 vóór de merge; de merge deployt automatisch (`autoDeploy: true`).

### Alleen gelezen, niet gewijzigd
- `muslim-life`, `barakah2`: geen wijzigingen.
- `clodeproject1` (publiek): bevat dezelfde lekken. **Niet gewijzigd**; zie actie 1, 2 en 8.
- `hikmar-ai`, `rwina`, `clodeproject`, `barakah`: leeg.

## 3. Documenten in `monetization/`

| Document | Status |
|---|---|
| [investeringsbeslissing.md](investeringsbeslissing.md) | **Nieuw**: advies C, drie productideeën, validatie van 14 dagen |
| [juridisch-kader.md](juridisch-kader.md) | **Nieuw**: wet, richtsnoer en interpretatie gescheiden; volledige links |
| [leadrevive-productcheck.md](leadrevive-productcheck.md) | **Nieuw**: self-service, terugkerende waarde, geselecteerd vs. toegestaan, steekproefgarantie, economie |
| [opleverstatus.md](opleverstatus.md) | **Nieuw**: dit document |
| commercial-offer, first-customers-plan, pricing-and-costs, technical-backlog | Gemarkeerd als geparkeerd en gecorrigeerd (garantie, juristenclaim) |
| bronnen-en-aannames, beveiliging-acties, portfolio-assessment | Bijgewerkt met verwijzingen |
