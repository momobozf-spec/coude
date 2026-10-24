/**
 * Maakt importbestanden voor een staging-omgeving uit de demogenerator.
 *
 *   npx tsx scripts/make-staging-feeds.ts <doelmap> [--unverified spar,lidl]
 *
 * In productie-modus (`NODE_ENV=production`) kan de API geen demogegevens
 * genereren (`COMPARE_ALLOW_DEMO` is daar verboden). Staging moet toch iets
 * tonen om de volledige keten te kunnen testen. Deze bestanden dragen
 * `source.kind = "DEMO"` en `termsReviewed = false`: ze worden overal als
 * DEMO getoond en nooit als live prijs. Zet ze NOOIT in een productie-feedmap.
 *
 * `--unverified <keys>`: die ketens krijgen `kind = "IMPORT_FILE"` met
 * `termsReviewed = false` (status UNVERIFIED, label "fictief"). Alleen zo kan
 * staging de alert- en meldingspijplijn testen: in productie-modus triggeren
 * alerts bewust nooit op DEMO-prijzen.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { feedFileSchema } from '../src/compare/adapters/feed-schema';
import { buildDemoSnapshot, DEMO_CHAIN_KEYS } from '../src/compare/demo/demo-catalog';

const args = process.argv.slice(2);
const target = resolve(args.find((a) => !a.startsWith('--')) ?? 'data/feeds-staging');
const unverified = new Set((args.includes('--unverified') ? (args[args.indexOf('--unverified') + 1] ?? '') : '').split(',').filter(Boolean));
mkdirSync(target, { recursive: true });
const now = new Date();

for (const key of DEMO_CHAIN_KEYS) {
  const snapshot = buildDemoSnapshot(key, { now });
  const asUnverified = unverified.has(key);
  const feed = {
    version: 1 as const,
    chain: {
      slug: snapshot.chain.slug,
      name: snapshot.chain.name,
      logoUrl: snapshot.chain.logoUrl ?? null,
      websiteUrl: snapshot.chain.websiteUrl ?? null,
      loyaltyCardName: snapshot.chain.loyaltyCardName ?? null,
    },
    source: {
      kind: asUnverified ? ('IMPORT_FILE' as const) : ('DEMO' as const),
      label: asUnverified
        ? 'Stagingtestgegevens — fictieve prijzen, bron niet geverifieerd (alleen om alerts te testen)'
        : 'Stagingtestgegevens — fictieve prijzen uit de demogenerator',
      termsReviewed: false,
      notes: 'Gegenereerd door scripts/make-staging-feeds.ts. Alleen voor staging; nooit in productie plaatsen.',
    },
    observedAt: snapshot.observedAt.toISOString(),
    locations: snapshot.locations,
    products: snapshot.products,
    offers: snapshot.offers.map((offer) => ({
      ...offer,
      startsAt: offer.startsAt ? offer.startsAt.toISOString() : null,
      endsAt: offer.endsAt ? offer.endsAt.toISOString() : null,
      observedAt: offer.observedAt ? offer.observedAt.toISOString() : snapshot.observedAt.toISOString(),
    })),
  };

  // Dezelfde validatie als de adapter bij het inlezen; een ongeldig bestand komt niet op schijf.
  const parsed = feedFileSchema.parse(JSON.parse(JSON.stringify(feed)));
  const file = join(target, `${key}.json`);
  writeFileSync(file, JSON.stringify(parsed, null, 1));
  console.log(`✓ ${file}: ${parsed.products.length} producten, ${parsed.offers.length} aanbiedingen (${parsed.source.kind}${asUnverified ? ', niet geverifieerd' : ''})`);
}
