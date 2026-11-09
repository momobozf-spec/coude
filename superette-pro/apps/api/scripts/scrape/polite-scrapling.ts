/**
 * Beleefde fetcher op basis van Scrapling, voor ketens waar de prijs al in de
 * HTML van de server staat (geen browser nodig).
 *
 * Zelfde regels als PoliteBrowser, ook letterlijk dezelfde code voor robots.txt:
 *  - robots.txt lezen en elke URL eraan toetsen vóór het bezoek;
 *  - wachten tussen verzoeken: minstens `minDelayMs`, of de `Crawl-delay` van de
 *    site als die hoger is, plus een kleine willekeurige marge;
 *  - zich bekendmaken: user-agent "SuperetteBot/<versie> (+contact)";
 *  - een harde bovengrens op het aantal verzoeken per run.
 *
 * Wat hij nooit doet: captcha's, logins, cookiemuren of botbescherming omzeilen.
 * De Python-worker draait in Scraplings gewone HTTP-modus, nooit in stealth- of
 * browsermodus. Antwoordt de site met 401/403/429/503 of met een blokkeerpagina,
 * dan stopt de hele run met `BlockedError`.
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface, type Interface } from 'node:readline';
import { resolve } from 'node:path';
import { crawlDelayFor, isAllowed, parseRobots, type RobotsPolicy } from '../../src/compare/scrapers/robots';
import { BLOCK_TITLE, BOT_TOKEN, BOT_VERSION, BlockedError } from './polite-common';

export interface PoliteScraplingOptions {
  readonly origin: string;
  /** Contact voor de site-eigenaar (e-mail of URL). Verplicht: wie scrapet, is bereikbaar. */
  readonly contact: string;
  readonly minDelayMs: number;
  readonly maxPages: number;
  readonly log?: (message: string) => void;
  /** Commando om de worker te starten; standaard via uv (installeert scrapling eenmalig). */
  readonly command?: readonly string[];
}

interface WorkerReply {
  url: string;
  status: number;
  finalUrl: string;
  body: string;
  error: string | null;
}

export class PoliteScrapling {
  private child: ChildProcessWithoutNullStreams | null = null;
  private lines: Interface | null = null;
  private readonly pending: ((line: string) => void)[] = [];
  private robots: RobotsPolicy | null = null;
  private lastVisit = 0;
  private visits = 0;
  readonly userAgent: string;

  constructor(private readonly options: PoliteScraplingOptions) {
    if (!options.contact.trim()) throw new Error('Een contactadres is verplicht (SCRAPE_CONTACT).');
    if (options.minDelayMs < 2000) throw new Error('minDelayMs moet minstens 2000 zijn.');
    this.userAgent = `Mozilla/5.0 (compatible; ${BOT_TOKEN}/${BOT_VERSION}; +${options.contact.trim()})`;
  }

  private log(message: string): void {
    (this.options.log ?? console.log)(`[scrapling] ${message}`);
  }

