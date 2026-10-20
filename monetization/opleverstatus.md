# Opleverstatus — 20 oktober 2026

## 0. Eerst doen: accountacties (alleen jij kan dit)

Code aanpassen trekt niets in. Alles hieronder blijft open tot jij het doet.
Details en achtergrond staan in [beveiliging-acties.md](beveiliging-acties.md).

| # | Actie | Waar | Waarom dringend |
|---|---|---|---|
| 1 | **ANWB-API-sleutel intrekken** (als je hem zelf aanvroeg) of niet meer gebruiken | ANWB-ontwikkelaarsaccount | Staat publiek in de git-geschiedenis van `coude` **en** in de huidige code van de publieke repo `clodeproject1` |
| 2 | **Firebase-browsersleutel beperken** tot je domein(en) en Firebase-API's; Firestore-regels nakijken | Google Cloud Console → Credentials; Firebase Console → Rules | Sleutel staat publiek in `coude` en `clodeproject1`; de regels kon ik niet zien |
| 3 | **Verbruik van AI-sleutels nakijken**, uitgavenlimiet instellen, roteren bij onverklaard verbruik | Anthropic Console (resume-roaster, Hikmar), OpenAI, Google AI Studio (Hikmar) | De endpoints die deze sleutels gebruiken, stonden open |
| 4 | **Logs van printable-generator nakijken** op verzoeken naar `/api/admin/stats` | Vercel/Render, als de app online stond | Gaf namen en e-mailadressen van gebruikers vrij. Bij misbruik: binnen 72 uur beoordelen of je dit bij de GBA moet melden |
| 5 | **Admin-wachtwoorden wijzigen** van webshops die online geseed werden (Layali, luxe-store), inclusief de demoklant | In de app of de database | De standaardwachtwoorden staan publiek in de code |
| 6 | `ADMIN_PASS` (≥ 12) en `SESSION_SECRET` zetten voor marktonderzoek; oud wachtwoord nergens anders meer gebruiken | Render → marktonderzoek → Environment | De nieuwe code start niet zonder deze variabelen; het oude standaardwachtwoord stond in de code |
| 7 | Lokaal `AUTH_SECRET`/`NEXTAUTH_SECRET` van noor-tracker vervangen | `noor-tracker/.env` | Maakt de oude sessiecookies ongeldig (ze waren al verlopen) |
| 8 | **`clodeproject1` en `immoradar` privé maken** of archiveren; secret scanning en push protection aanzetten; 2FA op GitHub, Render, Railway, Vercel, Google en Anthropic | GitHub → Settings | `clodeproject1` is een publieke kopie met dezelfde lekken en kwetsbare code; mijn fixes staan daar **niet** in |

## 1. Live of alleen in code?

**Niets van mijn werk is live.** Ik heb niets gedeployed, geen PR gemaakt en niets
gemerged naar `main`. Ik heb geen toegang tot je hostingaccounts. Welke versie
van welke app vandaag online draait, weet ik dus niet. Vermoedelijk deployt
Render uit `main` van `coude` of uit `clodeproject1` (beide met `render.yaml`).

| Beveiligingsfix | In code (branch) | Live? |
|---|---|---|
| printable-generator: admin-routes dicht, stats beschermd | ✅ `coude` | ❌ pas na merge + deploy + `ADMIN_PASSWORD` |
| resume-roaster: limieten, geen CORS, eerlijke tekst | ✅ `coude` | ❌ |
| brandstofprijzen: ANWB-sleutel en verzonnen prijzen weg | ✅ `coude` | ❌ — **en de sleutel blijft geldig tot actie 1** |
| Hikmar: toegangscode, limieten | ✅ `coude` | ❌ pas na deploy + `HIKMAR_ACCESS_TOKEN` |
| noor-tracker: `cookies.txt` uit de repo | ✅ `coude` | n.v.t. (staat nog in de geschiedenis) |
| Webshops: seed weigert publiek wachtwoord online | ✅ `coude` | ❌ bestaande admins blijven onveranderd tot actie 5 |
| marktonderzoek: geen standaardwachtwoord, geen CORS, eerlijke enquêtetekst | ✅ `marktonderzoek` | ❌ |
| `clodeproject1` | ❌ niet aangepast | ❌ |

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

**Resterend:** nakijken en mergen; daarna de omgevingsvariabelen uit §0 zetten vóór de deploy.

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
- beslissen of je deze branch merget, ook nu LeadRevive geparkeerd wordt. Aanbevolen: wél mergen, want de fixes in import en ontdubbeling zijn echte bugfixes;
- de repo privé maken.

### `momobozf-spec/marktonderzoek` — branch `ccr-02331f64-4fd2md` (geen PR)

| Commit | Inhoud |
|---|---|
| `9f59120` | Geen standaardwachtwoord, geen open CORS, eerlijke tekst over anonimiteit, religievraag optioneel |

**Tests:** `node --check`; start met `NODE_ENV=production` zonder variabelen geweigerd (verwacht); lokale start geeft health OK. Geen automatische tests.

**Resterend:** actie 6 vóór de merge.

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
