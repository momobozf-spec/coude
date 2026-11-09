/**
 * Rooktest voor de productiehardening: cookie-sessies, CSRF, CORS, foutvorm,
 * beveiligingsheaders, rate limiting, gegevensexport, accountverwijdering,
 * health-endpoints en het interne sync-endpoint (sleutel, rotatie, lease).
 *
 *   # API gestart met (minstens) deze variabelen:
 *   #   COMPARE_JOB_KEY=<huidige>  COMPARE_JOB_KEY_PREVIOUS=<vorige>
 *   #   EMAIL_PROVIDER=file EMAIL_FROM="…" NOTIFY_EMAIL_ENABLED=true EMAIL_OUTBOX_DIR=<map>
 *   COMPARE_JOB_KEY=<huidige> COMPARE_JOB_KEY_PREVIOUS=<vorige> EMAIL_OUTBOX_DIR=<map> \
 *     npx tsx scripts/smoke-auth.ts
 *
 * Zonder COMPARE_JOB_KEY worden de interne endpoints als "niet geconfigureerd"
 * getest (404). Zonder EMAIL_OUTBOX_DIR wordt de e-mailcontrole overgeslagen.
 *
 * Let op de limieten per IP per minuut: registratie 5, login 5, sync 5. De
 * test gebruikt ze bijna volledig; draai hem niet twee keer binnen een minuut.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const API = process.env['API_URL'] ?? 'http://localhost:4000/api/v1';
const WEB_ORIGIN = process.env['WEB_ORIGIN'] ?? 'http://localhost:3001';
const JOB_KEY = process.env['COMPARE_JOB_KEY'] ?? '';
const JOB_KEY_PREVIOUS = process.env['COMPARE_JOB_KEY_PREVIOUS'] ?? '';
const OUTBOX = process.env['EMAIL_OUTBOX_DIR'] ?? '';
const CLIENT_HEADER = 'x-superette-client';
const PASSWORD = 'een-lang-genoeg-wachtwoord';

let passed = 0;
let failed = 0;
const skipped: string[] = [];

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  } else {
    failed++;
    console.log(`  \x1b[31m✗\x1b[0m ${label}\n      verwacht: ${JSON.stringify(expected)}\n      kreeg:    ${JSON.stringify(actual)}`);
  }
}

function truthy(label: string, value: unknown, detail = ''): void {
  if (value) {
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  } else {
    failed++;
    console.log(`  \x1b[31m✗\x1b[0m ${label}${detail ? `\n      ${detail}` : ''}`);
  }
}

interface Reply {
  status: number;
  body: any;
  headers: Headers;
  cookies: Record<string, string>;
  rawCookies: string[];
}

/** Een minimale cookie-jar: één per "browser". */
class Jar {
  readonly cookies = new Map<string, string>();

  absorb(reply: Reply): void {
    for (const raw of reply.rawCookies) {
      const [pair, ...attrs] = raw.split(';');
      const [name, ...rest] = (pair ?? '').split('=');
      const value = rest.join('=').trim();
      const maxAge = attrs.map((a) => a.trim().toLowerCase()).find((a) => a.startsWith('max-age='));
      if (!name) continue;
      if (maxAge === 'max-age=0' || value === '') this.cookies.delete(name.trim());
      else this.cookies.set(name.trim(), value);
    }
  }

  header(): string {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }
}

interface CallOptions {
  body?: unknown;
  rawBody?: string;
  headers?: Record<string, string>;
  jar?: Jar;
  web?: boolean;
  origin?: string | null;
  token?: string;
}

