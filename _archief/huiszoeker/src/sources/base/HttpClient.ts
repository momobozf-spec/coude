/**
 * De HTTP-client voor bronnen.
 *
 * Alles wat een scraper beleefd en voorspelbaar maakt zit hier, één keer, in
 * plaats van per bron opnieuw:
 *
 *  - robots.txt-controle vóór elke request
 *  - snelheidsbeperking per host, met respect voor `Crawl-delay`
 *  - timeouts
 *  - retry met exponentiële backoff en jitter, alleen op fouten waar dat zin
 *    heeft (429, 5xx, netwerkfouten)
 *  - een identificeerbare User-Agent met contactgegevens
 *
 * En expliciet wat er NIET in zit: geen proxy-rotatie, geen browser-
 * fingerprinting, geen CAPTCHA-verwerking, geen User-Agent die zich voordoet
 * als een echte browser. Een 403 of een challenge is een antwoord, geen
 * obstakel: de bron gaat in cooldown en de run stopt voor die bron.
 */
import { setTimeout as sleep } from "node:timers/promises";
import { SourceBlockedError } from "../../lib/errors.js";
import { assertSafeOutboundUrl } from "../../lib/url.js";
import type { RobotsPolicy } from "./RobotsPolicy.js";

export interface HttpClientOptions {
  userAgent: string;
  robots: RobotsPolicy;
  requestsPerMinute: number;
  timeoutMs: number;
  maxRetries: number;
  /** Injecteerbaar zodat tests geen netwerk raken. */
  fetchImpl?: typeof fetch;
}

interface HostState {
  /** Vroegste moment waarop de volgende request mag vertrekken. */
  nextAllowedAt: number;
}

export interface FetchTextResult {
  url: string;
  status: number;
  body: string;
}

export class HttpClient {
  private readonly hosts = new Map<string, HostState>();
  private readonly options: HttpClientOptions;
  private readonly fetchImpl: typeof fetch;

  constructor(options: HttpClientOptions) {
    this.options = options;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async fetchText(url: string, source: string, signal: AbortSignal): Promise<FetchTextResult> {
    assertSafeOutboundUrl(url);
    await this.options.robots.assertAllowed(url);
    await this.throttle(url);

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      if (signal.aborted) throw new Error("Run afgebroken");

      try {
        const response = await this.fetchOnce(url, signal);

        // 403/401: de site zegt nee. Niet opnieuw proberen, niet omzeilen.
        if (response.status === 401 || response.status === 403) {
          throw new SourceBlockedError(
            source,
            `${source} weigert toegang (HTTP ${response.status}). De bron gaat in cooldown.`,
          );
        }

        if (response.status === 429 || response.status >= 500) {
          lastError = new Error(`HTTP ${response.status}`);
          const retryAfter = parseRetryAfter(response.headers.get("retry-after"));
          await this.backoff(attempt, retryAfter);
          continue;
        }

        if (response.status >= 400) {
          // 404 en consorten: dit gaat niet beter worden met een retry.
          return { url, status: response.status, body: "" };
        }

        return { url, status: response.status, body: await response.text() };
      } catch (e) {
        if (e instanceof SourceBlockedError) throw e;
        lastError = e as Error;
        if (attempt === this.options.maxRetries) break;
        await this.backoff(attempt);
      }
    }

    throw new SourceBlockedError(source, `${source} was niet bereikbaar: ${lastError?.message ?? "onbekende fout"}`);
  }

  private async fetchOnce(url: string, signal: AbortSignal): Promise<Response> {
    const controller = new AbortController();
    const onAbort = (): void => controller.abort();
    signal.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs);

    try {
      return await this.fetchImpl(url, {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "user-agent": this.options.userAgent,
          accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
          "accept-language": "nl-BE,nl;q=0.9,fr-BE;q=0.8,en;q=0.7",
        },
      });
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
    }
  }

  /** Wacht tot deze host weer aan de beurt is. */
  private async throttle(url: string): Promise<void> {
    const host = new URL(url).host;
    const minInterval = Math.max(
      60_000 / this.options.requestsPerMinute,
      (await this.options.robots.crawlDelayMs(url)) ?? 0,
    );

    const state = this.hosts.get(host) ?? { nextAllowedAt: 0 };
    const now = Date.now();
    const wait = Math.max(0, state.nextAllowedAt - now);

    this.hosts.set(host, { nextAllowedAt: Math.max(now, state.nextAllowedAt) + minInterval });
    if (wait > 0) await sleep(wait);
  }

  private async backoff(attempt: number, retryAfterMs?: number): Promise<void> {
    if (retryAfterMs !== undefined) {
      await sleep(Math.min(retryAfterMs, 60_000));
      return;
    }
    // Exponentieel met jitter: zonder jitter komen parallelle runs telkens
    // tegelijk terug en veroorzaken ze precies de piek die ze moesten vermijden.
    const base = Math.min(1000 * 2 ** attempt, 30_000);
    await sleep(base + Math.floor(Math.random() * 250));
  }
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number.parseInt(value, 10);
  if (Number.isFinite(seconds)) return seconds * 1000;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
}
