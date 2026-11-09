import { beforeEach, describe, expect, it } from "vitest";
import { SearchService, deriveName, nextRunAt, type SearchExecutor } from "../src/services/searchService.js";
import {
  InMemorySearchRepository,
  InMemorySearchRunRepository,
  InMemoryUserRepository,
} from "./helpers/inMemoryRepositories.js";
import { StubAiProvider } from "./helpers/stubAiProvider.js";
import { ConflictError, NotFoundError, ValidationError } from "../src/lib/errors.js";
import { searchCriteriaSchema } from "../src/schemas/searchCriteria.js";
import type { SearchRunTotals } from "../src/types/domain.js";

const silentLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- alleen wat de service gebruikt
} as any;

const VALID_CRITERIA = {
  transactionType: "buy",
  locations: ["Gent"],
  hardRequirements: { propertyTypes: ["house"], maxPrice: 450_000, minBedrooms: 3 },
  preferences: { features: ["garden"] },
};

interface Harness {
  service: SearchService;
  searches: InMemorySearchRepository;
  runs: InMemorySearchRunRepository;
  users: InMemoryUserRepository;
  userId: string;
  otherUserId: string;
  executor: SearchExecutor & { calls: number };
}

async function setup(overrides: { executor?: SearchExecutor; now?: () => Date } = {}): Promise<Harness> {
  const searches = new InMemorySearchRepository();
  const runs = new InMemorySearchRunRepository();
  const users = new InMemoryUserRepository();

  const user = await users.ensure("dev@example.test");
  const other = await users.ensure("iemand-anders@example.test");

  const executor = Object.assign(
    {
      calls: 0,
      execute(): Promise<SearchRunTotals> {
        executor.calls += 1;
        return Promise.resolve({ scrapedCount: 3, newPropertyCount: 1, matchCount: 1, notifiedCount: 0 });
      },
    },
    { calls: 0 },
  );

  const service = new SearchService({
    searches,
    searchRuns: runs,
    executor: overrides.executor ?? executor,
    logger: silentLogger,
    lockTtlMinutes: 30,
    workerId: "test-worker",
    aiProvider: new StubAiProvider(VALID_CRITERIA),
    now: overrides.now,
  });

  return { service, searches, runs, users, userId: user.id, otherUserId: other.id, executor };
}

