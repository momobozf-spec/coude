/**
 * End-to-end rooktest over echte HTTP tegen een draaiende Orbit-server.
 *
 * Loopt de belangrijkste flow door: registreren, quick capture, weergaven,
 * afvinken van een herhalende taak, conversie, en de beveiligingsgrenzen.
 * Alles via de publieke API, dus inclusief cookies, validatie en foutvorm.
 *
 * Gebruik:
 *   node apps/web/scripts/serve-local.mjs 3100    (in een andere terminal)
 *   node apps/web/scripts/smoke.mjs http://localhost:3100
 */

const BASE = process.argv[2] ?? process.env.SMOKE_BASE ?? 'http://localhost:3100';

let passed = 0;
let failed = 0;

function check(label, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ok    ${label}`);
  } else {
    failed++;
    console.log(`  FOUT  ${label}${detail ? ` -> ${detail}` : ''}`);
  }
}

/** Bewaart cookies tussen verzoeken, zoals een browser dat doet. */
const jar = new Map();

function cookieHeader() {
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
}

function storeCookies(response) {
  for (const cookie of response.headers.getSetCookie?.() ?? []) {
    const pair = cookie.split(';')[0] ?? '';
    const index = pair.indexOf('=');
    if (index > 0) jar.set(pair.slice(0, index), pair.slice(index + 1));
  }
}

async function call(method, path, body, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(jar.size && !options.anonymous ? { cookie: cookieHeader() } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!options.anonymous) storeCookies(response);

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text.slice(0, 200) };
  }
  return { status: response.status, body: payload };
}

async function main() {
  const health = await fetch(`${BASE}/login`).catch(() => null);
  if (!health?.ok) {
    console.error(`Geen server op ${BASE}. Start eerst serve-local.mjs.`);
    process.exitCode = 1;
    return;
  }

  const email = `smoke-${Date.now()}@orbit.test`;

  console.log('\nRegistreren en sessie');
  const registered = await call('POST', '/api/auth/register', {
    email,
    password: 'een-lang-rooktestwachtwoord',
    name: 'Rook Tester',
    timeZone: 'Europe/Brussels',
    platform: 'WEB',
  });
  check('registratie geeft 200', registered.status === 200, JSON.stringify(registered.body).slice(0, 160));
  check('sessiecookie is gezet', jar.has('orbit_at'));
  check('workspace is meteen aangemaakt', Boolean(registered.body?.workspace?.id));

  console.log('\nValidatie');
  const weak = await call('POST', '/api/auth/register', {
    email: `weak-${Date.now()}@orbit.test`,
    password: 'kort',
    name: 'Test',
    platform: 'WEB',
  });
  check('te kort wachtwoord geeft 422', weak.status === 422, String(weak.status));
  check('foutcode is VALIDATION_FAILED', weak.body?.error?.code === 'VALIDATION_FAILED');

  const duplicate = await call('POST', '/api/auth/register', {
    email,
    password: 'een-lang-rooktestwachtwoord',
    name: 'Dubbel',
    platform: 'WEB',
  });
  check('dubbel e-mailadres geeft 409', duplicate.status === 409, String(duplicate.status));

  console.log('\nQuick capture');
  const captured = await call('POST', '/api/items/quick-capture', {
    text: 'Bel morgen om 14:00 met de boekhouder @finance',
  });
  check('quick capture geeft 200', captured.status === 200, String(captured.status));
  check(
    'titel is opgeschoond',
    captured.body?.item?.title === 'Bel met de boekhouder',
    captured.body?.item?.title,
  );
  check('tag is aangemaakt', (captured.body?.createdTagIds ?? []).length === 1);

  const capturedDetail = await call('GET', `/api/items/${captured.body?.item?.id}`);
  check('datum is opgeslagen', Boolean(capturedDetail.body?.item?.task?.dueDate));
  check('tijd is opgeslagen', capturedDetail.body?.item?.task?.dueTime === '14:00');

  console.log('\nHerhalende taak');
  const recurring = await call('POST', '/api/items/quick-capture', {
    text: 'Elke maandag weekplanning maken',
  });
  const recurringId = recurring.body?.item?.id;
  const before = await call('GET', `/api/items/${recurringId}`);
  const firstDue = before.body?.item?.task?.dueDate;
  check('herhaling is herkend', Boolean(before.body?.item?.task?.recurrence));

  const completed = await call('POST', `/api/items/${recurringId}/complete`, {
    completed: true,
    completedAt: new Date().toISOString(),
  });
  check('afvinken geeft 200', completed.status === 200, String(completed.status));
  check('taak schuift door in plaats van te sluiten', completed.body?.rescheduled === true);
  check(
    'nieuwe deadline ligt later',
    Boolean(completed.body?.nextDueDate) && completed.body.nextDueDate > firstDue,
    `${firstDue} -> ${completed.body?.nextDueDate}`,
  );

  console.log('\nWeergaven en dashboard');
  const today = await call('GET', '/api/views/TODAY');
  check('vandaag geeft 200', today.status === 200, String(today.status));
  check('vandaag bevat alleen taken', (today.body?.items ?? []).every((entry) => entry.item.type === 'TASK'));

  const dashboard = await call('GET', '/api/dashboard');
  check('dashboard geeft 200', dashboard.status === 200, String(dashboard.status));
  check('dashboard telt de inbox', typeof dashboard.body?.summary?.inboxCount === 'number');

  const badView = await call('GET', '/api/views/BESTAATNIET');
  check('onbekende weergave geeft 422', badView.status === 422, String(badView.status));

  console.log('\nConversie');
  const idea = await call('POST', '/api/items/quick-capture', {
    text: 'Idee: abonnementsmodel voor de webshop',
  });
  const ideaId = idea.body?.item?.id;
  check('idee is als idee aangemaakt', idea.body?.item?.type === 'IDEA');

  const converted = await call('POST', `/api/items/${ideaId}/convert`, {
    targetType: 'TASK',
    keepBacklink: true,
  });
  check('conversie geeft 200', converted.status === 200, String(converted.status));
  check('het id blijft gelijk', converted.body?.item?.id === ideaId);
  check('het type is nu taak', converted.body?.item?.type === 'TASK');

  console.log('\nBeveiliging');
  const anonymous = await call('GET', '/api/items', undefined, { anonymous: true });
  check('zonder sessie geen toegang', anonymous.status === 401, String(anonymous.status));

  const unknown = await call('GET', '/api/items/01JAAAAAAAAAAAAAAAAAAAAAAA');
  check('onbekend item geeft 404', unknown.status === 404, String(unknown.status));

  const malformed = await call('PATCH', `/api/items/${ideaId}`, { title: '' });
  check('lege titel wordt geweigerd', malformed.status === 422, String(malformed.status));

  console.log('\nUitloggen');
  const loggedOut = await call('POST', '/api/auth/logout');
  check('uitloggen geeft 200', loggedOut.status === 200, String(loggedOut.status));
  const afterLogout = await call('GET', '/api/items');
  check('de sessie is echt weg', afterLogout.status === 401, String(afterLogout.status));

  console.log(`\n${passed} geslaagd, ${failed} mislukt`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
