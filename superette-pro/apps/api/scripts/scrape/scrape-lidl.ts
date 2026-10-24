/**
 * Lidl-prijzen verzamelen → `data/feeds/lidl.json`.
 *
 *   SCRAPE_CONTACT=jij@voorbeeld.be npm run scrape:lidl
 *
 * Werkwijze:
 *  1. robots.txt lezen (PoliteBrowser), ook voor de verzoeken die de pagina
 *     zelf doet: verboden zoek-API's worden afgebroken, niet omzeild;
 *  2. de categoriepagina's uit `data/scrape/lidl.json` openen. Met
 *     `discoverCategories` ook de categorielinks (`/c/nl-BE/<naam>/<code>`)
 *     die op die startpagina's staan — alleen links die Lidl zelf toont,
 *     niets geraden — tot `maxCategories` pagina's;
 *  3. per pagina naar beneden scrollen zodat de tegels die pas bij het
 *     scrollen laden er ook bij zijn (geen knoppen, geen formulieren);
 *  4. per tegel het `data-grid-data`-attribuut lezen (`parseLidlTile`),
 *     dubbele producten (zelfde product op twee pagina's) één keer;
 *  5. optioneel alleen tegels uit bepaalde Lidl-"werelden" houden
 *     (`onlyWorlds`, het 2e niveau van wonCategoryPrimary, bv.
 *     "Eten en dichtbij voedsel"). Het rapport telt per wereld, zodat je
 *     die lijst op echte waarden baseert in plaats van te raden;
 *  6. het importbestand valideren en atomisch wegschrijven, alleen als er
 *     minstens `minProductsToWrite` producten zijn.
 *
 * Geen productpagina's nodig: de tegel bevat prijs, oude prijs, actie,
 * Lidl Plus-prijs, inhoud en actieperiode. Dat houdt het aantal verzoeken laag.
 *
 * Daarna inladen: `npm run compare:sync -- lidl`.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Page } from 'playwright';
import { z } from 'zod';
import { buildLidlFeed, type LidlTile } from '../../src/compare/scrapers/lidl/feed';
import { LIDL_ORIGIN, parseLidlTile } from '../../src/compare/scrapers/lidl/parse';
import { BlockedError, PoliteBrowser } from './polite-browser';

const CATEGORY = /^https:\/\/www\.lidl\.be\/c\/nl-BE\/[a-z0-9-]+\/[a-z]?\d{4,12}$/;

const configSchema = z.object({
  startUrls: z
    .array(z.string().url().refine((url) => url.startsWith(`${LIDL_ORIGIN}/c/`), 'alleen lidl.be-categoriepagina’s (/c/…)'))
    .min(1)
    .max(30),
  discoverCategories: z.boolean().default(false),
  maxCategories: z.number().int().positive().max(60).default(20),
  scrollRounds: z.number().int().min(0).max(30).default(10),
  onlyWorlds: z.array(z.string().min(1)).default([]),
  minDelayMs: z.number().int().min(2000).default(4000),
  minProductsToWrite: z.number().int().positive().default(5),
});

function stripQuery(href: string): string {
  try {
    const url = new URL(href);
    return `${url.origin}${url.pathname}`;
  } catch {
    return '';
  }
}

const countTiles = (page: Page) => page.$$eval('[data-grid-data]', (nodes) => nodes.length);

/**
 * Naar beneden scrollen tot er geen nieuwe tegels meer bijkomen (of na
 * `rounds` keer). Dat is wat een bezoeker ook doet; de pagina laadt zelf bij.
 */
async function scrollUntilStable(page: Page, rounds: number): Promise<number> {
  let previous = await countTiles(page);
  for (let i = 0; i < rounds; i += 1) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);
    const now = await countTiles(page);
    if (now <= previous) return now;
    previous = now;
  }
  return previous;
}

/** 2e niveau van wonCategoryPrimary ("Werelden van nood/<wereld>/…"), of null. */
function worldOf(raw: string): string | null {
  try {
    const tile = JSON.parse(raw) as { keyfacts?: { wonCategoryPrimary?: unknown } };
    const path = tile.keyfacts?.wonCategoryPrimary;
    if (typeof path !== 'string') return null;
    return path.split('/')[1]?.trim() || null;
  } catch {
    return null;
  }
}

