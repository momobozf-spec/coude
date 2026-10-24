import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Unit-tests voor de zuivere delen van de app (formattering, vertalingen,
 * URL-state, voorkeuren, hulpfuncties). Geen DOM-emulatie: de schermen zelf
 * worden door `scripts/walkthrough-superette.mjs` in een echte browser getest.
 */
export default defineConfig({
  resolve: { alias: { '@': resolve(import.meta.dirname, 'src') } },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
