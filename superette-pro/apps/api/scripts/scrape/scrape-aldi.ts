/** ALDI: elke afgewerkte pagina atomisch bewaren; bij netwerkverlies veilig hervatten. */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { buildAldiFeed } from '../../src/compare/scrapers/aldi/feed';
import { ALDI_ORIGIN, PRODUCT_URL, parseAldiProductPage, type ParsedAldiProduct } from '../../src/compare/scrapers/aldi/parse';
import { readCheckpoint, writeCheckpoint, finishRun, type AldiCheckpoint } from '../../src/compare/scrapers/aldi/checkpoint';
import { BlockedError, PoliteBrowser } from './polite-browser';

const configSchema = z.object({
  sitemapUrl: z.string().url().refine((url) => url.startsWith(`${ALDI_ORIGIN}/`)),
  maxProducts: z.number().int().positive().max(2000).default(300),
  minDelayMs: z.number().int().min(2000).default(5000),
  minProductsToWrite: z.number().int().positive().default(10),
});
async function main() {
  const apiRoot = resolve(__dirname, '..', '..');
  const config = configSchema.parse(JSON.parse(readFileSync(resolve(apiRoot, process.env.SCRAPE_CONFIG ?? 'data/scrape/aldi.json'), 'utf8')));
  const feedDir = resolve(apiRoot, process.env.COMPARE_FEED_DIR ?? 'data/feeds');
  const probe = process.argv[2] ? Number(process.argv[2]) : null;
  if (probe !== null && (!Number.isInteger(probe) || probe < 1 || probe > 2000)) throw new Error('Ongeldig proefaantal.');
  const maxProducts = probe ?? config.maxProducts;
  const signature = JSON.stringify({ config, probe });
  mkdirSync(feedDir, { recursive: true });
  // Herstelpunten buiten OneDrive: alleen de eindfeed komt in de projectmap.
  const checkpointDir = join(process.env.LOCALAPPDATA ?? tmpdir(), 'superette', 'scrape-checkpoints', createHash('sha256').update(feedDir).digest('hex').slice(0, 20));
  mkdirSync(checkpointDir, { recursive: true });
  const checkpointFile = join(checkpointDir, 'aldi.checkpoint.json');
  const legacy = join(feedDir, 'aldi.checkpoint.json');
  const recoverFrom = existsSync(checkpointFile) || existsSync(`${checkpointFile}.tmp`) ? checkpointFile : legacy;
  let checkpoint: AldiCheckpoint = existsSync(recoverFrom) || existsSync(`${recoverFrom}.tmp`)
    ? readCheckpoint(recoverFrom, signature)
    : { version: 1, signature, startedAt: new Date().toISOString(), status: 'RUNNING', inSitemap: 0, urls: [], entries: [] };
  writeCheckpoint(checkpointFile, checkpoint);
  const pointer = join(feedDir, 'aldi.checkpoint-location.json');
  if (!existsSync(pointer)) writeFileSync(pointer, JSON.stringify({ version: 1, checkpointFile }), { encoding: 'utf8', flag: 'wx' });
  const startedAt = new Date(checkpoint.startedAt);
  const browser = new PoliteBrowser({ origin: ALDI_ORIGIN, contact: process.env.SCRAPE_CONTACT ?? '', minDelayMs: config.minDelayMs, maxPages: maxProducts + 3, headless: process.env.SCRAPE_HEADLESS !== 'false', enforceRobotsOnSubrequests: true });
  const products: ParsedAldiProduct[] = [];
  const skipped = new Map<string, number>();
  const issues: { url: string; kind: string; reason: string }[] = [];
  let withoutSalesUnit = 0, unreadableInARow = 0;
  const applyEntry = (entry: AldiCheckpoint['entries'][number]) => {
    if (!entry.input) {
      const reason = 'niet toegestaan of niet gevonden';
      skipped.set(reason, (skipped.get(reason) ?? 0) + 1);
      issues.push({ url: entry.url, kind: 'not_found_or_disallowed', reason });
      return;
    }
    if (!entry.input.salesUnit) withoutSalesUnit++;
    const result = parseAldiProductPage(entry.input);
    if (result.ok) { products.push(result.product); unreadableInARow = 0; }
    else {
      skipped.set(result.reason, (skipped.get(result.reason) ?? 0) + 1);
      issues.push({ url: entry.url, kind: result.kind, reason: result.reason });
      unreadableInARow = result.kind === 'skipped' ? 0 : unreadableInARow + 1;
      if (result.kind === 'unreadable') console.log(`onleesbaar: ${result.reason} - ${entry.url}`);
    }
    if (unreadableInARow >= 5) throw new BlockedError('5 onleesbare productpagina\'s op rij; run gestopt.');
  };
  let stopped: string | null = null;
  let currentUrl = 'browser starten';
  const heartbeat = setInterval(() => console.log(`Voortgang: ${checkpoint.entries.length}/${checkpoint.urls.length || maxProducts} paginas bewaard - ${currentUrl}`), 30_000);
  const deadline = async <T>(operation: Promise<T>, label: string): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([operation, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`Geen antwoord binnen 90 seconden: ${label}`)), 90_000); })]);
    } finally { if (timer) clearTimeout(timer); }
  };
  try {
    for (const entry of checkpoint.entries) applyEntry(entry);
    console.log(`Bewaarde voortgang: ${checkpoint.entries.length} paginas, ${products.length} bruikbare producten.`);
    await deadline(browser.start(), 'browser starten');
    if (!checkpoint.urls.length) {
      const xml = await browser.fetchText(config.sitemapUrl);
      if (!xml) throw new BlockedError('Sitemap niet gevonden of niet toegestaan.');
      const all = [...new Set([...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((match) => match[1]!.replace(/&amp;/g, '&')).filter((url) => PRODUCT_URL.test(url)))];
      checkpoint.inSitemap = all.length;
      checkpoint.urls = all.length <= maxProducts ? all : Array.from({ length: maxProducts }, (_, i) => all[Math.floor(i * all.length / maxProducts)]!);
      if (!checkpoint.urls.length) throw new BlockedError('Sitemap bevat geen herkenbare productpagina\'s.');
      checkpoint.status = 'RUNNING';
      writeCheckpoint(checkpointFile, checkpoint);
    }
    const initialDone = checkpoint.entries.length, phaseStart = Date.now();
    for (let index = initialDone; index < checkpoint.urls.length; index++) {
      const url = checkpoint.urls[index]!;
      currentUrl = url;
      const input = await deadline((async () => {
        const page = await browser.visit(url);
        return page ? {
          url,
          jsonLd: await page.$$eval('script[type="application/ld+json"]', (nodes) => nodes.map((node) => node.textContent ?? '')),
          salesUnit: await page.$eval('.tag__marker--salesunit', (node) => node.textContent ?? '').catch(() => null),
        } : null;
      })(), url);
      const entry = { url, input };
      checkpoint.entries.push(entry);
      checkpoint.status = 'RUNNING';
      // Eerst bewaren. Netwerk- of procesuitval verliest hoogstens de huidige pagina.
      writeCheckpoint(checkpointFile, checkpoint);
      applyEntry(entry);
      if (checkpoint.entries.length % 10 === 0) {
        const doneThisSession = checkpoint.entries.length - initialDone;
        const minutes = Math.ceil(((Date.now() - phaseStart) / doneThisSession * (checkpoint.urls.length - checkpoint.entries.length)) / 60_000);
        console.log(`productpagina's: ${checkpoint.entries.length}/${checkpoint.urls.length} - ${products.length} ok - nog ongeveer ${minutes} min`);
      }
    }
    checkpoint.status = 'COMPLETE';
  } catch (error) {
    stopped = error instanceof Error ? error.message : String(error);
    checkpoint.status = error instanceof BlockedError ? 'BLOCKED' : 'INTERRUPTED';
  } finally {
    try { await finishRun(() => writeCheckpoint(checkpointFile, checkpoint), () => deadline(browser.stop(), 'browser sluiten')); }
    catch (error) {
      stopped ??= error instanceof Error ? error.message : String(error);
      if (checkpoint.status !== 'BLOCKED') checkpoint.status = 'INTERRUPTED';
      console.error(`Afsluiten: ${stopped}`);
    } finally { clearInterval(heartbeat); }
  }
  const report = { startedAt: checkpoint.startedAt, finishedAt: new Date().toISOString(), probe: probe !== null, pagesVisited: browser.pagesVisited, completedProducts: checkpoint.entries.length, plannedProducts: checkpoint.urls.length, inSitemap: checkpoint.inSitemap, products: products.length, withoutSalesUnit, skipped: Object.fromEntries(skipped), issues, blocked: stopped, checkpointStatus: checkpoint.status, written: false };
  if (checkpoint.status === 'COMPLETE' && products.length >= (probe !== null ? 1 : config.minProductsToWrite)) {
    const feed = buildAldiFeed(products, startedAt);
    const target = join(feedDir, 'aldi.json');
    writeFileSync(`${target}.tmp`, JSON.stringify(feed, null, 2) + '\n', 'utf8');
    renameSync(`${target}.tmp`, target);
    report.written = true;
    console.log(`${feed.products.length} producten en ${feed.offers.length} prijzen opgeslagen.`);
  }
  writeFileSync(join(feedDir, 'aldi.report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(`Checkpoint: ${checkpointFile}`);
  if (stopped) { console.error(`Gestopt: ${stopped}. Voortgang bewaard; geen gedeeltelijke feed geimporteerd.`); process.exitCode = 2; }
  else if (!report.written) { console.error('Te weinig bruikbare producten; geen feed geschreven.'); process.exitCode = 1; }
}
main().then(() => { process.exit(process.exitCode ?? 0); }).catch((error) => { console.error(error.message); process.exit(1); });
