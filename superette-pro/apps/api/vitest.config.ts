import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * Unit- en integratietests van de API.
 *
 * - Alleen `src/**` en `scripts/**`: lokale scrape- en importdata in `data/`
 *   (codebackups, scrape-runs) en `.superette-backups/` worden nooit opgepikt.
 * - SWC in plaats van esbuild: Nest heeft `emitDecoratorMetadata` nodig voor
 *   constructor-injectie, en esbuild geeft die niet. Zo kunnen tests een echte
 *   Nest-app opstarten (zie `src/app.module.test.ts`).
 */
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    exclude: ['**/node_modules/**', 'dist/**', 'data/**', '**/.superette-backups/**', '**/*backup*/**'],
    environment: 'node',
  },
});
