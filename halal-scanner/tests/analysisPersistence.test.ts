import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import {
  PrismaReferenceLoader,
  invalidateReferenceCache,
  isActiveCertificate,
  toCertificateEvidence,
} from "@/server/repositories/referenceRepository";
import { saveAnalysis, UNIQUE_VIOLATION } from "@/server/repositories/analysisRepository";
import { orderFindings } from "@/server/halal/engine/decide";
import { computeInputHash, ENGINE_VERSION } from "@/server/halal/engine";
import { resolveAnalysisInput } from "@/server/services/analysisService";
import type { AnalysisResult } from "@/server/halal/engine";
import type { IngredientFinding } from "@/types/halal";

/**
 * Geen database en geen netwerk: Prisma wordt vervangen door kleine fakes die
 * alleen de methodes hebben die deze code aanroept. Wat hier bewezen wordt zijn
 * de contracten van onze eigen laag; dat PostgreSQL de unique constraint
 * daadwerkelijk afdwingt hoort in de integratiesuite achter TEST_DATABASE_URL.
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- minimale Prisma-fakes */

describe("PrismaReferenceLoader", () => {
  beforeEach(() => invalidateReferenceCache());

  function fakeDb(overrides: Record<string, unknown> = {}) {
    return {
      ingredient: {
        findMany: vi.fn(async () => [
          {
            id: "ing-1",
            name: "Gelatine",
            normalizedName: "gelatine",
            defaultStatus: "MUSHBOOH",
            defaultConfidence: "MEDIUM",
            originRisk: "ANIMAL_POSSIBLE",
            eNumber: null,
            aliases: [{ alias: "gelatin" }, { alias: "e441" }],
            sources: [
              {
                source: {
                  id: "src-1",
                  name: "Interne regel",
                  organization: "Halal Scanner",
                  url: null,
                  sourceType: "INTERNAL_RULE",
                  lastVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
                },
              },
            ],
          },
        ]),
      },
      eNumber: {
        findMany: vi.fn(async () => [
          {
            id: "en-1",
            code: "E471",
            name: "mono- en diglyceriden",
            defaultStatus: "MUSHBOOH",
            defaultConfidence: "MEDIUM",
            originRisk: "ANIMAL_POSSIBLE",
            animalDerivedPossible: true,
            plantDerivedPossible: true,
            syntheticPossible: false,
            sources: [],
          },
        ]),
      },
      ...overrides,
    } as any;
  }

  it("laadt ingredienten met aliassen en bron", async () => {
    const db = fakeDb();
    const reference = await new PrismaReferenceLoader(db).load();

    expect(reference.ingredients).toHaveLength(1);
    expect(reference.ingredients[0]?.aliases).toEqual(["gelatin", "e441"]);
    expect(reference.ingredients[0]?.source?.isInternal).toBe(true);
    expect(reference.ingredients[0]?.source?.lastVerifiedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("laadt E-nummers", async () => {
    const reference = await new PrismaReferenceLoader(fakeDb()).load();
    expect(reference.eNumbers[0]?.code).toBe("E471");
    expect(reference.eNumbers[0]?.animalDerivedPossible).toBe(true);
  });

  it("doet één query per tabel, ongeacht het aantal ingredienten (geen N+1)", async () => {
    const db = fakeDb();
    await new PrismaReferenceLoader(db).load();

    expect(db.ingredient.findMany).toHaveBeenCalledTimes(1);
    expect(db.eNumber.findMany).toHaveBeenCalledTimes(1);
    // De aliassen komen mee in dezelfde query; er is geen aparte alias-tabel-call.
    expect(db.ingredient.findMany.mock.calls[0]?.[0]?.include?.aliases).toBeDefined();
  });

  it("hergebruikt de momentopname binnen de TTL", async () => {
    const db = fakeDb();
    const loader = new PrismaReferenceLoader(db);
    await loader.load();
    await loader.load();
    expect(db.ingredient.findMany).toHaveBeenCalledTimes(1);
  });
});

describe("certificaat-evidence", () => {
  const now = new Date("2026-08-07T12:00:00.000Z");

  function cert(over: Record<string, unknown> = {}) {
    return {
      id: "cert-1",
      certificateNumber: "HAL-1",
      certificationBodyId: "cb-1",
      certificationBody: { name: "Instituut", official: true },
      issuedAt: new Date("2026-01-01T00:00:00.000Z"),
      expiresAt: new Date("2027-01-01T00:00:00.000Z"),
      status: "VERIFIED",
      ...over,
    } as any;
  }

  it("VERIFIED en niet verlopen is geldig bewijs", () => {
    expect(isActiveCertificate("VERIFIED", new Date("2027-01-01T00:00:00.000Z"), now)).toBe(true);
    expect(toCertificateEvidence(cert(), now).isActive).toBe(true);
  });

  it("VERIFIED zonder einddatum blijft geldig", () => {
    expect(isActiveCertificate("VERIFIED", null, now)).toBe(true);
  });

  it("VERIFIED maar verlopen is géén geldig bewijs", () => {
    expect(isActiveCertificate("VERIFIED", new Date("2020-01-01T00:00:00.000Z"), now)).toBe(false);
    const evidence = toCertificateEvidence(cert({ expiresAt: new Date("2020-01-01") }), now);
    expect(evidence.isActive).toBe(false);
    // Het certificaat verdwijnt niet: de UI moet "verlopen" kunnen tonen.
    expect(evidence.status).toBe("VERIFIED");
  });

  it("PENDING, COMMUNITY_REVIEWED en REJECTED tellen niet als geverifieerd", () => {
    for (const status of ["PENDING", "COMMUNITY_REVIEWED", "REJECTED", "EXPIRED"] as const) {
      expect(isActiveCertificate(status, null, now)).toBe(false);
    }
  });
});

describe("inputHash", () => {
  const base = {
    parsedIngredients: [
      { rawName: "Suiker", normalizedName: "suiker", position: 0, quantityText: null, eNumberCode: null },
    ],
    hasIngredientsText: true,
    certificates: [],
  };

  it("is stabiel bij identieke input", () => {
    expect(computeInputHash(base)).toBe(computeInputHash({ ...base }));
  });

  it("verandert bij een gewijzigd ingredient", () => {
    const changed = {
      ...base,
      parsedIngredients: [{ ...base.parsedIngredients[0]!, normalizedName: "gelatine" }],
    };
    expect(computeInputHash(changed)).not.toBe(computeInputHash(base));
  });

  it("verandert bij een gewijzigd E-nummer, ook bij dezelfde naam", () => {
    const withCode = {
      ...base,
      parsedIngredients: [{ ...base.parsedIngredients[0]!, eNumberCode: "E471" }],
    };
    expect(computeInputHash(withCode)).not.toBe(computeInputHash(base));
  });

  it("verandert wanneer een certificaat vervalt", () => {
    const active = {
      ...base,
      certificates: [{ certificateId: "c1", isActive: true } as any],
    };
    const expired = {
      ...base,
      certificates: [{ certificateId: "c1", isActive: false } as any],
    };
    expect(computeInputHash(active)).not.toBe(computeInputHash(expired));
  });

  it("is onafhankelijk van de volgorde waarin certificaten binnenkomen", () => {
    const a = {
      ...base,
      certificates: [{ certificateId: "a", isActive: true }, { certificateId: "b", isActive: false }] as any,
    };
    const b = {
      ...base,
      certificates: [{ certificateId: "b", isActive: false }, { certificateId: "a", isActive: true }] as any,
    };
    expect(computeInputHash(a)).toBe(computeInputHash(b));
  });

  it("negeert het verschil tussen 'lege lijst' en 'geen lijst' niet", () => {
    const geenLijst = { ...base, parsedIngredients: [], hasIngredientsText: false };
    const legeLijst = { ...base, parsedIngredients: [], hasIngredientsText: true };
    expect(computeInputHash(geenLijst)).not.toBe(computeInputHash(legeLijst));
  });
});

describe("resolveAnalysisInput", () => {
  it("gebruikt de ruwe etikettekst wanneer die er is", () => {
    const result = resolveAnalysisInput({
      ingredientsRaw: "Suiker, water",
      ingredients: [],
    } as any);
    expect(result.hasIngredientsText).toBe(true);
    expect(result.parsedIngredients.map((i) => i.normalizedName)).toEqual(["suiker", "water"]);
  });

  it("valt terug op de opgeslagen rijen wanneer ruwe tekst ontbreekt", () => {
    const result = resolveAnalysisInput({
      ingredientsRaw: null,
      ingredients: [
        { rawName: "Water", normalizedName: "water", position: 1, quantityText: null },
        { rawName: "Suiker", normalizedName: "suiker", position: 0, quantityText: null },
      ],
    } as any);
    expect(result.hasIngredientsText).toBe(true);
    // Etiketvolgorde blijft behouden: die draagt betekenis (afnemend gewicht).
    expect(result.parsedIngredients.map((i) => i.normalizedName)).toEqual(["suiker", "water"]);
  });

  it("meldt eerlijk dat er geen lijst is", () => {
    const result = resolveAnalysisInput({ ingredientsRaw: null, ingredients: [] } as any);
    expect(result.hasIngredientsText).toBe(false);
    expect(result.parsedIngredients).toEqual([]);
  });

  it("bewaart onbekende ingredienten in plaats van ze weg te laten", () => {
    const result = resolveAnalysisInput({
      ingredientsRaw: "emulgator van plantaardige en dierlijke vetzuren, suiker",
      ingredients: [],
    } as any);
    // Ook zonder match in de referentietabel blijft de ruwe én genormaliseerde
    // naam beschikbaar; de UI moet hem kunnen tonen.
    expect(result.parsedIngredients.length).toBeGreaterThanOrEqual(2);
    expect(result.parsedIngredients[0]?.rawName.length).toBeGreaterThan(0);
    expect(result.parsedIngredients[0]?.normalizedName.length).toBeGreaterThan(0);
  });
});

describe("finding-volgorde", () => {
  function finding(over: Partial<IngredientFinding>): IngredientFinding {
    return {
      findingType: "HALAL_INGREDIENT",
      status: "LIKELY_HALAL",
      confidence: "HIGH",
      label: "x",
      rawLabel: null,
      reason: "r",
      ingredientId: null,
      eNumberId: null,
      eNumberCode: null,
      source: null,
      ...over,
    } as IngredientFinding;
  }

  it("zet conflict, haram en certificaat vooraan en positieve bevindingen achteraan", () => {
    const ordered = orderFindings([
      finding({ findingType: "HALAL_INGREDIENT", label: "suiker" }),
      finding({ findingType: "UNKNOWN_INGREDIENT", status: "UNKNOWN", label: "onbekend" }),
      finding({ findingType: "CERTIFICATE", status: "CERTIFIED_HALAL", label: "cert" }),
      finding({ findingType: "HARAM_INGREDIENT", status: "HARAM", label: "varkensgelatine" }),
      finding({ findingType: "CONFLICT", status: "MUSHBOOH", label: "conflict" }),
    ]);

    expect(ordered.map((f) => f.findingType)).toEqual([
      "CONFLICT",
      "HARAM_INGREDIENT",
      "CERTIFICATE",
      "UNKNOWN_INGREDIENT",
      "HALAL_INGREDIENT",
    ]);
  });

  it("is stabiel: dezelfde input geeft dezelfde volgorde", () => {
    const input = [
      finding({ findingType: "MUSHBOOH_INGREDIENT", status: "MUSHBOOH", label: "a" }),
      finding({ findingType: "MUSHBOOH_INGREDIENT", status: "MUSHBOOH", label: "b" }),
      finding({ findingType: "MUSHBOOH_INGREDIENT", status: "MUSHBOOH", label: "c" }),
    ];
    expect(orderFindings(input).map((f) => f.label)).toEqual(
      orderFindings(input).map((f) => f.label),
    );
    // Bij gelijke rang en ernst blijft de etiketvolgorde staan.
    expect(orderFindings(input).map((f) => f.label)).toEqual(["a", "b", "c"]);
  });
});

describe("saveAnalysis - transactie en gelijktijdigheid", () => {
  const analysis: AnalysisResult = {
    status: "MUSHBOOH",
    confidence: "MEDIUM",
    summary: "samenvatting",
    findings: [],
    certificateEvidence: [],
    sources: [],
    hasConflict: false,
    needsHumanReview: false,
    engineVersion: ENGINE_VERSION,
    analyzedAt: "2026-08-07T12:00:00.000Z",
    inputHash: "hash-1",
    productRevisionId: null,
  };

  it("schrijft analyse, findings en statuscache in één transactie", async () => {
    // Parameters expliciet declareren, anders typeert TypeScript het
    // aanroeptupel als `[]` en is `mock.calls[0][0]` niet te lezen.
    const productUpdate = vi.fn(async (_args: { data: { halalStatus: string } }) => ({}));
    const create = vi.fn(async () => ({ id: "an-1", findings: [] }));

    const db = {
      $transaction: vi.fn(async (fn: any) =>
        fn({ productAnalysis: { create }, product: { update: productUpdate } }),
      ),
    } as any;

    const result = await saveAnalysis({ productId: "p1", analysis }, db);

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
    // De cache-update zit binnen dezelfde transactie: analyse en cache kunnen
    // niet uit elkaar lopen.
    expect(productUpdate).toHaveBeenCalledTimes(1);
    expect(productUpdate.mock.calls[0]?.[0]?.data?.halalStatus).toBe("MUSHBOOH");
    expect(result.reused).toBe(false);
  });

  it("rolt alles terug wanneer de cache-update faalt", async () => {
    const db = {
      $transaction: vi.fn(async (fn: any) =>
        fn({
          productAnalysis: { create: vi.fn(async () => ({ id: "an-1", findings: [] })) },
          product: { update: vi.fn(async () => { throw new Error("cache-update mislukt"); }) },
        }),
      ),
    } as any;

    await expect(saveAnalysis({ productId: "p1", analysis }, db)).rejects.toThrow(
      "cache-update mislukt",
    );
  });

  it("maakt geen tweede record wanneer een gelijktijdige request net eerder was", async () => {
    const existing = { id: "an-bestaand", findings: [] };

    const db = {
      $transaction: vi.fn(async () => {
        throw new Prisma.PrismaClientKnownRequestError("unique", {
          code: UNIQUE_VIOLATION,
          clientVersion: "test",
        });
      }),
      productAnalysis: { findUnique: vi.fn(async () => existing) },
    } as any;

    const result = await saveAnalysis({ productId: "p1", analysis }, db);

    // De verliezer van de race maakt geen duplicaat maar leest de winnaar terug.
    expect(result.reused).toBe(true);
    expect(result.analysis.id).toBe("an-bestaand");
    expect(db.productAnalysis.findUnique).toHaveBeenCalledTimes(1);
  });

  it("laat een andere databasefout wél doorkomen", async () => {
    const db = {
      $transaction: vi.fn(async () => {
        throw new Error("verbinding weg");
      }),
    } as any;

    await expect(saveAnalysis({ productId: "p1", analysis }, db)).rejects.toThrow("verbinding weg");
  });
});
