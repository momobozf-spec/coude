/**
 * De applicatieservice rond tekstherkenning.
 *
 * PRIVACY — de regels die hier gelden en die niemand mag omzeilen:
 *
 *  - De afbeelding wordt NIET opgeslagen. Niet op schijf, niet in de database,
 *    niet in een cache. Hij bestaat als bytes in het geheugen voor de duur van
 *    één request en is daarna weg. Een foto van een verpakking legt vaak meer
 *    vast dan de verpakking: een keukentafel, een hand, een adreslabel.
 *  - Er gaat GEEN afbeelding en GEEN herkende tekst naar de logs. Wat er wel in
 *    gaat: mimetype, aantal bytes, afmetingen, aantal herkende tekens, en de
 *    duur. Genoeg om een storing te onderzoeken, te weinig om iemands
 *    boodschappen te lezen.
 *  - Er gaat GEEN afbeelding en GEEN tekst naar analytics.
 *  - Ook de BESTANDSNAAM gaat niet naar de logs. Telefoons noemen foto's naar
 *    tijdstip en locatie, en gebruikers hernoemen ze naar van alles.
 *
 * Deze regels zijn niet alleen opgeschreven maar ook afgedwongen: zie
 * `tests/ocrPrivacy.test.ts`, dat de echte logoutput opvangt en op een unieke
 * markerstring controleert — over alle succes- én foutpaden.
 *
 * WAT ER GEBEURT ZODRA EEN ECHTE PROVIDER AANGESLOTEN WORDT: de bytes verlaten
 * deze server richting die partij. Dat is een verwerkersrelatie, geen technisch
 * detail. Zie `docs/OCR-PROVIDERS.md` voor wat er dan geregeld moet zijn
 * (verwerkersovereenkomst, dataregio, retentie, EXIF-stripping).
 */
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { MAX_UPLOAD_BYTES, serverEnv } from "@/config/env";
import { getOcrProvider } from "@/server/integrations/ocr";
import {
  isLowConfidence,
  MIN_USABLE_TEXT_LENGTH,
  type OcrProvenance,
  type OcrProvider,
} from "@/server/integrations/ocr/types";
import {
  hasIngredientListSignals,
  normalizeOcrText,
} from "@/server/integrations/ocr/normalizeOcrText";
import {
  MAX_IMAGE_DIMENSION,
  MAX_IMAGE_PIXELS,
  mimeMatchesFormat,
  probeImage,
} from "@/server/integrations/ocr/imageSignature";
import { callProviderWithResilience } from "@/server/integrations/ocr/resilience";

/** Wat de client mag aanbieden. Bewust geen SVG: dat is uitvoerbare markup. */
const ACCEPTED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export interface OcrRequest {
  image: ArrayBuffer;
  mimeType: string;
  /**
   * Alleen gebruikt om de extensie te kunnen negeren; wordt nergens gelogd of
   * doorgegeven. Zie de privacyregels hierboven.
   */
  fileName?: string;
}

export interface OcrOutcome {
  /** Ruwe tekst van de provider; blijft bewaard zodat opschonen navolgbaar is. */
  rawText: string;
  /** Opgeschoonde tekst, als startwaarde voor het bewerkbare veld. */
  text: string;
  confidence: number | null;
  lowConfidence: boolean;
  warnings: string[];
  /** Herkomst voor diagnose. Gaat niet naar de client. */
  provenance: OcrProvenance;
}

/**
 * Goedkope voorcontrole op wat de client BEWEERT: grootte en mimetype.
 *
 * Dit is opzettelijk niet genoeg — zie `validateImageBytes`. Het staat apart
 * omdat het zonder de bytes kan en dus vóór een upload gebruikt kan worden.
 */
export function validateImageUpload(input: { size: number; mimeType: string }): void {
  if (input.size === 0) {
    throw new AppError("VALIDATION_ERROR", "Het gekozen bestand is leeg.", {
      details: { reason: "EMPTY_FILE" },
    });
  }

  if (!ACCEPTED_MIME_TYPES.has(input.mimeType.toLowerCase())) {
    throw new AppError(
      "UNSUPPORTED_MEDIA_TYPE",
      "Dit bestandstype wordt niet ondersteund. Kies een JPG-, PNG- of WEBP-afbeelding.",
      { details: { reason: "UNSUPPORTED_TYPE", mimeType: input.mimeType } },
    );
  }

  const max = MAX_UPLOAD_BYTES();
  if (input.size > max) {
    throw new AppError(
      "PAYLOAD_TOO_LARGE",
      `De afbeelding is te groot. Maximaal ${Math.floor(max / (1024 * 1024))} MB.`,
      { details: { reason: "TOO_LARGE", maxBytes: max } },
    );
  }
}

