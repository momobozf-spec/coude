/**
 * Demogegevens uit de database halen (op inactief zetten), voor alle ketens.
 *
 *   npm run compare:purge-demo              (eerst tonen wat er zou gebeuren)
 *   npm run compare:purge-demo -- --doe     (echt uitvoeren)
 *
 * Waarom: zonder importbestand valt een keten buiten productie terug op
 * demogegevens (verzonnen prijzen, overal gelabeld als DEMO). Dat wil je niet
 * naast echte prijzen. Dit script zet alle actieve aanbiedingen met bron
 * DEMO op inactief, en ook de winkelproducten die daardoor geen enkele
 * actieve aanbieding meer hebben. Er wordt niets verwijderd: de geschiedenis
 * blijft, en een echte import later zet echte producten gewoon weer actief.
 *
 * Voorkom herhaling met `COMPARE_ALLOW_DEMO=false` in je `.env`.
 */
import './load-env';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const execute = process.argv.includes('--doe');

async function main() {
  const demoOffers = await prisma.productOffer.findMany({
    where: { source: 'DEMO', active: true },
    select: { id: true, storeProductId: true, storeChain: { select: { slug: true } } },
  });
  const perChain = new Map<string, number>();
  for (const offer of demoOffers) perChain.set(offer.storeChain.slug, (perChain.get(offer.storeChain.slug) ?? 0) + 1);

  console.log(`\n${demoOffers.length} actieve DEMO-aanbiedingen gevonden.`);
  for (const [chain, count] of [...perChain].sort()) console.log(`  ${chain}: ${count}`);
  if (demoOffers.length === 0) return;

  const storeProductIds = [...new Set(demoOffers.map((offer) => offer.storeProductId))];
  if (!execute) {
    console.log(`\nProefmodus: er is niets gewijzigd. Draai met "-- --doe" om ze op inactief te zetten.\n`);
    return;
  }

  const offers = await prisma.productOffer.updateMany({ where: { source: 'DEMO', active: true }, data: { active: false } });
  // Alleen winkelproducten die nu geen enkele actieve (echte) aanbieding meer hebben.
  const products = await prisma.storeProduct.updateMany({
    where: { id: { in: storeProductIds }, active: true, offers: { none: { active: true } } },
    data: { active: false },
  });
  console.log(`\n✔ ${offers.count} DEMO-aanbiedingen en ${products.count} winkelproducten op inactief gezet.\n`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
