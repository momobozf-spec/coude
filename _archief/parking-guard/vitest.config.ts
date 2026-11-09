import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

/**
 * Twee projecten, bewust gescheiden.
 *
 * `unit` raakt nooit een database of het netwerk. De env hieronder bestaat
 * alleen zodat de validatie in src/lib/env.ts slaagt; niets in die suite opent
 * een verbinding.
 *
 * `integration` draait wél tegen de ontwikkeldatabase en staat daarom niet in
 * `npm test`. Die suite deelt één database, dus `npm run test:integration` geeft
 * `--no-file-parallelism` mee: parallel draaien zou de tests op elkaars data
 * laten stuklopen. Dat staat in het script en niet hier, omdat Vitest 3 die
 * optie alleen op het hoogste niveau accepteert.
 */
const testEnv = {
  NODE_ENV: 'test' as const,
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5434/parkingguard_test?schema=public',
  AUTH_SECRET: 'test-auth-secret-dat-minstens-tweeendertig-tekens-lang-is',
  // 32 bytes base64, alleen voor tests.
  STORAGE_ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
  STORAGE_DRIVER: 'local',
}

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    projects: [
      {
        plugins: [tsconfigPaths()],
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
          env: testEnv,
        },
      },
      {
        plugins: [tsconfigPaths()],
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          environment: 'node',
          env: testEnv,
        },
      },
    ],
  },
})
