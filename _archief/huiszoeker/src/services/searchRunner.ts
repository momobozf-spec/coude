/**
 * De pijplijn van één run.
 *
 *   bronnen → normaliseren → ontdubbelen → matchen → opslaan
 *
 * Dit is de `SearchExecutor` die in fase 2 nog een lege huls was. De vier
 * stappen zijn strikt gescheiden en elk apart testbaar: bronnen leveren
 * `PropertyListing[]`, de repository ontdubbelt en persisteert, de matching
 * engine oordeelt, en pas daarna wordt er iets bewaard.
 *
 * Twee dingen die opvallen en bewust zijn:
 *
 *  1. Een falende bron laat de run niet klappen. Drie bronnen waarvan er één
 *     geblokkeerd is, leveren nog steeds de resultaten van de andere twee. De
 *     blokkade komt wél in `sourceStats` en in de logs terecht.
 *  2. Een pand dat de harde eisen niet haalt wordt tóch opgeslagen (het bestaat
 *     nu eenmaal), maar er komt geen `SearchMatch` en dus geen melding. Zo
 *     bouwen we historiek op zonder de gebruiker lastig te vallen.
 */
import { LogEvent } from "../lib/events.js";
import type { Logger } from "../lib/logger.js";
import { SourceBlockedError, RobotsDisallowedError } from "../lib/errors.js";
import type { PropertyRepository, SearchMatchRepository } from "../db/repositories/interfaces.js";
import type { SearchExecutor } from "./searchService.js";
import type { SearchRecord, SearchRunTotals } from "../types/domain.js";
import type { PropertyListing } from "../schemas/property.js";
import type { PropertySource, SourceSearchContext } from "../sources/types.js";
import type { SourceRegistry } from "../sources/registry.js";
import { matchesCriteria, toMatchable } from "./matchingService.js";

export interface SourceStat {
  source: string;
  status: "ok" | "blocked" | "failed" | "skipped";
  listings: number;
  durationMs: number;
  reason?: string;
}

interface SearchRunnerDeps {
  registry: SourceRegistry;
  properties: PropertyRepository;
  matches: SearchMatchRepository;
  logger: Logger;
  maxResultsPerSource: number;
  /** Harde bovengrens op de duur van één run. */
  runTimeoutMs?: number;
}

const DEFAULT_RUN_TIMEOUT_MS = 15 * 60 * 1000;

export class SearchRunner implements SearchExecutor {
  constructor(private readonly deps: SearchRunnerDeps) {}

  async execute(search: SearchRecord, runId: string): Promise<SearchRunTotals> {
    const log = this.deps.logger;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.deps.runTimeoutMs ?? DEFAULT_RUN_TIMEOUT_MS);

    const stats: SourceStat[] = [];
    let scrapedCount = 0;
    let newPropertyCount = 0;
    let matchCount = 0;

