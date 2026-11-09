import { describe, expect, it } from "vitest";
import { RobotsPolicy } from "../src/sources/base/RobotsPolicy.js";
import { buildSearchUrls, externalIdFromUrl, isDetailUrl, withPage } from "../src/sources/immoweb/urls.js";
import { normalizeImmoweb } from "../src/sources/immoweb/normalize.js";
import { extractJsonLd, findByType } from "../src/sources/base/jsonld.js";
import { FixtureSource } from "../src/sources/fixture/fixtureSource.js";
import { SourceRegistry } from "../src/sources/registry.js";
import { propertyListingSchema } from "../src/schemas/property.js";
import { searchCriteriaSchema } from "../src/schemas/searchCriteria.js";
import { RobotsDisallowedError } from "../src/lib/errors.js";
import type { SourceSearchContext } from "../src/sources/types.js";

/**
 * De echte robots.txt van Immoweb, opgehaald tijdens het ontwerp. Hij staat hier
 * letterlijk omdat hij het ontwerp van de adapter bepaalt: de disallow-regels
 * op *maxprice*, *minprice* en *orderBy* zijn de reden dat we pad-gebaseerd
 * zoeken en zelf filteren.
 */
const IMMOWEB_ROBOTS = `Sitemap: https://www.immoweb.be/sitemap.xml

User-agent: *

Disallow: /nl/profiel/
Disallow: (elk pad) /nl/geavanceerd-zoeken/
Disallow: *&orderBy*
Disallow: *orderBy*
Disallow: *searchByRooms*
Disallow: *minprice*
Disallow: *maxprice*
Disallow: *searchId*
Disallow: *countries=*
`.replace("Disallow: (elk pad) /nl/geavanceerd-zoeken/", "Disallow: */nl/geavanceerd-zoeken/*");

function stubFetch(status: number, body: string) {
  return () => Promise.resolve({ status, text: () => Promise.resolve(body) });
}

const silentLogger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

function context(maxResults = 10): SourceSearchContext {
  return { maxResults, signal: new AbortController().signal, logger: silentLogger };
}

describe("RobotsPolicy", () => {
  it("blokkeert de filter-URL's die Immoweb verbiedt", async () => {
    const policy = new RobotsPolicy({
      userAgent: "HuiszoekerBot/0.1",
      fetchImpl: stubFetch(200, IMMOWEB_ROBOTS),
    });

    // Precies de URL's die een naïeve scraper zou bouwen.
    expect(await policy.isAllowed("https://www.immoweb.be/nl/zoekertjes/huis/te-koop?maxprice=450000")).toBe(false);
    expect(await policy.isAllowed("https://www.immoweb.be/nl/zoekertjes/huis/te-koop?minprice=100000")).toBe(false);
    expect(await policy.isAllowed("https://www.immoweb.be/nl/zoekertjes/huis/te-koop?orderBy=newest")).toBe(false);
    expect(await policy.isAllowed("https://www.immoweb.be/nl/geavanceerd-zoeken/huis")).toBe(false);
  });

  it("staat de pad-gebaseerde zoek- en detailpagina's toe", async () => {
    const policy = new RobotsPolicy({
      userAgent: "HuiszoekerBot/0.1",
      fetchImpl: stubFetch(200, IMMOWEB_ROBOTS),
    });

    expect(await policy.isAllowed("https://www.immoweb.be/nl/zoekertjes/huis/te-koop/gent/9000")).toBe(true);
    expect(await policy.isAllowed("https://www.immoweb.be/nl/zoekertje/huis/gent/12345678")).toBe(true);
  });

  it("weigert wanneer robots.txt niet op te halen is", async () => {
    const policy = new RobotsPolicy({
      userAgent: "HuiszoekerBot/0.1",
      fetchImpl: stubFetch(403, ""),
    });
    // Bij twijfel niet doorgaan: een site die zijn regels niet levert heeft ons
    // niet uitgenodigd.
    await expect(policy.assertAllowed("https://www.zimmo.be/nl/gent/te-koop/")).rejects.toBeInstanceOf(
      RobotsDisallowedError,
    );
  });

  it("staat alles toe wanneer er geen robots.txt is", async () => {
    const policy = new RobotsPolicy({
      userAgent: "HuiszoekerBot/0.1",
      fetchImpl: stubFetch(404, ""),
    });
    expect(await policy.isAllowed("https://example.com/wat-dan-ook")).toBe(true);
  });

  it("leest de crawl-delay uit", async () => {
    const policy = new RobotsPolicy({
      userAgent: "HuiszoekerBot/0.1",
      fetchImpl: stubFetch(200, "User-agent: *\nCrawl-delay: 5\n"),
    });
    expect(await policy.crawlDelayMs("https://example.com/pagina")).toBe(5000);
  });
});

