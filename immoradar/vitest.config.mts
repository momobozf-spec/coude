import { defineConfig } from "vitest/config";

const shared = { resolve: { tsconfigPaths: true } };

export default defineConfig({
  ...shared,
  test: {
    projects: [
      {
        ...shared,
        test: { name: "unit", include: ["src/**/*.test.ts"], environment: "node" },
      },
      {
        ...shared,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          setupFiles: ["tests/integration/setup.ts"],
          fileParallelism: false,
          sequence: { concurrent: false },
          testTimeout: 30000,
          hookTimeout: 60000,
        },
      },
    ],
  },
});
