import { ProviderError, describeError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { openFoodFactsResponseSchema, type OpenFoodFactsResponse } from "./schema";

/**
 * HTTP-client voor de Open Food Facts v2 API.
 *
 * Verantwoordelijk voor precies één ding: een betrouwbare respons ophalen of
 * een duidelijke fout gooien. Normalisatie zit in normalize.ts, de
 * providerlogica in provider.ts.
 *
 * Retrybeleid: alleen op fouten die van voorbijgaande aard kúnnen zijn
 * (netwerkfout, timeout, 5xx, 429). Een 404 of `status: 0` is een definitief
 * antwoord en wordt nooit opnieuw geprobeerd - dat zou de API onnodig belasten
 * en de lookup drie keer zo traag maken.
 */

export const OPEN_FOOD_FACTS_PROVIDER_NAME = "open_food_facts";

export interface OpenFoodFactsClientOptions {
  baseUrl: string;
  userAgent: string;
  timeoutMs?: number;
  maxAttempts?: number;
  /** Basisvertraging; groeit exponentieel per poging. */
  retryDelayMs?: number;
  /** Injecteerbaar zodat tests geen echte HTTP-calls doen. */
  fetchImpl?: typeof fetch;
  /** Injecteerbaar zodat tests niet echt hoeven te wachten. */
  sleepImpl?: (ms: number) => Promise<void>;
}

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 250;

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Uitkomst van één poging. Het expliciete onderscheid tussen `retry` en
 * `fatal` houdt de retrylus leesbaar: de lus hoeft niet te raden welke fout
 * nog een kans verdient.
 */
type Attempt =
  | { kind: "ok"; data: OpenFoodFactsResponse }
  | { kind: "not_found" }
  | { kind: "retry"; error: ProviderError }
  | { kind: "fatal"; error: ProviderError };

export class OpenFoodFactsClient {
  private readonly baseUrl: string;
  private readonly userAgent: string;
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;
  private readonly retryDelayMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly sleepImpl: (ms: number) => Promise<void>;

  constructor(options: OpenFoodFactsClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.userAgent = options.userAgent;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxAttempts = Math.max(1, options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
    this.retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleepImpl = options.sleepImpl ?? defaultSleep;
  }

  /**
   * @returns de geparste respons, of `null` als OFF bevestigt dat de barcode
   *          onbekend is (HTTP 404 of `status: 0`).
   * @throws  {ProviderError} bij timeout, netwerkfout, 429 of 5xx.
   */
  async fetchProduct(barcode: string): Promise<OpenFoodFactsResponse | null> {
    const url = `${this.baseUrl}/api/v2/product/${encodeURIComponent(barcode)}.json`;
    let lastError: ProviderError | undefined;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      logger.debug("PRODUCT_PROVIDER_REQUEST", {
        provider: OPEN_FOOD_FACTS_PROVIDER_NAME,
        barcode,
        attempt,
      });

      const result = await this.attempt(url, barcode, attempt);

      switch (result.kind) {
        case "ok":
          return result.data;
        case "not_found":
          return null;
        case "fatal":
          throw result.error;
        case "retry":
          lastError = result.error;
          if (attempt < this.maxAttempts) {
            await this.sleepImpl(this.retryDelayMs * 2 ** (attempt - 1));
          }
          break;
      }
    }

    throw (
      lastError ??
      new ProviderError(
        OPEN_FOOD_FACTS_PROVIDER_NAME,
        "PROVIDER_UNAVAILABLE",
        "De externe productdatabase is niet bereikbaar.",
      )
    );
  }

  private async attempt(url: string, barcode: string, attempt: number): Promise<Attempt> {
    let response: Response;

    try {
      response = await this.requestOnce(url);
    } catch (error: unknown) {
      const isTimeout =
        error instanceof Error &&
        (error.name === "AbortError" || error.name === "TimeoutError");

      logger.warn("PRODUCT_PROVIDER_FAILED", {
        provider: OPEN_FOOD_FACTS_PROVIDER_NAME,
        barcode,
        attempt,
        ...describeError(error),
      });

      return {
        kind: "retry",
        error: new ProviderError(
          OPEN_FOOD_FACTS_PROVIDER_NAME,
          isTimeout ? "PROVIDER_TIMEOUT" : "PROVIDER_UNAVAILABLE",
          isTimeout
            ? "De externe productdatabase reageerde niet op tijd."
            : "De externe productdatabase is niet bereikbaar.",
          { cause: error },
        ),
      };
    }

    if (response.status === 404) return { kind: "not_found" };

    if (response.status === 429 || response.status >= 500) {
      logger.warn("PRODUCT_PROVIDER_FAILED", {
        provider: OPEN_FOOD_FACTS_PROVIDER_NAME,
        barcode,
        attempt,
        httpStatus: response.status,
      });
      return {
        kind: "retry",
        error: new ProviderError(
          OPEN_FOOD_FACTS_PROVIDER_NAME,
          response.status === 429 ? "PROVIDER_RATE_LIMITED" : "PROVIDER_UNAVAILABLE",
          "De externe productdatabase is tijdelijk niet beschikbaar.",
          { details: { httpStatus: response.status } },
        ),
      };
    }

    if (!response.ok) {
      // Overige 4xx: onze aanvraag deugt niet. Opnieuw proberen helpt niet.
      return {
        kind: "fatal",
        error: new ProviderError(
          OPEN_FOOD_FACTS_PROVIDER_NAME,
          "PROVIDER_UNAVAILABLE",
          "De externe productdatabase wees het verzoek af.",
          { details: { httpStatus: response.status } },
        ),
      };
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch (error: unknown) {
      return {
        kind: "retry",
        error: new ProviderError(
          OPEN_FOOD_FACTS_PROVIDER_NAME,
          "PROVIDER_UNAVAILABLE",
          "De externe productdatabase gaf een onleesbaar antwoord.",
          { cause: error },
        ),
      };
    }

    const parsed = openFoodFactsResponseSchema.safeParse(json);
    if (!parsed.success) {
      // Onverwachte vorm behandelen we als storing, niet als "niet gevonden".
      // Anders zou een API-wijziging stilletjes alle producten ongeldig maken.
      return {
        kind: "fatal",
        error: new ProviderError(
          OPEN_FOOD_FACTS_PROVIDER_NAME,
          "PROVIDER_UNAVAILABLE",
          "De externe productdatabase gaf een onverwacht antwoord.",
        ),
      };
    }

    if (parsed.data.status !== 1 || !parsed.data.product) return { kind: "not_found" };
    return { kind: "ok", data: parsed.data };
  }

  private async requestOnce(url: string): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetchImpl(url, {
        method: "GET",
        headers: {
          // Open Food Facts vraagt om een identificeerbare User-Agent.
          "User-Agent": this.userAgent,
          Accept: "application/json",
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }
}
