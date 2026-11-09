/**
 * Overzicht van de automatische productmatches, om ze met het oog na te kijken.
 *
 *   npm run match:report
 *
 * Toont:
 *  1. het aantal matches per soort en status;
 *  2. hoeveel daarvan tussen twee VERSCHILLENDE ketens liggen (dat is wat de
 *     vergelijking nuttig maakt) en hoeveel binnen dezelfde keten;
 *  3. elke ketenoverschrijdende EXACT-, EQUIVALENT- en ALTERNATIVE-match met
 *     naam, inhoud en reden, zodat je fouten meteen ziet.
 *
 * Alleen lezen: dit script wijzigt niets in de database.
 */
import './load-env';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Side = {
  name: string;
  brand: string | null;
  packageQuantity: number | null;
  packageUnit: string | null;
  packCount: number;
  storeProducts: { storeChain: { slug: string } }[];
};

const chainsOf = (side: Side) => [...new Set(side.storeProducts.map((sp) => sp.storeChain.slug))].sort();

const label = (side: Side) => {
  const pack = side.packageQuantity === null ? 'inhoud onbekend' : `${side.packCount > 1 ? `${side.packCount} x ` : ''}${side.packageQuantity} ${side.packageUnit}`;
  return `${side.brand ? `${side.brand} ` : ''}${side.name} (${pack}) [${chainsOf(side).join(', ')}]`;
};

async function main() {
  const counts = await prisma.productMatch.groupBy({ by: ['matchType', 'status'], _count: { _all: true } });
  console.log('\n1. Matches per soort en status');
  console.table(counts.map((row) => ({ soort: row.matchType, status: row.status, aantal: row._count._all })));

  const sideSelect = {
    select: {
      name: true,
      brand: true,
      packageQuantity: true,
      packageUnit: true,
      packCount: true,
      storeProducts: { select: { storeChain: { select: { slug: true } } } },
    },
  } as const;

  const all = await prisma.productMatch.findMany({
    select: { matchType: true, status: true, confidence: true, reason: true, product: sideSelect, related: sideSelect },
    orderBy: [{ matchType: 'asc' }, { confidence: 'desc' }],
  });

  // Ketenoverschrijdend = de twee producten worden niet door precies dezelfde keten(s) gevoerd.
  const crossChain = all.filter((m) => chainsOf(m.product).join() !== chainsOf(m.related).join());
  console.log('\n2. Binnen dezelfde keten vs. tussen ketens');
  console.table([
    { soort: 'binnen dezelfde keten', aantal: all.length - crossChain.length },
    { soort: 'tussen verschillende ketens', aantal: crossChain.length },
  ]);

  const useful = crossChain.filter((m) => m.matchType !== 'UNCERTAIN');
  console.log(`\n3. Ketenoverschrijdende EXACT / EQUIVALENT / ALTERNATIVE (${useful.length})`);
  if (useful.length === 0) console.log('   (geen)');
  for (const m of useful) {
    console.log(`\n   ${m.matchType} ${m.confidence.toFixed(2)} ${m.status} — ${m.reason ?? ''}`);
    console.log(`     ${label(m.product)}`);
    console.log(`     ${label(m.related)}`);
  }

  const uncertainCross = crossChain.filter((m) => m.matchType === 'UNCERTAIN').length;
  console.log(`\n   + ${uncertainCross} ketenoverschrijdende UNCERTAIN-matches (wachten op een mens, niet getoond als vergelijking).\n`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
