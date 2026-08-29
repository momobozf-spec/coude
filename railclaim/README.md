# RailClaim Belgium

Detecteert NMBS-vertragingen op je vaste pendeltrajecten via de open iRail API
en zet je compensatiedossier klaar. **Detectie is automatisch; indiening gebeurt
nooit zonder jouw bevestiging per rit.**

> RailClaim is een onafhankelijke dienst en is niet verbonden aan, goedgekeurd
> door of gelieerd aan NMBS/SNCB.

## Wat dit product wel en niet doet

Dit staat vooraan omdat het de belangrijkste eigenschap van het systeem is.

**Wel:** elke pendeldag de aankomstvertraging meten en als bewijs bewaren; de
teller bijhouden voor de regeling herhaaldelijke vertragingen; op tijd
waarschuwen vóór een termijn verstrijkt; het volledige dossier invullen volgens
de officiële NMBS-voorwaarden, in NL of FR, met PDF.

**Niet:** indienen namens de gebruiker. NMBS heeft daar geen kanaal voor — geen
API, geen e-mailadres, en per post moet het originele vervoersbewijs mee
(behalve bij MoBIB). Wij vragen dus ook nooit My NMBS-inloggegevens. De
gebruiker dient zelf in, met alle velden kant-en-klaar. Zie
[ADR 0001](docs/decisions/0001-indieningskanaal.md).

**En nooit:** een dossier voorbereiden voor een rit die de gebruiker niet
uitdrukkelijk bevestigd heeft. Compensatie claimen voor een niet-gemaakte rit is
fraude op naam van de klant. Dit is afgedwongen in de database — een
CHECK-constraint die zelfs de service role niet kan omzeilen — en bewezen met
tests.

## Status van de integraties

| Onderdeel | Status |
|---|---|
| iRail API | **LIVE** |
| Supabase (Postgres, Auth, Storage) | **CONFIGURATION REQUIRED** |
| Veldencryptie (IBAN, MoBIB) | **CONFIGURATION REQUIRED** |
| Stripe (Pendel Pro, pay-per-claim, Bancontact) | **CONFIGURATION REQUIRED** |
| Resend (e-mail) | **CONFIGURATION REQUIRED** |
| Sentry | **CONFIGURATION REQUIRED** |
| Automatische indiening bij NMBS | **NOT AVAILABLE** — kanaal bestaat niet |

Details en instructies: [INTEGRATIONS.md](INTEGRATIONS.md).

## Aan de slag

```bash
npm install
cp .env.example .env.local     # vul de REQUIRED-waarden in
npm run dev
```

De app weigert te starten met een onvolledige omgeving — dat is opzet: een
half-geconfigureerde claimpijplijn is gevaarlijker dan een gestopte.

### Database

```bash
# migraties in supabase/migrations/ toepassen op je project, daarna:
npm run db:seed        # de geverifieerde NMBS-regels laden (verplicht)
```

Zonder seed weigert de detectie-engine elke rit te beoordelen, in plaats van
terug te vallen op aangenomen drempels.

### Verificatie

```bash
npm run verify         # typecheck + lint + test + build
```

| Commando | Wat het doet |
|---|---|
| `npm run dev` | Webapp op http://localhost:3000 |
| `npm run worker` | Detectie-worker (aparte service, zie ADR 0002) |
| `npm run test` | Unit- en integratietests (Postgres in-process via PGlite) |
| `npm run test:e2e` | Playwright end-to-end |
| `npm run typecheck` | `next typegen && tsc --noEmit` |

De integratietests draaien een **echte Postgres** in-process en passen de
migraties toe, zodat RLS en de claim-constraints werkelijk uitgevoerd worden.
Er is geen Docker nodig.

## Architectuur

Twee processen uit één codebase:

- **Webapp** — Next.js 16 (App Router), NL/FR via next-intl, donker thema,
  mobile-first PWA.
- **Worker** — always-on Node-proces dat iRail pollt en claims aanmaakt.
  Waarom geen Edge Functions: [ADR 0002](docs/decisions/0002-worker-architectuur.md).

Gedeelde domeinlogica in `src/lib/` — de compensatieberekening bestaat op
precies één plaats en wordt door beide processen gebruikt.

### Waar de regels vandaan komen

Geen enkele drempel, percentage of termijn staat in de code. Alles komt uit de
tabel `compensation_rules`, waar elke regel zijn **bron-URL en verificatiedatum**
draagt. De herkomst is uitgeschreven in [docs/nmbs-regels.md](docs/nmbs-regels.md).
Regels ouder dan zes maanden worden in de admin als `STALE` gemarkeerd.

## Documentatie

| Document | Inhoud |
|---|---|
| [docs/nmbs-regels.md](docs/nmbs-regels.md) | Geverifieerde compensatievoorwaarden, met bronnen en citaten |
| [docs/irail.md](docs/irail.md) | iRail-API, valstrikken, pollingstrategie, fair use |
| [docs/decisions/](docs/decisions/) | ADR's |
| [PROGRESS.md](PROGRESS.md) | Voortgang per fase |
| [INTEGRATIONS.md](INTEGRATIONS.md) | Wat werkt, wat credentials nodig heeft |

## Privacy

Bewaard wordt alleen wat NMBS voor een uitbetaling vraagt: naam, IBAN en
MoBIB-/abonnementsnummer. IBAN en MoBIB-nummer staan versleuteld (AES-256-GCM,
gebonden aan de gebruiker), worden gemaskeerd getoond en zijn uit alle logs
geredigeerd.

**Geen rijksregisternummer.** Het fase 0-onderzoek toont dat geen enkele
officiële NMBS-bron erom vraagt, dus wordt het niet verwerkt: er is geen kolom
en geen invoerveld.

## Attributie

Vertragingsgegevens via de open [iRail API](https://api.irail.be) (iRail vzw /
Open Knowledge Belgium), op basis van NMBS-open data.
