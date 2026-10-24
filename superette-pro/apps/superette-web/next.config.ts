import type { NextConfig } from 'next';
import { PHASE_PRODUCTION_BUILD } from 'next/constants';
import { resolve } from 'node:path';

/**
 * Een productiebuild faalt hard wanneer de API-URL ontbreekt of niet via HTTPS
 * loopt: een stille terugval naar localhost is in productie een storing die
 * pas bij de eerste gebruiker opvalt. Een lokale productiebuild geeft de
 * variabele expliciet mee (localhost is dan toegestaan). De controle hoort
 * bij de build: dáár wordt de waarde in de bundel gebakken; `next start`
 * draait met wat gebouwd is.
 */
function assertApiUrlForProductionBuild(): void {
  const apiUrl = process.env['NEXT_PUBLIC_API_URL'];
  if (!apiUrl) {
    throw new Error('NEXT_PUBLIC_API_URL ontbreekt. Zet hem expliciet voor een productiebuild, bv. https://api.superette.be/api/v1');
  }
  const parsed = new URL(apiUrl);
  const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  if (parsed.protocol !== 'https:' && !isLocal) {
    throw new Error(`NEXT_PUBLIC_API_URL moet https zijn in productie (nu ${parsed.protocol})`);
  }
}

const config: NextConfig = {
  reactStrictMode: true,
  // Zelfstandige server voor de container: kopieert alleen wat nodig is.
  output: 'standalone',
  poweredByHeader: false,
  // Geen browser-sourcemaps in productie: niets lekt over de interne structuur.
  productionBrowserSourceMaps: false,
  // Zonder dit kiest Next een verdwaalde package-lock.json elders op de schijf
  // als workspace-root (zie apps/pwa/next.config.ts).
  outputFileTracingRoot: resolve(import.meta.dirname, '..', '..'),
  // Gedeelde packages als TypeScript-bron meecompileren: API en app delen
  // gegarandeerd dezelfde contracten en prijslogica.
  transpilePackages: ['@superette/contracts', '@superette/vat', '@superette/pricing'],
  // Geen externe afbeeldingshosts tot een toegestane bron is gekoppeld (zie middleware.ts).
  images: { remotePatterns: [] },
};

export default function nextConfig(phase: string): NextConfig {
  if (phase === PHASE_PRODUCTION_BUILD) assertApiUrlForProductionBuild();
  return config;
}
