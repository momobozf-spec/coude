/**
 * Lokale feeds naar de productie-API sturen.
 *
 *   PUSH_API_URL=https://<api-host>/api/v1 PUSH_JOB_KEY=… npm run feeds:push
 *   npm run feeds:push -- delhaize aldi      # alleen deze ketens
 *   npm run feeds:push -- --dry-run          # alleen lokaal valideren
 *
 * Leest `COMPARE_FEED_DIR` (standaard `data/feeds`, relatief aan apps/api).
 * Elke feed wordt eerst lokaal gevalideerd (zelfde schema als de server),
 * daarna gzip-gecomprimeerd verstuurd met `x-job-key`. De server bewaart hem
 * in de database en start de synchronisatie van die keten; het resultaat
 * verschijnt in `GET /compare/internal/status`.
 *
 * `PUSH_JOB_KEY` valt terug op `COMPARE_JOB_KEY`. De sleutel wordt nooit getoond.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { supermarketAdapters } from '../src/compare/adapters/adapter-registry';
import { pushFeed, resolveTarget, selectFeeds, validateLocally, type FeedCandidate } from './feeds/push-feeds';

/** PUSH_API_URL, PUSH_JOB_KEY en COMPARE_FEED_DIR mogen ook in de root-`.env` staan (nooit gelogd). */
function loadRootEnv(): void {
  const envPath = resolve(__dirname, '..', '..', '..', '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = /^\s*(PUSH_API_URL|PUSH_JOB_KEY|COMPARE_FEED_DIR)\s*=\s*(.*)\s*$/.exec(line);
    if (match && !process.env[match[1]!]) process.env[match[1]!] = match[2]!.trim().replace(/^["']|["']$/g, '');
  }
}

async function main(): Promise<void> {
  loadRootEnv();
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const only = args.filter((argument) => !argument.startsWith('-'));
  const feedDir = resolve(process.cwd(), process.env['COMPARE_FEED_DIR'] ?? 'data/feeds');

  const { selected, skipped } = selectFeeds(readdirSync(feedDir), supermarketAdapters.map((adapter) => adapter.key), only);
  for (const file of skipped) console.log(`· overgeslagen: ${file}`);
  if (selected.length === 0) {
    console.log(`Geen feeds om te versturen in ${feedDir}.`);
    process.exitCode = only.length > 0 ? 1 : 0;
    return;
  }

  const candidates: FeedCandidate[] = selected.map((adapterKey) => {
    const path = join(feedDir, `${adapterKey}.json`);
    return { adapterKey, path, raw: readFileSync(path, 'utf8') };
  });

  let invalid = 0;
  for (const candidate of candidates) {
    const result = validateLocally(candidate);
    if (!result.ok) {
      invalid++;
      console.log(`✗ ${candidate.adapterKey}: ${result.error}`);
    }
  }
  if (invalid > 0) {
    console.log(`\n${invalid} ongeldige feed(s); er is niets verstuurd.`);
    process.exitCode = 1;
    return;
  }
  if (dryRun) {
    console.log(`✓ ${candidates.length} feed(s) geldig (dry-run, niets verstuurd): ${selected.join(', ')}`);
    return;
  }

  const target = resolveTarget(process.env);
  let failed = 0;
  for (const candidate of candidates) {
    const outcome = await pushFeed(target, candidate, (url, init) => fetch(url, init));
    if (outcome.ok) {
      console.log(`✓ ${outcome.adapterKey.padEnd(14)} ${String(outcome.offers).padStart(5)} aanbiedingen · ${outcome.changed ? 'nieuw' : 'ongewijzigd'} · sync ${outcome.sync}`);
    } else {
      failed++;
      console.log(`✗ ${outcome.adapterKey.padEnd(14)} ${outcome.status ?? '—'} ${outcome.error}`);
    }
  }
  console.log(`\n${candidates.length - failed}/${candidates.length} verstuurd naar ${new URL(target.apiUrl).host}. Resultaat van de import: GET /api/v1/compare/internal/status (met x-job-key).`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
