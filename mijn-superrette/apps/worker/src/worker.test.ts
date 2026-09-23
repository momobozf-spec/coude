import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createDatabase } from '@superrette/database';
import { parseSchedules, loadWorkerConfig } from './config.js';
import { startWorker } from './worker.js';

describe('worker configuration', () => {
  it('parses sync schedules', () => {
    expect(parseSchedules('open-prices:PRICES:0 5 * * *;partner-ah:PROMOTIONS:0 6 * * 1')).toEqual([
      { providerKey: 'open-prices', kind: 'PRICES', pattern: '0 5 * * *' },
      { providerKey: 'partner-ah', kind: 'PROMOTIONS', pattern: '0 6 * * 1' },
    ]);
    expect(parseSchedules(undefined)).toEqual([]);
    expect(() => parseSchedules('x:NOPE:* * * * *')).toThrow();
  });

  it('never exposes development data in production', () => {
    const config = loadWorkerConfig({ APP_ENV: 'production', DATABASE_URL: 'postgres://x', REDIS_URL: 'redis://x', ALLOW_DEVELOPMENT_DATA: 'true' });
    expect(config.allowDevelopmentData).toBe(false);
    expect(config.dataOrigins).not.toContain('DEVELOPMENT_SEED');
  });
});

// Runs against real Redis + PostgreSQL when INTEGRATION=1 (CI and local dev).
describe.skipIf(!process.env.INTEGRATION)('worker with BullMQ', () => {
  it('processes a queued provider sync', async () => {
    const databaseUrl = process.env.TEST_DATABASE_URL ?? 'postgres://superrette:superrette@localhost:5432/superrette_test';
    const config = loadWorkerConfig({ APP_ENV: 'test', DATABASE_URL: databaseUrl, REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379', PUSH_MODE: 'log' });
    const worker = await startWorker(config, { info: () => {}, error: () => {} });
    const db = createDatabase(databaseUrl, { max: 1 });
    try {
      const job = await worker.queues.sync.add('test', { syncId: '', providerKey: 'development-seed', kind: 'PROMOTIONS', triggeredBy: 'test' });
      let status: string | undefined;
      for (let i = 0; i < 60 && status !== 'SUCCESS' && status !== 'FAILED'; i++) {
        await new Promise((r) => setTimeout(r, 250));
        const rows = await db.db.execute<{ status: string }>(sql`SELECT s.status FROM ingest.provider_syncs s JOIN ingest.import_jobs j ON j.sync_id = s.id WHERE j.external_job_id = ${job.id}`);
        status = rows.rows[0]?.status;
      }
      expect(status).toBe('SUCCESS');
    } finally {
      await db.close();
      await worker.close();
    }
  }, 30_000);
});
