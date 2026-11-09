import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

/**
 * Integratietests: tegen een échte PostgreSQL.
 *
 * Apart van `vitest.config.ts` omdat deze tests fundamenteel anders zijn: ze
 * zijn traag, ze hebben een database nodig, en ze mogen niet in de gewone
 * `npm test` zitten — anders faalt de suite op elke machine zonder Postgres.
 *
 * Draaien:
 *   TEST_DATABASE_URL=postgresql://… npm run test:integration
 *
 * Zonder `TEST_DATABASE_URL` slaan alle bestanden zichzelf over (zie
 * tests/integration/setup.ts). Dat is bewust géén stilzwijgende pass: de runner
 * meldt de tests als "skipped", zodat zichtbaar blijft dat ze niet gedraaid
 * hebben.
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      'server-only': new URL('./tests/stubs/server-only.ts', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    // Start één echte PostgreSQL en past de migraties toe, vóór alle bestanden.
    globalSetup: ['tests/integration/globalSetup.ts'],
    setupFiles: ['tests/integration/setup.ts'],
    globals: false,
    // Eén bestand tegelijk: de tests delen één database en zouden elkaars
    // rijen zien wanneer ze parallel draaien.
    fileParallelism: false,
    testTimeout: 30_000,
    // Ruim: de eerste run start een database en draait alle migraties.
    hookTimeout: 180_000,
  },
})
