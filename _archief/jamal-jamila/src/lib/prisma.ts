import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

// Local-dev SQLite client (Prisma 7 requires a driver adapter).
// images/sizes/colors/materials and order.shippingAddress are native Json
// columns — Prisma (de)serialises them automatically. We only add a thin
// result extension to narrow the array fields back to string[] so the rest of
// the app keeps a precise type instead of the generic Prisma.JsonValue.

function toStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === "string");
  if (typeof raw === "string" && raw.length > 0) {
    try {
      const v = JSON.parse(raw);
      return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
    } catch {
      return [];
    }
  }
  return [];
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createExtendedClient> | undefined;
};

function createExtendedClient() {
  // Local dev → file:./dev.db. Production → a hosted libsql/Turso URL
  // (libsql://...) with an auth token. The same adapter handles both.
  const adapter = new PrismaLibSql({
    url: process.env.DATABASE_URL || "file:./prisma/dev.db",
    ...(process.env.DATABASE_AUTH_TOKEN ? { authToken: process.env.DATABASE_AUTH_TOKEN } : {}),
  });
  const base = new PrismaClient({ adapter });

  return base.$extends({
    name: "json-array-narrowing",
    result: {
      product: {
        images: { needs: { images: true }, compute: (p) => toStringArray(p.images) },
        sizes: { needs: { sizes: true }, compute: (p) => toStringArray(p.sizes) },
        colors: { needs: { colors: true }, compute: (p) => toStringArray(p.colors) },
        scents: { needs: { scents: true }, compute: (p) => toStringArray(p.scents) },
        materials: { needs: { materials: true }, compute: (p) => toStringArray(p.materials) },
        tags: { needs: { tags: true }, compute: (p) => toStringArray(p.tags) },
      },
      service: {
        images: { needs: { images: true }, compute: (s) => toStringArray(s.images) },
        tags: { needs: { tags: true }, compute: (s) => toStringArray(s.tags) },
      },
    },
  });
}

export const prisma = globalForPrisma.prisma ?? createExtendedClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
