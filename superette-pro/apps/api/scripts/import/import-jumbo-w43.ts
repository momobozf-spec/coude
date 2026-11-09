/**
 * Jumbo België folder week 43 → data/feeds/jumbo.json (gecontroleerde selectie).
 * Gebruik: npm run import:jumbo:w43 -- <volledig pad naar de PDF>
 * De PDF moet exact de gecontroleerde folder zijn (SHA-256), en we moeten binnen de geldigheid zitten.
 */
import { copyFile, mkdir, readFile, rename, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { assertW43Pdf, buildJumboW43Feed, W43_ITEMS, W43_PDF_SHA256, W43_PDF_URL } from '../../src/compare/scrapers/jumbo/folder-2026-w43';

async function main(): Promise<void> {
  const argument = process.argv[2];
  if (!argument || !path.isAbsolute(argument)) throw new Error('Geef het volledige pad van de folder-PDF.');
  assertW43Pdf(await readFile(argument));
  const now = new Date();
  const feed = buildJumboW43Feed(now); // weigert buiten 21-27 oktober
  const apiRoot = path.resolve(__dirname, '../..');
  const output = path.resolve(process.env.COMPARE_FEED_DIR ?? path.join(apiRoot, 'data', 'feeds'));
  await mkdir(output, { recursive: true });
  const feedPath = path.join(output, 'jumbo.json');
  // De vorige Jumbo-feed blijft bewaard.
  if (await access(feedPath).then(() => true, () => false)) await copyFile(feedPath, path.join(output, 'jumbo.vorige.json'));
  const temporary = `${feedPath}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(feed, null, 2)}\n`, 'utf8');
  await rename(temporary, feedPath);
  const report = {
    processedAt: now.toISOString(), mode: 'REVIEWED_PDF_SELECTION', week: '2026-W43',
    file: argument, sha256: W43_PDF_SHA256, sourceUrl: W43_PDF_URL, termsReviewed: false,
    reviewedItems: W43_ITEMS.length, products: feed.products.length, offers: feed.offers.length,
    multibuy: feed.offers.filter((o) => o.promotionType === 'MULTIBUY').length,
    completeCatalog: false, generalPdfScraper: false,
    exclusions: ['Alcohol', 'Acties zonder vaste verpakking', 'Inhoud in stuks/rollen/zakjes', 'Eenheidsprijs die niet sluit'],
    written: true,
  };
  await writeFile(path.join(output, 'jumbo.report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Feed geschreven: ${feedPath} (${feed.offers.length} aanbiedingen, ${report.multibuy} multibuy)`);
}

main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
