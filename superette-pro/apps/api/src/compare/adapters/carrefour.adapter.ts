/**
 * Carrefour België (Hyper, Market, Express).
 *
 * Geen live koppeling. Carrefour kent sterke prijsverschillen tussen formules
 * en filialen; de demogegevens tonen daarom een regionale promotie per filiaal.
 * Importbestand of demogegevens. Zie `delhaize.adapter.ts` voor live.
 */
import { buildDemoSnapshot } from '../demo/demo-catalog';
import { createChainAdapter } from './chain-adapter';

export const carrefourAdapter = createChainAdapter({
  key: 'carrefour',
  chain: {
    slug: 'carrefour',
    name: 'Carrefour',
    websiteUrl: 'https://www.carrefour.be',
    loyaltyCardName: 'Bonus Card',
    sortOrder: 7,
  },
  demo: (context) => buildDemoSnapshot('carrefour', context),
});
