import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

const packages = fileURLToPath(new URL('../../packages', import.meta.url));
const alias = Object.fromEntries(
  readdirSync(packages).map((name) => [`@superrette/${name}`, `${packages}/${name}/src/index.ts`]),
);

// NestJS dependency injection needs emitted decorator metadata, which esbuild
// does not produce; SWC does.
export default defineConfig({
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        transform: { decoratorMetadata: true, legacyDecorator: true },
        parser: { syntax: 'typescript', decorators: true },
      },
    }),
  ],
  resolve: { alias },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    globalSetup: ['test/global-setup.ts'],
  },
});
