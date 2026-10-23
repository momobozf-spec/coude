# TenderKompas IT — implementatieplan pilot (v0.1)

## Vastgestelde omgeving (23-10-2026)
- Leeg project. Node 22, PostgreSQL 16 lokaal.
- Netwerk-allowlist van de bouwomgeving blokkeert `api.ted.europa.eu`, `ted.europa.eu`, `data.europa.eu`, `publicprocurement.be` en `binaries.prisma.sh`.
  - Gevolg 1: TED-import is volledig gebouwd en getest met gecontroleerde testresponses, maar **niet live uitgevoerd** in deze omgeving.
  - Gevolg 2: Prisma kan zijn native schema-engine niet downloaden → **Drizzle ORM** i.p.v. Prisma (pure TS, SQL-migraties).

## Stack (versies gecontroleerd op npm, 23-10-2026)
Next.js 16.4.2 (App Router, `cacheComponents` uit: alle pagina's zijn geauthenticeerd en dynamisch) · React 19.3 · TypeScript 5 · Tailwind 4 · Zod 4.6 · Drizzle ORM 0.45.4 + drizzle-kit 0.31 · PostgreSQL 16 · better-auth 1.7 (e-mail + wachtwoord) · @anthropic-ai/sdk 1.1 · unpdf 1.9 (PDF-tekst) · nodemailer 10 (SMTP, optioneel) · Vitest 5.

## Aannames
1. Eén beheerder (platformrol `admin`), 3–10 klantorganisaties met elk één profiel.
2. Accounts worden door de beheerder aangemaakt (geen open registratie). Het aanvraagformulier maakt alleen een lead aan.
3. Facturatie gebeurt buiten de app; abonnementstatus wordt handmatig bijgehouden.
4. TED-veldnamen die niet in de officiële documentatie bevestigd konden worden, staan centraal in één configuratiebestand en worden bij de eerste live run gevalideerd (`npm run ted:verify-fields`).
5. Belgische e-Procurement: geen gedocumenteerde publieke API gevonden → handmatige invoer van bronlink, gegevens en documenten.
6. AI is optioneel: zonder `ANTHROPIC_API_KEY` blijft volledige handmatige analyse mogelijk.
7. Geen e-mailprovider ingesteld → preview/export; verzendstatus “niet ingesteld”.

## Kernontwerp
- **Gedeelde publieke laag**: procedures → aankondigingen (versies) → percelen → feiten/voorwaarden met bronbewijs → documenten → extractieruns (één keer per document, hergebruikt voor alle klanten).
- **Klantlaag** (strikt per organisatie): profiel, beoordelingen (geversioneerd), reviewbesluiten, gevolgde kansen, feedback, digests, verzendregistraties.
- **Beoordeling** = deterministische engine (pure functies, getest): A relevantie, B voorwaarden (onbekend blijft onbekend), C haalbaarheid → eindadvies. Harde blokkade wint altijd.
- **Workflow**: concept → te controleren → goedgekeurd → gepubliceerd. Bronwijziging = vingerafdruk wijzigt → goedkeuring vervalt, nieuwe versie ter controle, gepubliceerde versie krijgt banner “wijziging wordt gecontroleerd”.
- **Idempotentie**: import (unieke publicatienummers + content hash), verzending (unieke sleutel digest+ontvanger).

## Volgorde
1. Schema + migraties + auth + toegangslaag
2. Handmatige keten volledig (profiel → invoer → beoordeling → review → portaal → digest → feedback)
3. TED-import + 90-dagen-steekproefscript
4. AI-extractie met bewijscontrole, PDF-upload, SSRF-veilige URL-ophaling
5. Tests van de 10 acceptatierisico's + end-to-end demo
6. Afwerking en documentatie
