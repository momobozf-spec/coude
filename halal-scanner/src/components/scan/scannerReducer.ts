/**
 * De toestandsmachine van de scanner.
 *
 * Bewust een reducer en geen handvol losse booleans. Met `isScanning`,
 * `isLoading`, `hasPermission`, `hasProduct` en `hasError` naast elkaar bestaan
 * er 32 combinaties waarvan er hooguit acht betekenis hebben — en de andere 24
 * zijn precies de bugs die je in een scanner niet wilt: een camera die
 * doordraait terwijl er een resultaat op het scherm staat, of twee lookups voor
 * dezelfde barcode.
 *
 * Hier is er altijd exact één toestand, en de overgangen staan op één plek.
 * De reducer is puur: geen camera, geen fetch, geen timers. Daardoor is de hele
 * flow te testen zonder browser.
 */
import type { AnalysisStatus, ApiErrorKind, BarcodeLookupResult } from "@/lib/client/apiClient";

export type ScannerStatus =
  | "IDLE"
  | "REQUESTING_PERMISSION"
  | "SCANNING"
  | "BARCODE_DETECTED"
  | "LOADING_PRODUCT"
  | "PRODUCT_FOUND"
  | "PRODUCT_NOT_FOUND"
  | "ERROR";

/** Waarom de camera niet bruikbaar is. Elk geval krijgt een eigen tekst. */
export type CameraProblem =
  | "DENIED"
  | "UNAVAILABLE"
  | "NO_CAMERA"
  | "INSECURE_CONTEXT"
  | "UNSUPPORTED";

export interface ScannerState {
  status: ScannerStatus;
  /** De barcode die nu verwerkt wordt of verwerkt is. */
  barcode: string | null;
  result: BarcodeLookupResult | null;
  cameraProblem: CameraProblem | null;
  error: { kind: ApiErrorKind; message: string; retryable: boolean } | null;
  /** Hoe de laatste barcode binnenkwam; bepaalt of we de camera hervatten. */
  inputMethod: "camera" | "manual" | null;
  /**
   * Barcodes die we recent al verwerkt hebben. ZXing vuurt tientallen keren per
   * seconde bij een stabiel beeld; zonder deze set wordt dat evenzoveel
   * lookups.
   */
  recentlyHandled: string[];
}

export type ScannerAction =
  | { type: "REQUEST_PERMISSION" }
  | { type: "PERMISSION_GRANTED" }
  | { type: "CAMERA_PROBLEM"; problem: CameraProblem }
  | { type: "BARCODE_DETECTED"; barcode: string; method: "camera" | "manual" }
  | { type: "LOOKUP_STARTED" }
  | { type: "LOOKUP_SUCCEEDED"; result: BarcodeLookupResult }
  | { type: "LOOKUP_NOT_FOUND"; barcode: string }
  | { type: "LOOKUP_FAILED"; kind: ApiErrorKind; message: string; retryable: boolean }
  | { type: "SCAN_AGAIN" }
  | { type: "RETRY" };

/** Hoeveel recent verwerkte barcodes we onthouden voor de ontdubbeling. */
export const RECENT_BARCODE_MEMORY = 5;

export const initialScannerState: ScannerState = {
  status: "IDLE",
  barcode: null,
  result: null,
  cameraProblem: null,
  error: null,
  inputMethod: null,
  recentlyHandled: [],
};

/**
 * Mag deze barcode een lookup starten?
 *
 * Nee wanneer we hem net al verwerkt hebben, en nee wanneer er al een lookup
 * loopt. Dit is de bescherming tegen de twintig-requests-per-seconde die een
 * naïeve ZXing-integratie oplevert.
 */
export function shouldHandleBarcode(state: ScannerState, barcode: string): boolean {
  if (state.status === "LOADING_PRODUCT" || state.status === "BARCODE_DETECTED") return false;
  return !state.recentlyHandled.includes(barcode);
}

function remember(state: ScannerState, barcode: string): string[] {
  return [barcode, ...state.recentlyHandled.filter((item) => item !== barcode)].slice(
    0,
    RECENT_BARCODE_MEMORY,
  );
}

export function scannerReducer(state: ScannerState, action: ScannerAction): ScannerState {
  switch (action.type) {
    case "REQUEST_PERMISSION":
      return { ...state, status: "REQUESTING_PERMISSION", cameraProblem: null, error: null };

    case "PERMISSION_GRANTED":
      return { ...state, status: "SCANNING", cameraProblem: null };

    case "CAMERA_PROBLEM":
      // Geen ERROR-status: de camera is stuk, de app niet. Handmatige invoer
      // blijft gewoon werken, dus we vallen terug op IDLE met een probleem.
      return { ...state, status: "IDLE", cameraProblem: action.problem };

    case "BARCODE_DETECTED":
      if (!shouldHandleBarcode(state, action.barcode)) return state;
      return {
        ...state,
        status: "BARCODE_DETECTED",
        barcode: action.barcode,
        inputMethod: action.method,
        error: null,
        recentlyHandled: remember(state, action.barcode),
      };

    case "LOOKUP_STARTED":
      return { ...state, status: "LOADING_PRODUCT" };

    case "LOOKUP_SUCCEEDED":
      return { ...state, status: "PRODUCT_FOUND", result: action.result, error: null };

    case "LOOKUP_NOT_FOUND":
      return { ...state, status: "PRODUCT_NOT_FOUND", barcode: action.barcode, result: null };

    case "LOOKUP_FAILED":
      return {
        ...state,
        status: "ERROR",
        error: { kind: action.kind, message: action.message, retryable: action.retryable },
      };

    case "RETRY":
      // De barcode blijft staan en wordt uit de ontdubbeling gehaald: bij een
      // netwerkfout moet dezelfde code juist wél opnieuw geprobeerd kunnen.
      return {
        ...state,
        status: state.barcode ? "BARCODE_DETECTED" : "IDLE",
        error: null,
        recentlyHandled: state.recentlyHandled.filter((item) => item !== state.barcode),
      };

    case "SCAN_AGAIN":
      return {
        ...initialScannerState,
        status: "SCANNING",
        // De zojuist bekeken barcode blijft even in het geheugen, anders scant
        // de camera hem direct opnieuw omdat de verpakking nog voor de lens ligt.
        recentlyHandled: state.recentlyHandled,
      };

    default:
      return state;
  }
}

/** Moet de camera nu beelden leveren? Eén plek, zodat het nooit uiteenloopt. */
export function shouldCameraBeActive(state: ScannerState): boolean {
  return state.status === "SCANNING";
}

/** Korte, feitelijke omschrijving voor screenreaders bij elke statuswissel. */
export function statusAnnouncement(state: ScannerState): string {
  switch (state.status) {
    case "REQUESTING_PERMISSION":
      return "Toegang tot de camera wordt gevraagd.";
    case "SCANNING":
      return "De camera is actief. Richt op een barcode.";
    case "BARCODE_DETECTED":
    case "LOADING_PRODUCT":
      return "Barcode gevonden. Product wordt gecontroleerd.";
    case "PRODUCT_FOUND":
      return `Product gevonden: ${state.result?.product.name ?? "naam onbekend"}.`;
    case "PRODUCT_NOT_FOUND":
      return "Dit product staat niet in de database.";
    case "ERROR":
      return state.error?.message ?? "Er ging iets mis.";
    default:
      return "";
  }
}

/** Analysestatus van het huidige resultaat; `null` wanneer er geen resultaat is. */
export function currentAnalysisStatus(state: ScannerState): AnalysisStatus | null {
  return state.result?.analysisStatus ?? null;
}