describe("Immoweb URL-opbouw", () => {
  it("bouwt uitsluitend pad-gebaseerde URL's zonder verboden parameters", () => {
    const urls = buildSearchUrls(
      searchCriteriaSchema.parse({
        transactionType: "buy",
        locations: ["Gent"],
        hardRequirements: { propertyTypes: ["house"], maxPrice: 450_000, minBedrooms: 3 },
      }),
    );

    expect(urls).toEqual(["https://www.immoweb.be/nl/zoekertjes/huis/te-koop/gent"]);
    // De prijs zit nadrukkelijk NIET in de URL; die filtert onze eigen engine.
    for (const url of urls) {
      expect(url).not.toMatch(/maxprice|minprice|orderBy|searchByRooms|searchId/i);
    }
  });

  it("maakt een URL per plaats en per type", () => {
    const urls = buildSearchUrls(
      searchCriteriaSchema.parse({
        transactionType: "rent",
        locations: ["Gent", "Sint-Martens-Latem"],
        hardRequirements: { propertyTypes: ["apartment"] },
      }),
    );
    expect(urls).toEqual([
      "https://www.immoweb.be/nl/zoekertjes/appartement/te-huur/gent",
      "https://www.immoweb.be/nl/zoekertjes/appartement/te-huur/sint-martens-latem",
    ]);
  });

  it("gebruikt de postcode wanneer er geen plaatsnaam is", () => {
    const urls = buildSearchUrls(
      searchCriteriaSchema.parse({ transactionType: "buy", postalCodes: ["9000"] }),
    );
    expect(urls[0]).toBe("https://www.immoweb.be/nl/zoekertjes/huis-en-appartement/te-koop/9000");
  });

  it("pagineert met de enige toegestane parameter", () => {
    const base = "https://www.immoweb.be/nl/zoekertjes/huis/te-koop/gent";
    expect(withPage(base, 1)).toBe(base);
    expect(withPage(base, 3)).toBe(`${base}?page=3`);
  });

  it("herkent detailpagina's en haalt het advertentie-id eruit", () => {
    expect(isDetailUrl("https://www.immoweb.be/nl/zoekertje/huis/gent/9000/12345678")).toBe(true);
    expect(externalIdFromUrl("https://www.immoweb.be/nl/zoekertje/huis/gent/9000/12345678")).toBe("12345678");
    expect(isDetailUrl("https://www.immoweb.be/nl/zoekertjes/huis/te-koop/gent")).toBe(false);
  });
});

/**
 * JSON-LD zoals schema.org hem voorschrijft. Deze test bewijst dat de
 * normalisatie zonder netwerk werkt en dat elke bron hetzelfde
 * `PropertyListing` oplevert.
 */
const DETAIL_HTML = `<!doctype html><html><head>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SingleFamilyResidence",
  "name": "Vrijstaande woning met tuin",
  "description": "Ruime woning met tuin, garage en zonnepanelen. EPC: B",
  "url": "https://www.immoweb.be/nl/zoekertje/huis/gent/9000/12345678",
  "image": "https://media.example.com/12345678.jpg",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Voorbeeldstraat 12",
    "postalCode": "9000",
    "addressLocality": "Gent",
    "addressRegion": "Oost-Vlaanderen"
  },
  "geo": { "@type": "GeoCoordinates", "latitude": 51.05, "longitude": 3.72 },
  "numberOfBedrooms": 4,
  "numberOfBathroomsTotal": 2,
  "floorSize": { "@type": "QuantitativeValue", "value": 165, "unitCode": "MTK" },
  "lotSize": { "@type": "QuantitativeValue", "value": 420, "unitCode": "MTK" },
  "offers": { "@type": "Offer", "price": 415000, "priceCurrency": "EUR" },
  "datePosted": "2026-07-28T09:00:00.000Z"
}
</script>
</head><body></body></html>`;

