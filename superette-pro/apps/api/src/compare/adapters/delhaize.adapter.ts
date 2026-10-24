/**
 * Delhaize.
 *
 * ## Status van de databron
 *
 * Geen live koppeling. Delhaize biedt geen publieke prijs-API; de webshop
 * is geen toegestane bron zonder overeenkomst (gebruiksvoorwaarden en
 * databankrecht). Tot er een overeenkomst of gelicentieerde feed is, levert
 * deze adapter uitsluitend:
 *   - `COMPARE_FEED_DIR/delhaize.json` of `.csv` (handmatig beheerd), of
 *   - demogegevens, alleen buiten productie.
 *
 * ## Live zetten
 *
 * Voeg `live: async (ctx) => …` toe aan de configuratie hieronder. Die functie
 * vertaalt de bron naar een `AdapterSnapshot` en zet `source.kind` op
 * `OFFICIAL_API` of `MERCHANT_FEED` met `termsReviewed: true`. De rest van
 * de vergelijker wijzigt niet.
 */
import { buildDemoSnapshot } from '../demo/demo-catalog';
import { createChainAdapter } from './chain-adapter';

export const delhaizeAdapter = createChainAdapter({
  key: 'delhaize',
  chain: {
    slug: 'delhaize',
    name: 'Delhaize',
    websiteUrl: 'https://www.delhaize.be',
    loyaltyCardName: 'SuperPlus',
    sortOrder: 1,
  },
  demo: (context) => buildDemoSnapshot('delhaize', context),
});
