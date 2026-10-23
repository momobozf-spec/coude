import { z } from "zod";

/** Antwoordstructuur van POST /v3/notices/search (velden per aankondiging zijn dynamisch). */
export const tedSearchResponseSchema = z.object({
  notices: z.array(z.record(z.string(), z.unknown())),
  totalNoticeCount: z.number().nullable().optional(),
  iterationNextToken: z.string().nullable().optional(),
  timedOut: z.boolean().optional(),
});
export type TedSearchResponse = z.infer<typeof tedSearchResponseSchema>;

export class TedApiError extends Error {
  constructor(
    message: string,
    public status: number | null,
    public retryable: boolean,
    public body?: string,
    public retryAfterSeconds: number | null = null,
  ) {
    super(message);
  }
}

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export type TedClientOptions = {
  baseUrl?: string;
  fetchImpl?: FetchLike;
  maxRetries?: number;
  delayMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

const defaultSleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Eén zoekpagina met retries (429/5xx/netwerk/timedOut) en exponentiële backoff met Retry-After.
 */
export async function tedSearchPage(
  body: Record<string, unknown>,
  opts: TedClientOptions = {},
): Promise<TedSearchResponse> {
  const base = opts.baseUrl ?? process.env.TED_API_BASE ?? "https://api.ted.europa.eu";
  const doFetch = opts.fetchImpl ?? ((u, i) => fetch(u, i));
  const sleep = opts.sleep ?? defaultSleep;
  const maxRetries = opts.maxRetries ?? 4;
  let attempt = 0;
  for (;;) {
    attempt++;
    try {
      const res = await doFetch(`${base}/v3/notices/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      });
      if (res.status === 429 || res.status >= 500) {
        const ra = Number(res.headers.get("retry-after"));
        throw new TedApiError(`TED antwoordde ${res.status}`, res.status, true, undefined, Number.isFinite(ra) && ra > 0 ? ra : null);
      }
      if (!res.ok) {
        const text = (await res.text()).slice(0, 2000);
        throw new TedApiError(`TED weigerde de zoekopdracht (${res.status}): ${text}`, res.status, false, text);
      }
      const json = tedSearchResponseSchema.parse(await res.json());
      if (json.timedOut) throw new TedApiError("TED meldt timedOut=true; pagina onvolledig", 200, true);
      return json;
    } catch (e) {
      const err =
        e instanceof TedApiError
          ? e
          : e instanceof z.ZodError
            ? new TedApiError(`Onverwacht antwoordformaat van TED: ${e.message.slice(0, 300)}`, null, false)
            : new TedApiError(`Netwerkfout naar TED: ${e instanceof Error ? e.message : String(e)}`, null, true);
      if (!err.retryable || attempt > maxRetries) throw err;
      const retryAfter = err.retryAfterSeconds;
      const backoff = retryAfter ? Math.min(retryAfter, 120) * 1000 : Math.min(30_000, 1000 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 250);
      await sleep(backoff);
    }
  }
}

/**
 * Iteratiemodus: haalt alle pagina's op via iterationNextToken. Stopt bij een lege pagina.
 * Geeft per pagina de notices door aan onPage (zodat verwerking incrementeel en herstartbaar is).
 */
export async function tedSearchAll(
  input: { query: string; fields: string[]; limit: number; maxPages?: number },
  onPage: (notices: Record<string, unknown>[], meta: { page: number; totalNoticeCount: number | null }) => Promise<void>,
  opts: TedClientOptions = {},
) {
  let token: string | null | undefined = undefined;
  let page = 0;
  let total: number | null = null;
  const sleep = opts.sleep ?? defaultSleep;
  const delay = opts.delayMs ?? Number(process.env.TED_REQUEST_DELAY_MS ?? 500);
  for (;;) {
    page++;
    if (input.maxPages && page > input.maxPages) throw new TedApiError(`Maximum aantal pagina's (${input.maxPages}) bereikt; resultaat onvolledig`, null, false);
    const body: Record<string, unknown> = {
      query: input.query,
      fields: input.fields,
      limit: input.limit,
      scope: "ALL",
      checkQuerySyntax: false,
      paginationMode: "ITERATION",
      onlyLatestVersions: false,
    };
    if (token) body.iterationNextToken = token;
    const res = await tedSearchPage(body, opts);
    if (page === 1) total = res.totalNoticeCount ?? null;
    if (!res.notices.length) break;
    await onPage(res.notices, { page, totalNoticeCount: total });
    if (!res.iterationNextToken) {
      // Niet-lege pagina zonder token: einde volgens API óf onvolledig. Vergelijk met totaal.
      break;
    }
    token = res.iterationNextToken;
    await sleep(delay);
  }
  return { pages: page, totalNoticeCount: total };
}
