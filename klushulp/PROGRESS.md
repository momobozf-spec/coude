# PROGRESS — Klushulp

## Fase 0 — scaffold (1 nov 2026) ✅
Next.js 16 / TypeScript / Drizzle + PostgreSQL / better-auth / Tailwind 4 / Vitest. Stack gelijk aan TenderKompas (nieuwste basis in coude). Exit: typecheck, lint, build groen.

## Fase 1 — datamodel, auth, i18n ✅
23 tabellen, 1 migratie (`drizzle/0000_init.sql`). Rollen customer/provider/admin (server-side gezet). NL/FR-dictionary (380 sleutels), `/nl` en `/fr` via proxy.

## Fase 2 — klantflow ✅
Home → 3-staps wizard zonder account → matching (categorie × werkgebied × beschikbaarheid) → persoonlijke link → voorstellen vergelijken → accepteren → afspraak/status → annuleren/melden → beoordeling. Secundaire route: zoeken + gerichte aanvraag.

## Fase 3 — dienstverlener ✅
Registratie (KBO verplicht), profiel, werkgebied, beschikbaarheid, verificaties met upload, relevante aanvragen (alleen gematcht), voorstel (4 prijssoorten, fee-preview), berichten, opdrachten starten/afronden/annuleren.

## Fase 4 — boeking, admin, betalingsgrens ✅
Eén boeking per aanvraag (DB-constraint + lock). Admin: verificaties, activeren/schorsen, gebruikers, aanvragen, boekingen, meldingen, moderatie, catalogus, platformkosten. Betalingen: `PaymentProvider`-grens, gesimuleerd en zo gemarkeerd.

## Fase 5 — tests en oplevering ✅
- Vitest: 20/20 (unit: geld, beschikbaarheid, geo, suggestie; integratie: de 8 kwaliteitscriteria + extra).
- Browser-e2e (Playwright, 390×844): klant → dienstverlener → acceptatie → afronding → beoordeling; niet-passende dienstverlener krijgt 404; anoniem naar dashboard → login. Screenshots in `demo-output/`.
- `npm run check` (typecheck + lint + test + build) groen.

## Aannames (omkeerbaar)
- Dutch route-slugs ook voor FR (`/fr/aanvraag`); FR-slugs later.
- Klanten zonder account; accounts voor klanten later (koppeling via `customer_user_id` zit al in het model).
- Platformkosten aan dienstverlener, klant betaalt vakman rechtstreeks; `fee_payer`-switch later.
- Gemeentecentroïden benaderend (39 gemeenten regio Antwerpen).
- Aanvragen verlopen na 14 dagen (status wordt nog niet automatisch op `expired` gezet; open aanvragen worden niet meer getoond na `expires_at`). Cron-opschoning later.

## Resterende blokkades voor lancering
1. Stripe Connect implementeren of bewust starten met facturatie achteraf (fee-registratie bestaat al).
2. SMTP instellen (klantlink per mail, notificaties).
3. Juridisch: voorwaarden, privacyverklaring, btw op platformkosten, deeleconomie-erkenning indien particulieren (zie README).
4. Officiële gemeentedataset.
5. Domein + BETTER_AUTH_URL; Render-deploy via `render.yaml`; eerste beheerder via `admin:create`.
6. Vraagvalidatie: eerst 5–10 echte vakbedrijven in Antwerpen en 20 testaanvragen vóór marketinguitgaven (projectregel: geen product zonder bewezen vraag).
