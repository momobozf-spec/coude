/**
 * Kern van `npm run feeds:push`: lokale feeds (`data/feeds/<adapterkey>.json`)
 * naar de productie-API sturen (`POST /compare/internal/feeds/:chain`).
 *
 * Zuiver en testbaar: bestandssysteem en `fetch` komen binnen als parameters.
 * De jobsleutel wordt nooit gelogd of in een fout herhaald.
 */
import { gzipSync } from 'node:zlib';
import { feedFileSchema } from '../../src/compare/adapters/feed-schema';

export interface PushTarget {
  /** Basis-URL van de API inclusief `/api/v1`, bv. `https://superette-api.onrender.com/api/v1`. */
  readonly apiUrl: string;
  readonly jobKey: string;
}

export interface FeedCandidate {
  readonly adapterKey: string;
  readonly path: string;
  readonly raw: string;
}

export type PushOutcome =
  | { readonly adapterKey: string; readonly ok: true; readonly status: number; readonly changed: boolean; readonly offers: number; readonly sync: string }
  | { readonly adapterKey: string; readonly ok: false; readonly status: number | null; readonly error: string };

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: Uint8Array<ArrayBuffer> }) => Promise<{
  status: number;
  ok: boolean;
  text(): Promise<string>;
}>;

/** Weigert http buiten localhost: de jobsleutel gaat nooit onversleuteld over het net. */
export function resolveTarget(env: NodeJS.ProcessEnv): PushTarget {
  const apiUrl = env['PUSH_API_URL']?.trim().replace(/\/+$/, '');
  const jobKey = (env['PUSH_JOB_KEY'] ?? env['COMPARE_JOB_KEY'])?.trim();
  if (!apiUrl) throw new Error('PUSH_API_URL ontbreekt (bv. https://<api-host>/api/v1)');
  if (!jobKey) throw new Error('PUSH_JOB_KEY (of COMPARE_JOB_KEY) ontbreekt');

  let parsed: URL;
  try {
    parsed = new URL(apiUrl);
  } catch {
    throw new Error('PUSH_API_URL is geen geldige URL');
  }
  const local = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  if (parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) {
    throw new Error('PUSH_API_URL moet https:// zijn (http alleen voor localhost)');
  }
  if (!/\/api\/v1$/.test(parsed.pathname.replace(/\/+$/, ''))) {
    throw new Error('PUSH_API_URL moet eindigen op /api/v1');
  }
  return { apiUrl, jobKey };
}

/**
 * Kiest de bestanden die bij een geregistreerde adapter horen. `example.json`,
 * README's en onbekende namen worden overgeslagen (en gemeld).
 */
export function selectFeeds(
  files: readonly string[],
  registeredKeys: readonly string[],
  only: readonly string[] = [],
): { selected: string[]; skipped: string[] } {
  const selected: string[] = [];
  const skipped: string[] = [];
  for (const file of [...files].sort()) {
    const match = /^([a-z0-9-]{1,40})\.json$/.exec(file);
    if (!match) continue;
    const key = match[1]!;
    if (!registeredKeys.includes(key)) {
      if (key !== 'example') skipped.push(file);
      continue;
    }
    if (only.length > 0 && !only.includes(key)) continue;
    selected.push(key);
  }
  for (const key of only) {
    if (!selected.includes(key)) skipped.push(`${key}.json (niet gevonden of geen geregistreerde adapter)`);
  }
  return { selected, skipped };
}

/** Lokaal valideren met hetzelfde schema als de server: een ongeldige feed vertrekt niet. */
export function validateLocally(candidate: FeedCandidate): { ok: true } | { ok: false; error: string } {
  let json: unknown;
  try {
    json = JSON.parse(candidate.raw);
  } catch {
    return { ok: false, error: `${candidate.path}: geen geldige JSON` };
  }
  const parsed = feedFileSchema.safeParse(json);
  if (!parsed.success) {
    const details = parsed.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    return { ok: false, error: `${candidate.path} is ongeldig: ${details}` };
  }
  return { ok: true };
}

/** Eén feed versturen (gzip). Fouten van de server worden samengevat zonder de sleutel. */
export async function pushFeed(target: PushTarget, candidate: FeedCandidate, fetchImpl: FetchLike): Promise<PushOutcome> {
  const body = gzipSync(Buffer.from(candidate.raw, 'utf8'));
  let response: Awaited<ReturnType<FetchLike>>;
  try {
    response = await fetchImpl(`${target.apiUrl}/compare/internal/feeds/${candidate.adapterKey}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-encoding': 'gzip', 'x-job-key': target.jobKey },
      body: new Uint8Array(body),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { adapterKey: candidate.adapterKey, ok: false, status: null, error: `netwerkfout: ${message.split(target.jobKey).join('***')}` };
  }

  const text = await response.text();
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(text) as Record<string, unknown>;
  } catch {
    // geen JSON (bv. een proxyfout); hieronder samengevat
  }

  if (!response.ok) {
    const code = typeof payload['code'] === 'string' ? payload['code'] : 'ERROR';
    const message = typeof payload['message'] === 'string' ? payload['message'] : text.slice(0, 200);
    const issues = Array.isArray(payload['issues'])
      ? ` — ${(payload['issues'] as Array<{ path?: string; message?: string }>).slice(0, 3).map((issue) => `${issue.path}: ${issue.message}`).join('; ')}`
      : '';
    return { adapterKey: candidate.adapterKey, ok: false, status: response.status, error: `${code}: ${message}${issues}`.split(target.jobKey).join('***') };
  }

  return {
    adapterKey: candidate.adapterKey,
    ok: true,
    status: response.status,
    changed: payload['changed'] === true,
    offers: typeof payload['offers'] === 'number' ? payload['offers'] : 0,
    sync: typeof payload['sync'] === 'string' ? payload['sync'] : 'onbekend',
  };
}
