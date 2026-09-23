import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getEnv } from "@/lib/env";

/**
 * Prisma client singleton. Prisma 7 requires an explicit driver adapter.
 * The pool is created lazily so importing this module has no side effects.
 */
const globalForPrisma = globalThis as unknown as { immoradarPrisma?: PrismaClient };

export function createPrismaClient(databaseUrl?: string): PrismaClient {
  const url = databaseUrl ?? getEnv().DATABASE_URL;
  const adapter = new PrismaPg({ connectionString: url, max: 10 });
  return new PrismaClient({ adapter });
}

export function getDb(): PrismaClient {
  if (!globalForPrisma.immoradarPrisma) {
    globalForPrisma.immoradarPrisma = createPrismaClient();
  }
  return globalForPrisma.immoradarPrisma;
}

export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getDb();
    const value = Reflect.get(client, prop);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export type Db = PrismaClient;
export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
