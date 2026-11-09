import { defineConfig } from "vitest/config";
import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv();

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    environment: "node",
    globalSetup: ["./tests/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://tk:tk@localhost:5432/tenderkompas_test",
      STORAGE_DIR: "./.test-storage",
      SMTP_HOST: "",
      ANTHROPIC_API_KEY: "",
      BETTER_AUTH_URL: "http://localhost:3000",
    },
  },
});
