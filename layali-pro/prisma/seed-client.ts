import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * PrismaClient voor de seedscripts. De demo-seeds weigeren in productie, tenzij
 * je expliciet ALLOW_DEMO_SEED=1 zet (bv. voor een testomgeving die met
 * NODE_ENV=production draait).
 */
export function demoSeedClient(): PrismaClient {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "1") {
    console.error("Demo-seed geweigerd in productie. Zet ALLOW_DEMO_SEED=1 als dit een testomgeving is.");
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
