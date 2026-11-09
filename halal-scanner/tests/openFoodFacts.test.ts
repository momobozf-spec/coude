import { describe, expect, it, vi } from "vitest";
import { ProviderError } from "@/lib/errors";
import { OpenFoodFactsClient } from "@/server/integrations/openFoodFacts/client";
import { OpenFoodFactsProvider } from "@/server/integrations/openFoodFacts/provider";

/**
 * Open Food Facts wordt volledig gemockt: er gaat geen enkele echte HTTP-call
 * uit tijdens de tests. `sleepImpl` is ook gemockt, zodat de backoff niet
 * daadwerkelijk wacht.
 */

const BASE = { baseUrl: "https://off.test", userAgent: "HalalScanner/test" };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function makeProvider(fetchImpl: typeof fetch, overrides: Record<string, unknown> = {}) {
  const client = new OpenFoodFactsClient({
    ...BASE,
    fetchImpl,
    sleepImpl: async () => {},
    retryDelayMs: 0,
    ...overrides,
  });
  return new OpenFoodFactsProvider(client);
}

const FULL_PRODUCT = {
  status: 1,
  code: "4006381333931",
  product: {
    _id: "4006381333931",
    product_name: "Testkoek",
    product_name_nl: "Testkoek NL",
    brands: "Testmerk,Ander Merk",
    image_front_url: "https://images.off.test/front.jpg",
    ingredients_text_nl: "Suiker, plantaardige olie (palm), emulgator: E471, aroma",
    lang: "nl",
    categories_tags: ["en:snacks", "en:biscuits"],
    labels_tags: ["en:organic"],
    countries_tags: ["en:belgium"],
    allergens_tags: ["en:gluten"],
    last_modified_t: 1_700_000_000,
  },
};

describe("provider - product gevonden", () => {
  it("normaliseert een volledig product naar het interne model", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(FULL_PRODUCT));
    const provider = makeProvider(fetchImpl as unknown as typeof fetch);

    const result = await provider.getByBarcode("4006381333931");

    expect(result).not.toBeNull();
    expect(result?.name).toBe("Testkoek NL");
    expect(result?.brand).toBe("Testmerk");
    expect(result?.imageUrl).toBe("https://images.off.test/front.jpg");
    expect(result?.ingredientsLang).toBe("nl");
    expect(result?.externalSource).toBe("OPEN_FOOD_FACTS");
    expect(result?.externalUpdatedAt?.toISOString()).toBe("2023-11-14T22:13:20.000Z");
    // Taalprefixen uit OFF-tags worden gestript.
    expect(result?.categories).toEqual(["snacks", "biscuits"]);
    expect(result?.labels).toEqual(["organic"]);
    expect(result?.countries).toEqual(["belgium"]);
    expect(result?.allergens).toEqual(["gluten"]);
  });

  it("parseert de ingredienten inclusief sub-ingredienten en E-nummer", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(FULL_PRODUCT));
    const provider = makeProvider(fetchImpl as unknown as typeof fetch);

    const result = await provider.getByBarcode("4006381333931");
    const names = result?.ingredients?.map((item) => item.normalizedName) ?? [];

    expect(names).toContain("suiker");
    expect(names).toContain("plantaardige olie");
    // Het sub-ingredient uit de haakjes komt apart naar boven.
    expect(names).toContain("palm");
    // De functionele klasse "emulgator:" is gestript.
    expect(names).toContain("e471");
    expect(names).not.toContain("emulgator");

    const e471 = result?.ingredients?.find((item) => item.normalizedName === "e471");
    expect(e471?.eNumberCode).toBe("E471");
  });

  it("stuurt de vereiste User-Agent mee", async () => {
    // Deze mock declareert de parameters van `fetch` expliciet. Zonder die
    // declaratie leidt TypeScript het aanroeptupel af als `[]` en is
    // `mock.calls[0][1]` een compile-fout — precies wat we hier willen lezen.
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(FULL_PRODUCT),
    );
    const provider = makeProvider(fetchImpl as unknown as typeof fetch);
    await provider.getByBarcode("4006381333931");

    const headers = fetchImpl.mock.calls[0]?.[1]?.headers as Record<string, string> | undefined;
    expect(headers?.["User-Agent"]).toBe("HalalScanner/test");
  });
});

