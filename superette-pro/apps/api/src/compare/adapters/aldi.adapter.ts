/**
 * ALDI België.
 *
 * Geen live koppeling. Bron: het importbestand `COMPARE_FEED_DIR/aldi.json`,
 * gemaakt door `npm run scrape:aldi` uit de publieke productpagina's die ALDI
 * zelf in zijn sitemap zet (robots.txt laat `/product/` toe). Geen demogegevens:
 * zonder importbestand toont de app voor ALDI gewoon niets.
 */
import { createChainAdapter } from './chain-adapter';

export const aldiAdapter = createChainAdapter({
  key: 'aldi',
  chain: {
    slug: 'aldi',
    name: 'ALDI',
    websiteUrl: 'https://www.aldi.be',
    sortOrder: 8,
  },
});
