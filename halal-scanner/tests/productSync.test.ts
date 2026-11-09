import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * De repository wordt gemockt: deze tests gaan over de synchronisatieregels,
 * niet over SQL. De databasekant wordt in de integratietests tegen een echte
 * PostgreSQL gedekt (zie tests/integration/).
 */
vi.mock("@/server/repositories/productRepository", () => ({
  findProductByBarcode: vi.fn(),
  createProductWithRevision: vi.fn(),
  updateProductWithRevision: vi.fn(),
  touchSyncedAt: vi.fn(),
}));

const repo = await import("@/server/repositories/productRepository");
const { syncProductFromExternal, hashIngredients } = await import(
  "@/server/services/productSyncService"
);
const { makeProduct, makeExternal } = await import("./helpers/fixtures");
const { parseIngredientsText } = await import("@/server/halal/normalizers/ingredients");

const mocked = {
  findProductByBarcode: vi.mocked(repo.findProductByBarcode),
  createProductWithRevision: vi.mocked(repo.createProductWithRevision),
  updateProductWithRevision: vi.mocked(repo.updateProductWithRevision),
  touchSyncedAt: vi.mocked(repo.touchSyncedAt),
};

const SYNC_OPTIONS = {
  sourceConfidence: "MEDIUM" as const,
  ingredientsOrigin: "OPEN_FOOD_FACTS" as const,
  now: new Date("2026-02-01T00:00:00.000Z"),
};

beforeEach(() => {
  vi.resetAllMocks();
  mocked.createProductWithRevision.mockImplementation(async () => makeProduct());
  mocked.updateProductWithRevision.mockImplementation(async () => makeProduct());
});

describe("nieuw product", () => {
  it("maakt het product aan met revisie 1 en de geparste ingredienten", async () => {
    mocked.findProductByBarcode.mockResolvedValue(null);

    const result = await syncProductFromExternal(
      makeExternal({ ingredientsText: "Suiker, water, E471" }),
      SYNC_OPTIONS,
    );

    expect(result.outcome).toBe("CREATED");
    const input = mocked.createProductWithRevision.mock.calls[0]?.[0];
    expect(input?.parsedIngredients.map((i) => i.normalizedName)).toEqual([
      "suiker",
      "water",
      "e471",
    ]);
    expect(input?.ingredientsOrigin).toBe("OPEN_FOOD_FACTS");
    expect(input?.ingredientsHash).toBeTypeOf("string");
  });

  it("laat ingredientsOrigin leeg als de bron geen ingredienten aanlevert", async () => {
    mocked.findProductByBarcode.mockResolvedValue(null);

    await syncProductFromExternal(
      makeExternal({ ingredientsText: undefined, ingredients: [] }),
      SYNC_OPTIONS,
    );

    expect(mocked.createProductWithRevision.mock.calls[0]?.[0].ingredientsOrigin).toBeNull();
  });
});

describe("bestaand product", () => {
  it("doet geen update wanneer er niets gewijzigd is", async () => {
    mocked.findProductByBarcode.mockResolvedValue(
      makeProduct({ ingredientsRaw: "Suiker, water" }),
    );

    const result = await syncProductFromExternal(
      makeExternal({ ingredientsText: "Suiker, water" }),
      SYNC_OPTIONS,
    );

    expect(result.outcome).toBe("UNCHANGED");
    expect(mocked.updateProductWithRevision).not.toHaveBeenCalled();
    // lastSyncedAt gaat wel vooruit, anders blijft de TTL eeuwig verlopen.
    expect(mocked.touchSyncedAt).toHaveBeenCalledWith(
      "prod_1",
      SYNC_OPTIONS.now,
      undefined,
    );
  });

  it("verhoogt het revisienummer en registreert de gewijzigde velden", async () => {
    mocked.findProductByBarcode.mockResolvedValue(
      makeProduct({ revision: 3, name: "Oude naam" }),
    );

    const result = await syncProductFromExternal(
      makeExternal({ name: "Nieuwe naam" }),
      SYNC_OPTIONS,
    );

    expect(result.outcome).toBe("UPDATED");
    expect(result.changedFields).toContain("name");
    expect(mocked.updateProductWithRevision.mock.calls[0]?.[0].nextRevision).toBe(4);
  });

  it("wist een bestaande waarde niet wanneer de bron het veld niet aanlevert", async () => {
    // Een tijdelijk incomplete respons mag geen permanent gegevensverlies zijn.
    mocked.findProductByBarcode.mockResolvedValue(
      makeProduct({ imageUrl: "https://images.test/a.jpg", name: "Testkoek" }),
    );

    const result = await syncProductFromExternal(
      makeExternal({ imageUrl: undefined, name: "Testkoek" }),
      SYNC_OPTIONS,
    );

    expect(result.changedFields).not.toContain("imageUrl");
    expect(result.outcome).toBe("UNCHANGED");
  });

  it("vervangt de ingredientenlijst wanneer de ruwe tekst wijzigt", async () => {
    mocked.findProductByBarcode.mockResolvedValue(
      makeProduct({ ingredientsRaw: "Suiker, water" }),
    );

    const result = await syncProductFromExternal(
      makeExternal({ ingredientsText: "Suiker, water, gelatine" }),
      SYNC_OPTIONS,
    );

    expect(result.ingredientsChanged).toBe(true);
    const input = mocked.updateProductWithRevision.mock.calls[0]?.[0];
    expect(input?.parsedIngredients?.map((i) => i.normalizedName)).toEqual([
      "suiker",
      "water",
      "gelatine",
    ]);
  });
});

