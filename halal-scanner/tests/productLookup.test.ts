import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderError } from "@/lib/errors";
import type { ProductDataProvider } from "@/server/integrations/productData/types";

vi.mock("@/server/repositories/productRepository", () => ({
  findProductByBarcode: vi.fn(),
  findProductById: vi.fn(),
  recordScanEvent: vi.fn(async () => undefined),
}));

vi.mock("@/server/services/productSyncService", () => ({
  syncProductFromExternal: vi.fn(),
}));

const repo = await import("@/server/repositories/productRepository");
const sync = await import("@/server/services/productSyncService");
const { lookupProductByBarcode, refreshProductById } = await import(
  "@/server/services/productLookupService"
);
const { makeProduct, makeExternal } = await import("./helpers/fixtures");

const mocked = {
  findProductByBarcode: vi.mocked(repo.findProductByBarcode),
  findProductById: vi.mocked(repo.findProductById),
  recordScanEvent: vi.mocked(repo.recordScanEvent),
  syncProductFromExternal: vi.mocked(sync.syncProductFromExternal),
};

const NOW = new Date("2026-02-01T12:00:00.000Z");
const TTL_HOURS = 168;

function makeProvider(
  impl: ProductDataProvider["getByBarcode"],
  name = "test_provider",
): ProductDataProvider {
  return { name, displayName: name, confidence: "MEDIUM", getByBarcode: impl };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocked.recordScanEvent.mockResolvedValue(undefined);
  mocked.syncProductFromExternal.mockImplementation(async () => ({
    product: makeProduct(),
    outcome: "CREATED",
    changedFields: ["created"],
    ingredientsChanged: true,
  }));
});

describe("barcode-validatie in de lookup", () => {
  it("weigert een ongeldige barcode voordat er een externe call gebeurt", async () => {
    const getByBarcode = vi.fn();
    await expect(
      lookupProductByBarcode("12345", {
        providers: [makeProvider(getByBarcode)],
        ttlHours: TTL_HOURS,
        now: NOW,
      }),
    ).rejects.toMatchObject({ code: "INVALID_BARCODE" });

    expect(getByBarcode).not.toHaveBeenCalled();
    expect(mocked.findProductByBarcode).not.toHaveBeenCalled();
  });

  it("canonicaliseert de barcode voordat er lokaal gezocht wordt", async () => {
    mocked.findProductByBarcode.mockResolvedValue(
      makeProduct({ barcode: "0036000291452", lastSyncedAt: NOW }),
    );

    // Gescand als 12-cijferige UPC-A.
    await lookupProductByBarcode("036000291452", {
      providers: [],
      ttlHours: TTL_HOURS,
      now: NOW,
    });

    // ...maar lokaal opgezocht als canonieke EAN-13. Zonder dit zouden twee
    // gebruikers met verschillende scanners twee losse producten krijgen.
    expect(mocked.findProductByBarcode).toHaveBeenCalledWith("0036000291452");
  });
});

