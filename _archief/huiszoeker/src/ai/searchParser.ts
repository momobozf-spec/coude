/**
 * Vrije tekst → `SearchCriteria`.
 *
 * De volgorde is: model → deterministische opschoning → Zod-validatie. Faalt de
 * validatie, dan één retry met de concrete validatiefouten erbij; daarna een
 * `AiParseError`. Er wordt nooit een half ingevuld object opgeslagen.
 *
 * Merk op wat hier NIET gebeurt: er is geen fallback die zelf criteria probeert
 * te raden uit de tekst wanneer het model faalt. Half geraden criteria die
 * stilletjes worden opgeslagen zijn erger dan een duidelijke fout — de
 * gebruiker krijgt dan maanden meldingen over de verkeerde panden zonder te
 * weten waarom.
 */
import { AiParseError, ValidationError } from "../lib/errors.js";
import { LogEvent } from "../lib/events.js";
import { logger as rootLogger } from "../lib/logger.js";
import {
  CRITERIA_SCHEMA_VERSION,
  hasAnyCriterion,
  searchCriteriaSchema,
  type SearchCriteria,
} from "../schemas/searchCriteria.js";
import type { AiProvider } from "../types/ai.js";
import { getAiProvider } from "./providers/index.js";
import { normalizeRawCriteria } from "./normalizeCriteria.js";
import { SEARCH_PARSER_SYSTEM_PROMPT, retryHint } from "./prompts/searchParser.js";
import { env } from "../config/env.js";

export interface ParsedSearch {
  readonly criteria: SearchCriteria;
  readonly criteriaVersion: number;
  /** Welke provider en welk model dit geproduceerd hebben. Opgeslagen zodat we
   *  later kunnen zien welke zoekopdrachten door een oudere parser zijn gegaan. */
  readonly parsedBy: string;
}

export const MAX_QUERY_LENGTH = 2000;

interface ParseOptions {
  readonly provider?: AiProvider;
  readonly logger?: { info: (o: object, m: string) => void; warn: (o: object, m: string) => void };
}

export async function parseSearchQuery(query: string, options: ParseOptions = {}): Promise<ParsedSearch> {
  const text = query.trim();
  if (text.length === 0) {
    throw new ValidationError("De zoekopdracht is leeg");
  }
  if (text.length > MAX_QUERY_LENGTH) {
    throw new ValidationError(`De zoekopdracht mag maximaal ${MAX_QUERY_LENGTH} tekens bevatten`);
  }

  const provider = options.provider ?? getAiProvider();
  const log = options.logger ?? rootLogger;

  log.info({ event: LogEvent.AI_PARSE_STARTED, provider: provider.name, queryLength: text.length }, "AI-parse gestart");

  let userMessage = text;
  let lastError: AiParseError | undefined;

  for (let attempt = 0; attempt <= env.AI_MAX_VALIDATION_RETRIES; attempt++) {
    try {
      const criteria = await provider.complete<SearchCriteria>({
        system: SEARCH_PARSER_SYSTEM_PROMPT,
        user: userMessage,
        schema: searchCriteriaSchema,
        schemaName: "search_criteria",
        normalize: normalizeRawCriteria,
        maxTokens: 2048,
      });

      if (!hasAnyCriterion(criteria)) {
        throw new AiParseError(
          "Uit deze tekst kwam geen enkel bruikbaar zoekcriterium. Noem bijvoorbeeld een plaats, een budget of een woningtype.",
        );
      }

      log.info(
        { event: LogEvent.AI_PARSE_COMPLETED, provider: provider.name, attempts: attempt + 1 },
        "AI-parse geslaagd",
      );
      return {
        criteria,
        criteriaVersion: CRITERIA_SCHEMA_VERSION,
        parsedBy: describeParser(provider),
      };
    } catch (e) {
      if (!(e instanceof AiParseError)) throw e;
      lastError = e;

      const issues = extractIssues(e.details);
      // Zonder concrete validatiefouten heeft een retry geen extra informatie
      // en dus geen kans van slagen. Direct falen scheelt tokens en tijd.
      if (issues.length === 0 || attempt === env.AI_MAX_VALIDATION_RETRIES) break;

      log.warn(
        { event: LogEvent.AI_PARSE_RETRIED, provider: provider.name, attempt: attempt + 1, issues },
        "Modeloutput voldeed niet aan het schema; opnieuw proberen",
      );
      userMessage = `${text}${retryHint(issues)}`;
    }
  }

  log.warn({ event: LogEvent.AI_PARSE_FAILED, provider: provider.name }, "AI-parse mislukt");
  throw lastError ?? new AiParseError("De zoekopdracht kon niet omgezet worden naar criteria");
}

function describeParser(provider: AiProvider): string {
  const model = provider.name === "openai" ? env.OPENAI_MODEL : env.ANTHROPIC_MODEL;
  return `${provider.name}:${model ?? "unknown"}@v${CRITERIA_SCHEMA_VERSION}`;
}

function extractIssues(details: unknown): { path: string; message: string }[] {
  if (typeof details !== "object" || details === null) return [];
  const issues = (details as { issues?: unknown }).issues;
  if (!Array.isArray(issues)) return [];
  return issues.filter(
    (i): i is { path: string; message: string } =>
      typeof i === "object" && i !== null && "path" in i && "message" in i,
  );
}
