import { sql } from 'drizzle-orm';
import { createDatabase, runMigrations } from '@superrette/database';
import { seedDevelopmentData } from '@superrette/ingestion';
import { applyTestEnv, TEST_DATABASE_URL } from './env.js';

/** Fresh schema + development seed once per test run. */
export default async function setup(): Promise<void> {
  applyTestEnv();
  const handle = createDatabase(TEST_DATABASE_URL, { max: 2 });
  try {
    await handle.db.execute(sql`DROP SCHEMA IF EXISTS app, catalog, ingest, drizzle CASCADE`);
  } finally {
    await handle.close();
  }
  await runMigrations(TEST_DATABASE_URL);
  const seeded = createDatabase(TEST_DATABASE_URL, { max: 4 });
  try {
    await seedDevelopmentData(seeded.db, { environment: 'test', demoPassword: 'superrette-dev' });
  } finally {
    await seeded.close();
  }
}
