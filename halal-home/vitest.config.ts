import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

/**
 * De tests in dit project draaien zonder database en zonder netwerk.
 *
 * Dat is een ontwerpkeuze, geen beperking: alle beslissingen die ertoe doen
 * (fase-overgangen, matching, financieringsberekeningen, buurtscore,
 * uploadbeleid) staan in pure functies onder `domain/` en `policy.ts`. Wat een
 * database nodig heeft, is dunne glue-code eromheen.
 *
 * Externe diensten — AI, kaarten, e-mail, vastgoedbronnen — worden altijd
 * gemockt. Een test die een echte API aanroept is geen test maar een
 * beschikbaarheidsmeting.
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      // `server-only` gooit zodra het buiten een servercomponent geïmporteerd
      // wordt. Dat is precies de bedoeling in de applicatie, maar in een
      // testrunner is er geen React-servercontext. Hier vervangen we het door
      // een lege module, zodat modules die het importeren (env, prisma,
      // repositories) testbaar blijven zonder dat de bescherming in productie
      // verzwakt.
      'server-only': new URL('./tests/stubs/server-only.ts', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Integratietests hebben een echte database nodig en draaien apart, via
    // `npm run test:integration`. Ze hier meenemen zou betekenen dat `npm test`
    // op elke machine zonder Postgres een reeks overgeslagen tests toont — en
    // een overgeslagen test die eruitziet als een geslaagde is precies het
    // soort ruis dat een suite onbetrouwbaar maakt.
    exclude: ['tests/integration/**'],
    setupFiles: ['tests/setup.ts'],
    globals: false,
  },
})
