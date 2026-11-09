import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Aparte configuratie voor de integratiesuite.
 *
 * Waarom niet dezelfde config met een ander pad: `vitest.config.ts` sluit
 * `tests/integration/**` uit zodat de unit-suite snel blijft. Die uitsluiting
 * geldt óók wanneer je dat pad expliciet meegeeft, dus `vitest run
 * tests/integration` vond nul bestanden en eindigde met "No test files found".
 * Dat is stil genoeg om over het hoofd te zien en betekende dat deze suite ook
 * mét database niet gedraaid zou hebben.
 *
 * Draaien:
 *
 *   TEST_DATABASE_URL=postgresql://halal:halal@localhost:5432/halal_scanner_test \
 *     npm run test:integration
 *
 * Zonder `TEST_DATABASE_URL` slaan de suites zichzelf over (`describe.runIf`),
 * en dat is zichtbaar in de uitvoer — niet stilzwijgend groen.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    // Eén tegelijk: deze tests delen één database en leegt-elkaars tabellen.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
