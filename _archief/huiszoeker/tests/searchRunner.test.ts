/**
 * De pijplijn van begin tot eind, met een fixture-bron en in-memory
 * repositories. Geen netwerk, geen database, geen AI.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { SearchRunner } from "../src/services/searchRunner.js";
import { SourceRegistry } from "../src/sources/registry.js";
import { FixtureSource } from "../src/sources/fixture/fixtureSource.js";
import {
  InMemoryPropertyRepository,
  InMemorySearchMatchRepository,
} from "./helpers/inMemoryRepositories.js";
import { searchCriteriaSchema } from "../src/schemas/searchCriteria.js";
import type { SearchRecord } from "../src/types/domain.js";
import type { PropertySource, SourceSearchContext } from "../src/sources/types.js";
import { SourceBlockedError } from "../src/lib/errors.js";
import type { SearchCriteria } from "../src/schemas/searchCriteria.js";

const silentLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- alleen wat de runner gebruikt
} as any;

const MATCHING_LISTING = {
  externalId: "fx-1",
  url: "https://example.com/fixture/fx-1",
  title: "Vrijstaande woning met tuin in Gent",
  description: "Ruime woning met tuin.",
  address: "Voorbeeldstraat 12",
  city: "Gent",
  postalCode: "9000",
  propertyType: "house",
  transactionType: "buy",
  price: 415_000,
  bedrooms: 4,
  livingAreaM2: 165,
  epcLabel: "A",
  features: ["garden"],
};

const TOO_EXPENSIVE = {
  ...MATCHING_LISTING,
  externalId: "fx-2",
  url: "https://example.com/fixture/fx-2",
  title: "Dure villa in Gent",
  price: 895_000,
};

function makeSearch(criteria: SearchCriteria): SearchRecord {
  return {
    id: "search-1",
    userId: "user-1",
    name: "Huis Gent",
    originalQuery: "Huis in Gent onder 450k met tuin",
    criteria,
    criteriaVersion: 1,
    parsedBy: null,
    active: true,
    frequency: "DAILY",
    lastRunAt: null,
    nextRunAt: new Date(),
    lockedAt: null,
    lockedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

const CRITERIA = searchCriteriaSchema.parse({
  transactionType: "buy",
  locations: ["Gent"],
  hardRequirements: { propertyTypes: ["house"], maxPrice: 450_000, minBedrooms: 3 },
  preferences: { features: ["garden", "garage"] },
});

let properties: InMemoryPropertyRepository;
let matches: InMemorySearchMatchRepository;

function makeRunner(sources: PropertySource[], enabled: string[]): SearchRunner {
  return new SearchRunner({
    registry: new SourceRegistry(sources, enabled),
    properties,
    matches,
    logger: silentLogger,
    maxResultsPerSource: 50,
  });
}

beforeEach(() => {
  properties = new InMemoryPropertyRepository();
  matches = new InMemorySearchMatchRepository();
});

describe("pijplijn", () => {
  it("haalt op, slaat op en matcht", async () => {
    const runner = makeRunner([new FixtureSource([MATCHING_LISTING, TOO_EXPENSIVE])], ["fixture"]);
    const totals = await runner.execute(makeSearch(CRITERIA), "run-1");

    expect(totals.scrapedCount).toBe(2);
    expect(totals.newPropertyCount).toBe(2);
    // Alleen het pand binnen budget wordt een match; het dure pand is wél
    // opgeslagen maar leidt niet tot een melding.
    expect(totals.matchCount).toBe(1);

    const stored = await matches.listForUser("user-1");
    expect(stored).toHaveLength(1);
    expect(stored[0]?.score).toBe(50); // tuin wel, garage niet
    expect(stored[0]?.hardPass).toBe(true);
  });

  it("slaat een pand op dat de harde eisen niet haalt, zonder match", async () => {
    const runner = makeRunner([new FixtureSource([TOO_EXPENSIVE])], ["fixture"]);
    await runner.execute(makeSearch(CRITERIA), "run-1");

    expect(await properties.count()).toBe(1);
    expect(await matches.listForUser("user-1")).toHaveLength(0);
  });
});

describe("ontdubbeling", () => {
  it("meldt hetzelfde externalId niet twee keer als nieuw pand", async () => {
    const search = makeSearch(CRITERIA);
    const runner = makeRunner([new FixtureSource([MATCHING_LISTING])], ["fixture"]);

    const first = await runner.execute(search, "run-1");
    expect(first.newPropertyCount).toBe(1);
    expect(first.matchCount).toBe(1);

    const second = await runner.execute(search, "run-2");
    expect(second.scrapedCount).toBe(1);
    expect(second.newPropertyCount).toBe(0);
    expect(second.matchCount).toBe(0);

    expect(await properties.count()).toBe(1);
    expect(await matches.listForUser("user-1")).toHaveLength(1);
  });

  it("herkent hetzelfde pand via een andere URL-schrijfwijze", async () => {
    const withTracking = {
      ...MATCHING_LISTING,
      externalId: "andere-id",
      url: "https://example.com/fixture/fx-1?utm_source=nieuwsbrief",
    };

    const runner = makeRunner([new FixtureSource([MATCHING_LISTING, withTracking])], ["fixture"]);
    const totals = await runner.execute(makeSearch(CRITERIA), "run-1");

    expect(totals.scrapedCount).toBe(2);
    // Genormaliseerde URL is gelijk, dus het is één pand.
    expect(await properties.count()).toBe(1);
  });

  it("registreert een prijswijziging als wijziging en niet als nieuw pand", async () => {
    const search = makeSearch(CRITERIA);

    await makeRunner([new FixtureSource([MATCHING_LISTING])], ["fixture"]).execute(search, "run-1");
    const cheaper = { ...MATCHING_LISTING, price: 399_000 };
    const totals = await makeRunner([new FixtureSource([cheaper])], ["fixture"]).execute(search, "run-2");

    expect(totals.newPropertyCount).toBe(0);
    const stored = await properties.list();
    expect(stored[0]?.price).toBe(399_000);
  });
});

describe("bronnen falen los van elkaar", () => {
  it("laat een geblokkeerde bron de andere niet meenemen", async () => {
    const blocked: PropertySource = {
      name: "geblokkeerd",
      kind: "scrape",
      requiresBrowser: false,
      supports: () => true,
      search: () => Promise.reject(new SourceBlockedError("geblokkeerd", "403 van de site")),
    };

    const runner = makeRunner([blocked, new FixtureSource([MATCHING_LISTING])], ["geblokkeerd", "fixture"]);
    const totals = await runner.execute(makeSearch(CRITERIA), "run-1");

    expect(totals.scrapedCount).toBe(1);
    expect(totals.matchCount).toBe(1);

    const stats = totals.sourceStats as { source: string; status: string }[];
    expect(stats.find((s) => s.source === "geblokkeerd")?.status).toBe("blocked");
    expect(stats.find((s) => s.source === "fixture")?.status).toBe("ok");
  });

  it("levert nul resultaten wanneer geen enkele bron aanstaat", async () => {
    const runner = makeRunner([new FixtureSource([MATCHING_LISTING])], []);
    const totals = await runner.execute(makeSearch(CRITERIA), "run-1");
    expect(totals.scrapedCount).toBe(0);
    expect(totals.matchCount).toBe(0);
  });

  it("stopt netjes wanneer de run afgebroken wordt", async () => {
    const slow: PropertySource = {
      name: "traag",
      kind: "scrape",
      requiresBrowser: false,
      supports: () => true,
      search: (_criteria, ctx: SourceSearchContext) =>
        new Promise((resolve) => {
          ctx.signal.addEventListener("abort", () => resolve([]), { once: true });
        }),
    };

    const runner = new SearchRunner({
      registry: new SourceRegistry([slow], ["traag"]),
      properties,
      matches,
      logger: silentLogger,
      maxResultsPerSource: 50,
      runTimeoutMs: 20,
    });

    const totals = await runner.execute(makeSearch(CRITERIA), "run-1");
    expect(totals.scrapedCount).toBe(0);
  });
});