export interface ValidatedImage {
  format: string;
  width: number | null;
  height: number | null;
}

/**
 * Controleert de bytes zelf.
 *
 * De reden dat dit bestaat naast `validateImageUpload`: `Content-Type` is een
 * bewering van de client. Een uitvoerbaar bestand hernoemd naar `.jpg` komt
 * binnen als `image/jpeg`. En een bestandsgroottelimiet zegt niets over de
 * afmetingen — een kleine PNG kan 50000 x 50000 declareren.
 */
export function validateImageBytes(input: {
  image: ArrayBuffer;
  mimeType: string;
}): ValidatedImage {
  const probe = probeImage(new Uint8Array(input.image));

  if (probe.format === null) {
    throw new AppError(
      "UNSUPPORTED_MEDIA_TYPE",
      "Dit bestand is geen ondersteunde afbeelding. Kies een JPG-, PNG- of WEBP-foto.",
      { details: { reason: "UNSUPPORTED_TYPE" } },
    );
  }

  if (!mimeMatchesFormat(input.mimeType, probe.format)) {
    // Geen aanval veronderstellen, wel weigeren: we weten niet wat dit is.
    throw new AppError(
      "UNSUPPORTED_MEDIA_TYPE",
      "Het bestand komt niet overeen met het opgegeven type. Kies de foto opnieuw.",
      { details: { reason: "SIGNATURE_MISMATCH", detected: probe.format } },
    );
  }

  const { dimensions } = probe;
  if (dimensions) {
    const pixels = dimensions.width * dimensions.height;
    if (
      dimensions.width > MAX_IMAGE_DIMENSION ||
      dimensions.height > MAX_IMAGE_DIMENSION ||
      pixels > MAX_IMAGE_PIXELS
    ) {
      throw new AppError(
        "PAYLOAD_TOO_LARGE",
        "De afbeelding heeft te veel pixels. Maak de foto kleiner en probeer opnieuw.",
        {
          details: {
            reason: "IMAGE_TOO_LARGE",
            width: dimensions.width,
            height: dimensions.height,
          },
        },
      );
    }
  }

  return {
    format: probe.format,
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null,
  };
}

export async function extractIngredientText(
  request: OcrRequest,
  options: {
    provider?: OcrProvider;
    timeoutMs?: number;
    maxRetries?: number;
    sleep?: (ms: number) => Promise<void>;
  } = {},
): Promise<OcrOutcome> {
  const provider = options.provider ?? getOcrProvider();
  const startedAt = Date.now();

  validateImageUpload({ size: request.image.byteLength, mimeType: request.mimeType });
  const image = validateImageBytes({ image: request.image, mimeType: request.mimeType });

  logger.info("OCR_STARTED", {
    provider: provider.name,
    mimeType: request.mimeType,
    // Alleen de omvang en de vorm, nooit de inhoud en nooit de bestandsnaam.
    bytes: request.image.byteLength,
    format: image.format,
    width: image.width,
    height: image.height,
  });

  const { timeoutMs, maxRetries } = resolveResilienceSettings(options);

  let result;
  try {
    result = await callProviderWithResilience(
      provider,
      { image: request.image, mimeType: request.mimeType, languageHint: "nl" },
      {
        timeoutMs,
        maxRetries,
        ...(options.sleep ? { sleep: options.sleep } : {}),
        onRetry: ({ attempt, code, delayMs }) => {
          logger.warn("OCR_RETRIED", { provider: provider.name, attempt, code, delayMs });
        },
      },
    );
  } catch (error) {
    // Alleen de code. Nooit `error.message` van een provider (die kan een
    // stuk van de payload of een URL met een token bevatten) en nooit de input.
    logger.error("OCR_FAILED", {
      provider: provider.name,
      reason: error instanceof AppError ? error.code : "UNKNOWN",
    });
    throw toClientSafeProviderError(error);
  }

  const provenance: OcrProvenance = {
    provider: result.providerName,
    providerModel: result.providerModel ?? null,
    processedAt: new Date(startedAt).toISOString(),
  };

  const normalized = normalizeOcrText(result.text);
  const warnings = [...(result.warnings ?? [])];

  if (normalized.normalized.length < MIN_USABLE_TEXT_LENGTH) {
    logger.warn("OCR_FAILED", {
      provider: provider.name,
      reason: "TOO_LITTLE_TEXT",
      characters: normalized.normalized.length,
    });
    throw new AppError(
      "VALIDATION_ERROR",
      normalized.normalized.length === 0
        ? "Er is geen tekst in de afbeelding gevonden."
        : "Er is te weinig tekst gevonden om een ingrediëntenlijst te herkennen.",
      { details: { reason: normalized.normalized.length === 0 ? "NO_TEXT" : "TOO_LITTLE_TEXT" } },
    );
  }

  if (!hasIngredientListSignals(normalized.normalized)) {
    // Geen harde fout: de gebruiker kan de tekst alsnog corrigeren en
    // doorgaan. Wel een waarschuwing, want dit is meestal een foto van de
    // voorkant in plaats van de achterkant.
    warnings.push(
      "Dit lijkt geen ingrediëntenlijst. Fotografeer de achterkant van de verpakking, waar de ingrediënten staan.",
    );
  }

  const confidence = typeof result.confidence === "number" ? result.confidence : null;
  // De drempel hoort bij de provider, niet bij de applicatie: 0.8 betekent bij
  // de ene dienst iets heel anders dan bij de andere.
  const lowConfidence = isLowConfidence(confidence, provider.confidencePolicy);

  if (lowConfidence) {
    warnings.push(
      "De tekst kon niet volledig betrouwbaar worden gelezen. Controleer de ingrediënten voordat je verdergaat.",
    );
  }

  logger.info("OCR_COMPLETED", {
    provider: provider.name,
    providerModel: provenance.providerModel,
    durationMs: Date.now() - startedAt,
    // Aantal tekens, niet de tekens zelf.
    characters: normalized.normalized.length,
    confidence,
    lowConfidence,
  });

  return {
    rawText: normalized.original,
    text: normalized.normalized,
    confidence,
    lowConfidence,
    warnings,
    provenance,
  };
}

