/**
 * Een beleefde browser voor de prijsscrapers.
 *
 * Wat hij altijd doet:
 *  - robots.txt van de site lezen en elke URL eraan toetsen vóór het bezoek;
 *  - wachten tussen verzoeken: minstens `minDelayMs`, of de `Crawl-delay` van
 *    de site als die hoger is, plus een kleine willekeurige marge;
 *  - zich bekendmaken: de user-agent eindigt op "SuperetteBot/<versie> (+contact)";
 *  - een harde bovengrens op het aantal pagina's per run.
 *
 * Wat hij nooit doet:
 *  - captcha's, logins, cookiemuren of botbescherming omzeilen. Antwoordt de
 *    site met 401/403/429/503 of met een blokkeerpagina, dan stopt de hele run
 *    met `BlockedError`. Opnieuw proberen gebeurt pas bij de volgende run.
 *
 * Draait met een echte Chromium (Playwright), omdat de productpagina's van de
 * ketens hun gegevens pas na het laden van de pagina tonen.
 */
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { crawlDelayFor, isAllowed, parseRobots, type RobotsPolicy } from '../../src/compare/scrapers/robots';

import { BLOCK_TITLE, BOT_TOKEN, BOT_VERSION, BlockedError } from './polite-common';

export { BOT_TOKEN, BOT_VERSION, BlockedError };

export interface PoliteBrowserOptions {
  readonly origin: string;
  /** Contact voor de site-eigenaar (e-mail of URL). Verplicht: wie scrapet, is bereikbaar. */
  readonly contact: string;
  readonly minDelayMs: number;
  readonly maxPages: number;
  readonly headless?: boolean;
  readonly log?: (message: string) => void;
  /**
   * Ook de verzoeken die de pagina zélf doet (bv. een zoek-API die meer
   * producten bijlaadt) aan robots.txt toetsen en afbreken als ze verboden
   * zijn. Alleen verzoeken naar dezelfde site; externe bestanden blijven ongemoeid.
   */
  readonly enforceRobotsOnSubrequests?: boolean;
}


export class PoliteBrowser {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private robots: RobotsPolicy | null = null;
  private lastVisit = 0;
  private visits = 0;

  constructor(private readonly options: PoliteBrowserOptions) {
    if (!options.contact.trim()) throw new Error('Een contactadres is verplicht (SCRAPE_CONTACT).');
  }

  get pagesVisited(): number {
    return this.visits;
  }

  private log(message: string) {
    (this.options.log ?? console.log)(message);
  }

  async start(): Promise<void> {
    this.browser = await chromium.launch({ headless: this.options.headless ?? true });
    const probe = await this.browser.newContext();
    const probePage = await probe.newPage();
    const baseUserAgent = await probePage.evaluate(() => navigator.userAgent);
    await probe.close();

    this.context = await this.browser.newContext({
      userAgent: `${baseUserAgent} ${BOT_TOKEN}/${BOT_VERSION} (+${this.options.contact})`,
      locale: 'nl-BE',
    });
    this.page = await this.context.newPage();

    const response = await this.context.request.get(new URL('/robots.txt', this.options.origin).toString());
    if (response.status() >= 400 && response.status() < 500 && response.status() !== 403) {
      // Geen robots.txt = geen beperkingen (RFC 9309 § 2.3.1.3).
      this.robots = parseRobots('');
    } else if (!response.ok()) {
      throw new BlockedError(`robots.txt gaf HTTP ${response.status()}; we stoppen in plaats van te gokken`);
    } else {
      this.robots = parseRobots(await response.text());
    }
    this.log(`robots.txt gelezen (${this.robots.groups.length} groepen)`);

    if (this.options.enforceRobotsOnSubrequests) {
      const origin = new URL(this.options.origin).origin;
      let refused = 0;
      await this.context.route('**/*', (route) => {
        const url = route.request().url();
        if (url.startsWith(`${origin}/`) && !this.allowed(url)) {
          refused += 1;
          if (refused <= 5) this.log(`verzoek van de pagina afgebroken (robots.txt): ${url}`);
          return route.abort('blockedbyclient');
        }
        return route.continue();
      });
    }
  }

  async stop(): Promise<void> {
    await this.browser?.close();
    this.browser = null;
  }

  allowed(url: string): boolean {
    if (!this.robots) throw new Error('start() eerst');
    const parsed = new URL(url);
    if (parsed.origin !== new URL(this.options.origin).origin) return false;
    return isAllowed(this.robots, BOT_TOKEN, `${parsed.pathname}${parsed.search}`);
  }

  private async waitTurn(): Promise<void> {
    const robotsDelay = (crawlDelayFor(this.robots!, BOT_TOKEN) ?? 0) * 1000;
    const delay = Math.max(this.options.minDelayMs, robotsDelay) + Math.floor(Math.random() * 1500);
    const wait = this.lastVisit + delay - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    this.lastVisit = Date.now();
  }

  /**
   * Haalt een tekstbestand (bv. een sitemap) op zonder het in de browser te
   * openen: zelfde identificatie, zelfde robots.txt-controle, zelfde wachttijd
   * en het telt mee als bezoek. `null` als robots.txt het verbiedt of het
   * bestand niet bestaat; `BlockedError` bij elke vorm van blokkade.
   */
  async fetchText(url: string): Promise<string | null> {
    if (!this.context) throw new Error('start() eerst');
    if (!this.allowed(url)) {
      this.log(`overgeslagen (robots.txt): ${url}`);
      return null;
    }
    if (this.visits >= this.options.maxPages) {
      throw new BlockedError(`maximum van ${this.options.maxPages} pagina's per run bereikt`);
    }
    await this.waitTurn();
    this.visits += 1;
    const response = await this.context.request.get(url, { timeout: 45_000 });
    const status = response.status();
    if ([401, 403, 429, 503].includes(status)) {
      throw new BlockedError(`HTTP ${status} op ${url} — de site wil ons niet; run gestopt`);
    }
    if (status === 404 || status === 410) return null;
    if (status >= 400) throw new BlockedError(`HTTP ${status} op ${url}; run gestopt`);
    return response.text();
  }

  /**
   * Bezoekt een pagina en geeft ze terug, of `null` als robots.txt het verbiedt
   * of de pagina niet bestaat. Gooit `BlockedError` bij elke vorm van blokkade.
   */
  async visit(url: string): Promise<Page | null> {
    if (!this.page) throw new Error('start() eerst');
    if (!this.allowed(url)) {
      this.log(`overgeslagen (robots.txt): ${url}`);
      return null;
    }
    if (this.visits >= this.options.maxPages) {
      throw new BlockedError(`maximum van ${this.options.maxPages} pagina's per run bereikt`);
    }

    await this.waitTurn();
    this.visits += 1;
    const response = await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    const status = response?.status() ?? 0;

    if ([401, 403, 429, 503].includes(status)) {
      throw new BlockedError(`HTTP ${status} op ${url} — de site wil ons niet; run gestopt`);
    }
    if (status === 404 || status === 410) return null;
    if (status >= 400) throw new BlockedError(`HTTP ${status} op ${url}; run gestopt`);

    // De gegevens verschijnen na het laden; kort wachten tot het netwerk stil is.
    await this.page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);

    const title = await this.page.title();
    if (BLOCK_TITLE.test(title)) {
      throw new BlockedError(`blokkeerpagina ("${title}") op ${url}; run gestopt`);
    }
    return this.page;
  }
}
