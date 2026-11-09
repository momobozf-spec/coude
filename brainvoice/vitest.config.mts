import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, 'src/core'),
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    include: ['src/core/**/*.test.ts', 'src/runtime/**/*.test.ts', 'plugins/**/*.test.ts', 'server/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/core/**/*.ts'],
      exclude: ['**/*.test.ts', '**/__fixtures__/**'],
    },
  },
});