describe("eigenaarschap van velden", () => {
  it("raakt uitsluitend extern beheerde velden aan", async () => {
    mocked.findProductByBarcode.mockResolvedValue(makeProduct({ name: "Oude naam" }));

    await syncProductFromExternal(makeExternal({ name: "Nieuwe naam" }), SYNC_OPTIONS);

    const fields = mocked.updateProductWithRevision.mock.calls[0]?.[0].fields ?? {};
    // Halal-status, certificaten, reviews en analyses komen hier nooit in voor.
    for (const forbidden of [
      "halalStatus",
      "confidenceLevel",
      "needsHumanReview",
      "lastAnalyzedAt",
      "analysisVersion",
    ]) {
      expect(fields).not.toHaveProperty(forbidden);
    }
  });

  it("overschrijft een door een gebruiker vastgestelde ingredientenlijst niet", async () => {
    mocked.findProductByBarcode.mockResolvedValue(
      makeProduct({ ingredientsRaw: "Door gebruiker gecorrigeerd", ingredientsOrigin: "USER" }),
    );

    const result = await syncProductFromExternal(
      makeExternal({ ingredientsText: "Iets heel anders van OFF" }),
      SYNC_OPTIONS,
    );

    expect(result.ingredientsChanged).toBe(false);
    expect(result.outcome).toBe("SKIPPED_PROTECTED");
    expect(mocked.updateProductWithRevision).not.toHaveBeenCalled();
  });

  it("beschermt ook een via OCR vastgestelde lijst", async () => {
    mocked.findProductByBarcode.mockResolvedValue(
      makeProduct({ ingredientsRaw: "Via OCR", ingredientsOrigin: "OCR" }),
    );

    const result = await syncProductFromExternal(
      makeExternal({ ingredientsText: "Van OFF" }),
      SYNC_OPTIONS,
    );

    expect(result.ingredientsChanged).toBe(false);
  });

  it("werkt de overige velden wel bij terwijl de lijst beschermd blijft", async () => {
    mocked.findProductByBarcode.mockResolvedValue(
      makeProduct({
        name: "Oude naam",
        ingredientsRaw: "Door gebruiker gecorrigeerd",
        ingredientsOrigin: "ADMIN",
      }),
    );

    const result = await syncProductFromExternal(
      makeExternal({ name: "Nieuwe naam", ingredientsText: "Van OFF" }),
      SYNC_OPTIONS,
    );

    expect(result.outcome).toBe("UPDATED");
    expect(result.changedFields).toEqual(["name"]);
    const input = mocked.updateProductWithRevision.mock.calls[0]?.[0];
    expect(input?.parsedIngredients).toBeNull();
    expect(input?.fields).not.toHaveProperty("ingredientsRaw");
  });

  it("mag een lijst die zelf van Open Food Facts komt wel bijwerken", async () => {
    mocked.findProductByBarcode.mockResolvedValue(
      makeProduct({ ingredientsRaw: "Oud", ingredientsOrigin: "OPEN_FOOD_FACTS" }),
    );

    const result = await syncProductFromExternal(
      makeExternal({ ingredientsText: "Nieuw" }),
      SYNC_OPTIONS,
    );

    expect(result.ingredientsChanged).toBe(true);
  });
});

describe("hashIngredients", () => {
  it("geeft dezelfde hash voor dezelfde genormaliseerde lijst", () => {
    const a = hashIngredients(parseIngredientsText("Suiker, Water"));
    const b = hashIngredients(parseIngredientsText("  suiker ,  water  "));
    expect(a).toBe(b);
  });

  it("geeft een andere hash bij een ander ingredient", () => {
    const a = hashIngredients(parseIngredientsText("Suiker, water"));
    const b = hashIngredients(parseIngredientsText("Suiker, water, gelatine"));
    expect(a).not.toBe(b);
  });

  it("geeft null voor een lege lijst", () => {
    expect(hashIngredients([])).toBeNull();
  });
});
