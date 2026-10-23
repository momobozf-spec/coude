import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * PrismaClient voor de seedscripts. De demo-seeds (verzonnen producten) weigeren
 * in productie, tenzij de omgeving uitdrukkelijk een testomgeving is
 * (STAGING=1, bv. de gratis Render-opstelling). Dezelfde vlag bepaalt of de
 * app zelf mag starten met SEED_DEMO=1 (zie src/lib/env.ts).
 */
export function demoSeedClient(): PrismaClient {
  if (process.env.NODE_ENV === "production" && process.env.STAGING !== "1") {
    console.error("Demo-seed geweigerd in productie. Zet STAGING=1 als dit een testomgeving is.");
    process.exit(1);
  }
  return seedClient();
}

export function seedClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL ontbreekt.");
    process.exit(1);
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
