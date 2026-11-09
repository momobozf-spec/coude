# Een nieuwe bron toevoegen

Twee delen. Het eerste gaat over of het mág; het tweede over hoe je het bouwt.
Sla het eerste niet over — het bepaalt welk soort collector je überhaupt schrijft.

---

## Deel 1 — Mag het?

### De vier vragen

Beantwoord ze in deze volgorde. Bij één "nee" stopt het.

**1. Wat zegt `robots.txt`?**

```bash
curl -s https://bron.be/robots.txt
```

Let op de paden die je nodig hebt, niet alleen op `/`. Veel vastgoedsites staan
de detailpagina's toe maar verbieden juist de zoek-URL's met filterparameters —
precies wat een naïeve scraper zou gebruiken. Dat is geen obstakel om omheen te
werken; het duwt je naar de nette route (sitemap of feed).

Kan je `robots.txt` niet ophalen? Dan is dat het antwoord. Een host die
geautomatiseerde requests weigert voor zijn robots.txt, weigert ze ook voor de
rest.

**2. Wat zeggen de gebruiksvoorwaarden?**

`robots.txt` zegt wat een crawler technisch mag ophalen. Het zegt niets over wat
je met die gegevens mag doen. Zoek naar bepalingen over geautomatiseerde
toegang, hergebruik van data, en doorgifte aan derden.

**3. Mag je deze gegevens doorsturen naar makelaars?**

Dit is de vraag die deze dienst bijzonder maakt en die software niet voor je kan
beantwoorden. Je verzamelt contactgegevens van particulieren die daar niet om
gevraagd hebben, en stuurt ze naar commerciële partijen die hen gaan bellen.
Weeg minstens: grondslag, informatieplicht, bewaartermijn, en het recht op
verzet.

**4. Is er een officiële weg?**

Vraag het. Een partnerprogramma, een API-sleutel of een datalicentie is stabieler
dan elke scraper, en het maakt vragen 2 en 3 in één keer duidelijk.

### Als het antwoord "ja" is

Zet de host in `FEED_COLLECTOR_HOSTS`
([`src/collectors/reference/jsonLdFeedCollector.ts`](../src/collectors/reference/jsonLdFeedCollector.ts))
of schrijf een eigen collector. Vul `accessNotes` met de grond waarop het mag —
dat veld staat in het dashboard en is er voor de volgende persoon die zich
afvraagt waarom deze bron aanstaat.

### Als het antwoord "nee" is

Bouw een fixture-collector met een lokale momentopname, en noteer in
`accessNotes` wat er nodig zou zijn. Dat is geen nederlaag: de pijplijn is
volledig testbaar op fixtures, en zodra de officiële weg er is hoef je alleen de
`collect()` te vervangen.

**Wat je nooit doet:** CAPTCHA's oplossen of omzeilen, loginwalls omzeilen, IP's
of fingerprints roteren om detectie te ontlopen, robots.txt negeren, of 403's
behandelen als iets om omheen te werken. De `HttpClient` maakt dit ook lastig:
alles loopt door de robots-controle en een 403 gooit een `AccessBlockedError` die
niet geretried wordt.

---

## Deel 2 — Hoe bouw je hem?

### Kies de nettigste route die werkt

In deze volgorde. Elke stap omlaag is fragieler en zwaarder.

| | route | `accessMethod` | wanneer |
|---|---|---|---|
| 1 | officiële API | `OFFICIAL_API` | altijd als die er is |
| 2 | publieke feed (RSS, sitemap) | `PUBLIC_FEED` | de bron publiceert zelf wat er nieuw is |
| 3 | JSON-LD / schema.org | `STRUCTURED_DATA` | de site levert machineleesbare data mee |
| 4 | publieke HTML | `PUBLIC_HTML` | laatste redmiddel; breekt bij elke redesign |

Kies je 4, dan hoor je te kunnen uitleggen waarom 1–3 niet konden. Zet dat in
`accessNotes`.

### Het bestand

Maak `src/collectors/<naam>/<naam>Collector.ts`:

```ts
import type { CollectorContext, CollectorDefinition, CollectorResult } from '../types'

export const MIJN_BRON_KEY = 'mijn-bron'

export const mijnBronCollector: CollectorDefinition = {
  key: MIJN_BRON_KEY,
  name: 'Mijn Bron (publieke feed)',
  accessMethod: 'PUBLIC_FEED',
  baseUrl: 'https://mijnbron.be',
  defaultPollIntervalSeconds: 300,
  defaultRateLimitPerMinute: 10,
  accessNotes:
    'Leest de publieke feed op /feed.xml, expliciet toegestaan in robots.txt en ' +
    'in de API-voorwaarden van 2026-08. Contactpersoon: …',
  requiresBrowser: false,

  async collect(context: CollectorContext): Promise<CollectorResult> {
    const warnings: string[] = []
    const now = new Date()

    // context.http regelt robots.txt, rate limiting, timeouts en retries.
    // Gebruik nooit rechtstreeks `fetch` — dan omzeil je dat allemaal.
    const response = await context.http.get('https://mijnbron.be/feed.xml', {
      signal: context.signal,
    })

    const listings = parseFeed(response.body)
      .slice(0, context.maxItems)
      .map((item) => ({
        source: MIJN_BRON_KEY,
        sourceListingId: item.id,
        url: item.link,
        title: item.title,
        description: item.summary,
        price: item.price,
        postalCode: item.zip,
        sellerName: item.author,
        scrapedAt: now,
        raw: item,
      }))

    return { listings, warnings }
  },
}
```

