import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Unit tests raken nooit een echte site of een echte database. De
    // DATABASE_URL hieronder bestaat alleen zodat de env-validatie slaagt;
    // niets in de unit suite opent een verbinding.
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/fsbo_test?schema=public',
      ADMIN_PASSWORD: 'test-admin-password',
      SESSION_SECRET: 'test-session-secret-that-is-at-least-32-chars',
      TELEGRAM_BOT_TOKEN: '',
      COLLECTOR_ENABLED_SOURCES: 'fixture-be,demo-be',
    },
  },
})
