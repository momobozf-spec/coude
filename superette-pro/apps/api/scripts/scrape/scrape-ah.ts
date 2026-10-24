/**
 * Albert Heijn België-prijzen verzamelen → `data/feeds/albert-heijn.json`.
 *
 *   SCRAPE_CONTACT=jij@voorbeeld.be npm run scrape:ah
 *
 * Werkwijze (zelfde aanpak als Delhaize):
 *  1. robots.txt lezen (PoliteBrowser), ook voor de verzoeken die de pagina
 *     zelf doet: verboden adressen worden afgebroken, niet omzeild;
 *  2. de categoriepagina's uit `data/scrape/ah.json` openen (`/producten/<nr>/<naam>`,
 *     door jou aangeleverd vanaf ah.be — niets geraden), naar beneden scrollen
 *     zodat bijgeladen producten er ook bij zijn, en de productlinks
 *     (`/producten/product/wi…`) verzamelen;
 *  3. per categorie hoogstens `maxProductsPerCategory` producten, in totaal
 *     hoogstens `maxProducts` — een basket, niet de hele catalogus;
 *  4. per product de schema.org-gegevens lezen (`parseAhProductPage`);
 *  5. het importbestand valideren en atomisch wegschrijven, alleen als er
 *     minstens `minProductsToWrite` producten zijn.
 *
 * Een blokkade (403, 429, captcha) of vijf onleesbare pagina's op rij stopt
 * de run. Bewust overgeslagen producten (bv. alleen een kiloprijs) tellen
 * niet als blokkade.
 *
 * Daarna inladen: `npm run compare:sync -- albert-heijn`.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Page } from 'playwright';
import { z } from 'zod';
import { buildAhFeed, type AhFeedProduct } from '../../src/compare/scrapers/ah/feed';
import { parseAhProductPage } from '../../src/compare/scrapers/ah/parse';
import { BlockedError, PoliteBrowser } from './polite-browser';

const ORIGIN = 'https://www.ah.be';
const CATEGORY = /^https:\/\/www\.ah\.be\/producten\/\d{3,8}\/[a-z0-9-]+$/;
const PRODUCT = /^https:\/\/www\.ah\.be\/producten\/product\/wi\d{3,12}(?:\/[a-z0-9-]+)?$/;

const configSchema = z.object({
  startUrls: z
    .array(z.string().url().refine((url) => CATEGORY.test(url), 'alleen ah.be-categoriepagina’s (/producten/<nr>/<naam>)'))
    .min(1)
    .max(40),
  maxProductsPerCategory: z.number().int().positive().max(100).default(40),
  maxProducts: z.number().int().positive().max(2000).default(300),
  scrollRounds: z.number().int().min(0).max(30).default(6),
  minDelayMs: z.number().int().min(2000).default(5000),
  minProductsToWrite: z.number().int().positive().default(10),
});

function stripQuery(href: string): string {
  try {
    const url = new URL(href);
    return `${url.origin}${url.pathname}`;
  } catch {
    return '';
  }
}

const productLinks = (page: Page) =>
  page.$$eval('a[href*="/producten/product/"]', (anchors) => anchors.map((a) => (a as HTMLAnchorElement).href));

/** Naar beneden scrollen tot er geen nieuwe productlinks meer bijkomen. */
async function scrollUntilStable(page: Page, rounds: number): Promise<void> {
  let previous = (await productLinks(page)).length;
  for (let i = 0; i < rounds; i += 1) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);
    const now = (await productLinks(page)).length;
    if (now <= previous) return;
    previous = now;
  }
}

