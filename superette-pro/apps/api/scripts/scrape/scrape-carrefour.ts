/**
 * Carrefour België via Scrapling: officiële sitemap → publieke productpagina's → `carrefour.json`.
 *
 * Gebruik:
 *   SCRAPE_CONTACT=jij@voorbeeld.be npm run scrape:carrefour          # volgens data/scrape/carrefour.json
 *   SCRAPE_CONTACT=jij@voorbeeld.be npm run scrape:carrefour -- 20    # proefrun met 20 producten
 *
 * Beleefdheid zit volledig in PoliteScrapling (robots.txt, wachttijd, identificatie,
 * maximum, stoppen bij blokkade). De feed wordt pas geschreven als de run volledig
 * is; een gestopte run laat de bestaande feed ongemoeid.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, copyFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import { CARREFOUR_ORIGIN, carrefourProductUrlsFromSitemap, parseCarrefourProductPage, type CarrefourPdpProduct } from '../../src/compare/scrapers/carrefour/pdp';
import { buildCarrefourPdpFeed } from '../../src/compare/scrapers/carrefour/pdp-feed';
import { BlockedError } from './polite-common';
import { PoliteBrowser } from './polite-browser';
import { PoliteScrapling } from './polite-scrapling';

/** Eén interface voor beide motoren. */
interface Fetcher {
  start(): Promise<void>;
  stop(): Promise<void>;
  fetchText(url: string): Promise<string | null>;
  fetchHtml(url: string): Promise<string | null>;
  readonly visitCount: number;
}

function browserEngine(options: { contact: string; minDelayMs: number; maxPages: number }): Fetcher {
  const browser = new PoliteBrowser({ origin: CARREFOUR_ORIGIN, contact: options.contact, minDelayMs: options.minDelayMs, maxPages: options.maxPages, headless: process.env.SCRAPE_HEADLESS !== 'false' });
  let visits = 0;
  return {
    start: () => browser.start(),
    stop: () => browser.stop(),
    fetchText: async (url) => { visits += 1; return browser.fetchText(url); },
    fetchHtml: async (url) => { visits += 1; const page = await browser.visit(url); return page ? page.content() : null; },
    get visitCount() { return visits; },
  };
}

function scraplingEngine(options: { contact: string; minDelayMs: number; maxPages: number }): Fetcher {
  const fetcher = new PoliteScrapling({ origin: CARREFOUR_ORIGIN, ...options });
  return {
    start: () => fetcher.start(),
    stop: () => fetcher.stop(),
    fetchText: (url) => fetcher.fetchText(url),
    fetchHtml: (url) => fetcher.fetchText(url),
    get visitCount() { return fetcher.visitCount; },
  };
}

const configSchema = z.object({
  sitemapIndexUrl: z.string().url().refine((url) => url.startsWith(`${CARREFOUR_ORIGIN}/`)).default(`${CARREFOUR_ORIGIN}/sitemap_index.xml`),
  maxProducts: z.number().int().positive().max(2000).default(300),
  minDelayMs: z.number().int().min(2000).default(5000),
  minProductsToWrite: z.number().int().positive().default(10),
});