describe("cache en TTL", () => {
  it("gebruikt de lokale versie en doet geen externe call als die vers genoeg is", async () => {
    const oneDayOld = new Date(NOW.getTime() - 24 * 60 * 60 * 1000);
    mocked.findProductByBarcode.mockResolvedValue(
      makeProduct({ lastSyncedAt: oneDayOld }),
    );
    const getByBarcode = vi.fn();

    const result = await lookupProductByBarcode("4006381333931", {
      providers: [makeProvider(getByBarcode)],
      ttlHours: TTL_HOURS,
      now: NOW,
    });

    expect(result.source).toBe("CACHE");
    expect(result.cached).toBe(true);
    expect(getByBarcode).not.toHaveBeenCalled();
  });

  it("synchroniseert opnieuw wanneer de TTL verlopen is", async () => {
    const tooOld = new Date(NOW.getTime() - (TTL_HOURS + 1) * 60 * 60 * 1000);
    mocked.findProductByBarcode.mockResolvedValue(makeProduct({ lastSyncedAt: tooOld }));
    const getByBarcode = vi.fn(async () => makeExternal());

    const result = await lookupProductByBarcode("4006381333931", {
      providers: [makeProvider(getByBarcode)],
      ttlHours: TTL_HOURS,
      now: NOW,
    });

    expect(getByBarcode).toHaveBeenCalledOnce();
    expect(result.source).toBe("PROVIDER");
    expect(result.cached).toBe(false);
  });

  it("negeert de TTL bij force refresh", async () => {
    mocked.findProductByBarcode.mockResolvedValue(makeProduct({ lastSyncedAt: NOW }));
    const getByBarcode = vi.fn(async () => makeExternal());

    const result = await lookupProductByBarcode("4006381333931", {
      providers: [makeProvider(getByBarcode)],
      ttlHours: TTL_HOURS,
      now: NOW,
      force: true,
    });

    expect(getByBarcode).toHaveBeenCalledOnce();
    expect(result.source).toBe("PROVIDER");
  });

  it("synchroniseert wanneer het product lokaal nog nooit gesynchroniseerd is", async () => {
    mocked.findProductByBarcode.mockResolvedValue(makeProduct({ lastSyncedAt: null }));
    const getByBarcode = vi.fn(async () => makeExternal());

    await lookupProductByBarcode("4006381333931", {
      providers: [makeProvider(getByBarcode)],
      ttlHours: TTL_HOURS,
      now: NOW,
    });

    expect(getByBarcode).toHaveBeenCalledOnce();
  });
});

describe("product niet gevonden", () => {
  it("gooit PRODUCT_NOT_FOUND als geen enkele bron het kent", async () => {
    mocked.findProductByBarcode.mockResolvedValue(null);

    await expect(
      lookupProductByBarcode("4006381333931", {
        providers: [makeProvider(async () => null)],
        ttlHours: TTL_HOURS,
        now: NOW,
      }),
    ).rejects.toMatchObject({ code: "PRODUCT_NOT_FOUND" });
  });

  it("legt een mislukte scan vast voor statistiek", async () => {
    mocked.findProductByBarcode.mockResolvedValue(null);

    await lookupProductByBarcode("4006381333931", {
      providers: [makeProvider(async () => null)],
      ttlHours: TTL_HOURS,
      now: NOW,
    }).catch(() => undefined);

    expect(mocked.recordScanEvent).toHaveBeenCalledWith(
      expect.objectContaining({ barcode: "4006381333931", found: false, productId: null }),
    );
  });

  it("behoudt een bestaand lokaal product als de bron het niet meer kent", async () => {
    const existing = makeProduct({ lastSyncedAt: null });
    mocked.findProductByBarcode.mockResolvedValue(existing);

    const result = await lookupProductByBarcode("4006381333931", {
      providers: [makeProvider(async () => null)],
      ttlHours: TTL_HOURS,
      now: NOW,
    });

    expect(result.product).toBe(existing);
    expect(result.stale).toBe(true);
    expect(mocked.syncProductFromExternal).not.toHaveBeenCalled();
  });
});

