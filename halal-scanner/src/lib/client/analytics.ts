/**
 * Privacyvriendelijke analytics.
 *
 * De harde regel: een event zegt WAT er gebeurde, nooit WAAROVER. Er gaat dus
 * geen barcode, geen productnaam, geen merk en geen ingrediënt doorheen. Wat
 * iemand scant is gevoelige informatie — het zegt iets over wat hij eet, koopt
 * en gelooft — en dat hoort niet bij een externe partij terecht te komen.
 *
 * Daarom accepteert `track()` alleen een vaste set eventnamen en een payload
 * met uitsluitend niet-identificerende velden. Het type dwingt dat af: je
 * krijgt een compile-fout als je er een barcode in probeert te stoppen.
 *
 * Er is nog geen externe provider aangesloten. Deze module is de plek waar dat
 * straks gebeurt; tot die tijd gaat alles naar de console in development en
 * nergens heen in productie.
 */

export type AnalyticsEvent =
  | "SCANNER_OPENED"
  | "CAMERA_PERMISSION_GRANTED"
  | "CAMERA_PERMISSION_DENIED"
  | "BARCODE_SCANNED"
  | "MANUAL_BARCODE_SUBMITTED"
  | "PRODUCT_RESULT_SHOWN"
  | "PRODUCT_NOT_FOUND"
  | "ANALYSIS_RESULT_SHOWN"
  | "SEARCH_PERFORMED"
  // Ingrediëntenscanner (fase 5). Nooit de foto, de bestandsnaam of de
  // herkende tekst — alleen dát er tekstherkenning plaatsvond en hoe het afliep.
  | "OCR_STARTED"
  | "OCR_COMPLETED"
  | "OCR_FAILED";

/**
 * Wat een event mag meedragen.
 *
 * Alleen categorische waarden die over duizenden gebruikers heen betekenis
 * hebben. Geen vrije strings, want daar glipt vroeg of laat een productnaam in.
 */
export interface AnalyticsPayload {
  /** Hoe de barcode binnenkwam. */
  method?: "camera" | "manual";
  /** De halal-status van het resultaat; categorisch, niet herleidbaar. */
  status?: string;
  confidence?: string;
  analysisStatus?: "OK" | "NONE" | "FAILED";
  hasConflict?: boolean;
  /** Aantallen, geen inhoud. */
  resultCount?: number;
  /** Foutsoort uit de API-client, nooit de foutboodschap zelf. */
  errorKind?: string;
  /** Of de tekstherkenning zichzelf onbetrouwbaar noemde. Geen tekst, geen score. */
  lowConfidence?: boolean;
}

type Sink = (event: AnalyticsEvent, payload: AnalyticsPayload) => void;

let sink: Sink | null = null;

/** Sluit een provider aan. Gebeurt in fase 8; nu injecteerbaar voor tests. */
export function setAnalyticsSink(next: Sink | null): void {
  sink = next;
}

export function track(event: AnalyticsEvent, payload: AnalyticsPayload = {}): void {
  if (sink) {
    sink(event, payload);
    return;
  }

  if (process.env.NODE_ENV === "development") {
    console.warn(`[analytics] ${event}`, payload);
  }
}
