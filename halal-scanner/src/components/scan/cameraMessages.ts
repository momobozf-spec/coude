/**
 * Wat de gebruiker leest wanneer de camera niet werkt.
 *
 * Elk geval heeft een eigen tekst met een concrete vervolgstap. "Er ging iets
 * mis" is hier geen optie: iemand die per ongeluk op "blokkeren" tikte moet
 * kunnen lezen dát dat het probleem is, want anders denkt hij dat de app stuk is.
 *
 * Elke tekst eindigt bij hetzelfde alternatief — handmatig invoeren werkt
 * altijd, ongeacht wat de camera doet.
 */
import type { CameraProblem } from "./scannerReducer";

export interface CameraMessage {
  title: string;
  body: string;
  /** Heeft opnieuw proberen zin? Bij een geweigerde permissie meestal niet. */
  canRetry: boolean;
}

const MESSAGES: Record<CameraProblem, CameraMessage> = {
  DENIED: {
    title: "Cameratoegang is uitgeschakeld",
    body:
      "Geef Halal Product Scanner toestemming om je camera te gebruiken via de instellingen van je browser, " +
      "of voer de barcode hieronder handmatig in.",
    canRetry: false,
  },
  NO_CAMERA: {
    title: "Geen camera gevonden",
    body:
      "Op dit apparaat is geen bruikbare camera beschikbaar. Voer de barcode hieronder handmatig in.",
    canRetry: false,
  },
  UNAVAILABLE: {
    title: "Camera is niet beschikbaar",
    body:
      "De camera wordt mogelijk door een andere app of tabblad gebruikt. Sluit die en probeer het opnieuw, " +
      "of voer de barcode handmatig in.",
    canRetry: true,
  },
  INSECURE_CONTEXT: {
    title: "Camera vereist een beveiligde verbinding",
    body:
      "De camera kan alleen worden gebruikt via HTTPS. Open deze pagina via een beveiligde verbinding, " +
      "of voer de barcode hieronder handmatig in.",
    canRetry: false,
  },
  UNSUPPORTED: {
    title: "Deze browser ondersteunt scannen niet",
    body:
      "Je browser biedt geen toegang tot de camera. Probeer een andere browser, of voer de barcode handmatig in.",
    canRetry: false,
  },
};

export function cameraMessage(problem: CameraProblem): CameraMessage {
  return MESSAGES[problem];
}
