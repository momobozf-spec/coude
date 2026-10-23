import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests tegen een draaiende Barakah.
 *
 *   npm run db:seed                   # dev@barakah.local / barakah-dev-2026
 *   ADMIN_EMAIL=dev@barakah.local npm run admin:grant
 *   npm run build && npm start        # in een tweede terminal
 *   npm run test:e2e
 *
 * Start de server voor e2e met LOGIN_MAX_ATTEMPTS_PER_IP=1000: alle tests komen
 * van hetzelfde adres, en de IP-limiet (standaard 30 per kwartier) is apart
 * getest in tests/integration/account.test.ts.
 *
 * De tests registreren eigen gebruikers met unieke adressen, zodat ze herhaald
 * kunnen draaien zonder opnieuw te seeden. Ze lopen na elkaar: ze delen een
 * database en de IP-limiet op inloggen.
 *
 * `PLAYWRIGHT_CHROMIUM_PATH` laat een vooraf geïnstalleerde Chromium gebruiken
 * (CI-images, sandboxes); anders: `npx playwright install chromium`.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    locale: 'nl-BE',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
