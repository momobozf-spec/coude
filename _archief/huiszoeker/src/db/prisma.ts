/**
 * De enige plek waar een PrismaClient wordt aangemaakt.
 *
 * Prisma 7 wil een driver-adapter in plaats van een connectie-URL in het
 * schema, dus de pool wordt hier opgezet. Alles wat de database aanraakt gaat
 * via een repository in `src/db/repositories/`, nooit rechtstreeks via deze
 * client — dat houdt de query's op één plek en de services testbaar.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { env } from "../config/env.js";

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

export const prisma = new PrismaClient({
  adapter,
  log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
