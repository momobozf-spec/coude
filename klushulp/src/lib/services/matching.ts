import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { availabilitySlot, provider, providerCategory, timeOff, type TimePreference } from "@/db/schema";
import { distanceKm } from "@/lib/geo";
import { firstAvailableDay } from "@/lib/availability";

export type MatchInput = {
  categoryId: string;
  lat: number;
  lng: number;
  dateFrom: string | null;
  dateTo: string | null;
  timePreference: TimePreference;
  /** Extra straal bovenop het werkgebied van de dienstverlener (uitbreiding door klant). */
  extraRadiusKm?: number;
  /** Negeer de gewenste periode (uitbreiding door klant). */
  ignoreDates?: boolean;
  excludeProviderIds?: string[];
};

export type MatchResult = { providerId: string; distanceKm: number; availableInWindow: boolean; firstSlot: { date: string; startMin: number; endMin: number } | null };

/**
 * Matcht actieve dienstverleners op categorie, werkgebied (basis + straal) en wekelijkse beschikbaarheid binnen de periode.
 * Geen aanbod = lege lijst; we verzinnen niets.
 */
export async function computeMatches(input: MatchInput): Promise<MatchResult[]> {
  const candidates = await db
    .select({ p: provider })
    .from(provider)
    .innerJoin(providerCategory, eq(providerCategory.providerId, provider.id))
    .where(and(eq(provider.status, "active"), eq(providerCategory.categoryId, input.categoryId)));

  const inRange = candidates
    .map(({ p }) => p)
    .filter((p) => p.baseLat != null && p.baseLng != null && !(input.excludeProviderIds ?? []).includes(p.id))
    .map((p) => ({ p, d: distanceKm(input.lat, input.lng, p.baseLat!, p.baseLng!) }))
    .filter(({ p, d }) => d <= p.radiusKm + (input.extraRadiusKm ?? 0));

  if (!inRange.length) return [];
  const ids = inRange.map((x) => x.p.id);
  const [slots, offs] = await Promise.all([
    db.select().from(availabilitySlot).where(inArray(availabilitySlot.providerId, ids)),
    db.select().from(timeOff).where(inArray(timeOff.providerId, ids)),
  ]);

  const results: MatchResult[] = [];
  for (const { p, d } of inRange) {
    const mySlots = slots.filter((s) => s.providerId === p.id);
    const myOff = offs.filter((o) => o.providerId === p.id);
    const inWindow = firstAvailableDay(mySlots, myOff, { dateFrom: input.dateFrom, dateTo: input.dateTo, timePreference: input.timePreference });
    const anySoon = inWindow ?? firstAvailableDay(mySlots, myOff, { timePreference: "any", horizonDays: 21 });
    const available = Boolean(inWindow);
    if (!available && !input.ignoreDates) continue;
    if (!anySoon) continue; // geen enkele beschikbaarheid de komende weken: niet tonen
    results.push({ providerId: p.id, distanceKm: Math.round(d * 10) / 10, availableInWindow: available, firstSlot: inWindow ?? anySoon });
  }
  // Dichtstbij eerst; beschikbaar-in-venster boven niet-beschikbaar.
  results.sort((a, b) => Number(b.availableInWindow) - Number(a.availableInWindow) || a.distanceKm - b.distanceKm);
  return results;
}
