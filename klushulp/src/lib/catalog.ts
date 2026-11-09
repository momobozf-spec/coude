import "server-only";
import { and, asc, eq, ilike, or } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { category, municipality, region } from "@/db/schema";

export const getCategories = cache(async (onlyActive = true) => {
  const rows = await db.select().from(category).orderBy(asc(category.sortOrder));
  return onlyActive ? rows.filter((c) => c.active) : rows;
});

export const getCategoryBySlug = cache(async (slug: string) => {
  const [c] = await db.select().from(category).where(eq(category.slug, slug)).limit(1);
  return c ?? null;
});

export const getActiveRegions = cache(async () => db.select().from(region).where(eq(region.active, true)));

/** Zoekt een gemeente op postcode (exact) of naam (begin van naam, NL of FR). */
export async function findMunicipalities(query: string, limit = 8) {
  const q = query.trim();
  if (!q) return [];
  const isPostcode = /^\d{4}$/.test(q);
  const rows = await db
    .select({
      postcode: municipality.postcode,
      nameNl: municipality.nameNl,
      nameFr: municipality.nameFr,
      lat: municipality.lat,
      lng: municipality.lng,
      regionId: municipality.regionId,
      regionActive: region.active,
      regionNameNl: region.nameNl,
      regionNameFr: region.nameFr,
    })
    .from(municipality)
    .innerJoin(region, eq(region.id, municipality.regionId))
    .where(isPostcode ? eq(municipality.postcode, q) : or(ilike(municipality.nameNl, `${q}%`), ilike(municipality.nameFr, `${q}%`)))
    .limit(limit);
  return rows;
}

export async function findMunicipality(postcode: string, name?: string | null) {
  const rows = await findMunicipalities(postcode, 20);
  if (!rows.length) return null;
  if (name) {
    const hit = rows.find((r) => r.nameNl.toLowerCase() === name.toLowerCase() || r.nameFr.toLowerCase() === name.toLowerCase());
    if (hit) return hit;
  }
  return rows[0];
}

/** Deterministische categoriesuggestie op trefwoorden; geen AI nodig. */
export function suggestCategory(description: string, cats: { slug: string; keywords: string[] }[]): string | null {
  const text = description.toLowerCase();
  let best: { slug: string; score: number } | null = null;
  for (const c of cats) {
    const score = c.keywords.reduce((n, kw) => (text.includes(kw.toLowerCase()) ? n + 1 : n), 0);
    if (score > 0 && (!best || score > best.score)) best = { slug: c.slug, score };
  }
  return best?.slug ?? null;
}

export const activeRegionNames = cache(async () => {
  const rows = await db.select().from(region).where(and(eq(region.active, true)));
  return rows;
});
