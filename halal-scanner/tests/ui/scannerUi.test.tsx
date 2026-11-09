// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ManualBarcodeInput, looksLikeBarcode } from "@/components/scan/ManualBarcodeInput";
import { StatusBanner } from "@/components/product/StatusBanner";
import { AnalysisFindingList } from "@/components/product/AnalysisFindingCard";
import { ProductResult } from "@/components/product/ProductResult";
import { cameraMessage } from "@/components/scan/cameraMessages";
import { classifyCameraError, detectEnvironmentProblem } from "@/components/scan/useBarcodeScanner";
import type { AnalysisDto } from "@/server/services/analysisPresenter";
import type { BarcodeLookupResult } from "@/lib/client/apiClient";

afterEach(cleanup);

/** next/image werkt niet in jsdom; een gewone img is voor deze tests genoeg. */
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt } = props as { src: string; alt: string };
    // eslint-disable-next-line @next/next/no-img-element -- testvervanger
    return <img src={src} alt={alt} />;
  },
}));

function analysis(over: Partial<AnalysisDto> = {}): AnalysisDto {
  return {
    id: "an-1",
    status: "MUSHBOOH",
    statusLabel: "Twijfelachtig (mushbooh)",
    statusDescription: "Van een of meer ingredienten is de herkomst niet vast te stellen.",
    statusIcon: "alert-triangle",
    statusTone: "caution",
    confidence: "MEDIUM",
    summary: "Van 1 van de 3 ingrediënten is de herkomst niet vast te stellen.",
    hasConflict: false,
    needsHumanReview: false,
    engineVersion: "halal-engine@1",
    analyzedAt: "2026-08-07T12:00:00.000Z",
    findings: [],
    ...over,
  };
}

function lookupResult(over: Partial<BarcodeLookupResult> = {}): BarcodeLookupResult {
  return {
    product: {
      id: "p1",
      barcode: "5411234567890",
      name: "Testkoek",
      brandName: "Testmerk",
      imageUrl: null,
      halalStatus: "MUSHBOOH",
      halalStatusLabel: "Twijfelachtig (mushbooh)",
      confidenceLevel: "MEDIUM",
      lastAnalyzedAt: null,
      ingredientsRaw: "Suiker, E471, aroma",
      ingredientsLang: "nl",
      ingredientsOrigin: "OPEN_FOOD_FACTS",
      ingredients: [
        {
          rawName: "Suiker",
          normalizedName: "suiker",
          position: 0,
          quantityText: null,
          origin: "OPEN_FOOD_FACTS",
          matchedIngredient: { id: "i1", name: "suiker", defaultStatus: "LIKELY_HALAL" },
        },
        {
          rawName: "aroma",
          normalizedName: "aroma",
          position: 1,
          quantityText: null,
          origin: "OPEN_FOOD_FACTS",
          matchedIngredient: null,
        },
      ],
      categories: [],
      labels: [],
      countries: [],
      allergens: [],
      needsHumanReview: false,
      analysisVersion: "halal-engine@1",
      revision: 1,
      provenance: {
        externalSource: "OPEN_FOOD_FACTS",
        externalId: "5411234567890",
        externalUpdatedAt: null,
        lastSyncedAt: "2026-08-07T10:00:00.000Z",
        sourceConfidence: "MEDIUM",
      },
    },
    analysis: analysis(),
    analysisStatus: "OK",
    cached: false,
    provider: "Open Food Facts",
    ...over,
  } as BarcodeLookupResult;
}

describe("handmatige barcode-invoer", () => {
  it("accepteert een plausibele barcode en geeft hem door", async () => {
    const onSubmit = vi.fn();
    render(<ManualBarcodeInput onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/barcode handmatig invoeren/i), "5411234567890");
    await userEvent.click(screen.getByRole("button", { name: /zoeken/i }));

    expect(onSubmit).toHaveBeenCalledWith("5411234567890");
  });

  it("weigert letters en meldt dat begrijpelijk", async () => {
    const onSubmit = vi.fn();
    render(<ManualBarcodeInput onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/barcode handmatig invoeren/i), "abc");
    await userEvent.click(screen.getByRole("button", { name: /zoeken/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/8 tot 14 cijfers/i);
  });

  it("koppelt de foutmelding aan het invoerveld", async () => {
    render(<ManualBarcodeInput onSubmit={vi.fn()} />);
    const input = screen.getByLabelText(/barcode handmatig invoeren/i);

    await userEvent.type(input, "12");
    await userEvent.click(screen.getByRole("button", { name: /zoeken/i }));

    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toContain("error");
  });

  it("doet alleen een vormcontrole, geen checksum", () => {
    // 13 cijfers met een foute checksum: de UI laat dit door, de backend wijst
    // het af. Twee checksum-implementaties zouden uit elkaar gaan lopen.
    expect(looksLikeBarcode("5411234567891")).toBe(true);
    expect(looksLikeBarcode("54112")).toBe(false);
    expect(looksLikeBarcode("abcdefgh")).toBe(false);
  });
});

