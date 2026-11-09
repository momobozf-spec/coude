import { randomBytes } from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PostgresDriver, rewriteSql } from './db/PostgresDriver';
import { AdminParser } from '../src/core/butler/AdminParser';
import { UnavailablePdfRenderer, type ButlerAdapters } from '../src/core/butler/adapters';
import { createToolRegistry } from '../src/core/butler/tools';
import { ActionRouter } from '../src/core/commands/ActionRouter';
import { createFakeAdapters } from '../src/core/commands/testing/fakeAdapters';
import { openDatabase, type Database } from '../src/core/db/Database';
import { JobRepository } from '../src/core/db/repositories/ops/JobRepositories';
import { SequenceRepository } from '../src/core/db/repositories/ops/SystemRepositories';
import { LocalEmailAdapter, NullMailComposer } from '../src/core/email/EmailAdapter';
import { DEFAULT_ENGINE_CONFIG } from '../src/core/intent/config';
import { IntentEngine } from '../src/core/intent/IntentEngine';
import { createOpsServices, type OpsServices } from '../src/core/ops';
import { createCoreServices, type CoreServices } from '../src/core/services';
import { createFixedClock } from '../src/core/services/Clock';

/**
 * Phase 2: the same services and repositories on PostgreSQL, with real concurrency.
 * Runs only when ALFRED_TEST_DATABASE_URL points at a reachable server; each run uses a
 * throw-away schema. Locally: ALFRED_TEST_DATABASE_URL=postgres://user:pass@127.0.0.1:5432/postgres
 */
const URL = process.env.ALFRED_TEST_DATABASE_URL ?? '';
const TZ = 'Europe/Brussels';

describe('PostgresDriver.rewriteSql', () => {
  it('translates the SQLite idioms the schema uses', () => {
    expect(rewriteSql("SELECT * FROM t WHERE a = ? AND b LIKE '%?%' AND c = ?")).toBe("SELECT * FROM t WHERE a = $1 AND b LIKE '%?%' AND c = $2");
    expect(rewriteSql('INSERT OR IGNORE INTO item_tags (a, b) VALUES (?, ?)')).toBe('INSERT INTO item_tags (a, b) VALUES ($1, $2) ON CONFLICT DO NOTHING');
    expect(rewriteSql("SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now')")).toContain('to_char((now() at time zone');
    expect(rewriteSql("SELECT json_extract(triage_json, '$.classification') AS c FROM emails")).toBe("SELECT (triage_json::json->>'classification') AS c FROM emails");
    expect(rewriteSql('SELECT * FROM ticket_events ORDER BY created_at ASC, rowid ASC')).toBe('SELECT * FROM ticket_events ORDER BY created_at ASC, seq ASC');
    expect(rewriteSql('CREATE INDEX i ON companies(archived, name COLLATE NOCASE)')).toBe('CREATE INDEX i ON companies(archived, name)');
  });
});

