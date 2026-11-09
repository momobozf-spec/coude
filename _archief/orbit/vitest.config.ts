import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const resolvePkg = (name: string) =>
  fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@orbit/types': resolvePkg('types'),
      '@orbit/validation': resolvePkg('validation'),
      '@orbit/utils': resolvePkg('utils'),
      '@orbit/core': resolvePkg('core'),
      '@orbit/ui': resolvePkg('ui'),
      '@orbit/db': resolvePkg('db'),
      '@orbit/auth': resolvePkg('auth'),
      '@orbit/api-core': resolvePkg('api-core'),
      '@orbit/api-client': resolvePkg('api-client'),
    },
  },
  test: {
    environment: 'node',
    include: ['packages/**/*.test.ts', 'packages/**/tests/**/*.test.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      // Integratietests hebben een echte PostgreSQL nodig en draaien via
      // `npm run test:integration`; hier zouden ze de snelle suite blokkeren.
      '**/*.integration.test.ts',
    ],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/index.ts', '**/*.d.ts'],
    },
  },
});
