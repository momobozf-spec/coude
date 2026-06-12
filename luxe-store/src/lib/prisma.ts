import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

// Local-dev SQLite client (Prisma 7 requires a driver adapter).
// images and shippingAddress are stored as JSON-encoded strings; this file
// wraps PrismaClient with $extends so the rest of the app keeps using
// arrays/objects.

type AnyData = Record<string, unknown>;

function parseList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== "string" || raw.length === 0) return [];
  try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; }
}
function parseJson(raw: unknown): unknown {
  if (raw == null) return null;
  if (typeof raw !== "string") return raw;
  try { return JSON.parse(raw); } catch { return null; }
}
function stringifyData(data: AnyData | undefined, arrayKeys: readonly string[], jsonKeys: readonly string[]): AnyData | undefined {
  if (!data) return data;
  const out: AnyData = { ...data };
  for (const k of arrayKeys) if (Array.isArray(out[k])) out[k] = JSON.stringify(out[k]);
  for (const k of jsonKeys) {
    const v = out[k];
    if (v != null && typeof v !== "string") out[k] = JSON.stringify(v);
  }
  return out;
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createExtendedClient> | undefined;
};

function createExtendedClient() {
  const adapter = new PrismaLibSQL({ url: process.env.DATABASE_URL || "file:./prisma/dev.db" });
  const base = new PrismaClient({ adapter });

  return base.$extends({
    name: "sqlite-json-fields",
    result: {
      product: {
        images: { needs: { images: true }, compute: (p: { images: string }) => parseList(p.images) as string[] },
      },
      order: {
        shippingAddress: {
          needs: { shippingAddress: true },
          compute: (o: { shippingAddress: string | null }) => parseJson(o.shippingAddress),
        },
      },
    },
    query: {
      product: {
        async create({ args, query }) { args.data = stringifyData(args.data as AnyData, ["images"], []) as typeof args.data; return query(args); },
        async update({ args, query }) { args.data = stringifyData(args.data as AnyData, ["images"], []) as typeof args.data; return query(args); },
        async upsert({ args, query }) {
          args.create = stringifyData(args.create as AnyData, ["images"], []) as typeof args.create;
          args.update = stringifyData(args.update as AnyData, ["images"], []) as typeof args.update;
          return query(args);
        },
        async createMany({ args, query }) {
          if (Array.isArray(args.data)) args.data = args.data.map((d) => stringifyData(d as AnyData, ["images"], [])) as typeof args.data;
          return query(args);
        },
      },
      order: {
        async create({ args, query }) { args.data = stringifyData(args.data as AnyData, [], ["shippingAddress"]) as typeof args.data; return query(args); },
        async update({ args, query }) { args.data = stringifyData(args.data as AnyData, [], ["shippingAddress"]) as typeof args.data; return query(args); },
        async upsert({ args, query }) {
          args.create = stringifyData(args.create as AnyData, [], ["shippingAddress"]) as typeof args.create;
          args.update = stringifyData(args.update as AnyData, [], ["shippingAddress"]) as typeof args.update;
          return query(args);
        },
      },
    },
  });
}

export const prisma = globalForPrisma.prisma ?? createExtendedClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
