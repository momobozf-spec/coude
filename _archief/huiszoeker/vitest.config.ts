import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    environment: "node",
    // Tests mogen nooit een echte bron of AI-provider raken; de fixture-scraper
    // en een stub-provider dekken de hele pijplijn.
    env: {
      NODE_ENV: "test",
      // Anders verdrinkt de testuitvoer in request-logs.
      LOG_LEVEL: "silent",
      AI_ENABLED: "false",
      SCRAPER_ENABLED_SOURCES: "fixture",
      DATABASE_URL: "postgresql://test:test@localhost:5432/huiszoeker_test",
    },
  },
});
