/**
 * Lidl.
 *
 * Geen live koppeling: Lidl publiceert geen prijs-API en de folder-/webshopdata
 * vallen onder gebruiksvoorwaarden die scraping uitsluiten. Importbestand of
 * demogegevens; zie `delhaize.adapter.ts` voor de stappen naar een live bron.
 */
import { buildDemoSnapshot } from '../demo/demo-catalog';
import { createChainAdapter } from './chain-adapter';

export const lidlAdapter = createChainAdapter({
  key: 'lidl',
  chain: {
    slug: 'lidl',
    name: 'Lidl',
    websiteUrl: 'https://www.lidl.be',
    loyaltyCardName: 'Lidl Plus',
    sortOrder: 2,
  },
  demo: (context) => buildDemoSnapshot('lidl', context),
});
