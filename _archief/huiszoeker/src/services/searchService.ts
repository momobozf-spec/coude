/**
 * Businesslogica rond zoekopdrachten.
 *
 * Twee dingen zijn hier bewust:
 *
 *  1. Deze service kent geen Prisma. Hij krijgt repositories via de
 *     constructor, dus elke test hieronder draait op in-memory implementaties.
 *  2. Het uitvoeren van een zoekopdracht is opgesplitst: deze service regelt
 *     het slot, het run-record en de tijden; wát er tijdens een run gebeurt zit
 *     achter `SearchExecutor`. Fase 2 levert een executor die niets doet, fase 3
 *     vervangt hem door de echte pijplijn. Zo is de vergrendeling nu al af en
 *     te testen, zonder dat er een half afgemaakte scraper in zit.
 */
import type { SearchRepository, SearchRunRepository } from "../db/repositories/interfaces.js";
import { NotFoundError, ValidationError } from "../lib/errors.js";
import { LogEvent } from "../lib/events.js";
import type { Logger } from "../lib/logger.js";
import {
  CRITERIA_SCHEMA_VERSION,
  hasAnyCriterion,
  searchCriteriaSchema,
  type SearchCriteria,
} from "../schemas/searchCriteria.js";
import type { SearchFrequency, SearchRecord, SearchRunTotals } from "../types/domain.js";
import { parseSearchQuery } from "../ai/searchParser.js";
import type { AiProvider } from "../types/ai.js";

export interface SearchExecutor {
  execute(search: SearchRecord, runId: string): Promise<SearchRunTotals>;
}

/** Fase 2: het slot en de administratie werken, de pijplijn komt in fase 3. */
export class NoopSearchExecutor implements SearchExecutor {
  execute(): Promise<SearchRunTotals> {
    return Promise.resolve({ scrapedCount: 0, newPropertyCount: 0, matchCount: 0, notifiedCount: 0 });
  }
}

export interface CreateSearchRequest {
  /** Vrije tekst. Wanneer aanwezig wordt hij door de AI-parser gehaald. */
  query?: string;
  /** Rechtstreeks aangeleverde criteria. Wint van `query` wanneer beide er zijn. */
  criteria?: unknown;
  name?: string;
  frequency?: SearchFrequency;
  active?: boolean;
}

export interface UpdateSearchRequest {
  name?: string;
  query?: string;
  criteria?: unknown;
  frequency?: SearchFrequency;
  active?: boolean;
}

export interface RunResult {
  runId: string | null;
  started: boolean;
  reason?: "locked" | "inactive";
  totals?: SearchRunTotals;
}

interface SearchServiceDeps {
  searches: SearchRepository;
  searchRuns: SearchRunRepository;
  executor?: SearchExecutor;
  logger: Logger;
  /** Hoe lang een slot geldig blijft voor het overgenomen mag worden. */
  lockTtlMinutes: number;
  /** Identificeert deze worker in `Search.lockedBy`. */
  workerId: string;
  /** Injecteerbaar zodat tests nooit een echte AI-aanroep doen. */
  aiProvider?: AiProvider;
  now?: () => Date;
}

const FREQUENCY_INTERVAL_MS: Record<SearchFrequency, number> = {
  HOURLY: 60 * 60 * 1000,
  EVERY_6_HOURS: 6 * 60 * 60 * 1000,
  DAILY: 24 * 60 * 60 * 1000,
};

export class SearchService {
  private readonly deps: SearchServiceDeps;
  private readonly executor: SearchExecutor;
  private readonly now: () => Date;

  constructor(deps: SearchServiceDeps) {
    this.deps = deps;
    this.executor = deps.executor ?? new NoopSearchExecutor();
    this.now = deps.now ?? (() => new Date());
  }

  /** Vrije tekst → criteria, zonder iets op te slaan. Voedt POST /searches/parse. */
  async parse(query: string): Promise<{ criteria: SearchCriteria; criteriaVersion: number; parsedBy: string }> {
    const parsed = await parseSearchQuery(query, { provider: this.deps.aiProvider, logger: this.deps.logger });
    return { criteria: parsed.criteria, criteriaVersion: parsed.criteriaVersion, parsedBy: parsed.parsedBy };
  }

