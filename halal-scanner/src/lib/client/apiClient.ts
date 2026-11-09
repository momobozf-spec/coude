/**
 * De enige plek waar de browser onze API aanroept.
 *
 * Alles gaat door één functie, zodat de envelope `{ data, meta }` /
 * `{ error }` op één plek uitgepakt wordt en elke foutcode uit `AppErrorCode`
 * hier naar een client-state vertaald wordt. Componenten krijgen daardoor nooit
 * een ruwe `Response` te zien en hoeven niet zelf te raden of een 404 "product
 * bestaat niet" of "route bestaat niet" betekent.
 *
 * De backend blijft de bron van waarheid voor validatie: deze laag interpreteert
 * foutcodes, maar verzint er geen.
 */
import type { AnalysisDto } from "@/server/services/analysisPresenter";
import type { ProductDetailDto, ProductSummaryDto } from "@/server/services/productPresenter";

/** De situaties waar de UI daadwerkelijk verschillend op reageert. */
export type ApiErrorKind =
  | "INVALID_BARCODE"
  | "PRODUCT_NOT_FOUND"
  | "PROVIDER_UNAVAILABLE"
  | "RATE_LIMITED"
  | "NETWORK_ERROR"
  | "UNKNOWN";

export class ApiClientError extends Error {
  readonly kind: ApiErrorKind;
  readonly code: string;
  readonly requestId: string | null;
  /** Retry heeft alleen zin bij iets tijdelijks. */
  readonly retryable: boolean;
  /**
   * Extra context van de server, bv. `{ reason: "NO_TEXT" }`. De UI mag hier
   * op sturen om een specifieke herstelactie te tonen; onbekende waarden vallen
   * altijd terug op een generieke boodschap.
   */
  readonly details: Record<string, unknown> | null;

  constructor(
    kind: ApiErrorKind,
    code: string,
    message: string,
    requestId: string | null,
    details: Record<string, unknown> | null = null,
  ) {
    super(message);
    this.name = "ApiClientError";
    this.kind = kind;
    this.code = code;
    this.requestId = requestId;
    this.details = details;
    this.retryable =
      kind === "PROVIDER_UNAVAILABLE" || kind === "NETWORK_ERROR" || kind === "RATE_LIMITED";
  }
}

function toKind(code: string): ApiErrorKind {
  switch (code) {
    case "INVALID_BARCODE":
    case "VALIDATION_ERROR":
      return "INVALID_BARCODE";
    case "PRODUCT_NOT_FOUND":
    case "RESOURCE_NOT_FOUND":
      return "PRODUCT_NOT_FOUND";
    case "PROVIDER_UNAVAILABLE":
    case "PROVIDER_TIMEOUT":
      return "PROVIDER_UNAVAILABLE";
    case "PROVIDER_RATE_LIMITED":
    case "RATE_LIMITED":
      return "RATE_LIMITED";
    default:
      return "UNKNOWN";
  }
}

interface Envelope<T> {
  data?: T;
  meta?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    requestId: string;
    details?: Record<string, unknown>;
  };
}

async function request<T>(
  url: string,
  init?: RequestInit,
): Promise<{ data: T; meta: Record<string, unknown> }> {
  let response: Response;

  try {
    response = await fetch(url, { ...init, headers: { accept: "application/json", ...init?.headers } });
  } catch {
    // Geen verbinding, DNS-fout, afgebroken request: er is geen envelope om uit
    // te pakken, dus deze fout maken we hier zelf.
    throw new ApiClientError(
      "NETWORK_ERROR",
      "NETWORK_ERROR",
      "Geen verbinding. Controleer je internetverbinding en probeer het opnieuw.",
      null,
    );
  }

  let body: Envelope<T>;
  try {
    body = (await response.json()) as Envelope<T>;
  } catch {
    throw new ApiClientError(
      "UNKNOWN",
      "INVALID_RESPONSE",
      "Onverwacht antwoord van de server.",
      null,
    );
  }

  if (!response.ok || body.error) {
    const error = body.error;
    throw new ApiClientError(
      toKind(error?.code ?? "UNKNOWN"),
      error?.code ?? "UNKNOWN",
      error?.message ?? "Er ging iets mis.",
      error?.requestId ?? null,
      error?.details ?? null,
    );
  }

  return { data: body.data as T, meta: body.meta ?? {} };
}

/** Wat `meta.analysisStatus` kan zijn; de UI reageert op alle drie. */
export type AnalysisStatus = "OK" | "NONE" | "FAILED";

export interface BarcodeLookupResult {
  product: ProductDetailDto;
  analysis: AnalysisDto | null;
  analysisStatus: AnalysisStatus;
  cached: boolean;
  provider: string | null;
}

export async function lookupBarcode(
  barcode: string,
  options: { signal?: AbortSignal } = {},
): Promise<BarcodeLookupResult> {
  const { data, meta } = await request<{
    product: ProductDetailDto;
    analysis: AnalysisDto | null;
  }>(`/api/products/barcode/${encodeURIComponent(barcode)}`, { signal: options.signal });

  return {
    product: data.product,
    analysis: data.analysis,
    analysisStatus: (meta.analysisStatus as AnalysisStatus | undefined) ?? "NONE",
    cached: Boolean(meta.cached),
    provider: (meta.provider as string | undefined) ?? null,
  };
}

export interface OcrLookupResult {
  text: string;
  confidence: number | null;
  lowConfidence: boolean;
  warnings: string[];
}

/**
 * Stuurt de foto naar de server voor tekstherkenning.
 *
 * De afbeelding gaat als `FormData` en wordt nergens door deze client
 * gekopieerd, gecachet of gelogd. Na dit request is er in de browser alleen nog
 * de object-URL voor de preview, en die wordt door de UI expliciet vrijgegeven.
 */
export async function runOcr(
  file: File,
  options: { signal?: AbortSignal } = {},
): Promise<OcrLookupResult> {
  const form = new FormData();
  form.append("image", file);

  const { data } = await request<OcrLookupResult>("/api/ocr", {
    method: "POST",
    body: form,
    signal: options.signal,
  });

  return data;
}

/**
 * Analyseert losse ingrediëntentekst via dezelfde engine als een gescand
 * product. De frontend beslist niets: hij stuurt tekst en toont de uitkomst.
 */
export interface TextAnalysisResult {
  analysis: AnalysisDto;
  /**
   * Waarschuwingen over de tekst, niet over de ingrediënten. Bijvoorbeeld dat
   * een deel in een schrift stond dat niet meegenomen kon worden.
   */
  warnings: string[];
}

export async function analyzeIngredientText(
  text: string,
  options: { signal?: AbortSignal } = {},
): Promise<TextAnalysisResult> {
  const { data } = await request<{ analysis: AnalysisDto; warnings?: string[] }>(
    "/api/analysis/text",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
      signal: options.signal,
    },
  );

  return { analysis: data.analysis, warnings: data.warnings ?? [] };
}

export async function searchProducts(
  query: string,
  options: { signal?: AbortSignal } = {},
): Promise<ProductSummaryDto[]> {
  const { data } = await request<{ products: ProductSummaryDto[] }>(
    `/api/products/search?q=${encodeURIComponent(query)}`,
    { signal: options.signal },
  );
  return data.products;
}
