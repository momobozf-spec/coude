# ADR 0003 — Encryptie van IBAN en MoBIB-nummer

- **Status:** aanvaard
- **Datum:** 2026-08-29

## Context

RailClaim bewaart twee gevoelige velden: **IBAN** (nodig voor uitbetaling per overschrijving, en
volgens `docs/nmbs-regels.md` §6 uitsluitend zinvol bij vertragingen ≥ 60 min) en het
**MoBIB-kaartnummer / abonnementsnummer** (verplicht in elke aanvraag van een abonnee, en de enige
identificatie bij de regeling herhaaldelijke vertragingen).

Eis uit de opdracht: encrypted at rest, gemaskeerd in de UI behalve bij bewuste onthulling, nooit in
logs.

## Beslissing

**Authenticated envelope encryption in de applicatielaag met AES-256-GCM**, niet in de database.

- Sleutel: `ENCRYPTION_KEY`, 32 bytes base64, uit de omgeving. De app weigert te starten met een
  ontbrekende of verkeerd gevormde sleutel (`src/lib/env.ts`).
- Per waarde een willekeurige 96-bits IV; opgeslagen als
  `v1:<base64(iv)>:<base64(ciphertext)>:<base64(authTag)>`. Het `v1`-prefix maakt sleutelrotatie
  en algoritmewissel mogelijk zonder de kolom te moeten raden.
- **AAD (additional authenticated data)** = `user_id` + veldnaam. Daardoor kan een versleutelde IBAN
  niet van de ene gebruiker naar de andere gekopieerd worden in de database zonder dat de decryptie
  faalt.
- Kolommen heten `*_encrypted` en zijn `text`. Er bestaat **geen** onversleutelde variant.

### Waarom niet pgcrypto / Supabase Vault in de database

- Bij `pgcrypto` staat de sleutel in de databaseconnectie of in de query — die belandt in
  querylogs en in `pg_stat_statements`. Precies wat wij willen vermijden.
- Supabase Vault is uitstekend voor **secrets van de applicatie**, maar is niet bedoeld als
  per-rij-kolomencryptie voor gebruikersdata op schaal.
- Encryptie in de applicatielaag betekent dat een databasedump — via een lek, een backup, of een
  te ruime RLS-policy — **geen** leesbare IBANs bevat. De sleutel zit in een ander systeem
  (de omgevingsconfiguratie van de app).

## Maskering

Ontsleutelen gebeurt uitsluitend server-side. De API geeft standaard alleen een gemaskeerde vorm
terug, berekend na decryptie:

- IBAN → `BE** **** **** 4321` (alleen de laatste 4 cijfers)
- MoBIB → `•••• •••• •••• 7890` (alleen de laatste 4 cijfers)

De volledige waarde verlaat de server alleen:

1. via een expliciete "toon"-actie van de ingelogde eigenaar zelf, die als event gelogd wordt;
2. in het gegenereerde claimdossier (PDF / begeleide indiening), waar de waarde functioneel nodig is;
3. in de GDPR-data-export van de gebruiker zelf.

De React-componenten krijgen nooit de klare waarde in props of in de serialisatie van een server
component, tenzij in geval 1 of 2.

## Logging

`src/lib/logger.ts` heeft een **redactielijst** die `iban`, `mobib`, `mobib_number`,
`*_encrypted`, `authorization` en `cookie` vervangt door `[REDACTED]`, ook geneste velden. Sentry
krijgt dezelfde `beforeSend`-scrubbing. Er is een unit test die een logregel met een IBAN doorheen
de logger stuurt en verifieert dat het nummer niet in de output voorkomt.

## Gevolgen

- **Zoeken op IBAN is onmogelijk** (elke rij heeft een eigen IV). Dat is aanvaardbaar: er is geen
  functionele reden om op IBAN te zoeken. Voor het MoBIB-nummer geldt hetzelfde.
- **Sleutelverlies = dataverlies** voor deze velden. Daarom staat sleutelbeheer en -rotatie
  expliciet in `LAUNCH_CHECKLIST.md`, en draagt het formaat een versieprefix zodat een
  rotatiescript beide versies kan lezen tijdens de overgang.
- **Geen rijksregisternummer.** `docs/nmbs-regels.md` §7 toont dat geen enkele officiële bron dit
  vraagt. Er is dus geen kolom, geen veld en geen verwerking. Zie `docs/privacy.md`.