  async start(): Promise<void> {
    const worker = resolve(__dirname, 'scrapling_worker.py');
    const command = this.options.command ?? (process.env.SCRAPLING_CMD
      ? [...process.env.SCRAPLING_CMD.split(' '), worker]
      : ['uv', 'run', '--no-project', '--quiet', '--with', 'scrapling[fetchers]', 'python', worker]);
    this.child = spawn(command[0]!, command.slice(1), { stdio: ['pipe', 'pipe', 'pipe'], shell: process.platform === 'win32' });
    this.child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString().trim();
      if (text) this.log(`worker: ${text.slice(0, 300)}`);
    });
    this.lines = createInterface({ input: this.child.stdout });
    this.lines.on('line', (line) => this.pending.shift()?.(line));
    const ready = await this.nextLine(180_000);
    if (!/"ready"\s*:\s*true/.test(ready)) throw new Error(`Scrapling-worker startte niet: ${ready.slice(0, 200)}`);

    // robots.txt: zelfde regels als PoliteBrowser (RFC 9309).
    const reply = await this.request(new URL('/robots.txt', this.options.origin).toString());
    if (reply.status === 404 || reply.status === 410) {
      this.robots = parseRobots('');
    } else if (reply.status !== 200) {
      throw new BlockedError(`robots.txt gaf HTTP ${reply.status}${reply.error ? ` (${reply.error})` : ''}; we stoppen in plaats van te gokken`);
    } else {
      this.robots = parseRobots(reply.body);
    }
    this.log(`robots.txt gelezen (${this.robots.groups.length} groepen), user-agent: ${this.userAgent}`);
  }

  async stop(): Promise<void> {
    this.lines?.close();
    this.child?.stdin.end();
    this.child?.kill();
    this.child = null;
  }

  allowed(url: string): boolean {
    if (!this.robots) throw new Error('start() eerst');
    const parsed = new URL(url);
    if (parsed.origin !== new URL(this.options.origin).origin) return false;
    return isAllowed(this.robots, BOT_TOKEN, `${parsed.pathname}${parsed.search}`);
  }

  private nextLine(timeoutMs: number): Promise<string> {
    return new Promise((resolvePromise, reject) => {
      const timer = setTimeout(() => {
        const index = this.pending.indexOf(handler);
        if (index >= 0) this.pending.splice(index, 1);
        reject(new Error('Scrapling-worker antwoordt niet'));
      }, timeoutMs);
      const handler = (line: string) => { clearTimeout(timer); resolvePromise(line); };
      this.pending.push(handler);
    });
  }

  private async request(url: string): Promise<WorkerReply> {
    if (!this.child) throw new Error('start() eerst');
    const answer = this.nextLine(90_000);
    this.child.stdin.write(`${JSON.stringify({ url, userAgent: this.userAgent, timeout: 45 })}\n`);
    return JSON.parse(await answer) as WorkerReply;
  }

  private async waitTurn(): Promise<void> {
    const robotsDelay = (crawlDelayFor(this.robots!, BOT_TOKEN) ?? 0) * 1000;
    const delay = Math.max(this.options.minDelayMs, robotsDelay) + Math.floor(Math.random() * 1500);
    const wait = this.lastVisit + delay - Date.now();
    if (wait > 0) await new Promise((resolvePromise) => setTimeout(resolvePromise, wait));
    this.lastVisit = Date.now();
  }

  /**
   * Haalt een pagina of bestand op. `null` als robots.txt het verbiedt of de pagina
   * niet bestaat. `BlockedError` bij elke vorm van blokkade of bij het maximum.
   */
  async fetchText(url: string): Promise<string | null> {
    if (!this.allowed(url)) {
      this.log(`overgeslagen (robots.txt): ${url}`);
      return null;
    }
    if (this.visits >= this.options.maxPages) {
      throw new BlockedError(`maximum van ${this.options.maxPages} verzoeken per run bereikt`);
    }
    await this.waitTurn();
    this.visits += 1;
    const reply = await this.request(url);
    if (reply.error && reply.status === 0) throw new BlockedError(`netwerkfout op ${url}: ${reply.error}; run gestopt`);
    if ([401, 403, 429, 503].includes(reply.status)) {
      throw new BlockedError(`HTTP ${reply.status} op ${url} — de site wil ons niet; run gestopt`);
    }
    if (reply.status === 404 || reply.status === 410) return null;
    if (reply.status >= 400) throw new BlockedError(`HTTP ${reply.status} op ${url}; run gestopt`);
    // Doorverwezen naar een andere site of een pad dat robots.txt verbiedt: niet gebruiken.
    if (reply.finalUrl && reply.finalUrl !== url) {
      const final = new URL(reply.finalUrl);
      if (final.origin !== new URL(this.options.origin).origin || !this.allowed(final.href)) {
        this.log(`doorverwezen naar een niet-toegestane plek, overgeslagen: ${url} -> ${reply.finalUrl}`);
        return null;
      }
    }
    const title = /<title[^>]*>([^<]*)<\/title>/i.exec(reply.body)?.[1] ?? '';
    if (BLOCK_TITLE.test(title)) throw new BlockedError(`blokkeerpagina ("${title.trim()}") op ${url}; run gestopt`);
    return reply.body;
  }

  get visitCount(): number {
    return this.visits;
  }
}
