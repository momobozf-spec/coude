import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('.', import.meta.url));

/** Resolve workspace packages to their TypeScript sources so tests never need a build. */
const alias = Object.fromEntries(
  readdirSync(`${root}packages`).map((name) => [`@superrette/${name}`, `${root}packages/${name}/src/index.ts`]),
);

export default defineConfig({
  resolve: { alias },
  test: {
    include: ['packages/*/src/**/*.test.ts', 'apps/worker/src/**/*.test.ts'],
    environment: 'node',
    reporters: ['default'],
  },
});
