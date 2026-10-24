import type { NextConfig } from 'next';
import { resolve } from 'node:path';

const config: NextConfig = {
  reactStrictMode: true,
  // Zonder dit kiest Next een verdwaalde package-lock.json elders op de schijf
  // als workspace-root, en trace't het de verkeerde bestanden mee in de build.
  outputFileTracingRoot: resolve(import.meta.dirname, '..', '..'),
  // De contracts- en vat-packages worden als TypeScript-bron meegecompileerd,
  // zodat de PWA en de API gegarandeerd dezelfde types delen.
  transpilePackages: ['@superette/contracts', '@superette/vat', '@superette/pricing'],
};

export default config;
