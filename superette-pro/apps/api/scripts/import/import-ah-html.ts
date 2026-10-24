/**
 * Albert Heijn België-prijzen uit ZELF OPGESLAGEN ah.be-pagina's → `data/feeds/albert-heijn.json`.
 *
 *   npm run import:ah -- "C:\pad\naar\melk.html" "C:\pad\naar\kaas.html"
 *   npm run import:ah -- "C:\pad\naar\map-met-html-bestanden"
 *
 * Hoe je de pagina's bewaart: open op ah.be een zoek- of categoriepagina in je
 * eigen browser (bv. https://www.ah.be/zoeken?query=melk), scroll tot alle
 * producten er staan, en bewaar met Ctrl+S als "Webpagina, alleen HTML".
 *
 * Dit script haalt NIETS op van het internet. ah.be weigert geautomatiseerde
 * bezoekers; daar gaan we niet omheen. Wat jij zelf bekijkt en bewaart,
 * verwerken we wel.
 *
 * Het importbestand bevat ALLEEN de producten uit de opgegeven bestanden: bij
 * de volgende sync worden AH-producten die er niet in staan inactief. Geef dus
 * telkens al je pagina's samen op (of één map).
 *
 * Tijdstip: de prijs geldt op het moment dat jij de pagina bewaarde; we nemen
 * daarvoor de wijzigingsdatum van het bestand (de oudste als er meerdere zijn).
 *
 * Daarna inladen: `npm run compare:sync -- albert-heijn`.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { AH_SAVED_PAGES_LABEL, buildAhFeed, type AhFeedProduct } from '../../src/compare/scrapers/ah/feed';
import { extractAhListing, rejectAhPage } from '../../src/compare/scrapers/ah/listing';

function htmlFiles(args: readonly string[]): string[] {
  const files: string[] = [];
  for (const arg of args) {
    const path = resolve(arg);
    if (!existsSync(path)) {
      throw new Error(`Map of bestand bestaat niet: ${path}\nBewaar eerst AH-pagina's (Ctrl+S, "Webpagina, alleen HTML") in die map.`);
    }
    if (statSync(path).isDirectory()) {
      for (const name of readdirSync(path)) {
        if (['.html', '.htm'].includes(extname(name).toLowerCase())) files.push(join(path, name));
      }
    } else {
      files.push(path);
    }
  }
  return files;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Gebruik: npm run import:ah -- <bestand.html of map> [meer bestanden]');
    process.exitCode = 1;
    return;
  }
  const apiRoot = resolve(__dirname, '..', '..');
  const feedDir = resolve(apiRoot, process.env.COMPARE_FEED_DIR ?? 'data/feeds');

  const files = htmlFiles(args);
  const products = new Map<string, AhFeedProduct>();
  const skipped: Record<string, number> = {};
  const perFile: Record<string, number | string> = {};
  let oldest: Date | null = null;

  for (const file of files) {
    const html = readFileSync(file, 'utf8');
    const problem = rejectAhPage(html);
    if (problem) {
      perFile[file] = `geweigerd: ${problem}`;
      console.log(`✖ ${file} — ${problem}`);
      continue;
    }
    const result = extractAhListing(html);
    for (const [reason, count] of Object.entries(result.skipped)) skipped[reason] = (skipped[reason] ?? 0) + count;
    let added = 0;
    for (const product of result.products) {
      if (products.has(product.externalId)) continue;
      products.set(product.externalId, product);
      added += 1;
    }
    perFile[file] = result.products.length;
    const savedAt = statSync(file).mtime;
    if (!oldest || savedAt < oldest) oldest = savedAt;
    console.log(`✔ ${file} → ${result.products.length} producten (${added} nieuw)`);
  }

  const list = [...products.values()];
  const report = {
    processedAt: new Date().toISOString(),
    savedAt: oldest?.toISOString() ?? null,
    files: perFile,
    products: list.length,
    withPromotion: list.filter((p) => p.offer).length,
    skipped,
    written: false,
  };

  mkdirSync(feedDir, { recursive: true });
  if (list.length > 0 && oldest) {
    const feed = buildAhFeed(list, oldest, {
      label: AH_SAVED_PAGES_LABEL,
      notes:
        'Verwerkt uit pagina’s van ah.be die een mens zelf bekeek en bewaarde (geen geautomatiseerde ' +
        'toegang). Tijdstip = wijzigingsdatum van het oudste bestand. Acties op meerdere artikelen staan ' +
        'als voorwaarde bij de gewone stukprijs. Geen EAN, afbeeldingen of omschrijvingen.',
    });
    const target = join(feedDir, 'albert-heijn.json');
    writeFileSync(`${target}.tmp`, `${JSON.stringify(feed, null, 2)}\n`, 'utf8');
    renameSync(`${target}.tmp`, target);
    report.written = true;
    console.log(`\n✔ ${feed.offers.length} prijzen → ${target}`);
  } else {
    console.log('\n✖ geen bruikbare producten gevonden; bestaand bestand blijft staan');
    process.exitCode = 1;
  }

  writeFileSync(join(feedDir, 'albert-heijn.report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

try {
  main();
} catch (error) {
  console.error(`✖ ${(error as Error).message}`);
  process.exitCode = 1;
}
