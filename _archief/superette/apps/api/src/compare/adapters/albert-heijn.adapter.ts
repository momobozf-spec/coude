/**
 * Albert Heijn België.
 *
 * Geen live koppeling. De AH-app-API is niet publiek gedocumenteerd en niet
 * bedoeld voor derden; gebruik ervan is geen toegestane bron. Importbestand
 * of demogegevens. Let op: Belgische AH-prijzen verschillen van de Nederlandse;
 * een eventuele feed moet expliciet de Belgische zijn.
 */
import { buildDemoSnapshot } from '../demo/demo-catalog';
import { createChainAdapter } from './chain-adapter';

export const albertHeijnAdapter = createChainAdapter({
  key: 'albert-heijn',
  chain: {
    slug: 'albert-heijn',
    name: 'Albert Heijn',
    websiteUrl: 'https://www.ah.be',
    loyaltyCardName: 'Bonuskaart',
    sortOrder: 5,
  },
  demo: (context) => buildDemoSnapshot('albert-heijn', context),
});
