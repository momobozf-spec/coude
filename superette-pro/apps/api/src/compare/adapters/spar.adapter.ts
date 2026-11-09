/**
 * SPAR (Colruyt Group / Lambrechts).
 *
 * Geen live koppeling; SPAR-winkels zijn deels zelfstandig, met lokale
 * prijsverschillen. Daarom is het filiaalmodel (`StoreLocation`) voor SPAR
 * belangrijker dan voor de andere ketens. Importbestand of demogegevens.
 */
import { buildDemoSnapshot } from '../demo/demo-catalog';
import { createChainAdapter } from './chain-adapter';

export const sparAdapter = createChainAdapter({
  key: 'spar',
  chain: {
    slug: 'spar',
    name: 'SPAR',
    websiteUrl: 'https://www.spar.be',
    loyaltyCardName: null,
    sortOrder: 4,
  },
  demo: (context) => buildDemoSnapshot('spar', context),
});