describe("weerbaarheid bij storingen", () => {
  it("valt terug op de gecachte versie wanneer de provider faalt", async () => {
    const existing = makeProduct({ lastSyncedAt: null });
    mocked.findProductByBarcode.mockResolvedValue(existing);

    const result = await lookupProductByBarcode("4006381333931", {
      providers: [
        makeProvider(async () => {
          throw new ProviderError("test", "PROVIDER_TIMEOUT", "timeout");
        }),
      ],
      ttlHours: TTL_HOURS,
      now: NOW,
    });

    // Cruciaal: een storing maakt bestaande data niet ongeldig.
    expect(result.product).toBe(existing);
    expect(result.source).toBe("CACHE_STALE_FALLBACK");
    expect(result.stale).toBe(true);
    expect(mocked.syncProductFromExternal).not.toHaveBeenCalled();
  });

  it("geeft de providerfout door als er geen lokale versie is", async () => {
    mocked.findProductByBarcode.mockResolvedValue(null);

    await expect(
      lookupProductByBarcode("4006381333931", {
        providers: [
          makeProvider(async () => {
            throw new ProviderError("test", "PROVIDER_UNAVAILABLE", "storing");
          }),
        ],
        ttlHours: TTL_HOURS,
        now: NOW,
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
  });

  it("probeert de volgende provider wanneer de eerste faalt", async () => {
    mocked.findProductByBarcode.mockResolvedValue(null);
    const second = vi.fn(async () => makeExternal());

    const result = await lookupProductByBarcode("4006381333931", {
      providers: [
        makeProvider(async () => {
          throw new ProviderError("een", "PROVIDER_UNAVAILABLE", "storing");
        }, "een"),
        makeProvider(second, "twee"),
      ],
      ttlHours: TTL_HOURS,
      now: NOW,
    });

    expect(second).toHaveBeenCalledOnce();
    expect(result.providerName).toBe("twee");
  });
});

describe("integratie met de analyse-engine", () => {
  it("analyseert een nieuw geimporteerd product", async () => {
    mocked.findProductByBarcode.mockResolvedValue(null);
    const analyzed = makeProduct({ halalStatus: "LIKELY_HALAL" });
    const analyzer = { analyzeAndPersist: vi.fn(async () => analyzed) };

    const result = await lookupProductByBarcode("4006381333931", {
      providers: [makeProvider(async () => makeExternal())],
      ttlHours: TTL_HOURS,
      now: NOW,
      analyzer,
    });

    expect(analyzer.analyzeAndPersist).toHaveBeenCalledWith("prod_1", { now: NOW });
    expect(result.product.halalStatus).toBe("LIKELY_HALAL");
  });

  it("analyseert niet opnieuw als er niets veranderde en er al een analyse is", async () => {
    mocked.findProductByBarcode.mockResolvedValue(makeProduct({ lastSyncedAt: null }));
    mocked.syncProductFromExternal.mockResolvedValue({
      product: makeProduct({ lastAnalyzedAt: new Date("2026-01-15T00:00:00.000Z") }),
      outcome: "UNCHANGED",
      changedFields: [],
      ingredientsChanged: false,
    });
    const analyzer = { analyzeAndPersist: vi.fn(async () => makeProduct()) };

    await lookupProductByBarcode("4006381333931", {
      providers: [makeProvider(async () => makeExternal())],
      ttlHours: TTL_HOURS,
      now: NOW,
      analyzer,
    });

    expect(analyzer.analyzeAndPersist).not.toHaveBeenCalled();
  });

  it("analyseert wel opnieuw wanneer de ingredienten wijzigden", async () => {
    mocked.findProductByBarcode.mockResolvedValue(makeProduct({ lastSyncedAt: null }));
    mocked.syncProductFromExternal.mockResolvedValue({
      product: makeProduct({ lastAnalyzedAt: new Date("2026-01-15T00:00:00.000Z") }),
      outcome: "UPDATED",
      changedFields: ["ingredientsRaw"],
      ingredientsChanged: true,
    });
    const analyzer = { analyzeAndPersist: vi.fn(async () => makeProduct()) };

    await lookupProductByBarcode("4006381333931", {
      providers: [makeProvider(async () => makeExternal())],
      ttlHours: TTL_HOURS,
      now: NOW,
      analyzer,
    });

    expect(analyzer.analyzeAndPersist).toHaveBeenCalledOnce();
  });
});

describe("refreshProductById", () => {
  it("gooit RESOURCE_NOT_FOUND voor een onbekend id", async () => {
    mocked.findProductById.mockResolvedValue(null);
    await expect(refreshProductById("bestaat_niet")).rejects.toMatchObject({
      code: "RESOURCE_NOT_FOUND",
    });
  });

  it("forceert een providercall voor een bestaand product", async () => {
    mocked.findProductById.mockResolvedValue(makeProduct({ lastSyncedAt: NOW }));
    mocked.findProductByBarcode.mockResolvedValue(makeProduct({ lastSyncedAt: NOW }));
    const getByBarcode = vi.fn(async () => makeExternal());

    const result = await refreshProductById("prod_1", {
      providers: [makeProvider(getByBarcode)],
      ttlHours: TTL_HOURS,
      now: NOW,
    });

    expect(getByBarcode).toHaveBeenCalledOnce();
    expect(result.source).toBe("PROVIDER");
  });
});