async function main() {
  const apiRoot = resolve(__dirname, '..', '..');
  const configPath = resolve(apiRoot, process.env.SCRAPE_CONFIG ?? 'data/scrape/lidl.json');
  const feedDir = resolve(apiRoot, process.env.COMPARE_FEED_DIR ?? 'data/feeds');
  const config = configSchema.parse(JSON.parse(readFileSync(configPath, 'utf8')));

  const browser = new PoliteBrowser({
    origin: LIDL_ORIGIN,
    contact: process.env.SCRAPE_CONTACT ?? '',
    minDelayMs: config.minDelayMs,
    maxPages: Math.max(config.maxCategories, config.startUrls.length) + 2,
    headless: process.env.SCRAPE_HEADLESS !== 'false',
    enforceRobotsOnSubrequests: true,
  });

  const tiles = new Map<string, LidlTile>();
  const skipped = new Map<string, number>();
  const count = (reason: string) => skipped.set(reason, (skipped.get(reason) ?? 0) + 1);
  const worlds = new Map<string, number>();
  const perPage: Record<string, number> = {};
  let blocked: string | null = null;
  const startedAt = new Date();

  // Wachtrij: eerst de startpagina's, daarna wat op die startpagina's gelinkt staat.
  const queue: string[] = [];
  const seen = new Set<string>();
  const enqueue = (href: string) => {
    const clean = stripQuery(href);
    if (!CATEGORY.test(clean) || seen.has(clean)) return;
    seen.add(clean);
    queue.push(clean);
  };
  config.startUrls.forEach(enqueue);
  const startSet = new Set(queue);

  await browser.start();
  try {
    let visited = 0;
    while (queue.length > 0 && visited < config.maxCategories) {
      const url = queue.shift()!;
      const page = await browser.visit(url);
      visited += 1;
      if (!page) {
        count('pagina niet toegestaan of niet gevonden');
        continue;
      }

      // Alleen vanaf de startpagina's zoeken we nieuwe categorieën: één niveau diep.
      if (config.discoverCategories && startSet.has(url)) {
        const links = await page.$$eval('a[href]', (anchors) => anchors.map((a) => (a as HTMLAnchorElement).href));
        links.forEach(enqueue);
      }

      const total = await scrollUntilStable(page, config.scrollRounds);
      const raws = await page.$$eval('[data-grid-data]', (nodes) => nodes.map((node) => node.getAttribute('data-grid-data') ?? ''));
      perPage[url] = raws.length;
      if (raws.length === 0) count('categoriepagina zonder tegels');

      let added = 0;
      for (const raw of raws) {
        const world = worldOf(raw) ?? '(onbekend)';
        worlds.set(world, (worlds.get(world) ?? 0) + 1);
        if (config.onlyWorlds.length > 0 && !config.onlyWorlds.includes(world)) {
          count(`buiten onlyWorlds (${world})`);
          continue;
        }
        const result = parseLidlTile(raw);
        if (!result.ok) {
          count(result.reason);
          continue;
        }
        if (tiles.has(result.product.externalId)) continue;
        result.skipped.forEach(count);
        tiles.set(result.product.externalId, { product: result.product, offers: result.offers });
        added += 1;
      }
      console.log(`${url} → ${total} tegels, ${added} nieuwe producten (nog ${queue.length} pagina's in de wachtrij, totaal ${tiles.size})`);
    }
  } catch (error) {
    if (error instanceof BlockedError) blocked = error.message;
    else throw error;
  } finally {
    await browser.stop();
  }

  const list = [...tiles.values()];
  const report = {
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    pagesVisited: browser.pagesVisited,
    tilesPerPage: perPage,
    tilesPerWorld: Object.fromEntries([...worlds].sort((a, b) => b[1] - a[1])),
    products: list.length,
    offers: list.reduce((total, tile) => total + tile.offers.length, 0),
    skipped: Object.fromEntries(skipped),
    blocked,
    written: false,
  };

  mkdirSync(feedDir, { recursive: true });
  if (list.length >= config.minProductsToWrite) {
    const feed = buildLidlFeed(list, startedAt);
    const target = join(feedDir, 'lidl.json');
    const temp = `${target}.tmp`;
    writeFileSync(temp, `${JSON.stringify(feed, null, 2)}\n`, 'utf8');
    renameSync(temp, target);
    report.written = true;
    console.log(`✔ ${feed.offers.length} prijzen van ${feed.products.length} producten → ${target}`);
  } else {
    console.log(`✖ te weinig producten (${list.length} < ${config.minProductsToWrite}); bestaand bestand blijft staan`);
  }

  writeFileSync(join(feedDir, 'lidl.report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));

  if (blocked) {
    console.error(`⚠ gestopt: ${blocked}`);
    process.exitCode = 2;
  } else if (!report.written) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
