/**
 * robots.txt als echte poort, niet als decoratie.
 *
 * Elke uitgaande request van een `scrape`-bron loopt hierlangs. Voor Immoweb
 * betekent dat concreet iets: hun robots.txt verbiedt onder meer `*maxprice*`,
 * `*minprice*`, `*orderBy*` en `*searchByRooms*` — precies de query-parameters
 * die een filterende scraper zou gebruiken. Deze klasse blokkeert zo'n URL
 * daadwerkelijk, en dat is de reden dat de Immoweb-adapter pad-gebaseerde
 * zoek-URL's bouwt en het filteren aan onze eigen matching engine overlaat.
 *
 * Bij twijfel weigeren we. Kunnen we robots.txt niet ophalen, dan gaan we niet
 * verder: een site die zijn regels niet kan leveren heeft ons niet uitgenodigd.
 * De enige uitzondering is een 404 — geen robots.txt betekent geen regels, en
 * dat is de expliciete afspraak in de standaard.
 */
import { createRequire } from "node:module";
import { RobotsDisallowedError } from "../../lib/errors.js";

/**
 * `robots-parser` is een CommonJS-pakket waarvan de meegeleverde typedeclaratie
 * onder `moduleResolution: NodeNext` niet als aanroepbare functie doorkomt.
 * `createRequire` haalt hem expliciet binnen; de vorm leggen we hieronder zelf
 * vast, zodat we niet op `any` terugvallen.
 */
interface Robot {
  isAllowed(url: string, ua?: string): boolean | undefined;
  isDisallowed(url: string, ua?: string): boolean | undefined;
  getCrawlDelay(ua?: string): number | undefined;
  getSitemaps(): string[];
}

const require = createRequire(import.meta.url);
const robotsParser = require("robots-parser") as (url: string, robotsTxt: string) => Robot;

interface CacheEntry {
  robot: Robot | null;
  /** `null` = geen robots.txt (404): alles toegestaan. */
  fetchedAt: number;
}

export interface RobotsPolicyOptions {
  userAgent: string;
  /** Hoe lang een robots.txt hergebruikt wordt. */
  ttlMs?: number;
  timeoutMs?: number;
  /** Injecteerbaar zodat tests geen netwerk raken. */
  fetchImpl?: (url: string, init: { signal: AbortSignal; headers: Record<string, string> }) => Promise<{
    status: number;
    text: () => Promise<string>;
  }>;
}

const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000;

export class RobotsPolicy {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly userAgent: string;
  private readonly ttlMs: number;
  private readonly timeoutMs: number;
  private readonly fetchImpl: NonNullable<RobotsPolicyOptions["fetchImpl"]>;

  constructor(options: RobotsPolicyOptions) {
    this.userAgent = options.userAgent;
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.fetchImpl = options.fetchImpl ?? ((url, init) => fetch(url, init));
  }

  /** Gooit `RobotsDisallowedError` wanneer deze URL niet opgehaald mag worden. */
  async assertAllowed(url: string): Promise<void> {
    if (!(await this.isAllowed(url))) {
      throw new RobotsDisallowedError(url);
    }
  }

  async isAllowed(url: string): Promise<boolean> {
    const robot = await this.load(url);
    if (robot === null) return true;
    // robots-parser geeft `undefined` wanneer het geen uitspraak kan doen; dat
    // behandelen we als toegestaan, conform de standaard.
    return robot.isAllowed(url, this.userAgent) !== false;
  }

  /** Crawl-delay in milliseconden wanneer de site er een opgeeft. */
  async crawlDelayMs(url: string): Promise<number | undefined> {
    const robot = await this.load(url);
    const seconds = robot?.getCrawlDelay(this.userAgent);
    return typeof seconds === "number" && seconds > 0 ? seconds * 1000 : undefined;
  }

  private async load(url: string): Promise<Robot | null> {
    const origin = new URL(url).origin;
    const cached = this.cache.get(origin);
    if (cached && Date.now() - cached.fetchedAt < this.ttlMs) return cached.robot;

    const robotsUrl = `${origin}/robots.txt`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(robotsUrl, {
        signal: controller.signal,
        headers: { "user-agent": this.userAgent, accept: "text/plain" },
      });

      if (response.status === 404 || response.status === 410) {
        this.cache.set(origin, { robot: null, fetchedAt: Date.now() });
        return null;
      }
      if (response.status >= 400) {
        // 403 of 5xx op robots.txt: geen toestemming vastgesteld, dus niet
        // verdergaan. Niet cachen, zodat een tijdelijke storing niet uren blijft
        // hangen.
        throw new RobotsDisallowedError(robotsUrl);
      }

      const robot = robotsParser(robotsUrl, await response.text());
      this.cache.set(origin, { robot, fetchedAt: Date.now() });
      return robot;
    } catch (e) {
      if (e instanceof RobotsDisallowedError) throw e;
      throw new RobotsDisallowedError(robotsUrl);
    } finally {
      clearTimeout(timer);
    }
  }
}
