import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDatabase } from './client.js';

export const MIGRATIONS_FOLDER = fileURLToPath(new URL('../drizzle', import.meta.url));

export async function runMigrations(url: string): Promise<void> {
  const handle = createDatabase(url, { max: 1, applicationName: 'superrette-migrate' });
  try {
    await migrate(handle.db, { migrationsFolder: MIGRATIONS_FOLDER, migrationsSchema: 'drizzle' });
  } finally {
    await handle.close();
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
  runMigrations(url)
    .then(() => console.info('Migrations applied'))
    .catch((error: unknown) => {
      console.error(error);
      process.exit(1);
    });
}
