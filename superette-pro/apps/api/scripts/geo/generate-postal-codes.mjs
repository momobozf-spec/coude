#!/usr/bin/env node
/**
 * Genereert `src/compare/geo/belgian-postal-codes.ts`: per Belgische postcode
 * één coördinaat (het rekenkundig midden van de deelgemeenten die de
 * postcode delen).
 *
 * Bron: https://github.com/jief/zipcode-belgium (`zipcode-belgium.json`):
 * de postcodelijst van bpost, met coördinaten uit OpenStreetMap
 * (© OpenStreetMap-bijdragers, ODbL). Gebruik:
 *
 *   node apps/api/scripts/geo/generate-postal-codes.mjs pad/naar/zipcode-belgium.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = process.argv[2];
if (!source) {
  console.error('Gebruik: generate-postal-codes.mjs <zipcode-belgium.json>');
  process.exit(1);
}

const entries = JSON.parse(readFileSync(source, 'utf8'));
const byZip = new Map();
for (const entry of entries) {
  const zip = String(entry.zip).trim();
  const lat = Number(entry.lat);
  const lng = Number(entry.lng);
  if (!/^[1-9]\d{3}$/.test(zip)) throw new Error(`Ongeldige postcode: ${JSON.stringify(entry)}`);
  if (!(lat > 49 && lat < 52 && lng > 2 && lng < 7)) throw new Error(`Coördinaat buiten België: ${JSON.stringify(entry)}`);
  const list = byZip.get(zip) ?? [];
  list.push({ lat, lng });
  byZip.set(zip, list);
}

const rows = [...byZip.entries()]
  .sort(([a], [b]) => Number(a) - Number(b))
  .map(([zip, points]) => {
    const lat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
    const lng = points.reduce((sum, p) => sum + p.lng, 0) / points.length;
    return `  [${zip}, ${lat.toFixed(4)}, ${lng.toFixed(4)}],`;
  });

const output = `/**
 * Belgische postcodes → coördinaat (breedte, lengte), het rekenkundig midden
 * van de deelgemeenten die de postcode delen. Vier decimalen ≈ 10 m.
 *
 * GEGENEREERD door \`scripts/geo/generate-postal-codes.mjs\`; niet met de hand
 * bewerken. Bron: postcodelijst van bpost via jief/zipcode-belgium, met
 * coördinaten uit OpenStreetMap (© OpenStreetMap-bijdragers, ODbL,
 * https://www.openstreetmap.org/copyright).
 */
export const BELGIAN_POSTAL_CODES: ReadonlyArray<readonly [postalCode: number, latitude: number, longitude: number]> = [
${rows.join('\n')}
];
`;

const target = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/compare/geo/belgian-postal-codes.ts');
writeFileSync(target, output);
console.log(`${rows.length} postcodes → ${target}`);
