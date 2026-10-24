/**
 * Belastingstest voor de Superette API, zonder extra afhankelijkheden.
 *
 *   # API gestart met TRUST_PROXY=1, zodat elke virtuele gebruiker zijn eigen
 *   # (gesimuleerde) IP krijgt en de per-IP-limieten per gebruiker gelden,
 *   # zoals in productie achter de reverse proxy.
 *   node scripts/loadtest.mjs                      # 30 s, 20 virtuele gebruikers
 *   CONCURRENCY=50 DURATION_SECONDS=60 node scripts/loadtest.mjs
 *
 * Scenario per virtuele gebruiker (lus tot de tijd om is):
 *   60 %  zoeken (wisselende termen, soms met filters en sortering)
 *   25 %  productdetail (id uit een eerder zoekresultaat)
 *   10 %  ketenoverzicht
 *    5 %  health/ready
 * Elke gebruiker wacht `THINK_MS` ± 50 % tussen verzoeken (standaard 600 ms:
 *   een drukke gebruiker; met 100 ms stoot elke gebruiker op de zoeklimiet van
 *   60/min/IP, wat dan als 429 in het rapport verschijnt).
 *
 * Rapport: aantal verzoeken, foutpercentage (status ≥ 400, 429 apart),
 * mediaan, p95, p99 en de traagste latentie, per endpoint en in totaal.
 */
const API = process.env.API_URL ?? 'http://localhost:4000/api/v1';
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 20);
const DURATION = Number(process.env.DURATION_SECONDS ?? 30) * 1000;
const SPOOF_IPS = (process.env.SPOOF_IPS ?? 'true') === 'true';
const THINK_MS = Number(process.env.THINK_MS ?? 600);

const TERMS = ['melk', 'coca-cola zero', 'olijfolie', 'brood', 'kaas', 'boter', 'pasta', 'rijst', 'yoghurt', 'koffie', 'appels', 'water', 'chips', 'eieren', 'suiker'];
const SORTS = ['UNIT_PRICE', 'PACKAGE_PRICE', 'RELEVANCE'];
const CHAINS = ['lidl', 'colruyt', 'delhaize', 'aldi', 'carrefour', 'albert-heijn', 'jumbo', 'spar'];

const samples = new Map(); // endpoint → { latencies: number[], errors: number, limited: number }
let total = 0;
let errors = 0;
let limited = 0;
let networkErrors = 0;

function record(endpoint, ms, status) {
  const entry = samples.get(endpoint) ?? { latencies: [], errors: 0, limited: 0 };
  entry.latencies.push(ms);
  if (status === 429) {
    entry.limited++;
    limited++;
  } else if (status === 0 || status >= 400) {
    entry.errors++;
    errors++;
  }
  samples.set(endpoint, entry);
  total++;
}

async function hit(endpoint, path, headers) {
  const started = performance.now();
  try {
    const response = await fetch(`${API}${path}`, { headers });
    const body = await response.json().catch(() => null);
    record(endpoint, performance.now() - started, response.status);
    return { status: response.status, body };
  } catch {
    networkErrors++;
    record(endpoint, performance.now() - started, 0);
    return { status: 0, body: null };
  }
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

async function virtualUser(index, deadline) {
  const headers = SPOOF_IPS ? { 'x-forwarded-for': `10.${(index >> 8) & 255}.${index & 255}.${1 + (index % 200)}` } : {};
  let productIds = [];
  while (performance.now() < deadline) {
    const roll = Math.random();
    if (roll < 0.6) {
      let path = `/compare/search?q=${encodeURIComponent(pick(TERMS))}`;
      if (Math.random() < 0.4) path += `&sort=${pick(SORTS)}`;
      if (Math.random() < 0.3) path += `&chains=${pick(CHAINS)}`;
      if (Math.random() < 0.2) path += `&onlyPromotions=true`;
      const result = await hit('GET /compare/search', path, headers);
      const ids = result.body?.items?.map((item) => item.product?.id).filter(Boolean) ?? [];
      if (ids.length) productIds = ids;
    } else if (roll < 0.85 && productIds.length) {
      await hit('GET /compare/products/:id', `/compare/products/${pick(productIds)}`, headers);
    } else if (roll < 0.95) {
      await hit('GET /compare/chains', '/compare/chains', headers);
    } else {
      await hit('GET /health/ready', '/health/ready', headers);
    }
    await new Promise((resolve) => setTimeout(resolve, THINK_MS * (0.5 + Math.random())));
  }
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

function row(name, entry) {
  const sorted = [...entry.latencies].sort((a, b) => a - b);
  return {
    endpoint: name,
    requests: sorted.length,
    'fouten %': sorted.length ? ((entry.errors / sorted.length) * 100).toFixed(2) : '0.00',
    '429': entry.limited,
    'mediaan ms': percentile(sorted, 50).toFixed(1),
    'p95 ms': percentile(sorted, 95).toFixed(1),
    'p99 ms': percentile(sorted, 99).toFixed(1),
    'max ms': (sorted.at(-1) ?? 0).toFixed(1),
  };
}

async function main() {
  const ready = await fetch(`${API}/health/ready`).catch(() => null);
  if (!ready || !ready.ok) {
    console.error(`API niet gereed op ${API} (health/ready ${ready?.status ?? 'onbereikbaar'})`);
    process.exit(2);
  }
  console.log(`\nBelastingstest: ${CONCURRENCY} virtuele gebruikers, ${DURATION / 1000} s, denktijd ~${THINK_MS} ms, tegen ${API}${SPOOF_IPS ? ' (eigen IP per gebruiker via X-Forwarded-For)' : ''}`);
  const started = performance.now();
  const deadline = started + DURATION;
  await Promise.all(Array.from({ length: CONCURRENCY }, (_, index) => virtualUser(index + 1, deadline)));
  const elapsed = (performance.now() - started) / 1000;

  const all = { latencies: [...samples.values()].flatMap((e) => e.latencies), errors, limited };
  const table = [...samples.entries()].sort((a, b) => b[1].latencies.length - a[1].latencies.length).map(([name, entry]) => row(name, entry));
  table.push(row('TOTAAL', all));
  console.table(table);
  console.log(`Verzoeken: ${total} in ${elapsed.toFixed(1)} s = ${(total / elapsed).toFixed(1)} req/s · fouten: ${errors} (${((errors / Math.max(1, total)) * 100).toFixed(2)} %) · 429: ${limited} · netwerkfouten: ${networkErrors}\n`);
  process.exit(errors > 0 ? 1 : 0);
}

main();