describe("statusweergave", () => {
  it("toont status als tekst én icoon, niet alleen als kleur", () => {
    const { container } = render(<StatusBanner analysis={analysis()} />);

    expect(screen.getByRole("heading", { name: /twijfelachtig/i })).toBeDefined();
    // Het icoon is een svg naast de tekst; samen dragen ze de boodschap.
    expect(container.querySelector("svg")).not.toBeNull();
    expect(screen.getByText(/betrouwbaarheid: gemiddeld/i)).toBeDefined();
  });

  it("toont geen percentage maar een niveau", () => {
    render(<StatusBanner analysis={analysis({ confidence: "HIGH" })} />);
    expect(screen.getByText(/betrouwbaarheid: hoog/i)).toBeDefined();
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it("maakt een conflict nadrukkelijk zichtbaar en niet groen", () => {
    render(
      <StatusBanner
        analysis={analysis({
          hasConflict: true,
          needsHumanReview: true,
          status: "MUSHBOOH",
          statusTone: "caution",
        })}
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/tegenstrijdige informatie/i);
    expect(alert).toHaveTextContent(/menselijke controle aanbevolen/i);
    // De waarschuwing staat er als tekst; wie geen kleur ziet mist niets.
    expect(alert.textContent).toContain("Controleer de details");
  });

  it("toont menselijke controle ook zonder conflict", () => {
    render(<StatusBanner analysis={analysis({ needsHumanReview: true })} />);
    expect(screen.getByRole("status")).toHaveTextContent(/menselijke controle aanbevolen/i);
  });

  it("toont een onbekende status zonder te suggereren dat het goed zit", () => {
    render(
      <StatusBanner
        analysis={analysis({
          status: "UNKNOWN",
          statusLabel: "Onvoldoende informatie",
          statusTone: "unknown",
          statusIcon: "help-circle",
        })}
      />,
    );
    expect(screen.getByRole("heading", { name: /onvoldoende informatie/i })).toBeDefined();
  });
});

describe("bevindingen", () => {
  it("toont de reden van de backend letterlijk", () => {
    render(
      <AnalysisFindingList
        findings={[
          {
            findingType: "E_NUMBER",
            status: "MUSHBOOH",
            statusLabel: "Twijfelachtig (mushbooh)",
            confidence: "MEDIUM",
            label: "E471 (mono- en diglyceriden)",
            reason: "E471 kan van dierlijke herkomst zijn. Het etiket vermeldt de herkomst niet.",
            position: 0,
            ingredientId: null,
            eNumberId: "en-1",
            certificateId: null,
            sourceId: null,
          },
        ]}
      />,
    );

    expect(screen.getByText(/E471 kan van dierlijke herkomst zijn/)).toBeDefined();
    expect(screen.getByText(/E471 \(mono- en diglyceriden\)/)).toBeDefined();
  });

  it("toont een onbekend ingrediënt met de ruwe etiketterm", () => {
    render(
      <AnalysisFindingList
        findings={[
          {
            findingType: "UNKNOWN_INGREDIENT",
            status: "UNKNOWN",
            statusLabel: "Onvoldoende informatie",
            confidence: "LOW",
            label: "emulgator van vetzuren",
            reason: "Dit ingrediënt staat niet in onze referentiedatabase.",
            position: 0,
            ingredientId: null,
            eNumberId: null,
            certificateId: null,
            sourceId: null,
          },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: /onbekend ingrediënt/i })).toBeDefined();
    // De ruwe etiketterm staat er tussen typografische aanhalingstekens.
    expect(screen.getByText(/emulgator van vetzuren/)).toBeDefined();
  });

  it("houdt de volgorde van de backend aan", () => {
    render(
      <AnalysisFindingList
        findings={[
          { findingType: "CONFLICT", status: "MUSHBOOH", statusLabel: "x", confidence: "LOW", label: "Conflict", reason: "r", position: 0, ingredientId: null, eNumberId: null, certificateId: null, sourceId: null },
          { findingType: "HARAM_INGREDIENT", status: "HARAM", statusLabel: "y", confidence: "HIGH", label: "Varkensgelatine", reason: "r", position: 1, ingredientId: null, eNumberId: null, certificateId: null, sourceId: null },
        ]}
      />,
    );

    const headings = screen.getAllByRole("heading", { level: 4 }).map((el) => el.textContent);
    expect(headings).toEqual(["Conflict", "Varkensgelatine"]);
  });
});

describe("productresultaat en analysisStatus", () => {
  it("toont product én analyse bij OK", async () => {
    render(<ProductResult result={lookupResult()} />);
    expect(screen.getByRole("heading", { level: 1, name: /testkoek/i })).toBeDefined();
    expect(screen.getByRole("heading", { name: /twijfelachtig/i })).toBeDefined();
  });

  it("toont het product ook zonder analyse (NONE)", () => {
    render(<ProductResult result={lookupResult({ analysis: null, analysisStatus: "NONE" })} />);
    expect(screen.getByRole("heading", { level: 1, name: /testkoek/i })).toBeDefined();
    expect(screen.getByRole("status")).toHaveTextContent(/nog geen beoordeling/i);
  });

  it("behoudt het product wanneer de analyse faalde (FAILED)", () => {
    render(<ProductResult result={lookupResult({ analysis: null, analysisStatus: "FAILED" })} />);
    expect(screen.getByRole("heading", { level: 1, name: /testkoek/i })).toBeDefined();
    expect(screen.getByRole("status")).toHaveTextContent(/kon op dit moment niet worden uitgevoerd/i);
  });

  it("verplaatst de focus naar de productnaam na het tonen", async () => {
    render(<ProductResult result={lookupResult()} />);
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1 }));
    });
  });

  it("toont een nette melding in plaats van een gebroken afbeelding", () => {
    render(<ProductResult result={lookupResult()} />);
    expect(screen.getByText(/geen productafbeelding beschikbaar/i)).toBeDefined();
  });

  it("onderscheidt 'geen aandachtspunt' van 'bewezen halal'", async () => {
    render(<ProductResult result={lookupResult()} />);
    await userEvent.click(screen.getByRole("tab", { name: /ingrediënten/i }));

    expect(screen.getByText(/geen aandachtspunt gevonden/i)).toBeDefined();
    // Een ingrediënt zonder match verdwijnt niet uit de lijst.
    expect(screen.getByText(/oorsprong onbekend/i)).toBeDefined();
  });

  it("toont lege secties eerlijk in plaats van met nepdata", async () => {
    render(<ProductResult result={lookupResult()} />);

    await userEvent.click(screen.getByRole("tab", { name: /certificaten/i }));
    expect(screen.getByText(/nog geen certificaten/i)).toBeDefined();

    await userEvent.click(screen.getByRole("tab", { name: /community/i }));
    expect(screen.getByText(/beïnvloedt de halal-status niet/i)).toBeDefined();
  });

  it("toont alleen bronnen die de backend teruggeeft", async () => {
    render(<ProductResult result={lookupResult()} />);
    await userEvent.click(screen.getByRole("tab", { name: /bronnen/i }));

    expect(screen.getByText("Open Food Facts")).toBeDefined();
    expect(screen.getByText(/externe communitydatabases/i)).toBeDefined();
  });
});

