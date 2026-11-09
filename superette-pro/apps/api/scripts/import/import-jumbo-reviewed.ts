import { readFile, stat, mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { assertReviewedPdf, buildReviewedJumboFeed, PDF_SHA256, PDF_URL } from '../../src/compare/scrapers/jumbo/reviewed-folder';

async function main(): Promise<void> {
  const argument = process.argv[2];
  if (!argument || !path.isAbsolute(argument)) throw new Error('Geef het volledige pad van de gecontroleerde PDF.');
  const bytes = await readFile(argument);
  assertReviewedPdf(bytes);
  const fileStat = await stat(argument);
  if (fileStat.mtimeMs > Date.now() + 60_000) throw new Error('Bestandsdatum ligt in de toekomst.');
  if (Date.now() > Date.parse('2026-10-13T21:59:59.999Z')) throw new Error('Folder verlopen; geen feed geschreven.');
  const feed = buildReviewedJumboFeed(fileStat.mtime);
  const apiRoot = path.resolve(__dirname, '../..');
  const output = process.env.COMPARE_FEED_DIR
    ? path.resolve(process.env.COMPARE_FEED_DIR)
    : path.join(apiRoot, 'data', 'jumbo-controle');
  await mkdir(output, { recursive: true });
  const feedPath = path.join(output, 'jumbo.json');
  const temporary = `${feedPath}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(feed, null, 2)}\n`, 'utf8');
  await rename(temporary, feedPath);
  const report = {
    processedAt: new Date().toISOString(), mode: 'REVIEWED_PDF_SELECTION',
    file: argument, sha256: PDF_SHA256, sourceUrl: PDF_URL,
    termsReviewed: false, products: feed.products.length, offers: feed.offers.length,
    completeCatalog: false, generalPdfScraper: false,
    exclusions: ['Multibuy', 'Wisselend gewicht', 'Alcohol', 'Niet beoordeelde aanbiedingen'],
    written: true,
  };
  await writeFile(path.join(output, 'jumbo.report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Feed geschreven: ${feedPath}`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
