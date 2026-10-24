/**
 * Delhaize-prijzen verzamelen → `data/feeds/delhaize.json`.
 *
 *   SCRAPE_CONTACT=jij@voorbeeld.be npm run scrape:delhaize
 *
 * Werkwijze:
 *  1. robots.txt lezen (PoliteBrowser);
 *  2. de startpagina's uit `data/scrape/delhaize.json` openen: categorieën
 *     (eindigen op `/c/<code>`) leveren productlinks, de shop-startpagina
 *     levert categorielinks als `discoverCategories` aanstaat;
 *  3. per categorie hoogstens `maxProductsPerCategory` producten, in totaal
 *     hoogstens `maxProducts` — een beperkte basket, niet de hele catalogus;
 *  4. per product de schema.org-gegevens lezen (`parseDelhaizeProductPage`);
 *  5. het importbestand valideren en wegschrijven. Bij nul producten wordt
 *     het bestaande bestand NIET overschreven.
 *
 * Een blokkade (403, 429, captcha) stopt de run. Wat al verzameld was, wordt
 * bewaard als het minstens `minProductsToWrite` producten zijn.
 *
 * Daarna inladen: `npm run compare:sync -- delhaize`.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { z } from 'zod';
import { buildDelhaizeFeed } from '../../src/compare/scrapers/delhaize/feed';
import { parseDelhaizeProductPage, type ParsedDelhaizeProduct } from '../../src/compare/scrapers/delhaize/parse';
import { BlockedError, PoliteBrowser } from './polite-browser';

const ORIGIN = 'https://www.delhaize.be';

const configSchema = z.object({
  startUrls: z.array(z.string().url()).min(1),
  discoverCategories: z.boolean().default(false),
  maxCategories: z.number().int().positive().max(200).default(30),
  maxProductsPerCategory: z.number().int().positive().max(100).default(20),
  maxProducts: z.number().int().positive().max(2000).default(300),
  minDelayMs: z.number().int().min(2000).default(4000),
  minProductsToWrite: z.number().int().positive().default(10),
});

const CATEGORY = /^https:\/\/www\.delhaize\.be\/nl\/shop\/.+\/c\/[A-Za-z0-9]+$/;
const PRODUCT = /^https:\/\/www\.delhaize\.be\/nl\/shop\/.+\/p\/[A-Za-z0-9]+$/;

function stripQuery(href: string): string {
  const url = new URL(href);
  return `${url.origin}${url.pathname}`;
}

async function main() {
  const apiRoot = resolve(__dirname, '..', '..');
  const configPath = resolve(apiRoot, process.env.SCRAPE_CONFIG ?? 'data/scrape/delhaize.json');
  const feedDir = resolve(apiRoot, process.env.COMPARE_FEED_DIR ?? 'data/feeds');
  const contact = process.env.SCRAPE_CONTACT ?? '';
  const config = configSchema.parse(JSON.parse(readFileSync(configPath, 'utf8')));

  const browser = new PoliteBrowser({
    origin: ORIGIN,
    contact,
    minDelayMs: config.minDelayMs,
    // Categorieën + producten + marge.
    maxPages: config.maxCategories + config.maxProducts + config.startUrls.length + 5,
    headless: process.env.SCRAPE_HEADLESS !== 'false',
  });

  const skipped = new Map<string, number>();
  const products: ParsedDelhaizeProduct[] = [];
  let blocked: string | null = null;
  const startedAt = new Date();

  await browser.start();
  try {
    // 1+2. Categorieën als wachtrij. Elke bezochte categoriepagina levert
    // productlinks én nieuwe categorielinks (kruimelpad, subcategorieën).
    // De startpagina van de shop bouwt haar menu met JavaScript en levert
    // daardoor zelf geen categorielinks; via de categoriepagina's lukt dat wel.
    const queue: string[] = [];
    const seen = new Set<string>();
    const enqueue = (url: string) => {
      const clean = stripQuery(url);
      if (!CATEGORY.test(clean) || seen.has(clean)) return;
      seen.add(clean);
      queue.push(clean);
    };

    for (const start of config.startUrls) {
      if (CATEGORY.test(stripQuery(start))) {
        enqueue(start);
        continue;
      }
      if (!config.discoverCategories) continue;
      const page = await browser.visit(start);
      if (!page) continue;
      const links = await page.$$eval('a[href]', (anchors) => anchors.map((a) => (a as HTMLAnchorElement).href));
      links.forEach(enqueue);
    }

    const productUrls = new Set<string>();
    let categoriesVisited = 0;
    while (queue.length > 0 && categoriesVisited < config.maxCategories && productUrls.size < config.maxProducts) {
      // Breed vóór diep: eerst de categorie met het kortste pad (hoofdcategorie
      // vóór subcategorie), zodat de basket over alle afdelingen gespreid raakt.
      const depth = (url: string) => new URL(url).pathname.split('/').length;
      let pick = 0;
      for (let i = 1; i < queue.length; i += 1) if (depth(queue[i]!) < depth(queue[pick]!)) pick = i;
      const category = queue.splice(pick, 1)[0]!;
      const page = await browser.visit(category);
      categoriesVisited += 1;
      if (!page) continue;

      const links = await page.$$eval('a[href]', (anchors) => anchors.map((a) => (a as HTMLAnchorElement).href));
      if (config.discoverCategories) links.forEach(enqueue);

      // Alleen de eerste pagina per categorie: een basket, geen catalogus.
      let taken = 0;
      for (const link of links) {
        const clean = stripQuery(link);
        if (!PRODUCT.test(clean) || productUrls.has(clean)) continue;
        productUrls.add(clean);
        taken += 1;
        if (taken >= config.maxProductsPerCategory || productUrls.size >= config.maxProducts) break;
      }
      console.log(`${category} → ${taken} producten (nog ${queue.length} categorieën in de wachtrij)`);
    }
    console.log(`${categoriesVisited} categorieën bezocht, ${productUrls.size} productlinks`);

    // 3. Productpagina's. Vijf mislukte pagina's op rij = vermoedelijk een
    // stille blokkade (uitdagingspagina met status 200): dan stoppen we.
    let failuresInARow = 0;
    let done = 0;
    const productPhaseStart = Date.now();
    for (const url of productUrls) {
      // Voortgang elke 10 pagina's, met een schatting van de resterende tijd.
      if (done > 0 && done % 10 === 0) {
        const perPage = (Date.now() - productPhaseStart) / done;
        const leftMin = Math.ceil((perPage * (productUrls.size - done)) / 60_000);
        console.log(`productpagina's: ${done}/${productUrls.size} · ${products.length} ok · nog ongeveer ${leftMin} min`);
      }
      done += 1;
      const page = await browser.visit(url);
      if (!page) {
        skipped.set('niet toegestaan of niet gevonden', (skipped.get('niet toegestaan of niet gevonden') ?? 0) + 1);
        continue;
      }
      const jsonLd = await page.$$eval('script[type="application/ld+json"]', (nodes) => nodes.map((n) => n.textContent ?? ''));
      const result = parseDelhaizeProductPage({ url, title: await page.title(), jsonLd });
      if (result.ok) {
        products.push(result.product);
        failuresInARow = 0;
      } else if (result.kind === 'skipped') {
        // Leesbare pagina, bewust niet opgenomen (bv. alleen een kiloprijs).
        // Geen teken van blokkade: een rij vleesproducten mag de run niet stoppen.
        skipped.set(result.reason, (skipped.get(result.reason) ?? 0) + 1);
        failuresInARow = 0;
      } else {
        skipped.set(result.reason, (skipped.get(result.reason) ?? 0) + 1);
        failuresInARow += 1;
        if (failuresInARow >= 5) {
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
    products: products.length,
    skipped: Object.fromEntries(skipped),
    blocked,
    written: false,
  };

  if (products.length >= config.minProductsToWrite) {
    const feed = buildDelhaizeFeed(products, startedAt);
    mkdirSync(feedDir, { recursive: true });
    const target = join(feedDir, 'delhaize.json');
    // Eerst naar een tijdelijk bestand, dan hernoemen: nooit een half bestand.
    const temp = `${target}.tmp`;
    writeFileSync(temp, `${JSON.stringify(feed, null, 2)}\n`, 'utf8');
    renameSync(temp, target);
    report.written = true;
    console.log(`✔ ${feed.offers.length} prijzen → ${target}`);
  } else {
    console.log(`✖ te weinig producten (${products.length} < ${config.minProductsToWrite}); bestaand bestand blijft staan`);
  }

  const reportPath = join(feedDir, 'delhaize.report.json');
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
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