describe("camera-diagnose", () => {
  it("vertaalt browserfouten naar de juiste oorzaak", () => {
    const denied = new Error("nope");
    denied.name = "NotAllowedError";
    expect(classifyCameraError(denied)).toBe("DENIED");

    const missing = new Error("nope");
    missing.name = "NotFoundError";
    expect(classifyCameraError(missing)).toBe("NO_CAMERA");

    const busy = new Error("nope");
    busy.name = "NotReadableError";
    expect(classifyCameraError(busy)).toBe("UNAVAILABLE");
  });

  it("geeft elke situatie een eigen, bruikbare tekst", () => {
    expect(cameraMessage("DENIED").title).toMatch(/uitgeschakeld/i);
    expect(cameraMessage("DENIED").body).toMatch(/handmatig/i);
    expect(cameraMessage("INSECURE_CONTEXT").body).toMatch(/https/i);
    expect(cameraMessage("NO_CAMERA").body).toMatch(/handmatig/i);

    // Opnieuw proberen alleen aanbieden waar het kan helpen.
    expect(cameraMessage("UNAVAILABLE").canRetry).toBe(true);
    expect(cameraMessage("DENIED").canRetry).toBe(false);
  });

  it("herkent een onveilige context", () => {
    const original = Object.getOwnPropertyDescriptor(window, "isSecureContext");
    Object.defineProperty(window, "isSecureContext", { value: false, configurable: true });
    expect(detectEnvironmentProblem()).toBe("INSECURE_CONTEXT");
    if (original) Object.defineProperty(window, "isSecureContext", original);
  });
});
