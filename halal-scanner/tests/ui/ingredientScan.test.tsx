// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IngredientScanScreen } from "@/components/scan/ingredients/IngredientScanScreen";
import { ApiClientError } from "@/lib/client/apiClient";
import type * as ApiClientModule from "@/lib/client/apiClient";
import type { AnalysisDto } from "@/server/services/analysisPresenter";

/**
 * De volledige OCR-flow zonder camera, zonder netwerk en zonder OCR-dienst.
 * `runOcr` en `analyzeIngredientText` zijn gemockt; de rest is de echte code.
 */

const runOcr = vi.fn();
const analyzeIngredientText = vi.fn();

vi.mock("@/lib/client/apiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClientModule>();
  return {
    ...actual,
    runOcr: (...args: unknown[]) => runOcr(...args),
    analyzeIngredientText: (...args: unknown[]) => analyzeIngredientText(...args),
  };
});

function analysis(over: Partial<AnalysisDto> = {}): AnalysisDto {
  return {
    id: "",
    status: "MUSHBOOH",
    statusLabel: "Twijfelachtig (mushbooh)",
    statusDescription: "Van een of meer ingrediënten is de herkomst niet vast te stellen.",
    statusIcon: "alert-triangle",
    statusTone: "caution",
    confidence: "MEDIUM",
    summary: "Van 1 van de 3 ingrediënten is de herkomst niet vast te stellen.",
    hasConflict: false,
    needsHumanReview: false,
    engineVersion: "halal-engine@1",
    analyzedAt: "2026-08-07T12:00:00.000Z",
    findings: [
      {
        findingType: "MUSHBOOH_INGREDIENT",
        status: "MUSHBOOH",
        statusLabel: "Twijfelachtig (mushbooh)",
        confidence: "MEDIUM",
        label: "gelatine",
        reason: "De herkomst van gelatine kan dierlijk zijn en staat niet op het etiket.",
        position: 0,
        ingredientId: "i1",
        eNumberId: null,
        certificateId: null,
        sourceId: null,
      },
    ],
    ...over,
  };
}

function imageFile(name = "achterkant.jpg"): File {
  return new File([new Uint8Array([1, 2, 3, 4])], name, { type: "image/jpeg" });
}

async function pickImage(file = imageFile()): Promise<void> {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("bestandsinvoer niet gevonden");
  await userEvent.upload(input, file);
}

beforeEach(() => {
  runOcr.mockReset();
  analyzeIngredientText.mockReset();

  // jsdom kent geen object-URL's.
  Object.defineProperty(URL, "createObjectURL", { value: vi.fn(() => "blob:preview"), configurable: true });
  Object.defineProperty(URL, "revokeObjectURL", { value: vi.fn(), configurable: true });
});

afterEach(cleanup);

describe("beginscherm", () => {
  it("biedt zowel een foto als handmatig intypen aan", () => {
    render(<IngredientScanScreen />);
    expect(screen.getByRole("button", { name: /foto maken of kiezen/i })).toBeInTheDocument();
    // De uitweg is er vanaf het begin, niet pas nadat iets faalt.
    expect(screen.getByRole("button", { name: /zelf intypen/i })).toBeInTheDocument();
  });

  it("legt uit welke kant van de verpakking nodig is", () => {
    render(<IngredientScanScreen />);
    expect(screen.getByText(/achterkant van de verpakking/i)).toBeInTheDocument();
  });
});