describe.skipIf(!URL)('PostgreSQL persistence (Phase 2)', () => {
  const schema = `alfred_test_${randomBytes(4).toString('hex')}`;
  let driver: PostgresDriver;
  let second: PostgresDriver;
  let db: Database;
  let clock: ReturnType<typeof createFixedClock>;
  let services: CoreServices;
  let ops: OpsServices;

  beforeAll(async () => {
    driver = new PostgresDriver({ connectionString: URL, schema, max: 6 });
    await driver.prepare();
    db = await openDatabase(driver);
    second = new PostgresDriver({ connectionString: URL, schema, max: 4 });
  });

  afterAll(async () => {
    await second.close();
    await driver.run(`DROP SCHEMA "${schema}" CASCADE`);
    await driver.close();
  });

  beforeEach(async () => {
    clock = createFixedClock('2026-10-03T10:00:00', TZ);
    for (const table of ['jobs', 'job_attempts', 'tickets', 'ticket_events', 'approvals', 'agent_questions', 'outbox_events', 'audit_log', 'quotes', 'follow_ups', 'interactions', 'workflow_runs', 'sequence_counters', 'worker_heartbeats']) await driver.run(`DELETE FROM ${table}`);
    const adapters = createFakeAdapters();
    services = createCoreServices(db, clock, adapters.calendar, { language: () => 'nl', signature: () => 'Mohamed' });
    await services.settings.load();
    await services.settings.update({ ops: { autonomy: 'PROACTIVE' } });
    await services.companies.updateProfile({ companyName: 'Bouzouf Consulting', vatNumber: 'BE0123456749', iban: 'BE68 5390 0754 7034', address: { street: 'Kerkstraat 1', postalCode: '1000', city: 'Brussel', country: 'België' }, defaultTaxRate: 21, defaultDayRateCents: 75000, paymentTermsDays: 30 });
    const butlerAdapters: ButlerAdapters = { email: new LocalEmailAdapter(), mailComposer: new NullMailComposer(), pdf: new UnavailablePdfRenderer(), notifications: null };
    const tools = createToolRegistry();
    const router = new ActionRouter({ services, adapters, clock, language: () => 'nl', tools, butlerAdapters });
    const engine = new IntentEngine({ config: DEFAULT_ENGINE_CONFIG, adminParser: new AdminParser() });
    ops = createOpsServices({ db, clock, services, tools, butlerAdapters, engine, router, language: () => 'nl' });
    router.setOps(ops);
  });

  it('applies every migration and seeds the built-in schedules', async () => {
    expect(db.migration.currentVersion).toBe(5);
    const tables = await driver.all<{ table_name: string }>('SELECT table_name FROM information_schema.tables WHERE table_schema = ?', [schema]);
    const names = tables.map((t) => t.table_name);
    for (const expected of ['tickets', 'jobs', 'approvals', 'schedules', 'outbox_events', 'provider_credentials', 'workflow_runs', 'search_index_plain']) expect(names).toContain(expected);
    expect((await ops.schedules.list()).filter((s) => s.builtIn)).toHaveLength(9);
    const seq = await driver.all<{ column_name: string }>("SELECT column_name FROM information_schema.columns WHERE table_schema = ? AND table_name = 'ticket_events'", [schema]);
    expect(seq.map((c) => c.column_name)).toContain('seq');
  });

  it('lets concurrent workers on separate connections claim each job exactly once (SKIP LOCKED)', async () => {
    const jobs = new JobRepository(driver);
    const jobsB = new JobRepository(second);
    for (let i = 0; i < 6; i++) await ops.queue.enqueue({ type: 'maintenance.sweep', payload: { i } });
    const now = clock.nowISO();
    const until = clock.now().plus({ minutes: 5 }).toISO() ?? now;
    const claims = await Promise.all(Array.from({ length: 12 }, (_, i) => (i % 2 ? jobs : jobsB).claim({ workerId: `w${i}`, nowISO: now, lockedUntilISO: until })));
    const claimed = claims.filter((j): j is NonNullable<typeof j> => Boolean(j));
    expect(claimed).toHaveLength(6);
    expect(new Set(claimed.map((j) => j.id)).size).toBe(6);
    expect(claimed.every((j) => j.status === 'running' && j.attempts === 1)).toBe(true);
    expect(await jobs.claim({ workerId: 'late', nowISO: now, lockedUntilISO: until })).toBeNull();
  });

  it('reclaims an expired lease and refuses completion from the worker that lost it', async () => {
    const { job } = await ops.queue.enqueue({ type: 'maintenance.sweep' });
    const first = await ops.queue.claim({ workerId: 'a', leaseMs: 1000 });
    expect(first?.id).toBe(job.id);
    clock.set('2026-10-03T10:10:00');
    const reclaimed = await ops.queue.claim({ workerId: 'b' });
    expect(reclaimed?.id).toBe(job.id);
    expect(reclaimed?.attempts).toBe(2);
    await expect(ops.queue.complete(job.id, 'a')).rejects.toBeTruthy();
    expect((await ops.queue.complete(job.id, 'b', { ok: true })).status).toBe('succeeded');
  });

  it('keeps idempotent enqueues, sequence counters and scheduler advances exact under parallel calls', async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => ops.queue.enqueue({ type: 'email.poll', idempotencyKey: 'poll:same' })));
    expect(results.filter((r) => r.created)).toHaveLength(1);
    expect(new Set(results.map((r) => r.job.id)).size).toBe(1);

    const numbers = await Promise.all(Array.from({ length: 10 }, (_, i) => (i % 2 ? new SequenceRepository(driver) : new SequenceRepository(second)).next('quote:2026')));
    expect([...numbers].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    const schedule = await ops.schedules.create({ name: 'poll', spec: { kind: 'interval', everyMinutes: 15 }, jobType: 'email.poll' });
    clock.set('2026-10-03T10:16:00');
    const advances = await Promise.all([db.schedules.advance(schedule.id, schedule.nextRunAt, { nextRunAt: '2026-10-03T10:31:00+02:00', lastRunAt: clock.nowISO(), lastJobId: 'j1', nowISO: clock.nowISO() }), db.schedules.advance(schedule.id, schedule.nextRunAt, { nextRunAt: '2026-10-03T10:31:00+02:00', lastRunAt: clock.nowISO(), lastJobId: 'j2', nowISO: clock.nowISO() })]);
    expect(advances.filter(Boolean)).toHaveLength(1);
  });

  it('runs the ticket → approval → restart → resume flow end to end on Postgres', async () => {
    await ops.quotes.createDraft({ client: 'Acme', title: 'Dashboard', lines: [{ description: 'Consulting', quantity: 5, unit: 'day', unitPriceCents: 75000 }] });
    const { ticket } = await ops.tickets.createFromText('Verstuur de offerte voor Acme');
    const worker = ops.createWorker({ id: 'pg-w1', kind: 'all', mode: 'server', host: 'pg' });
    await worker.drain();
    expect((await ops.tickets.require(ticket.id)).status).toBe('WAITING_APPROVAL');
    const [approval] = await ops.approvals.list('PENDING');
    expect(approval?.tool).toBe('quote.send');

    // "Restart": a second ops layer over a second connection pool resumes from the database alone.
    const adapters = createFakeAdapters();
    const butlerAdapters: ButlerAdapters = { email: new LocalEmailAdapter(), mailComposer: new NullMailComposer(), pdf: new UnavailablePdfRenderer(), notifications: null };
    const tools = createToolRegistry();
    const db2 = await openDatabase(second);
    const services2 = createCoreServices(db2, clock, adapters.calendar, { language: () => 'nl', signature: () => 'Mohamed' });
    await services2.settings.load();
    const router2 = new ActionRouter({ services: services2, adapters, clock, language: () => 'nl', tools, butlerAdapters });
    const ops2 = createOpsServices({ db: db2, clock, services: services2, tools, butlerAdapters, engine: new IntentEngine({ config: DEFAULT_ENGINE_CONFIG, adminParser: new AdminParser() }), router: router2, language: () => 'nl' });
    router2.setOps(ops2);
    expect((await ops2.approvals.list('PENDING')).map((a) => a.id)).toEqual([approval!.id]);
    await ops2.approvals.approve(approval!.id);
    const w2 = ops2.createWorker({ id: 'pg-w2', kind: 'all', mode: 'server', host: 'pg2' });
    await w2.drain();
    expect((await ops2.tickets.require(ticket.id)).status).toBe('COMPLETED');
    const quote = (await ops2.quotes.list('all'))[0]!;
    expect(quote.status).toBe('sent');
    expect(quote.quoteNumber).toBe('Q-2026-001');
    expect((await services2.audit.listRecent()).some((a) => a.tool === 'quote.send' && a.confirmed)).toBe(true);
    expect((await ops2.tickets.history(ticket.id)).map((e) => e.type)).toContain('approval_resolved');
    const health = await ops2.health.check();
    expect(health.mode).toBe('server');
  });

  it('pauses and resumes workflow runs on Postgres', async () => {
    await services.workflows.create({ name: 'PG gate', trigger: { type: 'document.created' }, steps: [{ action: 'require_approval', message: 'Go?' }, { action: 'create_task', title: 'After approval' }] });
    const runs = await services.workflows.emit({ type: 'document.created', payload: { document: { id: 'd1' } }, summary: 'doc' });
    const run = runs.find((r) => r.workflowName === 'PG gate');
    expect(run?.status).toBe('waiting_approval');
    expect(run?.ticketId).toBeTruthy();
    const worker = ops.createWorker({ id: 'pg-w3', kind: 'all', mode: 'server', host: 'pg' });
    await worker.drain();
    const ticket = await ops.tickets.require(run!.ticketId!);
    const history = (await ops.tickets.history(ticket.id)).map((e) => `${e.type}:${e.message}`).join(' | ');
    expect(`${ticket.status} ${history}`).toContain('WAITING_APPROVAL');
    const [approval] = await ops.approvals.list('PENDING');
    await ops.approvals.approve(approval!.id);
    await worker.drain();
    expect((await services.workflows.getRun(run!.id))?.status).toBe('completed');
    expect((await services.tasks.list('all')).some((t) => t.title === 'After approval')).toBe(true);
  });
});
