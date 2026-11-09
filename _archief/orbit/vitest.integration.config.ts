import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const resolvePkg = (name: string) =>
  fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url));

/**
 * Integratietests draaien tegen een echte PostgreSQL en zijn daardoor trager
 * dan de unittests. Ze staan in een eigen configuratie zodat `npm test` snel
 * blijft en `npm run test:integration` het volledige plaatje geeft.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@orbit/types': resolvePkg('types'),
      '@orbit/validation': resolvePkg('validation'),
      '@orbit/utils': resolvePkg('utils'),
      '@orbit/core': resolvePkg('core'),
      '@orbit/ui': resolvePkg('ui'),
      '@orbit/db': resolvePkg('db'),
      '@orbit/auth': resolvePkg('auth'),
      '@orbit/api-core': resolvePkg('api-core'),
      '@orbit/api-client': resolvePkg('api-client'),
    },
  },
  test: {
    environment: 'node',
    include: ['packages/**/*.integration.test.ts'],
    globalSetup: ['./tests/setup/postgres.ts'],
    // Eén database, dus geen parallelle testbestanden die elkaars rijen zien.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
