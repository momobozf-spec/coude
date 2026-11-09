/**
 * De toestandsmachine van de ingrediëntenscanner.
 *
 * Dezelfde reden als bij de barcodescanner: met losse booleans (`hasImage`,
 * `isProcessing`, `isAnalyzing`, `hasError`) bestaan er tientallen combinaties
 * waarvan er maar een handvol betekenis heeft. Hier is er altijd precies één
 * toestand, en de overgangen staan op één plek.
 *
 * Eén regel is inhoudelijk belangrijk en staat daarom in de machine en niet in
 * de UI: NA OCR WORDT NOOIT AUTOMATISCH GEANALYSEERD. `OCR_SUCCEEDED` gaat naar
 * `REVIEWING_TEXT`, en alleen een expliciete `ANALYSIS_REQUESTED` van de
 * gebruiker gaat verder. OCR leest "geiatine" waar "gelatine" staat, en het
 * verschil tussen die twee is precies het verschil tussen een twijfelgeval en
 * een verboden ingrediënt.
 */
import type { AnalysisDto } from "@/server/services/analysisPresenter";

export type IngredientScanStatus =
  | "IDLE"
  | "IMAGE_SELECTED"
  | "PROCESSING_OCR"
  | "REVIEWING_TEXT"
  | "OCR_FAILED"
  | "ANALYZING"
  | "ANALYSIS_SUCCESS"
  | "ANALYSIS_FAILED";

/** Waarom OCR niet lukte. Elke reden krijgt een eigen tekst en herstelactie. */
export type OcrProblem =
  | "NO_TEXT"
  | "TOO_LITTLE_TEXT"
  | "NOT_AN_INGREDIENT_LIST"
  | "UNSUPPORTED_TYPE"
  | "TOO_LARGE"
  | "EMPTY_FILE"
  | "PROVIDER_UNAVAILABLE"
  | "NETWORK_ERROR"
  | "UNKNOWN";

export interface SelectedImage {
  /** Object-URL voor de preview. Moet expliciet vrijgegeven worden. */
  previewUrl: string;
  fileName: string;
  sizeBytes: number;
}

export interface IngredientScanState {
  status: IngredientScanStatus;
  image: SelectedImage | null;
  /** De bewerkbare tekst. Startwaarde uit OCR, daarna van de gebruiker. */
  text: string;
  confidence: number | null;
  lowConfidence: boolean;
  warnings: string[];
  ocrProblem: OcrProblem | null;
  analysis: AnalysisDto | null;
  error: { message: string; retryable: boolean } | null;
  /** True zodra de gebruiker de OCR-tekst heeft aangepast. */
  textEdited: boolean;
}

export type IngredientScanAction =
  | { type: "IMAGE_SELECTED"; image: SelectedImage }
  | { type: "IMAGE_REJECTED"; problem: OcrProblem; message: string }
  | { type: "OCR_STARTED" }
  | {
      type: "OCR_SUCCEEDED";
      text: string;
      confidence: number | null;
      lowConfidence: boolean;
      warnings: string[];
    }
  | { type: "OCR_FAILED"; problem: OcrProblem; message: string; retryable: boolean }
  | { type: "TEXT_CHANGED"; text: string }
  | { type: "MANUAL_ENTRY_STARTED" }
  | { type: "ANALYSIS_REQUESTED" }
  | { type: "ANALYSIS_SUCCEEDED"; analysis: AnalysisDto; warnings?: string[] }
  | { type: "ANALYSIS_FAILED"; message: string; retryable: boolean }
  | { type: "RESET" };

export const initialIngredientScanState: IngredientScanState = {
  status: "IDLE",
  image: null,
  text: "",
  confidence: null,
  lowConfidence: false,
  warnings: [],
  ocrProblem: null,
  analysis: null,
  error: null,
  textEdited: false,
};