async function call(method: string, path: string, options: CallOptions = {}): Promise<Reply> {
  const headers: Record<string, string> = { ...(options.headers ?? {}) };
  if (options.body !== undefined || options.rawBody !== undefined) headers['content-type'] = 'application/json';
  if (options.web) headers[CLIENT_HEADER] = 'web';
  if (options.origin !== null && (options.web || options.origin)) headers['origin'] = options.origin ?? WEB_ORIGIN;
  if (options.jar && options.jar.cookies.size > 0) headers['cookie'] = options.jar.header();
  if (options.token) headers['authorization'] = `Bearer ${options.token}`;

  const response = await fetch(`${API}${path}`, {
    method,
    headers,
    body: options.rawBody ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
    redirect: 'manual',
  });
  const text = await response.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  const rawCookies = response.headers.getSetCookie();
  const cookies: Record<string, string> = {};
  for (const raw of rawCookies) {
    const [pair] = raw.split(';');
    const [name, ...rest] = (pair ?? '').split('=');
    if (name) cookies[name.trim()] = rest.join('=').trim();
  }
  const reply: Reply = { status: response.status, body, headers: response.headers, cookies, rawCookies };
  options.jar?.absorb(reply);
  return reply;
}

function cookieAttrs(reply: Reply, name: string): string {
  return reply.rawCookies.find((c) => c.startsWith(`${name}=`)) ?? '';
}

function uniqueEmail(suffix: string): string {
  return `smoke-auth-${Date.now()}-${suffix}@example.com`;
}

async function registerWeb(jar: Jar, suffix: string): Promise<{ email: string; reply: Reply }> {
  const email = uniqueEmail(suffix);
  const reply = await call('POST', '/auth/register-superette', {
    body: { email, password: PASSWORD, fullName: `Smoke ${suffix}`, acceptsTerms: true },
    web: true,
    jar,
  });
  if (reply.status !== 201) throw new Error(`Registratie mislukt (${reply.status}): ${JSON.stringify(reply.body)}`);
  return { email, reply };
}

