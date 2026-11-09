import "dotenv/config";
import { seedClient } from "./seed-client";

/**
 * Referentiedata die ook in productie hoort: de productcategorieën.
 * Idempotent (upsert op slug) en veilig bij elke start: wijzigingen die je
 * later in de beheeromgeving aan naam of omschrijving maakt, blijven staan —
 * bestaande categorieën worden niet overschreven.
 *
 *   npm run db:reference
 */
const prisma = seedClient();

const categories = [
  { name: "Home Decor", slug: "home-decor", description: "Wanddecoratie, schalen en accenten die je interieur warmte geven.", sortOrder: 1 },
  { name: "Tea Experience", slug: "tea-experience", description: "Theeglazen, theepotten en alles voor het perfecte oosterse theemoment.", sortOrder: 2 },
  { name: "Tableware", slug: "tableware", description: "Serveerschalen, plateaus en tafelaankleding met oosters karakter.", sortOrder: 3 },
  { name: "Fragrance", slug: "fragrance", description: "Musk, oud en amber parfumolie, home fragrance en wierook.", sortOrder: 4 },
  { name: "Candles & Lanterns", slug: "candles-lanterns", description: "Geurkaarsen en lantaarns voor warm, sfeervol licht.", sortOrder: 5 },
  { name: "Hammam & Wellness", slug: "hammam-wellness", description: "Hammam- en badrituelen met arganolie en zwarte zeep.", sortOrder: 6 },
  { name: "Gifts", slug: "gifts", description: "Cadeaupakketten en sfeerboxen met karakter voor elke gelegenheid.", sortOrder: 7 },
  { name: "Wedding & Henna Gifts", slug: "wedding-henna", description: "Bedankjes en giftboxen voor bruiloft en henna night.", sortOrder: 8 },
  { name: "Kitchen & Serving", slug: "kitchen-serving", description: "Tajines, serveersets en keukenitems voor gastvrij tafelen.", sortOrder: 9 },
  { name: "Cushions & Textiles", slug: "cushions-textiles", description: "Decoratieve kussens en luxe plaids met oosterse patronen.", sortOrder: 10 },
  { name: "Seasonal Collections", slug: "seasonal", description: "Seizoenscollecties — van Ramadan & Eid tot winterwarmte.", sortOrder: 11 },
];

async function main(): Promise<void> {
  for (const c of categories) {
    await prisma.category.upsert({ where: { slug: c.slug }, update: {}, create: c });
  }
  console.log(`${categories.length} categorieën staan klaar.`);
}

main()
  .catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