async function main() {
  const apiRoot = resolve(__dirname, '..', '..');
  const configPath = resolve(apiRoot, process.env.SCRAPE_CONFIG ?? 'data/scrape/carrefour.json');
  const config = configSchema.parse(existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf8')) : {});
  const feedDir = resolve(apiRoot, process.env.COMPARE_FEED_DIR ?? 'data/feeds');
  const probe = process.argv[2] ? Number(process.argv[2]) : null;
  if (probe !== null && (!Number.isInteger(probe) || probe < 1 || probe > 2000)) throw new Error('Ongeldig proefaantal.');
  const maxProducts = probe ?? config.maxProducts;
  mkdirSync(feedDir, { recursive: true });

  const startedAt = new Date();
  // Sitemap-index + tot 7 sitemaps + producten.
  // Carrefour weigert gewone HTTP-clients (403); de echte browser met eerlijke
  // naam laten ze toe. Daarom is 'browser' de standaard. SCRAPE_ENGINE=scrapling kan
  // voor sites die gewone HTTP toelaten; dan zonder browser-imitatie.
  const engine = process.env.SCRAPE_ENGINE === 'scrapling' ? 'scrapling' : 'browser';
  const engineOptions = { contact: process.env.SCRAPE_CONTACT ?? '', minDelayMs: config.minDelayMs, maxPages: maxProducts + 10 };
  const fetcher = engine === 'scrapling' ? scraplingEngine(engineOptions) : browserEngine(engineOptions);
  console.log(`motor: ${engine}`);
  const products: CarrefourPdpProduct[] = [];
  const skipped = new Map<string, number>();
  const issues: { url: string; kind: string; reason: string }[] = [];
  let inSitemap = 0, planned = 0, done = 0, unreadableInARow = 0;
  let stopped: string | null = null;

  try {
    await fetcher.start();
    const index = await fetcher.fetchText(config.sitemapIndexUrl);
    if (!index) throw new BlockedError('Sitemap-index niet gevonden of niet toegestaan.');
    const sitemaps = [...index.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)]
      .map((m) => m[1]!.replace(/&amp;/g, '&'))
      .filter((url) => url.startsWith(`${CARREFOUR_ORIGIN}/nl/`) && !/category/i.test(url));
    if (!sitemaps.length) throw new BlockedError('Geen Nederlandstalige productsitemaps gevonden.');

    const all = new Set<string>();
    // Proefrun: één sitemap volstaat; zo laden we geen ±60 MB voor een handvol producten.
    for (const sitemap of probe !== null ? sitemaps.slice(0, 1) : sitemaps) {
      const xml = await fetcher.fetchText(sitemap);
      if (xml) for (const url of carrefourProductUrlsFromSitemap(xml)) all.add(url);
    }
    const urls = [...all];
    inSitemap = urls.length;
    if (!urls.length) throw new BlockedError('Sitemaps bevatten geen herkenbare productpagina\'s.');
    // Gespreid over het hele assortiment, niet de eerste N.
    const picked = urls.length <= maxProducts ? urls : Array.from({ length: maxProducts }, (_, i) => urls[Math.floor((i * urls.length) / maxProducts)]!);
    planned = picked.length;
    console.log(`${inSitemap} productpagina's in de sitemaps, ${planned} gepland.`);

    for (const url of picked) {
      const html = await fetcher.fetchHtml(url);
      done += 1;
      if (html === null) {
        skipped.set('niet toegestaan of niet gevonden', (skipped.get('niet toegestaan of niet gevonden') ?? 0) + 1);
        continue;
      }
      const result = parseCarrefourProductPage(url, html);
      if (result.ok) {
        products.push(result.product);
        unreadableInARow = 0;
      } else {
        skipped.set(result.reason, (skipped.get(result.reason) ?? 0) + 1);
        issues.push({ url, kind: result.kind, reason: result.reason });
        // Voor diagnose: afgekeurde pagina's bewaren als SCRAPE_DEBUG_DIR gezet is (nooit standaard).
        if (process.env.SCRAPE_DEBUG_DIR && result.kind === 'unreadable') {
          mkdirSync(process.env.SCRAPE_DEBUG_DIR, { recursive: true });
          writeFileSync(join(process.env.SCRAPE_DEBUG_DIR, `${url.split('/').pop()}`), html, 'utf8');
        }
        unreadableInARow = result.kind === 'unreadable' ? unreadableInARow + 1 : 0;
        if (unreadableInARow >= 5) throw new BlockedError('5 onleesbare productpagina\'s op rij; run gestopt.');
      }
      if (done % 10 === 0) console.log(`productpagina's: ${done}/${planned} - ${products.length} ok`);
    }
  } catch (error) {
    stopped = error instanceof Error ? error.message : String(error);
  } finally {
    await fetcher.stop();
  }

  const report = {
    startedAt: startedAt.toISOString(), finishedAt: new Date().toISOString(), engine, probe: probe !== null,
    requests: fetcher.visitCount, inSitemap, plannedProducts: planned, completedProducts: done, products: products.length,
    skipped: Object.fromEntries(skipped), issues: issues.slice(0, 200), blocked: stopped, written: false,
  };
  if (!stopped && products.length >= (probe !== null ? 1 : config.minProductsToWrite)) {
    const feed = buildCarrefourPdpFeed(products, startedAt);
    const target = join(feedDir, 'carrefour.json');
    // De vorige feed (bv. uit opgeslagen pagina's) blijft bewaard naast de nieuwe.
    if (existsSync(target)) copyFileSync(target, join(feedDir, `carrefour.vorige.json`));
    writeFileSync(`${target}.tmp`, JSON.stringify(feed, null, 2) + '\n', 'utf8');
    renameSync(`${target}.tmp`, target);
    report.written = true;
    console.log(`${feed.products.length} producten en ${feed.offers.length} prijzen opgeslagen in ${target}.`);
  }
  writeFileSync(join(feedDir, 'carrefour.report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  if (stopped) { console.error(`Gestopt: ${stopped}. Bestaande feed ongemoeid.`); process.exitCode = 2; }
  else if (!report.written) { console.error('Te weinig bruikbare producten; geen feed geschreven.'); process.exitCode = 1; }
}

main().then(() => process.exit(process.exitCode ?? 0)).catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
