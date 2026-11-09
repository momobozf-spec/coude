# ADR 0001 — Parking Guard wordt een nieuw, zelfstandig project

Datum: 2026-08-29
Status: aanvaard

## Context

De opdracht zegt: bouw module 3 (bewonerskaart) voort op pijler 1 en 2 als die
bestaan; scaffold een fundering als de repo leeg is. De werkelijkheid ligt
ertussenin.

De geopende repository is een werkruimte met ~30 losstaande projecten naast
elkaar in de root. Er is geen Parking Guard-project. Wat er is:

- `parking-brussel-helper/` — vier bestanden, statische HTML + `localStorage`,
  geen build, geen server, geen database. Het genereert bezwaartekst die de
  gebruiker daarna zélf in het officiële portaal plakt. De README zegt dat ook.
- `immoradar-belgium/`, `fsbo-lead-radar/`, `woningalert/` — volwassen Next.js +
  Prisma-applicaties, maar met een compleet ander domein. Geen gedeelde code, geen
  workspace, geen pakket om te importeren.

## Beslissing

Een nieuw, zelfstandig project in `parking-guard/`, volgens hetzelfde patroon als
de buurprojecten. Module 3 (bewonerskaart) is de eerste module. Er wordt niets
aan bestaande projecten gewijzigd.

Twee dingen volgen daaruit.

**De mappenstructuur reserveert pijler 1 en 2 vanaf dag één.** `src/domain/`
krijgt naast `residentcard/` ook `alerts/` en `appeals/`, met een README die
zegt wat er hoort te komen. Niet leeg gelaten en later ontdekt, maar benoemd, zodat
de volgende module landt zonder verbouwing.

**Gedeelde lagen worden module-onafhankelijk gebouwd.** Auth, betalingen,
entitlements, storage, mail en jobs weten niet dat ze voor bewonerskaarten
gebruikt worden. Een `Dossier` is bewonerskaart-specifiek; een `Payment` en een
`Entitlement` zijn dat niet. Dat is het verschil tussen module 2 later toevoegen
en module 2 later inbouwen.

**De huisconventie is de stack.** Next.js 16 App Router, TypeScript strict +
`noUncheckedIndexedAccess`, Tailwind 4, Prisma 6 met echte migrations,
`embedded-postgres` voor lokale ontwikkeling, Vitest, ESLint 9 flat config,
Zod-gevalideerde env, Nederlandstalig commentaar dat *waarom* uitlegt.
`npm run verify` (validate → typecheck → lint → test → build) is de gate.

## Wat we uit `parking-brussel-helper` overnemen

Domeinkennis, niet code:

- Brusselse parkeerzones met retributiebedragen
- Een documentchecklist voor kentekenwijziging (identiteitskaart recto-verso,
  inschrijvingsbewijs recto-verso, leasing-/huurcontract, attest enige gebruiker,
  garageattest bij vervangvoertuig)
- Officiële Parking.brussels-routes

Dit is een startpunt voor het onderzoek, **geen bron**. Het prototype citeert
geen bronnen, dus elk overgenomen feit wordt alsnog tegen een officiële pagina
gelegd voordat het `VERIFIED` mag heten. Zie ADR 0005 en `docs/gemeenten.md`.

## Gevolgen

- Geen risico op regressie in bestaande projecten.
- Wel duplicatie van infrastructuurcode met de buurprojecten (env, logger, db).
  Dat is de prijs van de bestaande werkruimte-opzet en geen reden om er nu een
  monorepo van te maken — dat zou alle andere projecten raken.
- `parking-brussel-helper` blijft ongewijzigd staan. Het kan later vervangen
  worden door pijler 2, maar dat is een andere opdracht.
