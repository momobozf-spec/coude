import { describe, expect, it } from "vitest";
import {
  ENGINE_VERSION,
  analyzeIngredients,
  collectEvidence,
  computeInputHash,
  decide,
  interpret,
  type EvidenceInput,
  type HalalReference,
} from "@/server/halal/engine";
import { pickMostSpecific } from "@/server/halal/engine/interpret";
import { summarizeIngredientStatus } from "@/server/halal/engine/decide";
import type { IngredientReference, ENumberReference } from "@/server/halal/engine/types";
import type { CertificateEvidence } from "@/types/halal";
import type { ParsedIngredient } from "@/types/product";

/**
 * De engine raakt geen database en geen netwerk: de referentiedata wordt hier
 * als gewone objecten aangeleverd. Daardoor testen deze tests de beslisregels
 * zelf, en niet de infrastructuur eromheen.
 */

function ingredient(over: Partial<IngredientReference> & { normalizedName: string }): IngredientReference {
  return {
    id: `ing-${over.normalizedName}`,
    name: over.normalizedName,
    defaultStatus: "LIKELY_HALAL",
    defaultConfidence: "HIGH",
    originRisk: "NONE",
    eNumberCode: null,
    aliases: [],
    source: null,
    ...over,
  };
}

function eNumber(over: Partial<ENumberReference> & { code: string }): ENumberReference {
  return {
    id: `en-${over.code}`,
    name: over.code,
    defaultStatus: "MUSHBOOH",
    defaultConfidence: "MEDIUM",
    originRisk: "ANIMAL_POSSIBLE",
    animalDerivedPossible: true,
    plantDerivedPossible: true,
    syntheticPossible: false,
    source: null,
    ...over,
  };
}

const REFERENCE: HalalReference = {
  ingredients: [
    ingredient({ normalizedName: "suiker" }),
    ingredient({ normalizedName: "water" }),
    ingredient({
      normalizedName: "gelatine",
      name: "gelatine",
      defaultStatus: "MUSHBOOH",
      defaultConfidence: "MEDIUM",
      originRisk: "ANIMAL_POSSIBLE",
    }),
    ingredient({
      normalizedName: "varkensgelatine",
      name: "varkensgelatine",
      defaultStatus: "HARAM",
      defaultConfidence: "HIGH",
      originRisk: "ANIMAL_CERTAIN",
      aliases: ["porcine gelatine", "gelatine van varken"],
      source: {
        id: "src-1",
        name: "Interne regel",
        organization: "Halal Scanner",
        url: null,
        sourceType: "INTERNAL_RULE",
        isInternal: true,
        lastVerifiedAt: null,
      },
    }),
    ingredient({
      normalizedName: "alcohol",
      name: "alcohol",
      defaultStatus: "LIKELY_HARAM",
      defaultConfidence: "MEDIUM",
      originRisk: "ALCOHOL_RELATED",
    }),
  ],
  eNumbers: [eNumber({ code: "E471", name: "mono- en diglyceriden van vetzuren" })],
};

function parsed(name: string, eNumberCode: string | null = null): ParsedIngredient {
  return {
    rawName: name,
    normalizedName: name.toLowerCase(),
    eNumberCode,
    position: 0,
  } as ParsedIngredient;
}

function certificate(over: Partial<CertificateEvidence> = {}): CertificateEvidence {
  return {
    certificateId: "cert-1",
    certificateNumber: "HAL-2026-001",
    certificationBodyName: "Voorbeeld Halal Instituut",
    certificationBodyOfficial: true,
    issuedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2027-01-01T00:00:00.000Z",
    isActive: true,
    status: "VERIFIED",
    ...over,
  };
}

function analyze(
  ingredients: ParsedIngredient[],
  certificates: CertificateEvidence[] = [],
  hasIngredientsText = true,
) {
  const input: EvidenceInput = { parsedIngredients: ingredients, hasIngredientsText, certificates };
  return analyzeIngredients(input, REFERENCE, { now: new Date("2026-08-07T12:00:00.000Z") });
}

describe("stap 1 - evidence bevat feiten, geen oordeel", () => {
  it("levert alle matches op en kiest er zelf geen", () => {
    // "gelatine van varken" is een alias van het HARAM-record én bevat
    // "gelatine" als los woord, dus beide records slaan aan.
    const evidence = collectEvidence(
      { parsedIngredients: [parsed("gelatine van varken")], hasIngredientsText: true, certificates: [] },
      REFERENCE,
    );

    const names = evidence.tokens[0]?.ingredientMatches.map((m) => m.reference.normalizedName) ?? [];
    expect(names).toContain("varkensgelatine");
    expect(names).toContain("gelatine");
    // De verzamelstap spreekt geen voorkeur uit; dat doet stap 2.
    expect(names.length).toBeGreaterThan(1);
  });

  it("matcht 'gelatine' niet binnen het woord 'varkensgelatine'", () => {
    // Woordgrens: anders zou elke samenstelling ook het algemene record raken
    // en zou de langste-match-regel op toeval gaan lijken.
    const evidence = collectEvidence(
      { parsedIngredients: [parsed("varkensgelatine")], hasIngredientsText: true, certificates: [] },
      REFERENCE,
    );
    const names = evidence.tokens[0]?.ingredientMatches.map((m) => m.reference.normalizedName) ?? [];
    expect(names).toEqual(["varkensgelatine"]);
  });

  it("matcht een samenstelling op woordgrens", () => {
    const evidence = collectEvidence(
      { parsedIngredients: [parsed("runder gelatine")], hasIngredientsText: true, certificates: [] },
      REFERENCE,
    );
    expect(evidence.tokens[0]?.ingredientMatches.some((m) => m.reference.normalizedName === "gelatine")).toBe(true);
  });
});

