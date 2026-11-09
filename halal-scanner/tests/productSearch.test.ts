import { describe, expect, it, vi } from "vitest";
import {
  searchProducts,
  type Db,
  type ProductSearchHit,
} from "@/server/repositories/productRepository";
import { productSearchQuerySchema } from "@/server/validators/product";

/**
 * `searchProducts` accepteert een injecteerbare `db`, dus de opgebouwde
 * where-clause is testbaar zonder PostgreSQL. Dat de query ook echt rijen
 * oplevert, wordt gedekt door de integratietests (tests/integration/).
 */

const HIT: ProductSearchHit = {
  id: "prod_1",
  barcode: "4006381333931",
  name: "Testkoek",
  brandName: "Testmerk",
  imageUrl: null,
  halalStatus: "MUSHBOOH",
  confidenceLevel: "MEDIUM",
  lastAnalyzedAt: null,
};

/** Vorm van de argumenten die we in de assertions willen inspecteren. */
interface FindManyArgs {
  where?: { OR?: unknown[] };
  take?: number;
  skip?: number;
}

function fakeDb(hits: ProductSearchHit[] = [HIT], total = hits.length) {
  const findMany = vi.fn(async (_args: FindManyArgs) => hits);
  const count = vi.fn(async (_args: FindManyArgs) => total);
  return { db: { product: { findMany, count } } as unknown as Db, findMany, count };
}

describe("searchProducts", () => {
  it("zoekt op naam en merk, hoofdletterongevoelig", async () => {
    const { db, findMany } = fakeDb();
    await searchProducts({ query: "koek", limit: 20, offset: 0 }, db);

    const where = findMany.mock.calls[0]?.[0]?.where;
    expect(where?.OR).toEqual(
      expect.arrayContaining([
        { name: { contains: "koek", mode: "insensitive" } },
        { brandName: { contains: "koek", mode: "insensitive" } },
      ]),
    );
  });

  it("zoekt bij een cijferreeks ook op barcode-prefix", async () => {
    const { db, findMany } = fakeDb();
    await searchProducts({ query: "40063", limit: 20, offset: 0 }, db);

    const where = findMany.mock.calls[0]?.[0]?.where;
    expect(where?.OR).toEqual(
      expect.arrayContaining([{ barcode: { startsWith: "40063" } }]),
    );
  });

  it("zoekt niet op barcode bij een tekstuele term", async () => {
    const { db, findMany } = fakeDb();
    await searchProducts({ query: "nutella", limit: 20, offset: 0 }, db);

    const where = findMany.mock.calls[0]?.[0]?.where;
    const clauses = JSON.stringify(where?.OR);
    expect(clauses).not.toContain("barcode");
  });

  it("geeft paginering door aan de query", async () => {
    const { db, findMany } = fakeDb();
    await searchProducts({ query: "koek", limit: 10, offset: 30 }, db);

    expect(findMany.mock.calls[0]?.[0]?.take).toBe(10);
    expect(findMany.mock.calls[0]?.[0]?.skip).toBe(30);
  });

  it("geeft de resultaten en het totaal terug", async () => {
    const { db } = fakeDb([HIT], 42);
    const result = await searchProducts({ query: "koek", limit: 20, offset: 0 }, db);

    expect(result.hits).toHaveLength(1);
    expect(result.total).toBe(42);
  });

  it("trimt de zoekterm", async () => {
    const { db, findMany } = fakeDb();
    await searchProducts({ query: "  koek  ", limit: 20, offset: 0 }, db);

    const where = findMany.mock.calls[0]?.[0]?.where;
    expect(JSON.stringify(where)).toContain('"koek"');
    expect(JSON.stringify(where)).not.toContain('"  koek  "');
  });
});

describe("validatie van de zoekparameters", () => {
  it("weigert een te korte zoekterm", () => {
    expect(() => productSearchQuerySchema.parse({ q: "a" })).toThrow();
  });

  it("vult standaardwaarden aan voor limit en offset", () => {
    const parsed = productSearchQuerySchema.parse({ q: "koek" });
    expect(parsed.limit).toBe(20);
    expect(parsed.offset).toBe(0);
  });

  it("begrenst limit tot 50", () => {
    expect(() => productSearchQuerySchema.parse({ q: "koek", limit: "500" })).toThrow();
  });

  it("zet includeExternal om naar een boolean", () => {
    expect(productSearchQuerySchema.parse({ q: "koek" }).includeExternal).toBe(false);
    expect(
      productSearchQuerySchema.parse({ q: "koek", includeExternal: "true" })
        .includeExternal,
    ).toBe(true);
  });
});
