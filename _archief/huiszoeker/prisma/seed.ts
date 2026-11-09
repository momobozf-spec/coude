/**
 * Seed voor development.
 *
 * Bewust géén echte persoonsgegevens: het e-mailadres komt uit
 * `DEFAULT_USER_EMAIL` en de voorbeeldzoekopdrachten gebruiken gestructureerde
 * criteria, zodat seeden geen API-key en geen AI-aanroep kost.
 *
 * Idempotent: twee keer draaien levert dezelfde toestand op.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { env } from "../src/config/env.js";
import { searchCriteriaSchema } from "../src/schemas/searchCriteria.js";
import { CRITERIA_SCHEMA_VERSION } from "../src/schemas/searchCriteria.js";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });

const EXAMPLE_SEARCHES = [
  {
    name: "Huis Gent",
    originalQuery:
      "Vrijstaande woning in Gent of maximaal 15 km rond Gent, onder 450.000 euro, minstens 3 slaapkamers, EPC A of B, liefst een tuin en garage",
    criteria: {
      transactionType: "buy",
      locations: ["Gent"],
      radiusKm: 15,
      hardRequirements: {
        propertyTypes: ["house"],
        maxPrice: 450_000,
        minBedrooms: 3,
        epcLabels: ["A++", "A+", "A", "B"],
        features: ["detached"],
      },
      preferences: {
        features: ["garden", "garage"],
      },
    },
  },
  {
    name: "Appartement Brussel",
    originalQuery: "Appartement rond Brussel onder 300k",
    criteria: {
      transactionType: "buy",
      locations: ["Brussel"],
      hardRequirements: {
        propertyTypes: ["apartment"],
        maxPrice: 300_000,
      },
      preferences: {},
    },
  },
] as const;

async function main(): Promise<void> {
  const user = await prisma.user.upsert({
    where: { email: env.DEFAULT_USER_EMAIL.toLowerCase() },
    update: {},
    create: { email: env.DEFAULT_USER_EMAIL.toLowerCase(), name: "Ontwikkelaar" },
  });
  console.log(`Gebruiker klaar: ${user.email} (${user.id})`);

  for (const example of EXAMPLE_SEARCHES) {
    const criteria = searchCriteriaSchema.parse(example.criteria);
    const search = await prisma.search.upsert({
      where: { userId_name: { userId: user.id, name: example.name } },
      update: {},
      create: {
        userId: user.id,
        name: example.name,
        originalQuery: example.originalQuery,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSON-kolom
        criteria: criteria as any,
        criteriaVersion: CRITERIA_SCHEMA_VERSION,
        parsedBy: null,
        frequency: "DAILY",
      },
    });
    console.log(`Zoekopdracht klaar: ${search.name} (${search.id})`);
  }
}

main()
  .catch((e: unknown) => {
    console.error("Seed mislukt:", e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
