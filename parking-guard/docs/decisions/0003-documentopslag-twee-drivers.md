# ADR 0003 — Documentopslag: S3-driver voor productie, encrypted lokale driver voor ontwikkeling

Datum: 2026-08-29
Status: aanvaard

## Context

Dit product slaat identiteitskaarten en kentekenbewijzen op. De brief is
duidelijk: S3-compatibel (Cloudflare R2 of Scaleway, EU-regio), server-side
encryptie, nooit documenten in de database of in git.

Zonder credentials voor zo'n bucket is de hele upload-pijplijn onbewijsbaar. En
juist bij deze pijplijn is "we hebben het niet kunnen testen" het slechtste
antwoord: de retentie-job moet aantoonbaar verwijderen, de signed URLs moeten
aantoonbaar verlopen, en de access-logging moet aantoonbaar elk documentbezoek
vastleggen.

## Beslissing

Eén `DocumentStore`-interface, twee echte implementaties:

```
src/server/storage/
  types.ts          put / get / signedUrl / delete / exists
  s3-store.ts       AWS SDK v3 — werkt tegen R2, Scaleway, elke S3-API
  local-store.ts    .storage/ op schijf, AES-256-GCM at rest
  index.ts          kiest op basis van STORAGE_DRIVER
```

`S3DocumentStore` is de productiedriver: server-side encryptie aan,
presigned URLs met korte TTL, EU-regio via env. Staat als
`CONFIGURATION REQUIRED` in `INTEGRATIONS.md` tot de bucket en de keys er zijn.

`LocalDocumentStore` schrijft naar `.storage/` met AES-256-GCM per bestand, sleutel
uit `STORAGE_ENCRYPTION_KEY`. Dit is **geen mock**: het is een tweede volledige
implementatie van dezelfde interface, inclusief encryptie, inclusief TTL op de
signed URLs (HMAC-ondertekende token met vervaltijd via een eigen route),
inclusief echte verwijdering. Alles wat de S3-driver belooft, doet deze driver
ook — alleen op een andere ondergrond.

Daardoor zijn de upload-, retentie-, en verwijderflows end-to-end te testen
zonder credentials, en test je de *pijplijn* in plaats van een nabootsing ervan.

## Randvoorwaarden die voor beide drivers gelden

Deze zitten in de laag erboven, niet in de drivers, zodat geen enkele driver ze
kan overslaan:

- Documenttoegang loopt altijd via een route die eerst autoriseert en dan een
  `DocumentAccessLog`-record schrijft — gebruiker, dossier, document, tijdstip,
  IP. Ook voor admins. Vooral voor admins.
- Signed URLs hebben een korte TTL (default 5 minuten) en zijn niet raadbaar.
- De opslagsleutel bevat geen persoonsgegevens; hij is een UUID plus een
  extensie. Geen `jan-janssens-identiteitskaart.jpg` in een bucketlisting.
- Er wordt nooit documentinhoud gelogd, en `storageKey` telt als
  persoonsgegeven-adjacent: hij mag in de applicatielog, niet in een externe
  errortracker-payload.

## Gevolgen

- `.storage/` staat in `.gitignore`. Dat is een vangnet, geen maatregel: de
  echte maatregel is dat er geen codepad is dat een document ergens anders
  neerzet.
- CI draait op de lokale driver. Dat betekent dat de S3-driver niet door CI
  gedekt wordt; die krijgt een integratietest die alleen draait als de
  credentials aanwezig zijn, en staat tot die tijd eerlijk als onbewezen in
  `INTEGRATIONS.md`.
- `STORAGE_ENCRYPTION_KEY` is verplicht in elke omgeving, ook lokaal. Zonder
  sleutel start de applicatie niet — anders is "even snel zonder encryptie
  lokaal" een gewoonte die naar productie lekt.