  async create(userId: string, request: CreateSearchRequest): Promise<SearchRecord> {
    const { criteria, criteriaVersion, parsedBy, originalQuery } = await this.resolveCriteria(request);

    const name = (request.name ?? "").trim() || deriveName(criteria);

    return this.deps.searches.create({
      userId,
      name,
      originalQuery,
      criteria,
      criteriaVersion,
      parsedBy,
      frequency: request.frequency,
      active: request.active,
    });
  }

  async get(id: string, userId: string): Promise<SearchRecord> {
    const search = await this.deps.searches.findForUser(id, userId);
    // Bewust 404 en geen 403 wanneer de zoekopdracht van iemand anders is: een
    // 403 zou bevestigen dat het id bestaat, en dat is informatie die een
    // vreemde niet hoort te krijgen.
    if (!search) throw new NotFoundError("SEARCH_NOT_FOUND", "Zoekopdracht niet gevonden");
    return search;
  }

  async list(
    userId: string,
    options: { activeOnly?: boolean; limit?: number; offset?: number } = {},
  ): Promise<{ items: SearchRecord[]; total: number }> {
    const [items, total] = await Promise.all([
      this.deps.searches.listForUser(userId, options),
      this.deps.searches.countForUser(userId, options),
    ]);
    return { items, total };
  }

  async update(id: string, userId: string, request: UpdateSearchRequest): Promise<SearchRecord> {
    await this.get(id, userId);

    const patch: Parameters<SearchRepository["update"]>[2] = {};

    if (request.name !== undefined) {
      const trimmed = request.name.trim();
      if (trimmed.length === 0) throw new ValidationError("De naam mag niet leeg zijn");
      patch.name = trimmed;
    }
    if (request.frequency !== undefined) patch.frequency = request.frequency;
    if (request.active !== undefined) patch.active = request.active;

    if (request.criteria !== undefined || request.query !== undefined) {
      const resolved = await this.resolveCriteria({ criteria: request.criteria, query: request.query });
      patch.criteria = resolved.criteria;
      patch.criteriaVersion = resolved.criteriaVersion;
      patch.parsedBy = resolved.parsedBy;
      patch.originalQuery = resolved.originalQuery;
    }

    const updated = await this.deps.searches.update(id, userId, patch);
    if (!updated) throw new NotFoundError("SEARCH_NOT_FOUND", "Zoekopdracht niet gevonden");
    return updated;
  }

  async setActive(id: string, userId: string, active: boolean): Promise<SearchRecord> {
    return this.update(id, userId, { active });
  }

  async delete(id: string, userId: string): Promise<void> {
    const deleted = await this.deps.searches.delete(id, userId);
    if (!deleted) throw new NotFoundError("SEARCH_NOT_FOUND", "Zoekopdracht niet gevonden");
  }

  /**
   * Voert een zoekopdracht uit. Handmatig aangeroepen (POST /:id/run) of door de
   * scheduler.
   *
   * Het slot wordt geclaimd vóór er een run-record bestaat. Andersom zou een
   * geweigerde claim een weesrun achterlaten die nooit afgesloten wordt.
   */
  async run(id: string, userId: string, options: { force?: boolean } = {}): Promise<RunResult> {
    const search = await this.get(id, userId);
    return this.runSearch(search, options);
  }