describe("Immoweb-normalisatie", () => {
  it("zet JSON-LD om naar een geldig PropertyListing", () => {
    const nodes = extractJsonLd(DETAIL_HTML);
    const normalized = normalizeImmoweb({
      nodes,
      url: "https://www.immoweb.be/nl/zoekertje/huis/gent/9000/12345678",
      externalId: "12345678",
    });

    const parsed = propertyListingSchema.safeParse(normalized);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(parsed.data.source).toBe("immoweb");
    expect(parsed.data.externalId).toBe("12345678");
    expect(parsed.data.title).toBe("Vrijstaande woning met tuin");
    expect(parsed.data.city).toBe("Gent");
    expect(parsed.data.postalCode).toBe("9000");
    expect(parsed.data.price).toBe(415_000);
    expect(parsed.data.bedrooms).toBe(4);
    expect(parsed.data.livingAreaM2).toBe(165);
    expect(parsed.data.landAreaM2).toBe(420);
    expect(parsed.data.propertyType).toBe("house");
    expect(parsed.data.epcLabel).toBe("B");
    expect(parsed.data.features).toEqual(expect.arrayContaining(["garden", "garage", "solar_panels"]));
  });

  it("negeert een prijs in een andere munt in plaats van hem verkeerd op te slaan", () => {
    const html = DETAIL_HTML.replace('"priceCurrency": "EUR"', '"priceCurrency": "USD"');
    const normalized = normalizeImmoweb({
      nodes: extractJsonLd(html),
      url: "https://www.immoweb.be/nl/zoekertje/huis/gent/9000/12345678",
      externalId: "12345678",
    }) as Record<string, unknown>;
    expect(normalized.price).toBeUndefined();
  });

  it("weigert een pagina zonder bruikbare JSON-LD", () => {
    expect(() =>
      normalizeImmoweb({ nodes: [], url: "https://www.immoweb.be/x/1", externalId: "1" }),
    ).toThrow();
  });

  it("verzint geen EPC-label uit een losse hoofdletter in de tekst", () => {
    const html = DETAIL_HTML.replace("EPC: B", "Categorie A ligging");
    const normalized = normalizeImmoweb({
      nodes: extractJsonLd(html),
      url: "https://www.immoweb.be/nl/zoekertje/huis/gent/9000/12345678",
      externalId: "12345678",
    }) as Record<string, unknown>;
    expect(normalized.epcLabel).toBeUndefined();
  });

  it("leest ook JSON-LD uit een @graph", () => {
    const html = `<script type="application/ld+json">
      {"@context":"https://schema.org","@graph":[
        {"@type":"Organization","name":"Immoweb"},
        {"@type":"Apartment","name":"Appartement met terras","offers":{"price":289000,"priceCurrency":"EUR"}}
      ]}
    </script>`;
    const nodes = extractJsonLd(html);
    expect(findByType(nodes, "apartment")).toBeDefined();
    expect(findByType(nodes, "organization")).toBeDefined();
  });
});

describe("FixtureSource", () => {
  it("levert gevalideerde PropertyListings zonder netwerk", async () => {
    const source = new FixtureSource([
      {
        externalId: "fx-1",
        url: "https://example.com/fixture/fx-1",
        title: "Woning met tuin",
        city: "Gent",
        postalCode: "9000",
        propertyType: "house",
        transactionType: "buy",
        price: 400_000,
        bedrooms: 3,
        features: ["garden"],
      },
    ]);

    const listings = await source.search(searchCriteriaSchema.parse({ locations: ["Gent"] }), context());
    expect(listings).toHaveLength(1);
    expect(listings[0]?.source).toBe("fixture");
    expect(listings[0]?.price).toBe(400_000);
  });

  it("slaat een onbruikbare advertentie over in plaats van de hele run te laten falen", async () => {
    const source = new FixtureSource([
      { externalId: "kapot", url: "geen-geldige-url", title: "" },
      {
        externalId: "goed",
        url: "https://example.com/fixture/goed",
        title: "Bruikbare woning",
        transactionType: "buy",
        features: [],
      },
    ]);

    const listings = await source.search(searchCriteriaSchema.parse({}), context());
    expect(listings).toHaveLength(1);
    expect(listings[0]?.externalId).toBe("goed");
  });

  it("respecteert maxResults", async () => {
    const many = Array.from({ length: 20 }, (_v, i) => ({
      externalId: `fx-${i}`,
      url: `https://example.com/fixture/fx-${i}`,
      title: `Woning ${i}`,
      transactionType: "buy",
      features: [],
    }));
    const listings = await new FixtureSource(many).search(searchCriteriaSchema.parse({}), context(5));
    expect(listings).toHaveLength(5);
  });
});

describe("SourceRegistry", () => {
  const fixture = new FixtureSource([]);

  it("levert alleen bronnen die in de configuratie staan", () => {
    const registry = new SourceRegistry([fixture], ["fixture"]);
    expect(registry.resolve(searchCriteriaSchema.parse({})).map((s) => s.name)).toEqual(["fixture"]);

    const disabled = new SourceRegistry([fixture], ["immoweb"]);
    expect(disabled.resolve(searchCriteriaSchema.parse({}))).toEqual([]);
  });

  it("maakt een typefout in de configuratie zichtbaar", () => {
    const registry = new SourceRegistry([fixture], ["fixture", "immowebb"]);
    expect(registry.unknownEnabledNames()).toEqual(["immowebb"]);
  });

  it("slaat een bron over die deze criteria niet ondersteunt", () => {
    const limited = new FixtureSource([]);
    Object.defineProperty(limited, "supports", { value: () => false });
    const registry = new SourceRegistry([limited], ["fixture"]);
    expect(registry.resolve(searchCriteriaSchema.parse({}))).toEqual([]);
  });
});