describe("de gelukte flow", () => {
  it("foto → OCR → controleren → analyseren → resultaat", async () => {
    runOcr.mockResolvedValue({
      text: "suiker, geiatine, aroma",
      confidence: 0.42,
      lowConfidence: true,
      warnings: ["De afbeelding is onscherp."],
    });
    analyzeIngredientText.mockResolvedValue({ analysis: analysis(), warnings: [] });

    render(<IngredientScanScreen />);
    await pickImage();

    // 1. De herkende tekst staat in een bewerkbaar veld.
    const textarea = await screen.findByLabelText(/^ingrediënten$/i);
    expect(textarea).toHaveValue("suiker, geiatine, aroma");
    expect(screen.getByRole("heading", { name: /we hebben deze ingrediënten herkend/i })).toBeInTheDocument();

    // 2. Er wordt NIET automatisch geanalyseerd.
    expect(analyzeIngredientText).not.toHaveBeenCalled();

    // 3. De gebruiker corrigeert de leesfout.
    await userEvent.clear(textarea);
    await userEvent.type(textarea, "suiker, gelatine, aroma");

    // 4. Pas na een expliciete klik gaat de analyse lopen.
    await userEvent.click(screen.getByRole("button", { name: /ingrediënten analyseren/i }));

    await waitFor(() => expect(analyzeIngredientText).toHaveBeenCalledWith("suiker, gelatine, aroma"));

    // 5. Het resultaat gebruikt dezelfde weergave als de barcodeflow.
    expect(await screen.findByRole("heading", { name: /twijfelachtig/i })).toBeInTheDocument();
    expect(screen.getByText(/de herkomst van gelatine kan dierlijk zijn/i)).toBeInTheDocument();
  });

  it("toont de waarschuwing bij lage zekerheid", async () => {
    runOcr.mockResolvedValue({
      text: "suiker, geiatine",
      confidence: 0.3,
      lowConfidence: true,
      warnings: ["De tekst kon niet volledig betrouwbaar worden gelezen."],
    });

    render(<IngredientScanScreen />);
    await pickImage();

    // Twee keer aanwezig, en dat is de bedoeling: één keer zichtbaar in de
    // waarschuwing en één keer in de aria-live-regio voor screenreaders.
    const mentions = await screen.findAllByText(/niet volledig betrouwbaar/i);
    expect(mentions).toHaveLength(2);
  });

  it("zegt expliciet dat er geen product en geen certificaat aan gekoppeld is", async () => {
    runOcr.mockResolvedValue({ text: "suiker, cacao", confidence: 0.9, lowConfidence: false, warnings: [] });
    analyzeIngredientText.mockResolvedValue({
      analysis: analysis({
        status: "LIKELY_HALAL",
        statusLabel: "Waarschijnlijk halal",
        statusTone: "neutral-positive",
        findings: [],
      }),
      warnings: [],
    });

    render(<IngredientScanScreen />);
    await pickImage();
    await userEvent.click(await screen.findByRole("button", { name: /ingrediënten analyseren/i }));

    // Geen halal-claim over het product: alleen over de ingevoerde ingrediënten.
    expect(await screen.findByText(/geen certificaten meegewogen/i)).toBeInTheDocument();
    expect(screen.getByText(/niets opgeslagen/i)).toBeInTheDocument();
  });

  it("toont naast het resultaat dat een deel van de tekst niet gelezen kon worden", async () => {
    // Het gevaarlijkste geval: een gunstig oordeel over een lijst die maar half
    // geanalyseerd is. De waarschuwing hoort daarom bij het RESULTAAT te staan
    // en niet alleen in het controlescherm dat de gebruiker al voorbij is.
    runOcr.mockResolvedValue({
      text: "sucre, huile végétale المكونات: سكر",
      confidence: 0.9,
      lowConfidence: false,
      warnings: [],
    });
    analyzeIngredientText.mockResolvedValue({
      analysis: analysis({
        status: "LIKELY_HALAL",
        statusLabel: "Waarschijnlijk halal",
        statusTone: "neutral-positive",
        findings: [],
      }),
      warnings: ["Een deel van de tekst staat in een schrift dat we nog niet kunnen lezen."],
    });

    render(<IngredientScanScreen />);
    await pickImage();
    await userEvent.click(await screen.findByRole("button", { name: /ingrediënten analyseren/i }));

    expect(await screen.findByRole("heading", { name: /waarschijnlijk halal/i })).toBeInTheDocument();
    expect(screen.getByText(/schrift dat we nog niet kunnen lezen/i)).toBeInTheDocument();
  });

  it("verplaatst de focus naar het resultaat", async () => {
    runOcr.mockResolvedValue({ text: "suiker, cacao", confidence: 0.9, lowConfidence: false, warnings: [] });
    analyzeIngredientText.mockResolvedValue({ analysis: analysis(), warnings: [] });

    render(<IngredientScanScreen />);
    await pickImage();
    await userEvent.click(await screen.findByRole("button", { name: /ingrediënten analyseren/i }));

    await waitFor(() => {
      const region = screen.getByLabelText(/resultaat van de ingrediëntenanalyse/i);
      expect(document.activeElement).toBe(region);
    });
  });
});