export function ingredientScanReducer(
  state: IngredientScanState,
  action: IngredientScanAction,
): IngredientScanState {
  switch (action.type) {
    case "IMAGE_SELECTED":
      return {
        ...initialIngredientScanState,
        status: "IMAGE_SELECTED",
        image: action.image,
        // De tekst blijft staan: wie al handmatig iets had ingetypt en daarna
        // alsnog een foto kiest, verliest zijn werk niet.
        text: state.text,
        textEdited: state.textEdited,
      };

    case "IMAGE_REJECTED":
      // Nooit een afgekeurd bestand als geselecteerde afbeelding bewaren.
      return {
        ...state,
        status: "OCR_FAILED",
        image: null,
        ocrProblem: action.problem,
        error: { message: action.message, retryable: false },
      };

    case "OCR_STARTED":
      return { ...state, status: "PROCESSING_OCR", error: null, ocrProblem: null };

    case "OCR_SUCCEEDED":
      return {
        ...state,
        status: "REVIEWING_TEXT",
        text: action.text,
        confidence: action.confidence,
        lowConfidence: action.lowConfidence,
        warnings: action.warnings,
        ocrProblem: null,
        error: null,
        textEdited: false,
      };

    case "OCR_FAILED":
      return {
        ...state,
        status: "OCR_FAILED",
        ocrProblem: action.problem,
        error: { message: action.message, retryable: action.retryable },
      };

    case "TEXT_CHANGED":
      return { ...state, text: action.text, textEdited: true };

    case "MANUAL_ENTRY_STARTED":
      // De uitweg die altijd open moet blijven: geen camera, geen OCR, gewoon
      // typen.
      return {
        ...state,
        status: "REVIEWING_TEXT",
        image: null,
        ocrProblem: null,
        error: null,
        confidence: null,
        lowConfidence: false,
        warnings: [],
      };

    case "ANALYSIS_REQUESTED":
      if (state.text.trim().length === 0) return state;
      return { ...state, status: "ANALYZING", error: null };

    case "ANALYSIS_SUCCEEDED":
      return {
        ...state,
        status: "ANALYSIS_SUCCESS",
        analysis: action.analysis,
        error: null,
        // Waarschuwingen van de analyse komen bij die van de OCR: allebei
        // gaan ze over de betrouwbaarheid van de tekst waar het oordeel op
        // rust, en allebei horen ze naast het resultaat te blijven staan.
        warnings: [...state.warnings, ...(action.warnings ?? [])],
      };

    case "ANALYSIS_FAILED":
      return {
        ...state,
        status: "ANALYSIS_FAILED",
        error: { message: action.message, retryable: action.retryable },
      };

    case "RESET":
      return initialIngredientScanState;

    default:
      return state;
  }
}

/** Mag de analyseknop aan? Eén plek, zodat de UI het niet zelf hoeft af te leiden. */
export function canAnalyze(state: IngredientScanState): boolean {
  return (
    (state.status === "REVIEWING_TEXT" || state.status === "ANALYSIS_FAILED") &&
    state.text.trim().length > 0
  );
}

export function isBusy(state: IngredientScanState): boolean {
  return state.status === "PROCESSING_OCR" || state.status === "ANALYZING";
}

/** Korte, feitelijke melding voor screenreaders bij elke toestandswissel. */
export function ingredientScanAnnouncement(state: IngredientScanState): string {
  switch (state.status) {
    case "IMAGE_SELECTED":
      return "Afbeelding gekozen.";
    case "PROCESSING_OCR":
      return "De tekst in de afbeelding wordt gelezen.";
    case "REVIEWING_TEXT":
      return state.lowConfidence
        ? "Tekst herkend, maar niet volledig betrouwbaar. Controleer de ingrediënten."
        : "Tekst herkend. Controleer de ingrediënten en start daarna de analyse.";
    case "OCR_FAILED":
      return state.error?.message ?? "De tekst kon niet gelezen worden.";
    case "ANALYZING":
      return "De ingrediënten worden geanalyseerd.";
    case "ANALYSIS_SUCCESS":
      return `Analyse klaar: ${state.analysis?.statusLabel ?? "resultaat beschikbaar"}.`;
    case "ANALYSIS_FAILED":
      return state.error?.message ?? "De analyse is mislukt.";
    default:
      return "";
  }
}
