import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './drizzle',
  schemaFilter: ['catalog', 'ingest', 'app'],
  dbCredentials: { url: process.env.DATABASE_URL ?? 'postgres://superrette:superrette@localhost:5432/superrette_dev' },
  strict: true,
});
