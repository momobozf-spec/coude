/**
 * Wat de gebruiker leest wanneer OCR niet lukt.
 *
 * Elke oorzaak krijgt een eigen tekst met concrete herstelacties. "Er ging iets
 * mis" helpt niemand verder: iemand die de voorkant van de verpakking
 * fotografeerde moet lezen dát dat het probleem is, want anders probeert hij
 * precies hetzelfde nog een keer.
 *
 * Elke situatie eindigt bij dezelfde uitweg: handmatig intypen werkt altijd.
 */
import type { OcrProblem } from "./ingredientScanReducer";

export interface OcrMessage {
  title: string;
  body: string;
  /** Concrete dingen die de gebruiker kan doen, in volgorde van kansrijkheid. */
  suggestions: string[];
  /** Heeft dezelfde foto nog een keer proberen zin? */
  canRetrySameImage: boolean;
}

const MESSAGES: Record<OcrProblem, OcrMessage> = {
  NO_TEXT: {
    title: "Geen tekst gevonden",
    body: "In deze afbeelding is geen leesbare tekst aangetroffen.",
    suggestions: [
      "Fotografeer de achterkant van de verpakking, waar de ingrediënten staan.",
      "Houd de camera dichterbij, zodat de tekst het beeld vult.",
      "Zorg voor meer licht en vermijd schaduw op de verpakking.",
    ],
    canRetrySameImage: false,
  },
  TOO_LITTLE_TEXT: {
    title: "Te weinig tekst gevonden",
    body: "Er is wel tekst gevonden, maar te weinig om een ingrediëntenlijst te zijn.",
    suggestions: [
      "Fotografeer de volledige ingrediëntenlijst in één beeld.",
      "Houd de verpakking vlak, zodat de tekst niet vervormt.",
    ],
    canRetrySameImage: false,
  },
  NOT_AN_INGREDIENT_LIST: {
    title: "Dit lijkt geen ingrediëntenlijst",
    body: "De herkende tekst ziet er niet uit als een opsomming van ingrediënten.",
    suggestions: [
      "Fotografeer de achterkant in plaats van de voorkant.",
      "Controleer de tekst hieronder en pas hem zelf aan.",
    ],
    canRetrySameImage: false,
  },
  UNSUPPORTED_TYPE: {
    title: "Bestandstype wordt niet ondersteund",
    body: "Kies een JPG-, PNG- of WEBP-afbeelding.",
    suggestions: ["Maak een nieuwe foto met de camera.", "Kies een ander bestand."],
    canRetrySameImage: false,
  },
  TOO_LARGE: {
    title: "De afbeelding is te groot",
    body: "Kies een kleinere afbeelding of maak een nieuwe foto.",
    suggestions: ["Maak een nieuwe foto; die is meestal kleiner.", "Kies een ander bestand."],
    canRetrySameImage: false,
  },
  EMPTY_FILE: {
    title: "Het bestand is leeg",
    body: "Er zat geen afbeelding in het gekozen bestand.",
    suggestions: ["Kies een ander bestand.", "Maak een nieuwe foto."],
    canRetrySameImage: false,
  },
  PROVIDER_UNAVAILABLE: {
    title: "Tekstherkenning is tijdelijk niet beschikbaar",
    body: "De dienst die de tekst leest reageert nu niet. Dit ligt niet aan je foto.",
    suggestions: [
      "Probeer het over een moment opnieuw.",
      "Of typ de ingrediënten hieronder zelf in.",
    ],
    canRetrySameImage: true,
  },
  NETWORK_ERROR: {
    title: "Geen verbinding",
    body: "De afbeelding kon niet verstuurd worden.",
    suggestions: ["Controleer je internetverbinding en probeer het opnieuw."],
    canRetrySameImage: true,
  },
  UNKNOWN: {
    title: "Het lezen van de tekst is mislukt",
    body: "Er is iets misgegaan bij het verwerken van de afbeelding.",
    suggestions: ["Probeer een nieuwe foto.", "Of typ de ingrediënten hieronder zelf in."],
    canRetrySameImage: true,
  },
};

export function ocrMessage(problem: OcrProblem): OcrMessage {
  return MESSAGES[problem];
}

/**
 * Vertaalt de `details.reason` die de server meestuurt naar een OcrProblem.
 * Onbekende redenen worden `UNKNOWN` — nooit een gok naar iets specifiekers,
 * want een verkeerde herstelactie is erger dan een vage.
 */
export function problemFromReason(reason: unknown, fallback: OcrProblem = "UNKNOWN"): OcrProblem {
  if (typeof reason !== "string") return fallback;
  return reason in MESSAGES ? (reason as OcrProblem) : fallback;
}
