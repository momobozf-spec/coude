import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Eén PrismaClient per proces, op PostgreSQL via de pg-driver (Prisma 7).
 *
 * Een kleine result-extensie maakt de leeskant prettig voor de app:
 * - JSON-arrays (images, sizes, …) worden string[];
 * - Decimal-bedragen worden een gewoon getal in euro. Rekenen met dat getal doe
 *   je via src/lib/money.ts (in centen), niet rechtstreeks.
 */

function toStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === "string");
  return [];
}

/** Decimal | null → number | null. Prisma's Decimal heeft toNumber(). */
function num(v: { toNumber(): number } | null): number | null {
  return v === null ? null : v.toNumber();
}
function req(v: { toNumber(): number }): number {
  return v.toNumber();
}

function poolMax(): number {
  const n = Number(process.env.DATABASE_POOL_MAX ?? 5);
  return Number.isInteger(n) && n > 0 ? n : 5;
}

function createExtendedClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL ontbreekt");
  }
  const adapter = new PrismaPg({ connectionString, max: poolMax() });
  const base = new PrismaClient({ adapter });

  return base.$extends({
    name: "layali-read-shapes",
    result: {
      product: {
        price: { needs: { price: true }, compute: (p) => req(p.price) },
        comparePrice: { needs: { comparePrice: true }, compute: (p) => num(p.comparePrice) },
        images: { needs: { images: true }, compute: (p) => toStringArray(p.images) },
        sizes: { needs: { sizes: true }, compute: (p) => toStringArray(p.sizes) },
        colors: { needs: { colors: true }, compute: (p) => toStringArray(p.colors) },
        scents: { needs: { scents: true }, compute: (p) => toStringArray(p.scents) },
        materials: { needs: { materials: true }, compute: (p) => toStringArray(p.materials) },
        tags: { needs: { tags: true }, compute: (p) => toStringArray(p.tags) },
      },
      service: {
        priceFrom: { needs: { priceFrom: true }, compute: (s) => num(s.priceFrom) },
        images: { needs: { images: true }, compute: (s) => toStringArray(s.images) },
        tags: { needs: { tags: true }, compute: (s) => toStringArray(s.tags) },
      },
      order: {
        subtotal: { needs: { subtotal: true }, compute: (o) => req(o.subtotal) },
        shipping: { needs: { shipping: true }, compute: (o) => req(o.shipping) },
        discount: { needs: { discount: true }, compute: (o) => req(o.discount) },
        total: { needs: { total: true }, compute: (o) => req(o.total) },
      },
      orderItem: {
        price: { needs: { price: true }, compute: (i) => req(i.price) },
      },
      couponCode: {
        discountValue: { needs: { discountValue: true }, compute: (c) => req(c.discountValue) },
        minOrder: { needs: { minOrder: true }, compute: (c) => num(c.minOrder) },
      },
    },
  });
}

export type AppPrismaClient = ReturnType<typeof createExtendedClient>;

const globalForPrisma = globalThis as unknown as { prisma: AppPrismaClient | undefined };

function getClient(): AppPrismaClient {
  if (!globalForPrisma.prisma) globalForPrisma.prisma = createExtendedClient();
  return globalForPrisma.prisma;
}

/**
 * Lui aangemaakt: `next build` importeert deze module zonder database; pas bij
 * het eerste gebruik wordt er verbonden.
 */
export const prisma: AppPrismaClient = new Proxy({} as AppPrismaClient, {
  get(_target, prop) {
    const client = getClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