describe("stap 2 - interpretatie per ingredient", () => {
  it("laat de specifiekste match winnen", () => {
    const result = analyze([parsed("varkensgelatine")]);
    const finding = result.findings.find((f) => f.label === "varkensgelatine");
    expect(finding?.status).toBe("HARAM");
    expect(finding?.findingType).toBe("HARAM_INGREDIENT");
  });

  it("kiest deterministisch bij gelijke lengte", () => {
    const a = { ...ingredient({ normalizedName: "xx" }), id: "b" };
    const b = { ...ingredient({ normalizedName: "xx" }), id: "a" };
    const first = pickMostSpecific([
      { token: "xx", rawToken: "xx", matchedText: "xx", matchKind: "exact", reference: a },
      { token: "xx", rawToken: "xx", matchedText: "xx", matchKind: "exact", reference: b },
    ]);
    const second = pickMostSpecific([
      { token: "xx", rawToken: "xx", matchedText: "xx", matchKind: "exact", reference: b },
      { token: "xx", rawToken: "xx", matchedText: "xx", matchKind: "exact", reference: a },
    ]);
    expect(first?.reference.id).toBe(second?.reference.id);
  });

  it("laat een vermelde plantaardige herkomst de standaard overrulen", () => {
    const result = analyze([parsed("plantaardige gelatine")]);
    const finding = result.findings[0];
    expect(finding?.status).toBe("LIKELY_HALAL");
    expect(finding?.reason).toContain("plantaardige herkomst");
  });

  it("markeert een onbekend ingredient als UNKNOWN in plaats van te gokken", () => {
    const result = analyze([parsed("suiker"), parsed("mysterieuze stof")]);
    const unknown = result.findings.find((f) => f.label === "mysterieuze stof");
    expect(unknown?.status).toBe("UNKNOWN");
    expect(unknown?.findingType).toBe("UNKNOWN_INGREDIENT");
  });

  it("behandelt een E-nummer via het E-nummerrecord", () => {
    const result = analyze([parsed("E471", "E471")]);
    expect(result.findings[0]?.findingType).toBe("E_NUMBER");
    expect(result.findings[0]?.eNumberCode).toBe("E471");
    expect(result.status).toBe("MUSHBOOH");
  });

  it("geeft MISSING_DATA en UNKNOWN zonder ingredientenlijst", () => {
    const result = analyze([], [], false);
    expect(result.status).toBe("UNKNOWN");
    expect(result.findings[0]?.findingType).toBe("MISSING_DATA");
  });
});

describe("stap 3 - samenvoegen: de laagste status wint", () => {
  it("HARAM overstemt alles", () => {
    expect(analyze([parsed("suiker"), parsed("varkensgelatine"), parsed("water")]).status).toBe("HARAM");
  });

  it("LIKELY_HARAM wint van MUSHBOOH", () => {
    expect(analyze([parsed("gelatine"), parsed("alcohol")]).status).toBe("LIKELY_HARAM");
  });

  it("MUSHBOOH wint van onbekend", () => {
    expect(analyze([parsed("gelatine"), parsed("iets onbekends")]).status).toBe("MUSHBOOH");
  });

  it("alles bekend en onproblematisch is LIKELY_HALAL met hoge zekerheid", () => {
    const result = analyze([parsed("suiker"), parsed("water")]);
    expect(result.status).toBe("LIKELY_HALAL");
    expect(result.confidence).toBe("HIGH");
  });

  it("veel onbekende ingredienten maakt het MUSHBOOH", () => {
    const result = analyze([parsed("suiker"), parsed("onbekend a"), parsed("onbekend b")]);
    expect(result.status).toBe("MUSHBOOH");
  });

  it("een enkel onbekend ingredient verlaagt alleen de zekerheid", () => {
    const many = Array.from({ length: 19 }, (_v, i) => parsed(i % 2 === 0 ? "suiker" : "water"));
    const result = analyze([...many, parsed("onbekend")]);
    expect(result.status).toBe("LIKELY_HALAL");
    expect(result.confidence).toBe("MEDIUM");
  });

  it("summarizeIngredientStatus kent certificaten niet", () => {
    const evidence = collectEvidence(
      { parsedIngredients: [parsed("varkensgelatine")], hasIngredientsText: true, certificates: [certificate()] },
      REFERENCE,
    );
    // Zelfs met een geldig certificaat in de evidence blijft de ingredienten-
    // uitkomst HARAM; combineren gebeurt pas in decide().
    expect(summarizeIngredientStatus(interpret(evidence)).status).toBe("HARAM");
  });
});