### Registreer hem

Eén regel in [`src/collectors/registry.ts`](../src/collectors/registry.ts):

```ts
const COLLECTORS: readonly CollectorDefinition[] = [
  fixtureCollector,
  demoMarketCollector,
  jsonLdFeedCollector,
  mijnBronCollector,   // ← hier
]
```

Meer is er niet. De rest van het systeem kent geen enkele collector bij naam.

### Zet hem aan

Twee schakelaars, allebei nodig:

```bash
# .env — de knop van wie de omgeving deployt
COLLECTOR_ENABLED_SOURCES="fixture-be,demo-be,mijn-bron"
```

En daarna het vinkje op **/admin/sources** — de knop van wie de dienst bedient.
Zo kan een bron niet per ongeluk aangaan in productie doordat iemand in een
dashboard klikte, en niet stilletjes aanstaan doordat een seed hem aanzette.

De bronrij wordt automatisch aangemaakt bij de eerstvolgende
`npm run worker` of `npm run collect`.

---

## Wat je collector wél en niet doet

**Wel:** advertenties ophalen en als `RawListing` teruggeven, zo dicht mogelijk
bij wat de bron zei.

**Niet:** normaliseren, classificeren, dedupliceren, scoren, met de database
praten, of beslissen of iets een lead is. Die stappen zijn gedeeld en gelden
voor elke bron. Zou een collector ze zelf doen, dan zou elke nieuwe bron ze
opnieuw — en net iets anders — implementeren.

Laat velden die je niet begrijpt gewoon weg. `undefined` is een prima antwoord;
de normalisatie vult aan wat ze uit de tekst kan afleiden (postcode uit het
adres, slaapkamers en oppervlakte uit de beschrijving, telefoonnummer uit de
advertentietekst).

Zet de ruwe payload in `raw`. Die wordt bewaard tot
`RETENTION_RAW_PAYLOAD_DAYS` en dient uitsluitend om een parsingfout na te
kunnen kijken.

---

## Testen zonder de bron aan te raken

Verplicht: **geen enkele unit test mag een externe site benaderen.** Zet een
momentopname in `fixtures/` en test je parser erop.

```ts
// tests/collectors.test.ts
it('leest de feed van mijn-bron', async () => {
  const xml = await readFile(path.join(process.cwd(), 'fixtures', 'mijn-bron-feed.xml'), 'utf8')
  const listings = parseFeed(xml)

  expect(listings).toHaveLength(3)
  // Belangrijker dan de aantallen: de uitvoer moet door de pijplijn kunnen.
  for (const listing of listings) {
    expect(() => normalizeListing(listing)).not.toThrow()
  }
})
```

Die laatste lus is de test die ertoe doet. Een collector die keurig parseert maar
advertenties oplevert die de normalisatie afkeurt, levert stilletjes niets op.

Splits je collector zo dat het parsen een losse, exporteerbare functie is. Dan is
`collect()` alleen nog het ophalen, en dat hoef je niet te testen — de
`HttpClient` is al getest.

---

## Wanneer mag Playwright?

Alleen als je alle drie kunt beantwoorden met ja:

1. De inhoud staat aantoonbaar niet in de HTML, niet in een JSON-LD-blok en niet
   in een XHR-respons die je rechtstreeks mag ophalen.
2. De bron staat geautomatiseerde toegang toe — een browser gebruiken om
   botdetectie te omzeilen is precies wat hier niet gebeurt.
3. De waarde weegt op tegen de kosten: honderden megabytes, seconden per run, en
   een browser die je in productie moet onderhouden.

Zo ja: zet `requiresBrowser: true` op je definitie. Dat veld bestaat zodat de
runtime alleen een browser start als minstens één actieve bron erom vraagt, en
zodat het dashboard het toont. Voeg Playwright dan pas toe aan
`package.json` — in de MVP staat het er bewust niet in.

---

## Checklist

- [ ] `robots.txt` gelezen, voor de paden die je echt gebruikt
- [ ] Gebruiksvoorwaarden gelezen
- [ ] Doorgifte aan makelaars afgewogen
- [ ] Officiële weg geprobeerd
- [ ] Nettigste haalbare route gekozen, en `accessMethod` klopt
- [ ] `accessNotes` legt uit waarom dit mag
- [ ] Collector gebruikt `context.http`, nooit `fetch`
- [ ] Parser is een losse functie
- [ ] Fixture in `fixtures/`, test draait offline
- [ ] Test controleert dat de uitvoer `normalizeListing()` doorstaat
- [ ] Geregistreerd in `registry.ts`
- [ ] `COLLECTOR_ENABLED_SOURCES` aangevuld
- [ ] `npm run verify` slaagt
