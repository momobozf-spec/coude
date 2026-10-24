import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { buildSparSnapshot } from '../../src/compare/scrapers/spar/snapshot';

async function main() {
  const file = process.argv[2];
  if (!file || !path.isAbsolute(file)) throw new Error('Geef het volledige pad van de JSON-browseropname.');
  const { feed, skipped } = buildSparSnapshot(JSON.parse(await readFile(file, 'utf8')));
  const output = process.env.COMPARE_FEED_DIR ? path.resolve(process.env.COMPARE_FEED_DIR) : path.resolve(__dirname, '../../data/spar-controle');
  await mkdir(output, { recursive: true });
  const report = { processedAt: new Date().toISOString(), source: file, store: feed.locations[0], termsReviewed: false, products: feed.products.length, offers: feed.offers.length, skipped, written: true };
  const target = path.join(output, 'spar.json');
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(feed, null, 2) + '\n', 'utf8');
  await rename(temporary, target);
  await writeFile(path.join(output, 'spar.report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(`Feed geschreven: ${target}`);
  console.log(JSON.stringify(report, null, 2));
}
main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
