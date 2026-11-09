import { describe, expect, it } from "vitest";
import {
  canAnalyze,
  ingredientScanAnnouncement,
  ingredientScanReducer,
  initialIngredientScanState,
  isBusy,
  type IngredientScanAction,
  type IngredientScanState,
} from "@/components/scan/ingredients/ingredientScanReducer";
import type { AnalysisDto } from "@/server/services/analysisPresenter";

const ANALYSIS = {
  id: "",
  status: "MUSHBOOH",
  statusLabel: "Twijfelachtig (mushbooh)",
  statusDescription: "…",
  statusIcon: "alert-triangle",
  statusTone: "caution",
  confidence: "MEDIUM",
  summary: "…",
  hasConflict: false,
  needsHumanReview: false,
  engineVersion: "halal-engine@1",
  analyzedAt: "2026-08-07T12:00:00.000Z",
  findings: [],
} satisfies AnalysisDto;

const IMAGE = { previewUrl: "blob:preview", fileName: "achterkant.jpg", sizeBytes: 1024 };

function reduce(state: IngredientScanState, ...actions: IngredientScanAction[]): IngredientScanState {
  return actions.reduce(ingredientScanReducer, state);
}

const afterOcr = reduce(
  initialIngredientScanState,
  { type: "IMAGE_SELECTED", image: IMAGE },
  { type: "OCR_STARTED" },
  {
    type: "OCR_SUCCEEDED",
    text: "suiker, geiatine, aroma",
    confidence: 0.42,
    lowConfidence: true,
    warnings: ["De afbeelding is onscherp."],
  },
);

describe("begintoestand", () => {
  it("start leeg en niet bezig", () => {
    expect(initialIngredientScanState.status).toBe("IDLE");
    expect(isBusy(initialIngredientScanState)).toBe(false);
    expect(canAnalyze(initialIngredientScanState)).toBe(false);
  });
});

describe("afbeelding kiezen", () => {
  it("bewaart de preview en bijbehorende gegevens", () => {
    const state = ingredientScanReducer(initialIngredientScanState, {
      type: "IMAGE_SELECTED",
      image: IMAGE,
    });
    expect(state.status).toBe("IMAGE_SELECTED");
    expect(state.image?.previewUrl).toBe("blob:preview");
  });

  it("behoudt tekst die de gebruiker al had ingetypt", () => {
    const typed = reduce(initialIngredientScanState, { type: "TEXT_CHANGED", text: "suiker, cacao" });
    const withImage = ingredientScanReducer(typed, { type: "IMAGE_SELECTED", image: IMAGE });
    // Wie eerst typt en daarna alsnog een foto kiest, verliest zijn werk niet.
    expect(withImage.text).toBe("suiker, cacao");
  });

  it("bewaart een afgekeurd bestand niet als afbeelding", () => {
    const state = ingredientScanReducer(initialIngredientScanState, {
      type: "IMAGE_REJECTED",
      problem: "TOO_LARGE",
      message: "te groot",
    });
    expect(state.image).toBeNull();
    expect(state.ocrProblem).toBe("TOO_LARGE");
  });
});

describe("tekstherkenning", () => {
  it("is bezig tijdens OCR en blokkeert de analyseknop", () => {
    const state = reduce(
      initialIngredientScanState,
      { type: "IMAGE_SELECTED", image: IMAGE },
      { type: "OCR_STARTED" },
    );
    expect(state.status).toBe("PROCESSING_OCR");
    expect(isBusy(state)).toBe(true);
    expect(canAnalyze(state)).toBe(false);
  });

  it("gaat na OCR naar controleren en NIET rechtstreeks naar analyseren", () => {
    // De kern van deze fase: OCR-output wordt nooit automatisch beoordeeld.
    expect(afterOcr.status).toBe("REVIEWING_TEXT");
    expect(afterOcr.analysis).toBeNull();
  });

  it("neemt zekerheid en waarschuwingen over", () => {
    expect(afterOcr.confidence).toBe(0.42);
    expect(afterOcr.lowConfidence).toBe(true);
    expect(afterOcr.warnings).toEqual(["De afbeelding is onscherp."]);
  });

  it("markeert een correctie door de gebruiker", () => {
    const corrected = ingredientScanReducer(afterOcr, {
      type: "TEXT_CHANGED",
      text: "suiker, gelatine, aroma",
    });
    expect(corrected.text).toBe("suiker, gelatine, aroma");
    expect(corrected.textEdited).toBe(true);
  });

  it("bewaart per fout een eigen oorzaak", () => {
    for (const problem of ["NO_TEXT", "PROVIDER_UNAVAILABLE", "NETWORK_ERROR"] as const) {
      const state = ingredientScanReducer(initialIngredientScanState, {
        type: "OCR_FAILED",
        problem,
        message: "…",
        retryable: problem !== "NO_TEXT",
      });
      expect(state.status).toBe("OCR_FAILED");
      expect(state.ocrProblem).toBe(problem);
    }
  });
});

