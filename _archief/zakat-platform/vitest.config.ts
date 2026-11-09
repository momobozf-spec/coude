import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      // `server-only` throws when imported outside a React Server Component.
      // Node-environment tests import the real services on purpose, so the
      // marker resolves to an empty module — the same thing Next does under its
      // `react-server` condition. The package's own exports map does not expose
      // its empty file, hence the local stub.
      'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)),
    },
  },
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
    // Tests must never reach a real AI provider or price feed (§53). The
    // integration suite supplies its own TEST_DATABASE_URL and skips without it.
    env: {
      NODE_ENV: 'test',
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        'postgresql://test:test@localhost:5432/barakah_test?schema=public',
      AUTH_SECRET: 'test-secret-that-is-at-least-32-characters-long',
      AI_PROVIDER: 'mock',
      METAL_PRICE_PROVIDER: 'fixture',
      FX_PROVIDER: 'fixture',
      STORAGE_PROVIDER: 'local',
    },
  },
})
