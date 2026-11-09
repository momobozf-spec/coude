# Bronnen en beperkingen (onderzocht 23-10-2026)

## TED — Search API v3 (automatisch)
**Bevestigd** (officiële docs + werkende voorbeelden):
- `POST https://api.ted.europa.eu/v3/notices/search`, anoniem, geen API-sleutel. Niet beschikbaar in de preview-omgeving.
- Body: `query` (expertsyntaxis), `fields`, `page`, `limit`, `scope`, `checkQuerySyntax`, `paginationMode` (`PAGE_NUMBER` | `ITERATION`), `iterationNextToken`, `onlyLatestVersions`.
- Max 250 resultaten per pagina; PAGE_NUMBER-modus max 15.000 resultaten; ITERATION zonder totaallimiet; ~10.000 veldcellen per pagina.
- Fair use: 700 HTTP-verzoeken/minuut; 600 notice-downloads per IP per 6 min.
- Antwoord: `notices[]`, `totalNoticeCount`, `iterationNextToken`, `timedOut`; meertalige velden als taalobject, meerwaardige velden als array, `links` per formaat/taal.
- Directe links: `https://ted.europa.eu/{taal}/notice/-/detail/{publicatienummer}`, `/xml`, `/pdf`.

**Implementatie:** land opdrachtgever `BEL`, publicatieperiode, CPV `72*`/`48*` OF gecontroleerde NL/FR/EN-termen in aparte `FT~()`-clausules, `SORT BY publication-number`, `scope=ALL` (dus ook wijzigingen, gunningen, intrekkingen), ITERATION-modus, retries met backoff + `Retry-After`, `timedOut` = fout, incrementeel vanaf cursor met 1 dag overlap, deduplicatie op publicatienummer + inhoudshash, ruwe payload + ophaaltijd bewaard. Publicaties met hetzelfde `procedure-identifier` vormen één procedure (nieuwe publicatie ≠ nieuwe kans).

**Veldverificatie, wijzigingen, intrekkingen, percelen en deadlines:** zie [VALIDATIE.md](VALIDATIE.md) §1 (gecontroleerd tegen de officiële veldenlijst, OpenAPI-spec en eForms-codelijsten; nog niet live).

**Niet uitgevoerd in de bouwomgeving:** `api.ted.europa.eu` werd geblokkeerd door de netwerk-allowlist. Client, mapping en importer zijn getest met testfixtures volgens het officiële antwoordschema (herkenbaar als TESTFIXTURE), niet met live antwoorden.

## Belgische e-Procurement (publicprocurement.be / BOSA) — handmatig
- **Geen gedocumenteerde en toegestane publieke API of export gevonden.** publicprocurement.be is een JavaScript-applicatie; de BOSA-pagina weigert geautomatiseerde ophaling (robots); economie.fgov.be toonde een anti-botcontrole. Er zijn onofficiële scrapers van derden — bewust niet gebruikt.
- Daarom: handmatige invoer van bronlink, gegevens en rechtmatig beschikbare documenten (upload of ophalen via openbare URL). Geen omzeiling van aanmelding, CAPTCHA of toegangsbeperking.
- **Open vraag aan BOSA:** bestaat er een hergebruiksovereenkomst/export voor e-Notification-publicaties? Bij bevestiging is het datamodel (bron, publicaties, wijzigingen) al voorbereid.

## Dekking — wat we NIET claimen
TED bevat Europese publicaties (boven drempels + vrijwillig). Opdrachten die enkel nationaal gepubliceerd worden, zitten er niet in; die komen alleen binnen via handmatige invoer. Het portaal en de landingpage tonen dit per bron, met laatste geslaagde verwerking.

## Steekproef laatste 90 dagen
**Niet uitgevoerd — geen aantallen gerapporteerd.** Live controle zonder database: `node scripts/ted-live-check.mjs`. Vereist live toegang tot `api.ted.europa.eu`. Uitvoeren met `npm run ted:sample`: het rapport telt unieke potentieel relevante procedures en percelen uit de werkelijk geïmporteerde gegevens, met query en beperkingen; zonder geslaagde import weigert het bewust aantallen te geven.

## Echte bronnen in de E2E-demo
Zorgband Leie & Schelde (België, Fabric/Power BI, afgesloten) — zie VALIDATIE.md §2. TED-aankondiging 40211-2026 (wijzigingsbericht bij 838975-2025, Fusion for Energy, Barcelona) — handmatig overgenomen uit de openbare pdf, status “niet gecontroleerd”. TED-gegevens © Europese Unie, hergebruik volgens Besluit 2011/833/EU.
