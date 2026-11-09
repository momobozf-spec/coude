import { PrismaClient } from "@prisma/client";

/**
 * Eén PrismaClient per proces. In development maakt Next.js bij elke hot reload
 * een nieuwe module-instantie aan; zonder deze globale cache loopt het aantal
 * databaseconnecties vol.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
