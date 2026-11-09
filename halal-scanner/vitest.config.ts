import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    // Integratietests draaien apart (npm run test:integration): ze hebben een
    // echte PostgreSQL nodig en zouden de unit-suite anders traag maken.
    // .tsx erbij voor de componenttests. Die zetten zelf `@vitest-environment
    // jsdom` in een docblock, zodat de snelle node-omgeving de standaard blijft
    // voor alles wat geen DOM nodig heeft.
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    exclude: ["tests/integration/**", "node_modules/**"],
    setupFiles: ["tests/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
