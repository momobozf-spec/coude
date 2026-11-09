/**
 * De AI-laag achter één interface, zodat Anthropic en OpenAI uitwisselbaar zijn
 * en de rest van de applicatie geen provider-SDK importeert.
 *
 * Er is bewust maar één methode. Alles wat we van een model willen is:
 * "vul dit JSON-schema in" of "schrijf deze korte tekst". Meer werkwoorden zou
 * betekenen dat we businesslogica naar het model verplaatsen, en dat doen we
 * niet (zie ARCHITECTURE.md §7).
 */
import type { ZodType } from "zod";

export type AiProviderName = "anthropic" | "openai";

export interface StructuredRequest<T> {
  /** Systeeminstructie; stabiel, zodat prompt-caching effect heeft. */
  readonly system: string;
  readonly user: string;
  /** Contract én validatie in één: het JSON-schema hiervan gaat naar het model,
   *  en dezelfde schema valideert wat terugkomt. */
  readonly schema: ZodType<T>;
  /** Naam van het schema; sommige providers eisen die in het outputcontract. */
  readonly schemaName: string;
  /**
   * Deterministische opschoning tussen `JSON.parse` en validatie. Vangt
   * schrijfwijzeverschillen op ("450k", "GARDEN") zonder de validatie te
   * verzwakken: wat hierna nog niet past, faalt alsnog.
   */
  readonly normalize?: (raw: unknown) => unknown;
  readonly maxTokens?: number;
}

export interface TextRequest {
  readonly system: string;
  readonly user: string;
  readonly maxTokens?: number;
}

export interface AiProvider {
  readonly name: AiProviderName;

  /**
   * Vraagt gestructureerde output en valideert die met `schema`.
   * Faalt de validatie, dan één retry met de foutmelding erbij; daarna een
   * `AiValidationError`. Nooit een half ingevuld object teruggeven.
   */
  complete<T>(req: StructuredRequest<T>): Promise<T>;

  /** Vrije tekst, voor de "waarom interessant"-samenvatting. */
  completeText(req: TextRequest): Promise<string>;
}
