/**
 * Timeout en herpogingen rond één provideraanroep.
 *
 * Twee dingen die vandaag niets doen — de fixture-provider hangt niet en faalt
 * niet tijdelijk — maar die er moeten staan vóórdat er een echte provider
 * aangesloten wordt, niet erna. Een externe call zonder timeout blokkeert een
 * request tot de gebruiker de app wegklikt, en een retry-lus zonder
 * onderscheid tussen fouttypes verdubbelt rustig de rekening op fouten die
 * gegarandeerd opnieuw falen.
 *
 * WAT TIJDELIJK IS en dus opnieuw geprobeerd mag worden:
 *
 *   PROVIDER_TIMEOUT        de verbinding hing
 *   PROVIDER_UNAVAILABLE    5xx, netwerkfout
 *   PROVIDER_RATE_LIMITED   429
 *
 * WAT NIET, hoe vaak je het ook probeert:
 *
 *   VALIDATION_ERROR        het beeld deugt niet
 *   UNSUPPORTED_MEDIA_TYPE  het formaat deugt niet
 *   PAYLOAD_TOO_LARGE       te groot blijft te groot
 *   een 4xx van de provider zelf, inclusief geweigerde inhoud
 *
 * Dat onderscheid is de hele reden dat dit een aparte module is: het is precies
 * de regel die bij "even een retry eromheen" als eerste sneuvelt.
 */
import { AppError } from "@/lib/errors";
import type { OcrInput, OcrProvider, OcrResult } from "./types";

/** Foutcodes waarbij opnieuw proberen kans van slagen heeft. */
const TRANSIENT_CODES = new Set([
  "PROVIDER_TIMEOUT",
  "PROVIDER_UNAVAILABLE",
  "PROVIDER_RATE_LIMITED",
]);

export function isTransientProviderError(error: unknown): boolean {
  return error instanceof AppError && TRANSIENT_CODES.has(error.code);
}

export interface ResilienceOptions {
  timeoutMs: number;
  /** Aantal herpogingen BOVENOP de eerste poging. 0 betekent: één poging. */
  maxRetries: number;
  /** Wachttijd voor de eerste herpoging; verdubbelt daarna. */
  baseDelayMs?: number;
  /** Injecteerbaar zodat tests niet echt wachten. */
  sleep?: (ms: number) => Promise<void>;
  /** Wordt aangeroepen bij elke herpoging, voor logging. Krijgt nooit beeld of tekst. */
  onRetry?: (info: { attempt: number; code: string; delayMs: number }) => void;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Breekt af zodra `timeoutMs` verstreken is.
 *
 * De provider krijgt het abort-signaal mee zodat een fatsoenlijke implementatie
 * de onderliggende HTTP-call ook echt annuleert. Doet hij dat niet, dan loopt
 * die call op de achtergrond door maar wachten wij er niet meer op — de
 * gebruiker krijgt hoe dan ook binnen de timeout antwoord.
 */
async function withTimeout(
  provider: OcrProvider,
  input: OcrInput,
  timeoutMs: number,
): Promise<OcrResult> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(
        new AppError(
          "PROVIDER_TIMEOUT",
          "De tekstherkenning duurde te lang. Probeer het opnieuw.",
          { details: { reason: "PROVIDER_TIMEOUT", timeoutMs } },
        ),
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      provider.extractText({ ...input, signal: controller.signal }),
      timeout,
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Roept de provider aan met timeout en begrensde exponentiële backoff.
 *
 * Merk op dat er geen jitter in zit. Dat is bewust: dit is een limiet per
 * gebruiker op een interactieve actie, geen achtergrondbatch die met duizenden
 * tegelijk op dezelfde seconde terugkomt.
 */
export async function callProviderWithResilience(
  provider: OcrProvider,
  input: OcrInput,
  options: ResilienceOptions,
): Promise<OcrResult> {
  const sleep = options.sleep ?? defaultSleep;
  const baseDelayMs = options.baseDelayMs ?? 500;
  let lastError: unknown;

  for (let attempt = 0; attempt <= options.maxRetries; attempt += 1) {
    try {
      return await withTimeout(provider, input, options.timeoutMs);
    } catch (error) {
      lastError = error;

      const canRetry = attempt < options.maxRetries && isTransientProviderError(error);
      if (!canRetry) throw error;

      const delayMs = baseDelayMs * 2 ** attempt;
      options.onRetry?.({
        attempt: attempt + 1,
        code: error instanceof AppError ? error.code : "UNKNOWN",
        delayMs,
      });
      await sleep(delayMs);
    }
  }

  // Onbereikbaar: de lus gooit of geeft terug. Staat er voor de typechecker.
  throw lastError;
}
