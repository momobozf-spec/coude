import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // DB-backed suites (tenant isolation, repositories) manage their own
    // setup and are skipped automatically when TEST_DATABASE_URL is absent.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