    try {
      const sources = this.deps.registry.resolve(search.criteria, log);
      if (sources.length === 0) {
        log.warn(
          { event: LogEvent.SOURCE_SKIPPED, searchId: search.id, runId },
          "Geen actieve bronnen voor deze zoekopdracht; controleer SCRAPER_ENABLED_SOURCES",
        );
      }

      // Bronnen na elkaar, niet parallel: parallel draaien zou de
      // snelheidsbeperking per host omzeilen zodra twee bronnen dezelfde host
      // delen, en het maakt de logs onleesbaar.
      for (const source of sources) {
        const listings = await this.runSource(source, search, controller.signal, stats);
        scrapedCount += listings.length;

        for (const listing of listings) {
          if (controller.signal.aborted) break;
          const result = await this.persistAndMatch(search, listing, log);
          if (result.isNew) newPropertyCount += 1;
          if (result.matched) matchCount += 1;
        }
      }

      return { scrapedCount, newPropertyCount, matchCount, notifiedCount: 0, sourceStats: stats };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async runSource(
    source: PropertySource,
    search: SearchRecord,
    signal: AbortSignal,
    stats: SourceStat[],
  ): Promise<PropertyListing[]> {
    const log = this.deps.logger;
    const startedAt = Date.now();

    const context: SourceSearchContext = {
      maxResults: this.deps.maxResultsPerSource,
      signal,
      logger: log,
    };

    try {
      const listings = await source.search(search.criteria, context);
      stats.push({
        source: source.name,
        status: "ok",
        listings: listings.length,
        durationMs: Date.now() - startedAt,
      });
      return listings;
    } catch (e) {
      const blocked = e instanceof SourceBlockedError || e instanceof RobotsDisallowedError;
      const reason = e instanceof Error ? e.message : String(e);

      stats.push({
        source: source.name,
        status: blocked ? "blocked" : "failed",
        listings: 0,
        durationMs: Date.now() - startedAt,
        reason,
      });

      log[blocked ? "warn" : "error"](
        {
          event: blocked ? LogEvent.SOURCE_BLOCKED : LogEvent.SOURCE_FAILED,
          source: source.name,
          searchId: search.id,
          reason,
        },
        blocked ? "Bron blokkeert ons; overgeslagen" : "Bron faalde; overgeslagen",
      );

      // Bewust geen rethrow: één dichte bron mag de andere niet meenemen.
      return [];
    }
  }

  private async persistAndMatch(
    search: SearchRecord,
    listing: PropertyListing,
    log: Logger,
  ): Promise<{ isNew: boolean; matched: boolean }> {
    const { property, isNew, changes } = await this.deps.properties.upsertFromListing(listing);

    if (isNew) {
      log.info(
        { event: LogEvent.PROPERTY_NEW, source: listing.source, externalId: listing.externalId, propertyId: property.id },
        "Nieuw pand",
      );
    } else if (changes.length > 0) {
      log.info(
        { event: LogEvent.PROPERTY_UPDATED, propertyId: property.id, changes: changes.map((c) => c.field) },
        "Pand gewijzigd",
      );
    } else {
      log.debug({ event: LogEvent.PROPERTY_DUPLICATE, propertyId: property.id }, "Pand ongewijzigd");
    }

    const result = matchesCriteria(toMatchable(property), search.criteria);

    if (!result.hardPass) {
      log.debug(
        {
          event: LogEvent.MATCH_REJECTED,
          searchId: search.id,
          propertyId: property.id,
          failed: result.reasons.filter((r) => r.hard && r.verdict !== "pass").map((r) => r.field),
        },
        "Pand voldoet niet aan de harde eisen",
      );
      return { isNew, matched: false };
    }

    // Dezelfde woning op een andere site: wel opslaan, niet twee keer melden.
    const duplicates = await this.deps.properties.findByFingerprint(property.fingerprint, property.id);
    if (duplicates.length > 0) {
      const existing = await this.deps.matches.listForUser(search.userId, { searchId: search.id, limit: 200 });
      const alreadyKnown = new Set(existing.map((m) => m.propertyId));
      if (duplicates.some((d) => alreadyKnown.has(d.id))) {
        log.info(
          { event: LogEvent.PROPERTY_DUPLICATE, propertyId: property.id, fingerprint: property.fingerprint },
          "Zelfde woning al bekend via een andere bron; geen tweede melding",
        );
        return { isNew, matched: false };
      }
    }

    const { match, isNew: isNewMatch } = await this.deps.matches.upsert({
      searchId: search.id,
      propertyId: property.id,
      userId: search.userId,
      score: result.score,
      hardPass: result.hardPass,
      reasons: [...result.reasons],
    });

    log.info(
      { event: LogEvent.MATCH_FOUND, searchId: search.id, propertyId: property.id, matchId: match.id, score: result.score, isNew: isNewMatch },
      "Match",
    );

    return { isNew, matched: isNewMatch };
  }
}