describe("SearchService — CRUD", () => {
  let h: Harness;
  beforeEach(async () => {
    h = await setup();
  });

  it("maakt een zoekopdracht aan uit gestructureerde criteria zonder AI", async () => {
    const search = await h.service.create(h.userId, { criteria: VALID_CRITERIA, name: "Huis Gent" });
    expect(search.name).toBe("Huis Gent");
    expect(search.criteria.hardRequirements.maxPrice).toBe(450_000);
    // Rechtstreeks aangeleverde criteria zijn niet door een parser gegaan.
    expect(search.parsedBy).toBeNull();
    expect(search.active).toBe(true);
  });

  it("maakt een zoekopdracht aan uit vrije tekst en bewaart de herkomst", async () => {
    const search = await h.service.create(h.userId, { query: "Huis in Gent onder 450k met tuin" });
    expect(search.originalQuery).toBe("Huis in Gent onder 450k met tuin");
    expect(search.parsedBy).toMatch(/^anthropic:/);
    expect(search.criteriaVersion).toBe(1);
  });

  it("verzint een naam wanneer de gebruiker er geen geeft", async () => {
    const search = await h.service.create(h.userId, { criteria: VALID_CRITERIA });
    expect(search.name).toBe("Huis Gent");
  });

  it("weigert een tweede zoekopdracht met dezelfde naam", async () => {
    await h.service.create(h.userId, { criteria: VALID_CRITERIA, name: "Huis Gent" });
    await expect(
      h.service.create(h.userId, { criteria: VALID_CRITERIA, name: "Huis Gent" }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("laat twee gebruikers wél dezelfde naam gebruiken", async () => {
    await h.service.create(h.userId, { criteria: VALID_CRITERIA, name: "Huis Gent" });
    const other = await h.service.create(h.otherUserId, { criteria: VALID_CRITERIA, name: "Huis Gent" });
    expect(other.name).toBe("Huis Gent");
  });

  it("wijzigt naam, frequentie en criteria", async () => {
    const created = await h.service.create(h.userId, { criteria: VALID_CRITERIA });
    const updated = await h.service.update(created.id, h.userId, {
      name: "Nieuwe naam",
      frequency: "HOURLY",
      criteria: { ...VALID_CRITERIA, hardRequirements: { ...VALID_CRITERIA.hardRequirements, maxPrice: 400_000 } },
    });
    expect(updated.name).toBe("Nieuwe naam");
    expect(updated.frequency).toBe("HOURLY");
    expect(updated.criteria.hardRequirements.maxPrice).toBe(400_000);
  });

  it("activeert en deactiveert", async () => {
    const created = await h.service.create(h.userId, { criteria: VALID_CRITERIA });
    expect((await h.service.setActive(created.id, h.userId, false)).active).toBe(false);
    expect((await h.service.setActive(created.id, h.userId, true)).active).toBe(true);
  });

  it("verwijdert", async () => {
    const created = await h.service.create(h.userId, { criteria: VALID_CRITERIA });
    await h.service.delete(created.id, h.userId);
    await expect(h.service.get(created.id, h.userId)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("somt alleen de zoekopdrachten van de gebruiker op", async () => {
    await h.service.create(h.userId, { criteria: VALID_CRITERIA, name: "Mijn zoekopdracht" });
    await h.service.create(h.otherUserId, { criteria: VALID_CRITERIA, name: "Van iemand anders" });

    const { items, total } = await h.service.list(h.userId);
    expect(total).toBe(1);
    expect(items[0]?.name).toBe("Mijn zoekopdracht");
  });
});

describe("SearchService — validatie", () => {
  let h: Harness;
  beforeEach(async () => {
    h = await setup();
  });

  it("weigert criteria met minPrice groter dan maxPrice", async () => {
    await expect(
      h.service.create(h.userId, {
        criteria: {
          transactionType: "buy",
          locations: ["Gent"],
          hardRequirements: { minPrice: 600_000, maxPrice: 450_000 },
          preferences: {},
        },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("weigert onbekende velden in criteria", async () => {
    await expect(
      h.service.create(h.userId, {
        criteria: { transactionType: "buy", locations: ["Gent"], zwembadVerplicht: true },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("weigert criteria zonder één bruikbaar filter", async () => {
    await expect(
      h.service.create(h.userId, { criteria: { transactionType: "buy", hardRequirements: {}, preferences: {} } }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("weigert een create zonder query en zonder criteria", async () => {
    await expect(h.service.create(h.userId, {})).rejects.toBeInstanceOf(ValidationError);
  });

  it("weigert een lege naam bij een wijziging", async () => {
    const created = await h.service.create(h.userId, { criteria: VALID_CRITERIA });
    await expect(h.service.update(created.id, h.userId, { name: "   " })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("SearchService — toegang", () => {
  let h: Harness;
  beforeEach(async () => {
    h = await setup();
  });

  it("geeft 'niet gevonden' voor een onbestaande zoekopdracht", async () => {
    await expect(h.service.get("bestaat-niet", h.userId)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("geeft 'niet gevonden' voor de zoekopdracht van een andere gebruiker", async () => {
    const mine = await h.service.create(h.userId, { criteria: VALID_CRITERIA });
    // Bewust 'niet gevonden' en niet 'geen toegang': een 403 zou bevestigen dat
    // dit id bestaat.
    await expect(h.service.get(mine.id, h.otherUserId)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("laat een andere gebruiker niet wijzigen of verwijderen", async () => {
    const mine = await h.service.create(h.userId, { criteria: VALID_CRITERIA });
    await expect(h.service.update(mine.id, h.otherUserId, { name: "gekaapt" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(h.service.delete(mine.id, h.otherUserId)).rejects.toBeInstanceOf(NotFoundError);
    expect((await h.service.get(mine.id, h.userId)).name).toBe("Huis Gent");
  });

  it("laat een andere gebruiker de zoekopdracht niet starten", async () => {
    const mine = await h.service.create(h.userId, { criteria: VALID_CRITERIA });
    await expect(h.service.run(mine.id, h.otherUserId)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("SearchService — vergrendeling", () => {
  it("claimt het slot, draait, en geeft het weer vrij", async () => {
    const h = await setup();
    const search = await h.service.create(h.userId, { criteria: VALID_CRITERIA });

    const result = await h.service.run(search.id, h.userId);
    expect(result.started).toBe(true);
    expect(result.totals?.scrapedCount).toBe(3);

    const after = await h.service.get(search.id, h.userId);
    expect(after.lockedAt).toBeNull();
    expect(after.lastRunAt).not.toBeNull();
    expect(after.nextRunAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("voorkomt dat dezelfde zoekopdracht twee keer tegelijk draait", async () => {
    // De executor blijft hangen tot wij hem loslaten; zo overlappen de runs echt.
    let release: () => void = () => {};
    const blocking: SearchExecutor = {
      execute: () =>
        new Promise<SearchRunTotals>((resolve) => {
          release = () => resolve({ scrapedCount: 0, newPropertyCount: 0, matchCount: 0, notifiedCount: 0 });
        }),
    };

    const h = await setup({ executor: blocking });
    const search = await h.service.create(h.userId, { criteria: VALID_CRITERIA });

    const first = h.service.run(search.id, h.userId);
    // Tweede poging terwijl de eerste nog draait.
    const second = await h.service.run(search.id, h.userId);

    expect(second.started).toBe(false);
    expect(second.reason).toBe("locked");
    expect(second.runId).toBeNull();

    release();
    expect((await first).started).toBe(true);

    // Precies één run-record, geen weesrun voor de geweigerde poging.
    expect(await h.runs.listForSearch(search.id, 10)).toHaveLength(1);
  });

  it("neemt een verlopen slot over van een gecrashte worker", async () => {
    const h = await setup();
    const search = await h.service.create(h.userId, { criteria: VALID_CRITERIA });

    // Simuleer een worker die het slot nam en daarna crashte: het slot staat
    // nog, maar is ouder dan de TTL.
    const stale = new Date(Date.now() - 45 * 60_000);
    h.searches.searches.set(search.id, {
      ...h.searches.searches.get(search.id)!,
      lockedAt: stale,
      lockedBy: "gecrashte-worker",
    });

    const result = await h.service.run(search.id, h.userId);
    expect(result.started).toBe(true);
  });

  it("respecteert een vers slot dat nog binnen de TTL valt", async () => {
    const h = await setup();
    const search = await h.service.create(h.userId, { criteria: VALID_CRITERIA });

    h.searches.searches.set(search.id, {
      ...h.searches.searches.get(search.id)!,
      lockedAt: new Date(Date.now() - 60_000),
      lockedBy: "andere-worker",
    });

    const result = await h.service.run(search.id, h.userId);
    expect(result.started).toBe(false);
    expect(result.reason).toBe("locked");
  });

  it("geeft het slot ook vrij wanneer de run faalt", async () => {
    const failing: SearchExecutor = { execute: () => Promise.reject(new Error("bron onbereikbaar")) };
    const h = await setup({ executor: failing });
    const search = await h.service.create(h.userId, { criteria: VALID_CRITERIA });

    await expect(h.service.run(search.id, h.userId)).rejects.toThrow("bron onbereikbaar");

    const after = await h.service.get(search.id, h.userId);
    expect(after.lockedAt).toBeNull();

    const runs = await h.runs.listForSearch(search.id, 10);
    expect(runs[0]?.status).toBe("FAILED");
    expect(runs[0]?.error).toBe("bron onbereikbaar");
  });

  it("draait een inactieve zoekopdracht niet, tenzij met force", async () => {
    const h = await setup();
    const search = await h.service.create(h.userId, { criteria: VALID_CRITERIA, active: false });

    const skipped = await h.service.run(search.id, h.userId);
    expect(skipped.started).toBe(false);
    expect(skipped.reason).toBe("inactive");

    const forced = await h.service.run(search.id, h.userId, { force: true });
    expect(forced.started).toBe(true);
  });
});

describe("hulpfuncties", () => {
  it("berekent nextRunAt per frequentie", () => {
    const from = new Date("2026-08-07T10:00:00.000Z");
    expect(nextRunAt(from, "HOURLY").toISOString()).toBe("2026-08-07T11:00:00.000Z");
    expect(nextRunAt(from, "EVERY_6_HOURS").toISOString()).toBe("2026-08-07T16:00:00.000Z");
    expect(nextRunAt(from, "DAILY").toISOString()).toBe("2026-08-08T10:00:00.000Z");
  });

  it("leidt een naam af uit wat de gebruiker zelf genoemd heeft", () => {
    expect(deriveName(searchCriteriaSchema.parse(VALID_CRITERIA))).toBe("Huis Gent");
    expect(
      deriveName(
        searchCriteriaSchema.parse({
          transactionType: "rent",
          hardRequirements: { propertyTypes: ["apartment"] },
        }),
      ),
    ).toBe("Appartement (huur)");
  });
});

describe("scheduler-selectie", () => {
  it("levert alleen actieve zoekopdrachten waarvan de tijd verstreken is", async () => {
    const h = await setup();
    const due = await h.service.create(h.userId, { criteria: VALID_CRITERIA, name: "Nu" });
    const inactive = await h.service.create(h.userId, { criteria: VALID_CRITERIA, name: "Uit", active: false });
    const later = await h.service.create(h.userId, { criteria: VALID_CRITERIA, name: "Later" });

    await h.searches.update(later.id, h.userId, { nextRunAt: new Date(Date.now() + 3_600_000) });

    const found = await h.searches.findDue(new Date(), 10);
    const ids = found.map((s) => s.id);
    expect(ids).toContain(due.id);
    expect(ids).not.toContain(inactive.id);
    expect(ids).not.toContain(later.id);
  });
});
