import { createDatabase, runMigrations } from '@superrette/database';
import { assertNotProduction, resetDevelopmentData, seedDevelopmentData } from '../seed-dev.js';

/**
 * pnpm db:seed:dev [--reset]
 * Loads FICTITIOUS DEVELOPMENT DATA. Refuses to run in production.
 */
async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  const environment = process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development';
  if (!url) throw new Error('DATABASE_URL is required');
  assertNotProduction(environment, url);
  const password = process.env.DEV_SEED_PASSWORD ?? 'superrette-dev';
  await runMigrations(url);
  const handle = createDatabase(url, { applicationName: 'superrette-seed' });
  try {
    if (process.argv.includes('--reset')) {
      await resetDevelopmentData(handle.db);
      console.info('Removed previous DEVELOPMENT_SEED catalogue data.');
    }
    console.info('⚠️  Loading DEVELOPMENT DATA — fictitious prices, never shown as live prices.');
    await seedDevelopmentData(handle.db, { environment, demoPassword: password, log: (m) => console.info(m) });
    console.info(`Done. Demo password: ${process.env.DEV_SEED_PASSWORD ? '(from DEV_SEED_PASSWORD)' : password}`);
  } finally {
    await handle.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
