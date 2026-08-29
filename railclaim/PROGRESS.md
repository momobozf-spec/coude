# Voortgang

Bijgewerkt: 2026-08-29

## Status per fase

| Fase | Status |
|---|---|
| 0 — Onderzoek & fundament | **Afgerond** |
| 1 — Accounts & trajecten | Nog te doen |
| 2 — Detectie-engine | Nog te doen |
| 3 — Claimflow | Nog te doen |
| 4 — Betalingen, privacy & launch | Nog te doen |

## Verificatiegate (laatste run: groen)

```
typecheck   next typegen && tsc --noEmit     schoon
lint        eslint .                          schoon
test        vitest run                        114 tests, 6 bestanden
build       next build                        succesvol (NL + FR statisch)
```

---

## Fase 0 — afgerond

### Onderzoek

- **`docs/nmbs-regels.md`** — alle compensatievoorwaarden geverifieerd tegen
  belgiantrain.be (NL + FR) op 2026-08-29, met bron-URL en citaat per regel.
  Kernpunten: 60 min → 100 %, termijn 3 maanden; 10 × 30 min op hetzelfde
  traject binnen 6 maanden → 50 %, in te dienen tussen 6 en 9 maanden na de
  eerste vertraging. Inclusief de deeltabel (1/2/40/120/480), de afrondingsregel
  en alle uitsluitingen.
- **`docs/irail.md`** — API geverifieerd tegen de live endpoints. Reële
  responses opgeslagen als fixtures. Pollingstrategie vastgelegd op
  **2 requests per rit per dag**, ruim binnen de fair-use policy.

### Beslissingen (ADR's)

- **0001 — Indieningskanaal.** NMBS heeft geen API en geen e-mailkanaal.
  Wij bouwen begeleide indiening; wij dienen niet in namens de gebruiker en
  vragen nooit My NMBS-credentials. Kanaal zit achter een interface zodat een
  later officieel kanaal inplugbaar is.
- **0002 — Worker-architectuur.** Aparte always-on Node-worker in dezelfde
  codebase, niet Supabase Edge Functions — wegens gedeelde domeinlogica, één
  gedeelde rate limiter en wachtvensters tot 3 uur.
- **0003 — Encryptie.** AES-256-GCM in de applicatielaag, AAD gebonden aan
  `user_id` + veldnaam. Geen rijksregisternummer: geen enkele officiële bron
  vraagt het.

### Fundament

- Next.js 16 (App Router, Turbopack) + TypeScript + Tailwind 4, donker thema,
  mobile-first. NL/FR via next-intl; `src/proxy.ts` (Next 16 hernoemde
  `middleware` naar `proxy`) doet locale-resolutie én zet CSP en security headers.
- Supabase-schema met **RLS op alle 13 tabellen**, statusmachine-trigger,
  audit trail en `confirm_claim()`-RPC.
- `compensation_rules` geseed als reference data met bron en verificatiedatum.
- CI: install → typecheck → lint → test → build.
- `/api/health` rapporteert welke integraties werkelijk geconfigureerd zijn.

### Bewezen door tests (114)

- De drie **gepubliceerde NMBS-rekenvoorbeelden** reproduceren exact.
- Drempels werken op `>=` en ronden **nooit** omhoog naar een drempel
  (59 min blijft 59).
- iRail `delay` wordt als **seconden** behandeld en negatieve waarden clampen
  op 0 — de duurste denkfout in dit domein, afgedekt.
- **Een claim kan niet in een ingediende status komen zonder
  gebruikersbevestiging** — ook niet via de service role, die RLS omzeilt.
- Toestemming is onveranderlijk zodra gegeven; illegale statusovergangen worden
  geweigerd.
- RLS-isolatie: gebruiker A ziet of wijzigt niets van gebruiker B.
- De marketingteksten bevatten geen enkele belofte van automatisch indienen.

### Gevonden en opgelost tijdens fase 0

- **Trigger-bug:** de `CASE` in `claims_guard()` mengde `text[]` en
  `claim_status[]`, waardoor élke statuswijziging in productie zou falen.
  Gevonden door de migraties echt uit te voeren (PGlite), niet door ze te lezen.
- **Tijdzone-bug:** deadlineberekening met lokale tijd verschoof over een
  zomertijdgrens een dag (15 maart + 3 maanden werd 14 juni). Nu UTC-gebaseerde
  kalenderrekenkunde.
- **Dode RLS-policy:** `admin_users_select_self` kon nooit werken naast de
  `revoke`; verwijderd, `is_admin()` is het pad.

---

## Openstaand / bewust niet geïmplementeerd

Zie `docs/nmbs-regels.md` § Open punten:

1. **Minimumdrempel voor uitbetaling** — NMBS vermeldt er geen; niet geïmplementeerd.
2. **Afgeschafte treinen** — geen expliciete compensatieregel gevonden; wij
   detecteren de afschaffing en meten de werkelijke aankomstvertraging met de
   volgende trein, maar verzinnen geen bedrag.
3. **Exacte trajectprijs** — niet af te leiden uit iRail; gebruiker geeft
   abonnementstype en -prijs op, bedragen worden als **indicatief** gelabeld.
4. **Internationale reizen** — buiten scope.

## Volgende stap (fase 1)

Auth, profiel met encrypted IBAN/MoBIB, mandaat-flow, trajecten-CRUD met
iRail-stationautocomplete, dashboard-skelet.