describe("OCR-fouten", () => {
  it("legt uit wat er mis is en biedt handmatige invoer aan", async () => {
    runOcr.mockRejectedValue(
      new ApiClientError("INVALID_BARCODE", "VALIDATION_ERROR", "Er is geen tekst gevonden.", "req-1", {
        reason: "NO_TEXT",
      }),
    );

    render(<IngredientScanScreen />);
    await pickImage();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/geen tekst gevonden/i);
    // Concrete herstelacties, geen "er ging iets mis".
    expect(alert).toHaveTextContent(/achterkant van de verpakking/i);
    expect(alert).toHaveTextContent(/dichterbij/i);
  });

  it("noemt een providerstoring niet de schuld van de foto", async () => {
    runOcr.mockRejectedValue(
      new ApiClientError("PROVIDER_UNAVAILABLE", "PROVIDER_UNAVAILABLE", "Dienst plat.", "req-2"),
    );

    render(<IngredientScanScreen />);
    await pickImage();

    expect(await screen.findByRole("alert")).toHaveTextContent(/ligt niet aan je foto/i);
  });

  it("laat de gebruiker na een OCR-fout alsnog handmatig analyseren", async () => {
    runOcr.mockRejectedValue(
      new ApiClientError("NETWORK_ERROR", "NETWORK_ERROR", "Geen verbinding.", null),
    );
    analyzeIngredientText.mockResolvedValue({ analysis: analysis(), warnings: [] });

    render(<IngredientScanScreen />);
    await pickImage();

    await userEvent.click(await screen.findByRole("button", { name: /zelf intypen/i }));

    const textarea = screen.getByLabelText(/^ingrediënten$/i);
    await userEvent.type(textarea, "suiker, gelatine");
    await userEvent.click(screen.getByRole("button", { name: /ingrediënten analyseren/i }));

    await waitFor(() => expect(analyzeIngredientText).toHaveBeenCalledWith("suiker, gelatine"));
    expect(await screen.findByRole("heading", { name: /twijfelachtig/i })).toBeInTheDocument();
  });
});

describe("analysefouten", () => {
  it("behoudt de ingevoerde tekst zodat opnieuw proberen kan", async () => {
    runOcr.mockResolvedValue({ text: "suiker, cacao", confidence: 0.9, lowConfidence: false, warnings: [] });
    analyzeIngredientText.mockRejectedValueOnce(
      new ApiClientError("PROVIDER_UNAVAILABLE", "PROVIDER_UNAVAILABLE", "Analyse mislukt.", null),
    );

    render(<IngredientScanScreen />);
    await pickImage();
    await userEvent.click(await screen.findByRole("button", { name: /ingrediënten analyseren/i }));

    // Zichtbaar én aangekondigd.
    expect(await screen.findAllByText(/analyse mislukt/i)).toHaveLength(2);
    expect(screen.getByLabelText(/^ingrediënten$/i)).toHaveValue("suiker, cacao");

    analyzeIngredientText.mockResolvedValue({ analysis: analysis(), warnings: [] });
    await userEvent.click(screen.getByRole("button", { name: /ingrediënten analyseren/i }));
    expect(await screen.findByRole("heading", { name: /twijfelachtig/i })).toBeInTheDocument();
  });
});

describe("toegankelijkheid en knopgedrag", () => {
  it("blokkeert de analyseknop zolang er geen tekst is", async () => {
    render(<IngredientScanScreen />);
    await userEvent.click(screen.getByRole("button", { name: /zelf intypen/i }));

    expect(screen.getByRole("button", { name: /ingrediënten analyseren/i })).toBeDisabled();
  });

  it("blokkeert knoppen tijdens het lezen van de tekst", async () => {
    let resolveOcr: (value: unknown) => void = () => {};
    runOcr.mockReturnValue(new Promise((resolve) => { resolveOcr = resolve; }));

    render(<IngredientScanScreen />);
    await pickImage();

    expect(await screen.findByRole("status", { name: /tekst lezen/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /foto maken of kiezen/i })).toBeDisabled();

    resolveOcr({ text: "suiker, cacao", confidence: 0.9, lowConfidence: false, warnings: [] });
    await waitFor(() => expect(screen.getByLabelText(/^ingrediënten$/i)).toBeInTheDocument());
  });

  it("geeft de afbeeldingpreview een beschrijvende alt-tekst", async () => {
    runOcr.mockResolvedValue({ text: "suiker, cacao", confidence: 0.9, lowConfidence: false, warnings: [] });

    render(<IngredientScanScreen />);
    await pickImage();

    expect(await screen.findByAltText(/voorbeeld van de gekozen foto/i)).toBeInTheDocument();
  });

  it("ruimt de object-URL op bij unmount", async () => {
    runOcr.mockResolvedValue({ text: "suiker, cacao", confidence: 0.9, lowConfidence: false, warnings: [] });

    const { unmount } = render(<IngredientScanScreen />);
    await pickImage();
    await screen.findByLabelText(/^ingrediënten$/i);

    unmount();

    // Zonder dit houdt de browser elke gekozen foto in het geheugen.
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview");
  });
});