  /** Zonder eigendomscheck; alleen voor de scheduler, die al gefilterd heeft. */
  async runSearch(search: SearchRecord, options: { force?: boolean } = {}): Promise<RunResult> {
    const log = this.deps.logger;

    if (!search.active && !options.force) {
      log.info({ event: LogEvent.SEARCH_SKIPPED_LOCKED, searchId: search.id }, "Zoekopdracht staat uit");
      return { runId: null, started: false, reason: "inactive" };
    }

    const acquired = await this.deps.searches.tryAcquireLock(
      search.id,
      this.deps.workerId,
      this.deps.lockTtlMinutes,
      this.now(),
    );
    if (!acquired) {
      log.warn(
        { event: LogEvent.SEARCH_SKIPPED_LOCKED, searchId: search.id, worker: this.deps.workerId },
        "Zoekopdracht draait al; overgeslagen",
      );
      return { runId: null, started: false, reason: "locked" };
    }

    const run = await this.deps.searchRuns.start(search.id);
    log.info({ event: LogEvent.SEARCH_STARTED, searchId: search.id, runId: run.id }, "Run gestart");

    try {
      const totals = await this.executor.execute(search, run.id);
      await this.deps.searchRuns.complete(run.id, totals);
      log.info({ event: LogEvent.SEARCH_COMPLETED, searchId: search.id, runId: run.id, ...totals }, "Run klaar");
      return { runId: run.id, started: true, totals };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await this.deps.searchRuns.fail(run.id, message);
      log.error({ event: LogEvent.SEARCH_FAILED, searchId: search.id, runId: run.id, reason: message }, "Run mislukt");
      throw e;
    } finally {
      // In een finally: ook bij een fout moet het slot los, anders blokkeert de
      // zoekopdracht tot de TTL verstrijkt.
      const finishedAt = this.now();
      await this.deps.searches.releaseLock(search.id, this.deps.workerId, {
        lastRunAt: finishedAt,
        nextRunAt: nextRunAt(finishedAt, search.frequency),
      });
    }
  }

  /** Vrije tekst of expliciete criteria → gevalideerde criteria. */
  private async resolveCriteria(request: {
    query?: string;
    criteria?: unknown;
  }): Promise<{ criteria: SearchCriteria; criteriaVersion: number; parsedBy: string | null; originalQuery: string }> {
    if (request.criteria !== undefined) {
      const parsed = searchCriteriaSchema.safeParse(request.criteria);
      if (!parsed.success) {
        throw new ValidationError("De aangeleverde criteria zijn ongeldig", {
          issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        });
      }
      if (!hasAnyCriterion(parsed.data)) {
        throw new ValidationError("De criteria bevatten geen enkel bruikbaar filter");
      }
      return {
        criteria: parsed.data,
        criteriaVersion: CRITERIA_SCHEMA_VERSION,
        parsedBy: null,
        originalQuery: (request.query ?? "").trim(),
      };
    }

    if (request.query === undefined || request.query.trim() === "") {
      throw new ValidationError("Geef een zoekopdracht in vrije tekst (query) of gestructureerde criteria");
    }

    const parsed = await parseSearchQuery(request.query, {
      provider: this.deps.aiProvider,
      logger: this.deps.logger,
    });
    return {
      criteria: parsed.criteria,
      criteriaVersion: parsed.criteriaVersion,
      parsedBy: parsed.parsedBy,
      originalQuery: request.query.trim(),
    };
  }
}

export function nextRunAt(from: Date, frequency: SearchFrequency): Date {
  return new Date(from.getTime() + FREQUENCY_INTERVAL_MS[frequency]);
}

/**
 * Automatische naam wanneer de gebruiker er geen geeft: "Huis Gent",
 * "Appartement Brussel". Alleen wat de gebruiker zelf genoemd heeft — nooit een
 * gegokt kenmerk.
 */
export function deriveName(criteria: SearchCriteria): string {
  const type = criteria.hardRequirements.propertyTypes?.[0] ?? criteria.preferences.propertyTypes?.[0];
  const place = criteria.locations?.[0] ?? criteria.postalCodes?.[0];
  const verb = criteria.transactionType === "rent" ? "huur" : "koop";

  const typeLabel = type ? PROPERTY_TYPE_LABELS[type] ?? type : "Zoekopdracht";
  const parts = [typeLabel, place].filter(Boolean);
  return parts.length > 1 ? parts.join(" ") : `${typeLabel} (${verb})`;
}

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  house: "Huis",
  apartment: "Appartement",
  villa: "Villa",
  studio: "Studio",
  penthouse: "Penthouse",
  duplex: "Duplex",
  loft: "Loft",
  bungalow: "Bungalow",
  farmhouse: "Hoeve",
  land: "Grond",
  commercial: "Handelspand",
  garage: "Garage",
  other: "Vastgoed",
};
