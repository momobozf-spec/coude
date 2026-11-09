import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { platformSetting } from "@/db/schema";
import { env } from "./env";

export type FeeConfig = { feeBps: number; feeMinCents: number };

/** Platforminstelling uit de database, met .env als standaard. */
export async function getFeeConfig(): Promise<FeeConfig> {
  const rows = await db.select().from(platformSetting);
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    feeBps: map.fee_bps ? Number.parseInt(map.fee_bps, 10) : env.platformFeeBps,
    feeMinCents: map.fee_min_cents ? Number.parseInt(map.fee_min_cents, 10) : env.platformFeeMinCents,
  };
}

export async function setSetting(key: string, value: string) {
  await db
    .insert(platformSetting)
    .values({ key, value })
    .onConflictDoUpdate({ target: platformSetting.key, set: { value, updatedAt: new Date() } });
}

export async function getSetting(key: string): Promise<string | null> {
  const [r] = await db.select().from(platformSetting).where(eq(platformSetting.key, key)).limit(1);
  return r?.value ?? null;
}

export function formatBps(bps: number): string {
  return `${(bps / 100).toLocaleString("nl-BE", { maximumFractionDigits: 2 })} %`;
}