/** Onze eigen tekst per providerfout, in gewone taal en zonder interna. */
const PROVIDER_ERROR_MESSAGES: Record<string, string> = {
  PROVIDER_TIMEOUT: "De tekstherkenning duurde te lang. Probeer het opnieuw.",
  PROVIDER_UNAVAILABLE: "De tekstherkenning is tijdelijk niet bereikbaar.",
  PROVIDER_RATE_LIMITED: "Er zijn op dit moment te veel aanvragen. Probeer het zo opnieuw.",
};

/**
 * Vervangt de boodschap van een providerfout door de onze.
 *
 * `AppError.message` gaat één op één de HTTP-respons in. Een adapter die
 * `throw new AppError("PROVIDER_UNAVAILABLE", await response.text())` schrijft
 * — wat een volstrekt normale reflex is — zet daarmee de antwoordtekst van een
 * externe dienst in de browser van de gebruiker. Daar kan een interne hostnaam
 * in staan, een request-id van die partij, of een stuk van onze eigen payload.
 *
 * De code blijft, want daar stuurt de UI op. De oorspronkelijke fout blijft als
 * `cause` bewaard: die gaat niet mee in de respons maar is er nog voor wie in
 * een debugger kijkt.
 */
function toClientSafeProviderError(error: unknown): unknown {
  if (!(error instanceof AppError)) return error;

  const replacement = PROVIDER_ERROR_MESSAGES[error.code];
  if (!replacement) return error;

  return new AppError(error.code, replacement, {
    details: { reason: error.code },
    cause: error,
  });
}

/**
 * Timeout en herpogingen uit de omgeving, met een terugval voor aanroepers
 * buiten een geconfigureerde context (tests die geen `serverEnv` willen laden).
 */
function resolveResilienceSettings(options: {
  timeoutMs?: number;
  maxRetries?: number;
}): { timeoutMs: number; maxRetries: number } {
  if (options.timeoutMs !== undefined && options.maxRetries !== undefined) {
    return { timeoutMs: options.timeoutMs, maxRetries: options.maxRetries };
  }
  try {
    const env = serverEnv();
    return {
      timeoutMs: options.timeoutMs ?? env.OCR_TIMEOUT_MS,
      maxRetries: options.maxRetries ?? env.OCR_MAX_RETRIES,
    };
  } catch {
    return { timeoutMs: options.timeoutMs ?? 15_000, maxRetries: options.maxRetries ?? 0 };
  }
}
