/**
 * Colruyt.
 *
 * Geen live koppeling. Colruyt Group heeft een developer-portaal voor
 * partners; toegang vereist een overeenkomst. Tot dan: importbestand of
 * demogegevens. Zie `delhaize.adapter.ts` voor de stappen naar een live bron.
 */
import { buildDemoSnapshot } from '../demo/demo-catalog';
import { createChainAdapter } from './chain-adapter';

export const colruytAdapter = createChainAdapter({
  key: 'colruyt',
  chain: {
    slug: 'colruyt',
    name: 'Colruyt',
    websiteUrl: 'https://www.colruyt.be',
    loyaltyCardName: 'Xtra',
    sortOrder: 3,
  },
  demo: (context) => buildDemoSnapshot('colruyt', context),
});