async function main(): Promise<void> {
  console.log('\nHealth en beveiligingsheaders');
  const live = await call('GET', '/health/live');
  check('GET /health/live → 200', live.status, 200);
  check('live meldt status ok', live.body?.status, 'ok');
  const ready = await call('GET', '/health/ready');
  check('GET /health/ready → 200 (database bereikbaar)', ready.status, 200);
  check('ready meldt database ok', ready.body?.checks?.database, 'ok');

  const pub = await call('GET', '/compare/chains', { headers: { 'x-request-id': 'smoke-auth-request-0001' } });
  check('x-content-type-options: nosniff', pub.headers.get('x-content-type-options'), 'nosniff');
  check('x-frame-options: DENY', pub.headers.get('x-frame-options'), 'DENY');
  check('referrer-policy: no-referrer', pub.headers.get('referrer-policy'), 'no-referrer');
  truthy('CSP sluit alles uit (default-src none)', /default-src 'none'/.test(pub.headers.get('content-security-policy') ?? ''));
  truthy('cross-origin-resource-policy gezet', !!pub.headers.get('cross-origin-resource-policy'));
  check('x-powered-by afwezig', pub.headers.get('x-powered-by'), null);
  check('veilig aangeleverde x-request-id wordt overgenomen', pub.headers.get('x-request-id'), 'smoke-auth-request-0001');
  const unsafeId = await call('GET', '/compare/chains', { headers: { 'x-request-id': '<script>alert(1)</script>' } });
  truthy('onveilige x-request-id wordt vervangen', /^[A-Za-z0-9-]{8,}$/.test(unsafeId.headers.get('x-request-id') ?? '') && !unsafeId.headers.get('x-request-id')?.includes('<'));

  console.log('\nFoutvorm en payloadlimieten');
  const noAuth = await call('GET', '/compare/alerts');
  check('zonder sessie → 401', noAuth.status, 401);
  truthy('fout heeft statusCode, code, message, requestId', noAuth.body?.statusCode === 401 && typeof noAuth.body?.code === 'string' && typeof noAuth.body?.message === 'string' && typeof noAuth.body?.requestId === 'string', JSON.stringify(noAuth.body));
  const badBody = await call('POST', '/auth/login', { body: { email: 'geen-adres', password: '' } });
  check('ongeldige invoer → 400', badBody.status, 400);
  truthy('validatiefout draagt issues', Array.isArray(badBody.body?.issues) && badBody.body.issues.length > 0, JSON.stringify(badBody.body));
  const unknown = await call('GET', '/bestaat-niet');
  check('onbekende route → 404 in dezelfde vorm', unknown.status === 404 && typeof unknown.body?.requestId === 'string', true);
  const big = await call('POST', '/auth/login', { rawBody: JSON.stringify({ email: 'a@b.be', password: 'x'.repeat(100_000) }) });
  check('body van 100 kB → 413', big.status, 413);
  check('413 in dezelfde foutvorm', typeof big.body?.code === 'string' && typeof big.body?.requestId === 'string', true);

  console.log('\nCookie-sessie (Superette-app)');
  const alice = new Jar();
  const { email: aliceEmail, reply: registered } = await registerWeb(alice, 'alice');
  check('POST /auth/register-superette (web) → 201', registered.status, 201);
  check('geen accessToken in de JSON', 'accessToken' in (registered.body ?? {}), false);
  truthy('antwoord draagt user, expiresAt en sessionExpiresAt', registered.body?.user?.email === aliceEmail && typeof registered.body?.expiresAt === 'string' && typeof registered.body?.sessionExpiresAt === 'string');
  const access = cookieAttrs(registered, 'sup_access');
  const refresh = cookieAttrs(registered, 'sup_refresh');
  truthy('sup_access: HttpOnly, Path=/api/v1, SameSite=Lax', /HttpOnly/i.test(access) && /Path=\/api\/v1(;|$)/i.test(access) && /SameSite=Lax/i.test(access), access);
  truthy('sup_refresh: HttpOnly, Path=/api/v1/auth, SameSite=Strict', /HttpOnly/i.test(refresh) && /Path=\/api\/v1\/auth/i.test(refresh) && /SameSite=Strict/i.test(refresh), refresh);
  truthy('access-cookie verloopt binnen een uur', (() => { const m = /Max-Age=(\d+)/i.exec(access); return !!m && Number(m[1]) <= 3600; })(), access);
  if (process.env['EXPECT_SECURE_COOKIES'] === 'true') {
    truthy('cookies dragen Secure', /Secure/i.test(access) && /Secure/i.test(refresh));
  } else {
    skipped.push('Secure-vlag (alleen in productie; zet EXPECT_SECURE_COOKIES=true tegen een https-omgeving)');
  }
  const accessValue = registered.cookies['sup_access'] ?? '';
  truthy('access-cookie is een JWT met sessie-id', accessValue.split('.').length === 3 && JSON.parse(Buffer.from(accessValue.split('.')[1] ?? '', 'base64url').toString()).sid?.length > 0);

  const me = await call('GET', '/auth/me', { jar: alice, web: true });
  check('GET /auth/me met cookie → 200', me.status, 200);
  check('me zonder sessionId in het antwoord', 'sessionId' in (me.body ?? {}), false);
  const meNoClient = await call('GET', '/auth/me', { jar: alice });
  check('cookie zonder clientheader wordt genegeerd → 401', meNoClient.status, 401);

  console.log('\nCSRF');
  const csrfNoHeader = await call('POST', '/compare/lists', { body: { name: 'CSRF-test' }, jar: alice, origin: null });
  check('wijziging met cookie zonder clientheader → 403', csrfNoHeader.status, 403);
  check('…met code CSRF_REJECTED', csrfNoHeader.body?.code, 'CSRF_REJECTED');
  const csrfBadOrigin = await call('POST', '/compare/lists', { body: { name: 'CSRF-test' }, jar: alice, web: true, origin: 'https://kwaadaardig.example' });
  check('wijziging vanaf vreemde Origin → 403', csrfBadOrigin.status, 403);
  const csrfOk = await call('POST', '/compare/lists', { body: { name: 'CSRF-test' }, jar: alice, web: true });
  check('wijziging met clientheader en eigen Origin → 201', csrfOk.status, 201);
  const listId = csrfOk.body?.id as string;

  console.log('\nCORS');
  const preflightBad = await fetch(`${API}/compare/lists`, {
    method: 'OPTIONS',
    headers: { origin: 'https://kwaadaardig.example', 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type,x-superette-client' },
  });
  check('preflight vanaf vreemde origin: geen allow-origin', preflightBad.headers.get('access-control-allow-origin'), null);
  const preflightOk = await fetch(`${API}/compare/lists`, {
    method: 'OPTIONS',
    headers: { origin: WEB_ORIGIN, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type,x-superette-client' },
  });
  check('preflight vanaf eigen origin: allow-origin = origin', preflightOk.headers.get('access-control-allow-origin'), WEB_ORIGIN);
  check('…met credentials', preflightOk.headers.get('access-control-allow-credentials'), 'true');
  const allowHeaders = (preflightOk.headers.get('access-control-allow-headers') ?? '').toLowerCase();
  truthy('…clientheader toegestaan, jobsleutel niet', allowHeaders.includes('x-superette-client') && !allowHeaders.includes('x-job-key'), allowHeaders);
  const corsSimple = await call('GET', '/compare/chains', { origin: 'https://kwaadaardig.example' });
  check('gewone GET vanaf vreemde origin: geen allow-origin', corsSimple.headers.get('access-control-allow-origin'), null);

  console.log('\nRefresh-rotatie en hergebruik');
  const oldRefresh = alice.cookies.get('sup_refresh') ?? '';
  const oldAccess = alice.cookies.get('sup_access') ?? '';
  const refreshNoClient = await call('POST', '/auth/refresh', { jar: new Jar(), headers: { cookie: `sup_refresh=${oldRefresh}` }, origin: null });
  check('refresh zonder clientheader → 403 (CSRF) of 401', [401, 403].includes(refreshNoClient.status), true);
  const rotated = await call('POST', '/auth/refresh', { jar: alice, web: true });
  check('POST /auth/refresh → 200', rotated.status, 200);
  truthy('nieuw refresh-token verschilt', (alice.cookies.get('sup_refresh') ?? '') !== oldRefresh && (alice.cookies.get('sup_refresh') ?? '').length > 20);
  truthy('nieuw access-token verschilt', (alice.cookies.get('sup_access') ?? '') !== oldAccess);
  const meAfterRotate = await call('GET', '/auth/me', { jar: alice, web: true });
  check('nieuwe cookies werken', meAfterRotate.status, 200);

  const stolen = new Jar();
  stolen.cookies.set('sup_refresh', oldRefresh);
  const reuse = await call('POST', '/auth/refresh', { jar: stolen, web: true });
  check('hergebruik van het oude refresh-token → 401', reuse.status, 401);
  check('…met code SESSION_REUSE', reuse.body?.code, 'SESSION_REUSE');
  truthy('…en de cookies worden gewist', reuse.rawCookies.some((c) => c.startsWith('sup_refresh=') && /Max-Age=0/i.test(c)));
  const meAfterReuse = await call('GET', '/auth/me', { jar: alice, web: true });
  check('hele sessie ingetrokken na hergebruik: /auth/me → 401', meAfterReuse.status, 401);
  const refreshAfterReuse = await call('POST', '/auth/refresh', { jar: alice, web: true });
  check('…en vernieuwen lukt ook niet meer', refreshAfterReuse.status, 401);

  console.log('\nLogin, logout en intrekking');
  alice.cookies.clear();
  const login = await call('POST', '/auth/login', { body: { email: aliceEmail, password: PASSWORD }, web: true, jar: alice });
  check('POST /auth/login (web) → 200 met cookies', login.status === 200 && !!login.cookies['sup_access'] && !!login.cookies['sup_refresh'], true);
  check('login (web) zonder accessToken in JSON', 'accessToken' in (login.body ?? {}), false);
  const accessBeforeLogout = alice.cookies.get('sup_access') ?? '';
  const logout = await call('POST', '/auth/logout', { jar: alice, web: true });
  check('POST /auth/logout → 204', logout.status, 204);
  truthy('logout wist beide cookies', logout.rawCookies.filter((c) => /Max-Age=0/i.test(c)).length === 2, logout.rawCookies.join(' | '));
  const ghost = new Jar();
  ghost.cookies.set('sup_access', accessBeforeLogout);
  const meAfterLogout = await call('GET', '/auth/me', { jar: ghost, web: true });
  check('access-token na logout geweigerd (sessie ingetrokken, JWT nog geldig)', meAfterLogout.status, 401);

  console.log('\nBearer-pad (boetiek-app) ongewijzigd');
  const bearerLogin = await call('POST', '/auth/login', { body: { email: aliceEmail, password: PASSWORD } });
  check('login zonder clientheader → Bearer-token in JSON', bearerLogin.status === 200 && typeof bearerLogin.body?.accessToken === 'string', true);
  check('…zonder cookies', bearerLogin.rawCookies.length, 0);
  const meBearer = await call('GET', '/auth/me', { token: bearerLogin.body?.accessToken });
  check('GET /auth/me met Bearer → 200', meBearer.status, 200);

  console.log('\nGegevensexport en accountverwijdering');
  alice.cookies.clear();
  await call('POST', '/auth/login', { body: { email: aliceEmail, password: PASSWORD }, web: true, jar: alice });
  const prefs = await call('PATCH', '/compare/preferences', { body: { emailNotifications: true }, jar: alice, web: true });
  check('e-mailvoorkeur aanzetten (opt-in) → 200', prefs.status, 200);
  check('voorkeur bewaard', prefs.body?.emailNotifications, true);
  const exported = await call('GET', '/account/export', { jar: alice, web: true });
  check('GET /account/export → 200', exported.status, 200);
  truthy('export als download', /attachment/.test(exported.headers.get('content-disposition') ?? ''));
  truthy('export bevat profiel, lijsten en sessies', exported.body?.profile?.email === aliceEmail && Array.isArray(exported.body?.shoppingLists) && exported.body.shoppingLists.some((l: any) => l.name === 'CSRF-test') && Array.isArray(exported.body?.sessions), JSON.stringify(exported.body).slice(0, 200));
  truthy('export bevat geen interne ids van lijsten', !JSON.stringify(exported.body.shoppingLists).includes(listId));
  truthy('export markeert de huidige sessie', exported.body?.sessions?.some((s: any) => s.current === true));
  truthy('export bevat geen wachtwoordhash of tokens', !JSON.stringify(exported.body).includes('$argon2') && !/refreshTokenHash/.test(JSON.stringify(exported.body)));

  const wrongPassword = await call('DELETE', '/account', { body: { password: 'verkeerd-wachtwoord', confirmation: 'VERWIJDER MIJN ACCOUNT' }, jar: alice, web: true });
  check('verwijderen met fout wachtwoord → 401', wrongPassword.status, 401);
  check('…met code REAUTH_FAILED', wrongPassword.body?.code, 'REAUTH_FAILED');
  const wrongPhrase = await call('DELETE', '/account', { body: { password: PASSWORD, confirmation: 'ja' }, jar: alice, web: true });
  check('verwijderen zonder juiste bevestigingszin → 400', wrongPhrase.status, 400);
  const stillThere = await call('GET', '/auth/me', { jar: alice, web: true });
  check('account bestaat nog na mislukte pogingen', stillThere.status, 200);
  const deleted = await call('DELETE', '/account', { body: { password: PASSWORD, confirmation: 'VERWIJDER MIJN ACCOUNT' }, jar: alice, web: true });
  check('DELETE /account → 204', deleted.status, 204);
  truthy('verwijdering wist de cookies', deleted.rawCookies.some((c) => /Max-Age=0/i.test(c)));
  const meDeleted = await call('GET', '/auth/me', { jar: ghost, web: true });
  check('oude sessies geweigerd', meDeleted.status, 401);
  const bearerDeleted = await call('GET', '/auth/me', { token: bearerLogin.body?.accessToken });
  check('ook de Bearer-sessie van de boetiek is weg', bearerDeleted.status, 401);
  const loginDeleted = await call('POST', '/auth/login', { body: { email: aliceEmail, password: PASSWORD }, web: true });
  check('inloggen met verwijderd account → 401', loginDeleted.status, 401);

  console.log('\nInterne jobs: sleutel, rotatie, browser-signaal, lease');
  if (!JOB_KEY) {
    const none = await call('POST', '/compare/internal/sync', { body: {} });
    check('zonder geconfigureerde sleutel bestaat het endpoint niet (404)', none.status, 404);
    skipped.push('sync met sleutel (COMPARE_JOB_KEY ontbreekt)');
  } else {
    const noKey = await call('POST', '/compare/internal/sync', { body: {} });
    check('sync zonder sleutel → 401', noKey.status, 401);
    check('…code JOB_KEY_INVALID', noKey.body?.code, 'JOB_KEY_INVALID');
    const wrongKey = await call('POST', '/compare/internal/sync', { body: {}, headers: { 'x-job-key': 'x'.repeat(JOB_KEY.length) } });
    check('sync met foute sleutel (zelfde lengte) → 401', wrongKey.status, 401);
    const fromBrowser = await call('POST', '/compare/internal/sync', { body: {}, headers: { 'x-job-key': JOB_KEY }, origin: WEB_ORIGIN });
    check('sync met sleutel maar Origin-header → 403 INTERNAL_ONLY', fromBrowser.status === 403 && fromBrowser.body?.code === 'INTERNAL_ONLY', true);
    const statusPrev = await call('GET', '/health/status', { headers: { 'x-job-key': JOB_KEY_PREVIOUS || JOB_KEY } });
    check(JOB_KEY_PREVIOUS ? 'vorige sleutel geldig tijdens rotatie (health/status → 200)' : 'health/status met sleutel → 200', statusPrev.status, 200);
    truthy('status meldt versie, demo-stand, imports en alerts', typeof statusPrev.body?.version === 'string' && typeof statusPrev.body?.demoAllowed === 'boolean' && Array.isArray(statusPrev.body?.imports) && 'alerts' in (statusPrev.body ?? {}), JSON.stringify(statusPrev.body).slice(0, 300));
    truthy('status toont termsReviewed per adapter', statusPrev.body?.imports?.every((i: any) => 'termsReviewed' in i));
    const statusNoKey = await call('GET', '/health/status');
    check('health/status zonder sleutel → 401', statusNoKey.status, 401);

    // Alice bestaat niet meer; een nieuwe gebruiker met e-mailvoorkeur en alert voor de e-mailtest.
    // In productie-modus triggeren alerts bewust nooit op DEMO-prijzen; tegen zo'n
    // omgeving (staging met demobestanden) zet je EXPECT_DEMO_ALERTS=false.
    const expectDemoAlerts = process.env['EXPECT_DEMO_ALERTS'] !== 'false';
    const bob = new Jar();
    const { email: bobEmail } = await registerWeb(bob, 'bob');
    await call('PATCH', '/compare/preferences', { body: { emailNotifications: true }, jar: bob, web: true });
    const search = await call('GET', '/compare/search?q=' + encodeURIComponent('Coca-Cola Zero 1,5 L'));
    const product = search.body?.items?.[0];
    const lowest = (product?.bestOffer?.priceCents as number | undefined) ?? 0;
    let alertId: string | null = null;
    if (!expectDemoAlerts) {
      skipped.push('alert/melding/e-mail op demogegevens (in productie-modus triggeren alerts niet op DEMO-prijzen; zie de staging-controle met een niet-geverifieerde bron)');
    } else if (product && lowest > 0) {
      const alert = await call('POST', '/compare/alerts', { body: { catalogProductId: product.product.id, comparisonType: 'PACKAGE_PRICE', targetPriceCents: lowest + 50, notificationChannel: 'EMAIL' }, jar: bob, web: true });
      check('alert boven de laagste prijs aangemaakt → 201', alert.status, 201);
      alertId = alert.body?.id ?? null;
    } else {
      skipped.push('alert voor e-mailtest (geen zoekresultaat met prijs)');
    }

    // Op een omgeving met werkers kan de lease net bezet zijn ([409, 409]); dan
    // nog eens proberen (hoogstens drie keer) — het patroon [201, 409] is het bewijs.
    let first = await call('POST', '/compare/internal/sync', { body: {}, headers: { 'x-job-key': JOB_KEY } });
    let second = first;
    for (let attempt = 1; attempt <= 3; attempt++) {
      [first, second] = await Promise.all([
        call('POST', '/compare/internal/sync', { body: {}, headers: { 'x-job-key': JOB_KEY } }),
        call('POST', '/compare/internal/sync', { body: {}, headers: { 'x-job-key': JOB_KEY } }),
      ]);
      if (first.status === 201 || second.status === 201) break;
      await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
    const statuses = [first.status, second.status].sort();
    check('twee gelijktijdige syncs: één draait, één → 409 SYNC_ALREADY_RUNNING', statuses, [201, 409]);
    const winner = first.status === 201 ? first : second;
    const loser = first.status === 409 ? first : second;
    check('…409 draagt de code', loser.body?.code, 'SYNC_ALREADY_RUNNING');
    truthy('sync-samenvatting met runId en stappen', typeof winner.body?.runId === 'string' && Array.isArray(winner.body?.imports ?? winner.body?.steps ?? []), JSON.stringify(winner.body).slice(0, 300));
    const statusAfter = await call('GET', '/compare/internal/status', { headers: { 'x-job-key': JOB_KEY } });
    check('internal/status → 200', statusAfter.status, 200);
    truthy('lease is vrijgegeven na de run', !statusAfter.body?.sync?.running && !statusAfter.body?.lease?.active, JSON.stringify(statusAfter.body?.sync ?? statusAfter.body?.lease ?? statusAfter.body).slice(0, 200));

    if (alertId) {
      const notes = await call('GET', '/compare/notifications', { jar: bob, web: true });
      truthy('in-app melding voor de alert', notes.status === 200 && (notes.body?.items ?? notes.body ?? []).length >= 1, JSON.stringify(notes.body).slice(0, 200));
      if (OUTBOX) {
        const files = readdirSync(OUTBOX).filter((f) => f.endsWith('.json'));
        const mine = files.map((f) => JSON.parse(readFileSync(join(OUTBOX, f), 'utf8'))).filter((m: any) => m.to === bobEmail || m.to?.includes?.(bobEmail));
        truthy('e-mail in de outbox voor de opt-in gebruiker', mine.length >= 1, `bestanden: ${files.length}`);
        truthy('e-mail noemt demogegevens en afmeldlink', mine.length > 0 && /demo/i.test(JSON.stringify(mine[0])) && /voorkeuren/.test(JSON.stringify(mine[0])));
      } else {
        skipped.push('e-mail-outbox (EMAIL_OUTBOX_DIR ontbreekt)');
      }
    }
    // Opruimen: Bob verwijdert zichzelf.
    const bye = await call('DELETE', '/account', { body: { password: PASSWORD, confirmation: 'VERWIJDER MIJN ACCOUNT' }, jar: bob, web: true });
    check('tweede gebruiker opgeruimd', bye.status, 204);
  }

  console.log('\nRate limiting op login');
  let limited: Reply | null = null;
  for (let attempt = 1; attempt <= 8; attempt++) {
    const reply = await call('POST', '/auth/login', { body: { email: 'niemand@example.com', password: 'fout-wachtwoord' } });
    if (reply.status === 429) {
      limited = reply;
      break;
    }
  }
  truthy('na hoogstens zes pogingen → 429', limited !== null);
  check('429 met code RATE_LIMITED', limited?.body?.code, 'RATE_LIMITED');
  truthy('…en een Retry-After-header', Number(limited?.headers.get('retry-after') ?? 0) > 0);

  console.log(`\n${passed} geslaagd, ${failed} mislukt${skipped.length ? `\nOvergeslagen: ${skipped.join('; ')}` : ''}\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
