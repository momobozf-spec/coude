import { defineConfig } from "vitest/config";
import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv();

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src"), "server-only": path.resolve(import.meta.dirname, "tests/stubs/server-only.ts") },
  },
  test: {
    environment: "node",
    globalSetup: ["./tests/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    include: ["tests/**/*.test.ts"],
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://postgres:lokaal@localhost:54329/klushulp_test",
      STORAGE_DIR: "./.test-storage",
      BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-123456",
      BETTER_AUTH_URL: "http://localhost:3000",
      STRIPE_SECRET_KEY: "",
      SMTP_HOST: "",
    },
  },
});