/** "fruit-verse-sappen" → "Fruit verse sappen". Leesbare naam uit de URL die jij aanleverde. */
function categoryName(url: string): string {
  const slug = new URL(url).pathname.split('/').pop() ?? '';
  const words = slug.replace(/-/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

async function main() {
  const apiRoot = resolve(__dirname, '..', '..');
  const configPath = resolve(apiRoot, process.env.SCRAPE_CONFIG ?? 'data/scrape/ah.json');
  const feedDir = resolve(apiRoot, process.env.COMPARE_FEED_DIR ?? 'data/feeds');
  const config = configSchema.parse(JSON.parse(readFileSync(configPath, 'utf8')));

  const browser = new PoliteBrowser({
    origin: ORIGIN,
    contact: process.env.SCRAPE_CONTACT ?? '',
    minDelayMs: config.minDelayMs,
    maxPages: config.startUrls.length + config.maxProducts + 5,
    headless: process.env.SCRAPE_HEADLESS !== 'false',
    enforceRobotsOnSubrequests: true,
  });

  const skipped = new Map<string, number>();
  const count = (reason: string) => skipped.set(reason, (skipped.get(reason) ?? 0) + 1);
  const products: AhFeedProduct[] = [];
  const linksPerCategory: Record<string, number> = {};
  let withEan = 0;
  let blocked: string | null = null;
  const startedAt = new Date();

  await browser.start();
  try {
    // 1+2. Categoriepagina's → productlinks (met de categorie waar ze vandaan komen).
    const productUrls = new Map<string, string>();
    for (const start of config.startUrls) {
      if (productUrls.size >= config.maxProducts) break;
      const category = stripQuery(start);
      const page = await browser.visit(category);
      if (!page) {
        count('categoriepagina niet toegestaan of niet gevonden');
        continue;
      }
      await scrollUntilStable(page, config.scrollRounds);
      let taken = 0;
      for (const link of await productLinks(page)) {
        const clean = stripQuery(link);
        if (!PRODUCT.test(clean) || productUrls.has(clean)) continue;
        productUrls.set(clean, categoryName(category));
        taken += 1;
        if (taken >= config.maxProductsPerCategory || productUrls.size >= config.maxProducts) break;
      }
      linksPerCategory[category] = taken;
      console.log(`${category} → ${taken} producten`);
    }
    console.log(`${productUrls.size} productlinks uit ${Object.keys(linksPerCategory).length} categorieën`);

    // 3. Productpagina's.
    let unreadableInARow = 0;
    let done = 0;
    const phaseStart = Date.now();
    for (const [url, category] of productUrls) {
      if (done > 0 && done % 10 === 0) {
        const perPage = (Date.now() - phaseStart) / done;
        const leftMin = Math.ceil((perPage * (productUrls.size - done)) / 60_000);
        console.log(`productpagina's: ${done}/${productUrls.size} · ${products.length} ok · nog ongeveer ${leftMin} min`);
      }
      done += 1;
      const page = await browser.visit(url);
      if (!page) {
        count('niet toegestaan of niet gevonden');
        continue;
      }
      const jsonLd = await page.$$eval('script[type="application/ld+json"]', (nodes) => nodes.map((n) => n.textContent ?? ''));
      const result = parseAhProductPage({ url, jsonLd });
      if (result.ok) {
        products.push({ ...result.product, categoryPath: category });
        if (result.product.barcode) withEan += 1;
        unreadableInARow = 0;
      } else if (result.kind === 'skipped') {
        count(result.reason);
        unreadableInARow = 0;
      } else {
        count(result.reason);
        unreadableInARow += 1;
        if (unreadableInARow >= 5) {
          throw new BlockedError(`5 productpagina's op rij zonder bruikbare gegevens (laatste: ${result.reason}); vermoedelijk geblokkeerd`);
        }
      }
    }
  } catch (error) {
    if (error instanceof BlockedError) blocked = error.message;
    else throw error;
  } finally {
    await browser.stop();
  }

  const report = {
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    pagesVisited: browser.pagesVisited,
    linksPerCategory,
    products: products.length,
    withEan,
    skipped: Object.fromEntries(skipped),
    blocked,
    written: false,
  };

  mkdirSync(feedDir, { recursive: true });
  if (products.length >= config.minProductsToWrite) {
    const feed = buildAhFeed(products, startedAt);
    const target = join(feedDir, 'albert-heijn.json');
    const temp = `${target}.tmp`;
    writeFileSync(temp, `${JSON.stringify(feed, null, 2)}\n`, 'utf8');
    renameSync(temp, target);
    report.written = true;
    console.log(`✔ ${feed.offers.length} prijzen → ${target}`);
  } else {
    console.log(`✖ te weinig producten (${products.length} < ${config.minProductsToWrite}); bestaand bestand blijft staan`);
  }

  writeFileSync(join(feedDir, 'albert-heijn.report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
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
