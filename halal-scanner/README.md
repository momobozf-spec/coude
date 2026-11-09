# Halal Product Scanner

Mobile-first PWA om producten te scannen, ingrediënten te analyseren en
halal-certificaten te raadplegen.

> **Belangrijk.** Deze applicatie doet geen religieuze uitspraken. Ze maakt
> zichtbaar wát bekend is en wát niet: gecertificeerde informatie,
> ingrediëntenanalyse op basis van expliciete regels, twijfelgevallen, onbekende
> herkomst en community-informatie worden strikt van elkaar gescheiden. Waar de
> data onvoldoende is, zegt de app dat — ze gokt niet.
>
> De meegeleverde seeddataset is een **technische demo**, geen volledige
> halal-referentie.

**Status: Fase 1 afgerond** — architectuur, database, enums, relaties,
`.env.example` en seed. Fase 2 t/m 8 (product lookup, rules engine, scanner-UI,
OCR, certificaten, community, hardening) staan gepland; zie
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Documentatie

| Document | Inhoud |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Stack, lagen, mappenstructuur, datamodelkeuzes |
| [docs/DECISION-TREE.md](docs/DECISION-TREE.md) | Hoe een halal-status tot stand komt; certificaat vs. ingrediënten; wat AI wel en niet mag |

---

## Installatie

Vereist: Node.js ≥ 20 en een PostgreSQL-database.

```bash
cd halal-scanner
npm install
cp .env.example .env      # vul DATABASE_URL in
```

Postgres via Docker:

```bash
docker compose up -d db
```

De `app`-service in `docker-compose.yml` verwijst naar een `Dockerfile` die
samen met de Next.js applicatie in fase 8 volgt; in fase 1 is alleen `db`
bruikbaar.

Database opzetten en vullen:

```bash
npm run db:migrate        # of: npm run db:push
npm run db:seed
```

Controleren zonder database:

```bash
npm run db:validate       # Prisma schema
npm run typecheck         # TypeScript strict
npm test                  # Vitest
```

---

## Environment

Zie [.env.example](.env.example). Alleen variabelen die daadwerkelijk gebruikt
worden staan erin. `src/config/env.ts` valideert ze met Zod bij het opstarten en
scheidt server-secrets van client-safe waarden.

| Variabele | Doel |
|---|---|
| `DATABASE_URL` | PostgreSQL |
| `AI_PROVIDER` | `openai` \| `anthropic` \| `none` — alleen voor normalisatie, OCR en uitleg |
| `STORAGE_PROVIDER` | `local` \| `s3` — uploads (certificaten, OCR-foto's) |
| `MAX_UPLOAD_SIZE_MB` | Uploadlimiet |
| `AUTH_SECRET` | Sessies (auth nog niet uitgewerkt) |

---

## Database

Prisma + PostgreSQL. Het schema staat in
[prisma/schema.prisma](prisma/schema.prisma); de initiële migratie in
`prisma/migrations/20260807000000_init/`.

Die migratie bevat naast de door Prisma gegenereerde DDL vier handgeschreven
CHECK-constraints voor regels die te belangrijk zijn om alleen in
applicatiecode te bewaken:

- een certificaat hoort bij precies één product **of** één merk;
- een stem is `+1` of `-1`;
- een melding moet een doel hebben;
- een certificaat kan niet verlopen vóór het is uitgegeven.

### Seed

`npm run db:seed` is idempotent en vult:

- **4 bronnen** — Open Food Facts, EU-verordening 1333/2008, EFSA, plus de eigen
  interne regelset (expliciet gemarkeerd als `INTERNAL_RULE`);
- **4 certificerende instanties** — JAKIM, BPJPH, Halal Correct, HFA, allemaal
  met `hasImportedRulings: false`;
- **11 E-nummers** — o.a. E120, E422, E441, E471, E472, E904, E920;
- **30 ingrediënten** met 162 aliassen in NL/EN/FR/DE.

Er worden bewust **geen** producten, certificaten of community-content geseed,
en **geen** uitspraken namens certificerende instanties. Zolang
`hasImportedRulings` op `false` staat, mag de app niet suggereren dat een
instantie ergens een oordeel over heeft.

Een echte bron toevoegen: zie de instructies bovenaan
[prisma/seed.ts](prisma/seed.ts).

---

## Scripts

| Script | Doel |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` / `start` | Productiebuild |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest |
| `npm run db:migrate` / `db:push` / `db:seed` / `db:studio` | Prisma |
| `npm run db:format` / `db:validate` | Schema |
