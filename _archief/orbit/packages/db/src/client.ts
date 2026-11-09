import { PrismaClient } from '@prisma/client';

/**
 * Eén PrismaClient per proces. In dev herlaadt Next.js modules bij elke
 * wijziging; zonder deze cache loopt de connection pool binnen een minuut vol.
 */

const globalForPrisma = globalThis as unknown as { orbitPrisma?: PrismaClient };

export interface PrismaOptions {
  databaseUrl?: string;
  logQueries?: boolean;
}

export function createPrismaClient(options: PrismaOptions = {}): PrismaClient {
  return new PrismaClient({
    log: options.logQueries ? ['query', 'warn', 'error'] : ['warn', 'error'],
    ...(options.databaseUrl ? { datasources: { db: { url: options.databaseUrl } } } : {}),
  });
}

export function getPrisma(options: PrismaOptions = {}): PrismaClient {
  globalForPrisma.orbitPrisma ??= createPrismaClient(options);
  return globalForPrisma.orbitPrisma;
}

export type { PrismaClient };

/** Alles binnen één transactie; `tx` heeft dezelfde vorm als de client. */
export type Transactional = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export async function withTransaction<T>(
  prisma: PrismaClient,
  fn: (tx: Transactional) => Promise<T>,
): Promise<T> {
  return prisma.$transaction((tx) => fn(tx), {
    maxWait: 5_000,
    timeout: 15_000,
  });
}
