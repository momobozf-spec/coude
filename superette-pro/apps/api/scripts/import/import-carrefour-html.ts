import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { buildCarrefourFeed } from '../../src/compare/scrapers/carrefour/feed';
import { parseCarrefourTile, rejectCarrefourPage, type CarrefourProduct, type CarrefourTileInput } from '../../src/compare/scrapers/carrefour/parse';

function filesFor(args: string[]): string[] {
  const files = new Set<string>();
  for (const arg of args) {
    const input = resolve(arg);
    if (!existsSync(input)) throw new Error(`Bestand of map bestaat niet: ${input}`);
    const candidates = statSync(input).isDirectory() ? readdirSync(input).map(name => join(input, name)) : [input];
    for (const file of candidates) if (statSync(file).isFile() && ['.html', '.htm'].includes(extname(file).toLowerCase())) files.add(file);
  }
  return [...files].sort();
}

async function main() {
  if (!process.argv.slice(2).length) throw new Error('Geef een volledig pad naar opgeslagen HTML of een map');
  const files = filesFor(process.argv.slice(2));
  if (!files.length) throw new Error('Geen HTML-bestanden gevonden');
  const apiRoot = resolve(__dirname, '..', '..');
  // Standaard controlemap: nooit rechtstreeks de normale feed vervangen.
  const output = resolve(apiRoot, process.env.COMPARE_FEED_DIR ?? 'data/carrefour-controle');
  const report = { processedAt: new Date().toISOString(), mode: 'SAVED_HTML', storeConfirmed: false,
    files: [] as { file: string; tiles: number; accepted: number; problem: string | null }[],
    skipped: {} as Record<string, number>, products: 0, offers: 0, written: false };
  const skip = (reason: string) => { report.skipped[reason] = (report.skipped[reason] ?? 0) + 1; };
  const products: CarrefourProduct[] = [];
  let oldest: Date | null = null;
  const browser = await chromium.launch({ headless: true }).catch(error => {
    if (!String(error).includes("Executable doesn't exist")) throw error;
    return chromium.launch({ headless: true, channel: 'msedge' });
  });
  try {
    // Alleen DOM uitlezen: scripts uit het opgeslagen bestand draaien niet.
    const context = await browser.newContext({ javaScriptEnabled: false, offline: true, serviceWorkers: 'block' });
    await context.route('**/*', route => route.abort());
    for (const file of files) {
      const html = readFileSync(file, 'utf8');
      const problem = rejectCarrefourPage(html);
      if (problem) { report.files.push({ file, tiles: 0, accepted: 0, problem }); continue; }
      const page = await context.newPage();
      try {
        await page.setContent(html, { waitUntil: 'domcontentloaded' });
        // Tekstexpressie: tsx kan geen __name-helpers in deze browsercode injecteren.
        const data = await page.evaluate<{ category: string | null; tiles: CarrefourTileInput[] }>(`(() => {
          const clean = (value) => value?.replace(/\\s+/g, ' ').trim() || null;
          const category = clean(document.querySelector('h1')?.textContent);
          const tiles = [...document.querySelectorAll('.product.js-product[data-pid]')].map(root => ({
            id: root.getAttribute('data-pid'),
            name: clean(root.querySelector('.name-wrapper .desktop-name')?.textContent),
            brand: clean(root.querySelector('.brand-wrapper')?.textContent),
            href: root.querySelector('.name-wrapper a.link')?.getAttribute('href') ?? null,
            priceContent: root.querySelector('.price-wrapper .sales .value[content]')?.getAttribute('content') ?? null,
            priceText: clean(root.querySelector('.price-wrapper .sales')?.textContent),
            packageText: clean(root.querySelector('.package-info')?.textContent),
            promotionText: clean(root.querySelector('.promo-tag-text')?.textContent),
            hasStrikePrice: !!root.querySelector('.price-wrapper .strike'),
            tracking: root.querySelector('.product-tile')?.getAttribute('data-select-item-event-object') ?? null,
          }));
          return { category, tiles };
        })()`);
        let accepted = 0;
        for (const tile of data.tiles as CarrefourTileInput[]) {
          const parsed = parseCarrefourTile(tile, data.category);
          if (parsed.ok) { products.push(parsed.product); accepted++; } else skip(parsed.reason);
        }
        report.files.push({ file, tiles: data.tiles.length, accepted, problem: accepted ? null : 'geen ondersteunde productprijzen' });
        if (accepted) {
          const savedAt = statSync(file).mtime;
          if (savedAt.getTime() > Date.now() + 60_000) throw new Error('Bestandsdatum ligt in de toekomst');
          if (!oldest || savedAt < oldest) oldest = savedAt;
        }
        console.log(`${file}: ${accepted}/${data.tiles.length} tegels bruikbaar`);
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
  mkdirSync(output, { recursive: true });
  if (products.length && oldest && report.files.every(file => file.problem === null)) {
    const feed = buildCarrefourFeed(products, oldest);
    const target = join(output, 'carrefour.json');
    writeFileSync(`${target}.tmp`, JSON.stringify(feed, null, 2) + '\n', 'utf8');
    renameSync(`${target}.tmp`, target);
    report.products = feed.products.length; report.offers = feed.offers.length; report.written = true;
    console.log(`Feed geschreven: ${target}`);
  } else { console.error('Geen feed geschreven: minstens één bronpagina is onbruikbaar.'); process.exitCode = 1; }
  writeFileSync(join(output, 'carrefour.report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

main().catch(error => { console.error((error as Error).message); process.exitCode = 1; });