describe("certificaten", () => {
  it("een actief certificaat levert CERTIFIED_HALAL op", () => {
    const result = analyze([parsed("suiker")], [certificate()]);
    expect(result.status).toBe("CERTIFIED_HALAL");
    expect(result.confidence).toBe("HIGH");
    expect(result.hasConflict).toBe(false);
  });

  it("een niet-actief certificaat telt niet mee", () => {
    const result = analyze([parsed("suiker")], [certificate({ isActive: false, status: "PENDING" })]);
    expect(result.status).toBe("LIKELY_HALAL");
  });

  it("een verlopen certificaat telt niet mee", () => {
    const result = analyze(
      [parsed("suiker")],
      [certificate({ isActive: false, status: "EXPIRED", expiresAt: "2020-01-01T00:00:00.000Z" })],
    );
    expect(result.status).toBe("LIKELY_HALAL");
  });

  it("een certificaat naast twijfelgevallen blijft CERTIFIED_HALAL, maar met MEDIUM", () => {
    const result = analyze([parsed("gelatine")], [certificate()]);
    expect(result.status).toBe("CERTIFIED_HALAL");
    expect(result.confidence).toBe("MEDIUM");
    expect(result.hasConflict).toBe(false);
    // De twijfel blijft zichtbaar: het certificaat maakt hem niet onzichtbaar.
    expect(result.findings.some((f) => f.status === "MUSHBOOH")).toBe(true);
  });
});

describe("conflict: certificaat versus expliciet haram ingredient", () => {
  it("eindigt NOOIT als CERTIFIED_HALAL", () => {
    const result = analyze([parsed("suiker"), parsed("varkensgelatine")], [certificate()]);

    expect(result.status).not.toBe("CERTIFIED_HALAL");
    expect(result.status).toBe("MUSHBOOH");
    expect(result.hasConflict).toBe(true);
    expect(result.needsHumanReview).toBe(true);
  });

  it("maakt het conflict expliciet zichtbaar als bevinding", () => {
    const result = analyze([parsed("varkensgelatine")], [certificate()]);
    const conflict = result.findings.find((f) => f.findingType === "CONFLICT");

    expect(conflict).toBeDefined();
    expect(conflict?.reason).toContain("spreken elkaar tegen");
    expect(conflict?.reason).toContain("varkensgelatine");
    // Het conflict staat bovenaan: dit is het eerste wat de gebruiker moet zien.
    expect(result.findings[0]?.findingType).toBe("CONFLICT");
    expect(result.summary).toContain("moderator");
  });

  it("geldt ook bij LIKELY_HARAM", () => {
    const result = analyze([parsed("alcohol")], [certificate()]);
    expect(result.status).toBe("MUSHBOOH");
    expect(result.hasConflict).toBe(true);
    expect(result.needsHumanReview).toBe(true);
  });

  it("de haram-bevinding zelf blijft bewaard naast het conflict", () => {
    const result = analyze([parsed("varkensgelatine")], [certificate()]);
    expect(result.findings.some((f) => f.status === "HARAM")).toBe(true);
  });
});

describe("determinisme en herkomst", () => {
  it("levert bij dezelfde invoer exact dezelfde uitkomst", () => {
    const input = [parsed("suiker"), parsed("gelatine"), parsed("onbekend")];
    const first = analyze(input);
    const second = analyze(input);

    expect(second.status).toBe(first.status);
    expect(second.confidence).toBe(first.confidence);
    expect(second.inputHash).toBe(first.inputHash);
    expect(second.findings.map((f) => f.label)).toEqual(first.findings.map((f) => f.label));
  });

  it("verandert de hash zodra een certificaat vervalt", () => {
    const base: EvidenceInput = {
      parsedIngredients: [parsed("suiker")],
      hasIngredientsText: true,
      certificates: [certificate()],
    };
    const expired: EvidenceInput = {
      ...base,
      certificates: [certificate({ isActive: false })],
    };
    expect(computeInputHash(base)).not.toBe(computeInputHash(expired));
  });

  it("vermeldt de engineversie en de bronnen achter de bevindingen", () => {
    const result = analyze([parsed("varkensgelatine")]);
    expect(result.engineVersion).toBe(ENGINE_VERSION);
    expect(result.sources.map((s) => s.id)).toContain("src-1");
    expect(result.sources[0]?.isInternal).toBe(true);
  });

  it("decide() is puur: geen mutatie van de interpretatie", () => {
    const evidence = collectEvidence(
      { parsedIngredients: [parsed("varkensgelatine")], hasIngredientsText: true, certificates: [certificate()] },
      REFERENCE,
    );
    const interpretation = interpret(evidence);
    const before = interpretation.findings.length;
    decide(interpretation, evidence.certificates);
    expect(interpretation.findings).toHaveLength(before);
  });
});
