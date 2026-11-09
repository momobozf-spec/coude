/**
 * De registry: welke bronnen bestaan, en welke daarvan mogen draaien.
 *
 * Aanzetten gaat uitsluitend via `SCRAPER_ENABLED_SOURCES`. Standaard staat
 * alleen `fixture` aan. Dat is geen voorzichtigheidsritueel: robots.txt zegt
 * niets over de gebruiksvoorwaarden van een site, en die afweging hoort bij de
 * beheerder van de installatie, niet bij een default in de code.
 *
 * Een nieuwe bron toevoegen is: implementeer `PropertySource`, zet hem in
 * `ALL_SOURCES`, en noem hem in de env. Geen enkele andere plek in de codebase
 * hoeft te weten dat hij bestaat.
 */
import { env } from "../config/env.js";
import { LogEvent } from "../lib/events.js";
import type { SearchCriteria } from "../schemas/searchCriteria.js";
import type { PropertySource, SourceLogger } from "./types.js";
import { FixtureSource } from "./fixture/fixtureSource.js";
import { ImmowebSource } from "./immoweb/immowebSource.js";
import { ZimmoSource } from "./zimmo/zimmoSource.js";
import { HttpClient } from "./base/HttpClient.js";
import { RobotsPolicy } from "./base/RobotsPolicy.js";

export class SourceRegistry {
  private readonly sources: Map<string, PropertySource>;
  private readonly enabled: Set<string>;

  constructor(sources: PropertySource[], enabledNames: readonly string[]) {
    this.sources = new Map(sources.map((s) => [s.name, s]));
    this.enabled = new Set(enabledNames.map((n) => n.toLowerCase()));
  }

  /** Alle geregistreerde bronnen, ongeacht configuratie. Voor /ready en de CLI. */
  all(): PropertySource[] {
    return [...this.sources.values()];
  }

  /** Namen uit de configuratie die geen geregistreerde bron zijn — een typefout
   *  in de env moet zichtbaar worden, niet stil resulteren in nul bronnen. */
  unknownEnabledNames(): string[] {
    return [...this.enabled].filter((n) => !this.sources.has(n));
  }

  isEnabled(name: string): boolean {
    return this.enabled.has(name.toLowerCase());
  }

  /** De bronnen die voor déze zoekopdracht mogen én kunnen draaien. */
  resolve(criteria: SearchCriteria, logger?: SourceLogger): PropertySource[] {
    const resolved: PropertySource[] = [];
    for (const source of this.sources.values()) {
      if (!this.isEnabled(source.name)) continue;
      if (!source.supports(criteria)) {
        logger?.debug(
          { event: LogEvent.SOURCE_SKIPPED, source: source.name, reason: "supports() gaf false" },
          "Bron overgeslagen",
        );
        continue;
      }
      resolved.push(source);
    }
    return resolved;
  }
}

/**
 * Alles wat de applicatie kent.
 *
 * De HTTP-client wordt hier één keer gemaakt en gedeeld door alle scrape-
 * bronnen. Dat is essentieel: de snelheidsbeperking is per host, en twee
 * bronnen met elk hun eigen client zouden die limiet samen verdubbelen zonder
 * dat iemand dat merkt.
 */
export function allSources(): PropertySource[] {
  const robots = new RobotsPolicy({
    userAgent: env.SCRAPER_USER_AGENT,
    timeoutMs: env.SCRAPER_TIMEOUT_MS,
  });

  const http = new HttpClient({
    userAgent: env.SCRAPER_USER_AGENT,
    robots,
    requestsPerMinute: env.SCRAPER_REQUESTS_PER_MINUTE,
    timeoutMs: env.SCRAPER_TIMEOUT_MS,
    maxRetries: env.SCRAPER_MAX_RETRIES,
  });

  return [new FixtureSource(), new ImmowebSource(http), new ZimmoSource(http)];
}

let cached: SourceRegistry | undefined;

export function getSourceRegistry(): SourceRegistry {
  cached ??= new SourceRegistry(allSources(), env.SCRAPER_ENABLED_SOURCES);
  return cached;
}

/** Alleen voor tests. */
export function setSourceRegistry(registry: SourceRegistry | undefined): void {
  cached = registry;
}