describe("provider - niet gevonden", () => {
  it("geeft null bij status 0", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ status: 0, status_verbose: "product not found" }),
    );
    const provider = makeProvider(fetchImpl as unknown as typeof fetch);
    await expect(provider.getByBarcode("4006381333931")).resolves.toBeNull();
  });

  it("geeft null bij HTTP 404 en probeert het niet opnieuw", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 404 }));
    const provider = makeProvider(fetchImpl as unknown as typeof fetch);

    await expect(provider.getByBarcode("4006381333931")).resolves.toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("provider - storingen", () => {
  it("gooit PROVIDER_TIMEOUT wanneer het verzoek afgebroken wordt", async () => {
    const fetchImpl = vi.fn(async () => {
      const error = new Error("The operation was aborted");
      error.name = "AbortError";
      throw error;
    });
    const provider = makeProvider(fetchImpl as unknown as typeof fetch, { maxAttempts: 2 });

    await expect(provider.getByBarcode("4006381333931")).rejects.toMatchObject({
      code: "PROVIDER_TIMEOUT",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("probeert een 5xx opnieuw en gooit daarna PROVIDER_UNAVAILABLE", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 503 }));
    const provider = makeProvider(fetchImpl as unknown as typeof fetch, { maxAttempts: 3 });

    const error = await provider.getByBarcode("4006381333931").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProviderError);
    expect(error).toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("herkent 429 als rate limiting", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 429 }));
    const provider = makeProvider(fetchImpl as unknown as typeof fetch, { maxAttempts: 2 });

    await expect(provider.getByBarcode("4006381333931")).rejects.toMatchObject({
      code: "PROVIDER_RATE_LIMITED",
    });
  });

  it("slaagt alsnog wanneer een herhaalde poging lukt", async () => {
    let call = 0;
    const fetchImpl = vi.fn(async () => {
      call += 1;
      return call === 1 ? new Response("", { status: 502 }) : jsonResponse(FULL_PRODUCT);
    });
    const provider = makeProvider(fetchImpl as unknown as typeof fetch);

    const result = await provider.getByBarcode("4006381333931");
    expect(result?.name).toBe("Testkoek NL");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("behandelt een onverwachte responsvorm als storing, niet als niet-gevonden", async () => {
    // Als een API-wijziging als "niet gevonden" zou tellen, zouden alle
    // producten stilzwijgend hun data verliezen.
    const fetchImpl = vi.fn(async () => jsonResponse("dit is geen object"));
    const provider = makeProvider(fetchImpl as unknown as typeof fetch);

    await expect(provider.getByBarcode("4006381333931")).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
    });
  });

  it("behandelt onleesbare JSON als storing", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("<html>gateway</html>", { status: 200 }),
    );
    const provider = makeProvider(fetchImpl as unknown as typeof fetch, { maxAttempts: 2 });

    await expect(provider.getByBarcode("4006381333931")).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
    });
  });
});

describe("normalisatie van ontbrekende en rommelige velden", () => {
  it("verwerkt een product waarin vrijwel alles ontbreekt", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ status: 1, code: "4006381333931", product: {} }),
    );
    const provider = makeProvider(fetchImpl as unknown as typeof fetch);

    const result = await provider.getByBarcode("4006381333931");

    expect(result).not.toBeNull();
    expect(result?.barcode).toBe("4006381333931");
    expect(result?.name).toBeUndefined();
    expect(result?.brand).toBeUndefined();
    expect(result?.imageUrl).toBeUndefined();
    expect(result?.ingredientsText).toBeUndefined();
    expect(result?.ingredients).toBeUndefined();
    expect(result?.categories).toBeUndefined();
  });

  it("behandelt lege strings als afwezig", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        status: 1,
        product: { product_name: "   ", brands: "", ingredients_text: "" },
      }),
    );
    const provider = makeProvider(fetchImpl as unknown as typeof fetch);

    const result = await provider.getByBarcode("4006381333931");
    expect(result?.name).toBeUndefined();
    expect(result?.brand).toBeUndefined();
    expect(result?.ingredientsText).toBeUndefined();
  });

  it("negeert een niet-https afbeelding-URL", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        status: 1,
        product: { image_front_url: "http://images.off.test/front.jpg" },
      }),
    );
    const provider = makeProvider(fetchImpl as unknown as typeof fetch);

    const result = await provider.getByBarcode("4006381333931");
    expect(result?.imageUrl).toBeUndefined();
  });

  it("verwerkt tags die als string in plaats van lijst binnenkomen", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        status: 1,
        product: { categories_tags: "en:snacks,en:biscuits" },
      }),
    );
    const provider = makeProvider(fetchImpl as unknown as typeof fetch);

    const result = await provider.getByBarcode("4006381333931");
    expect(result?.categories).toEqual(["snacks", "biscuits"]);
  });

  it("negeert een onbruikbare last_modified_t", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ status: 1, product: { last_modified_t: "onzin" } }),
    );
    const provider = makeProvider(fetchImpl as unknown as typeof fetch);

    const result = await provider.getByBarcode("4006381333931");
    expect(result?.externalUpdatedAt).toBeUndefined();
  });

  it("valt terug op Engels wanneer Nederlands ontbreekt", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        status: 1,
        product: { ingredients_text_en: "Sugar, water", lang: "en" },
      }),
    );
    const provider = makeProvider(fetchImpl as unknown as typeof fetch);

    const result = await provider.getByBarcode("4006381333931");
    expect(result?.ingredientsText).toBe("Sugar, water");
    expect(result?.ingredientsLang).toBe("en");
  });
});
