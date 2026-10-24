/**
 * Jumbo België.
 *
 * Geen live koppeling. Importbestand of demogegevens. Zie
 * `delhaize.adapter.ts` voor de stappen naar een live bron.
 */
import { buildDemoSnapshot } from '../demo/demo-catalog';
import { createChainAdapter } from './chain-adapter';

export const jumboAdapter = createChainAdapter({
  key: 'jumbo',
  chain: {
    slug: 'jumbo',
    name: 'Jumbo',
    websiteUrl: 'https://www.jumbo.com/be',
    loyaltyCardName: null,
    sortOrder: 6,
  },
  demo: (context) => buildDemoSnapshot('jumbo', context),
});