describe("handmatige invoer", () => {
  it("blijft bereikbaar nadat OCR faalde", () => {
    const failed = ingredientScanReducer(initialIngredientScanState, {
      type: "OCR_FAILED",
      problem: "PROVIDER_UNAVAILABLE",
      message: "dienst plat",
      retryable: true,
    });

    const manual = ingredientScanReducer(failed, { type: "MANUAL_ENTRY_STARTED" });

    expect(manual.status).toBe("REVIEWING_TEXT");
    expect(manual.ocrProblem).toBeNull();
    expect(manual.error).toBeNull();
  });

  it("laat geen zekerheid van een eerdere OCR staan", () => {
    const manual = ingredientScanReducer(afterOcr, { type: "MANUAL_ENTRY_STARTED" });
    expect(manual.confidence).toBeNull();
    expect(manual.lowConfidence).toBe(false);
    expect(manual.warnings).toEqual([]);
  });
});

describe("analyse", () => {
  it("start alleen wanneer er tekst is", () => {
    const empty = reduce(initialIngredientScanState, { type: "MANUAL_ENTRY_STARTED" });
    expect(canAnalyze(empty)).toBe(false);
    // De actie wordt genegeerd in plaats van een lege analyse te starten.
    expect(ingredientScanReducer(empty, { type: "ANALYSIS_REQUESTED" })).toBe(empty);
  });

  it("gaat naar bezig en daarna naar het resultaat", () => {
    const analyzing = ingredientScanReducer(afterOcr, { type: "ANALYSIS_REQUESTED" });
    expect(analyzing.status).toBe("ANALYZING");
    expect(isBusy(analyzing)).toBe(true);

    const done = ingredientScanReducer(analyzing, { type: "ANALYSIS_SUCCEEDED", analysis: ANALYSIS });
    expect(done.status).toBe("ANALYSIS_SUCCESS");
    expect(done.analysis).toBe(ANALYSIS);
  });

  it("laat de tekst staan wanneer de analyse faalt, zodat opnieuw proberen kan", () => {
    const failed = reduce(
      afterOcr,
      { type: "ANALYSIS_REQUESTED" },
      { type: "ANALYSIS_FAILED", message: "server plat", retryable: true },
    );

    expect(failed.status).toBe("ANALYSIS_FAILED");
    expect(failed.text).toBe("suiker, geiatine, aroma");
    expect(canAnalyze(failed)).toBe(true);
  });
});

describe("opnieuw beginnen", () => {
  it("zet alles terug naar de begintoestand", () => {
    const done = reduce(
      afterOcr,
      { type: "ANALYSIS_REQUESTED" },
      { type: "ANALYSIS_SUCCEEDED", analysis: ANALYSIS },
      { type: "RESET" },
    );
    expect(done).toEqual(initialIngredientScanState);
  });
});

describe("aankondigingen voor screenreaders", () => {
  it("meldt elke betekenisvolle toestand", () => {
    expect(ingredientScanAnnouncement(afterOcr)).toMatch(/niet volledig betrouwbaar/i);

    const analyzing = ingredientScanReducer(afterOcr, { type: "ANALYSIS_REQUESTED" });
    expect(ingredientScanAnnouncement(analyzing)).toMatch(/geanalyseerd/i);

    const done = ingredientScanReducer(analyzing, { type: "ANALYSIS_SUCCEEDED", analysis: ANALYSIS });
    expect(ingredientScanAnnouncement(done)).toContain("Twijfelachtig");
  });
});
