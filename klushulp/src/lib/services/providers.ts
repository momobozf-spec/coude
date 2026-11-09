import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  availabilitySlot,
  booking,
  category,
  jobRequest,
  proposal,
  provider,
  providerCategory,
  providerVerification,
  requestMatch,
  review,
  timeOff,
  user,
  type ProviderType,
  type VerificationKind,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { findMunicipality } from "@/lib/catalog";
import { logEvent } from "@/lib/events";
import { providerPublicStats } from "./requests";

export class ProviderError extends Error {
  constructor(public code: "email_exists" | "invalid_kbo" | "unknown_postcode" | "category_not_allowed" | "incomplete" | "private_not_available" | "not_found") {
    super(code);
  }
}

export const KBO_RE = /^[01]\d{9}$/;

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(200),
  password: z.string().min(10).max(200),
  type: z.enum(["professional", "private"]),
  businessName: z.string().trim().max(120).optional().or(z.literal("")),
  kboNumber: z.string().trim().optional().or(z.literal("")),
  locale: z.enum(["nl", "fr"]).default("nl"),
  terms: z.literal(true),
});

export function normalizeKbo(input: string): string {
  return input.replace(/[^\d]/g, "");
}

/** Registratie dienstverlener: account + concept-profiel. Rol wordt server-side gezet. */
export async function registerProvider(input: z.infer<typeof registerSchema>) {
  if (input.type === "private") throw new ProviderError("private_not_available");
  const kbo = normalizeKbo(input.kboNumber ?? "");
  if (!KBO_RE.test(kbo)) throw new ProviderError("invalid_kbo");

  let userId: string;
  try {
    const res = await auth.api.signUpEmail({ body: { name: input.name, email: input.email, password: input.password } });
    userId = res.user.id;
  } catch (e) {
    if (e instanceof Error && /exist|already/i.test(e.message)) throw new ProviderError("email_exists");
    throw e;
  }
  await db.update(user).set({ platformRole: "provider", locale: input.locale, updatedAt: new Date() }).where(eq(user.id, userId));
  const [p] = await db
    .insert(provider)
    .values({ userId, type: input.type as ProviderType, displayName: input.businessName || input.name, businessName: input.businessName || null, kboNumber: kbo, status: "draft" })
    .returning();
  // KBO-verificatie wordt meteen aangevraagd; goedkeuring gebeurt door beheer na controle in de KBO.
  await db.insert(providerVerification).values({ providerId: p.id, kind: "kbo", reference: kbo, status: "pending" });
  await logEvent(db, { entityType: "provider", entityId: p.id, type: "registered", actorRole: "provider", actorUserId: userId });
  return p;
}

export const profileSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  bio: z.string().trim().max(1500).default(""),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  yearsExperience: z.number().int().min(0).max(70).nullable().default(null),
  hourlyRateCents: z.number().int().min(0).max(1_000_000).nullable().default(null),
  travelFeeCents: z.number().int().min(0).max(1_000_000).default(0),
  basePostcode: z.string().regex(/^[1-9]\d{3}$/),
  radiusKm: z.number().int().min(1).max(60),
  categories: z.array(z.object({ categoryId: z.string(), services: z.string().trim().max(500).default("") })).max(10),
  photoPath: z.string().optional().nullable(),
});

const CONTACT_IN_BIO = /(\+?\d[\d .-]{8,}\d)|(@\S+\.\S+)/;

export async function updateProfile(providerId: string, input: z.infer<typeof profileSchema>) {
  const muni = await findMunicipality(input.basePostcode);
  if (!muni) throw new ProviderError("unknown_postcode");
  const [p] = await db.select().from(provider).where(eq(provider.id, providerId)).limit(1);
  if (!p) throw new ProviderError("not_found");
  const cats = input.categories.length ? await db.select().from(category).where(inArray(category.id, input.categories.map((c) => c.categoryId))) : [];
  for (const c of cats) if (!c.allowedProviderTypes.includes(p.type)) throw new ProviderError("category_not_allowed");
  const bio = input.bio.replace(CONTACT_IN_BIO, "[verwijderd]");
  await db.transaction(async (tx) => {
    await tx
      .update(provider)
      .set({
        displayName: input.displayName,
        bio,
        phone: input.phone || null,
        yearsExperience: input.yearsExperience,
        hourlyRateCents: input.hourlyRateCents,
        travelFeeCents: input.travelFeeCents,
        basePostcode: muni.postcode,
        baseMunicipality: muni.nameNl,
        baseLat: muni.lat,
        baseLng: muni.lng,
        radiusKm: input.radiusKm,
        photoPath: input.photoPath === undefined ? p.photoPath : input.photoPath,
        updatedAt: new Date(),
      })
      .where(eq(provider.id, providerId));
    await tx.delete(providerCategory).where(eq(providerCategory.providerId, providerId));
    if (input.categories.length) await tx.insert(providerCategory).values(input.categories.map((c) => ({ providerId, categoryId: c.categoryId, services: c.services })));
  });
}

export const availabilitySchema = z.object({
  slots: z.array(z.object({ weekday: z.number().int().min(0).max(6), startMin: z.number().int().min(0).max(1439), endMin: z.number().int().min(1).max(1440) }).refine((s) => s.endMin > s.startMin)).max(30),
  timeOff: z.array(z.object({ dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), note: z.string().max(100).optional() }).refine((t) => t.dateTo >= t.dateFrom)).max(50),
});

export async function updateAvailability(providerId: string, input: z.infer<typeof availabilitySchema>) {
  await db.transaction(async (tx) => {
    await tx.delete(availabilitySlot).where(eq(availabilitySlot.providerId, providerId));
    await tx.delete(timeOff).where(eq(timeOff.providerId, providerId));
    if (input.slots.length) await tx.insert(availabilitySlot).values(input.slots.map((s) => ({ ...s, providerId })));
    if (input.timeOff.length) await tx.insert(timeOff).values(input.timeOff.map((t) => ({ providerId, dateFrom: t.dateFrom, dateTo: t.dateTo, note: t.note ?? null })));
  });
}

/** Profiel indienen voor controle: vereist categorieën, werkgebied en beschikbaarheid. */
export async function submitForReview(providerId: string) {
  const missing = await missingProfileFields(providerId);
  if (missing.length) throw new ProviderError("incomplete");
  await db.update(provider).set({ status: "pending", updatedAt: new Date() }).where(and(eq(provider.id, providerId), eq(provider.status, "draft")));
  await logEvent(db, { entityType: "provider", entityId: providerId, type: "submitted", actorRole: "provider" });
}

export async function missingProfileFields(providerId: string): Promise<string[]> {
  const [p] = await db.select().from(provider).where(eq(provider.id, providerId)).limit(1);
  if (!p) return ["profile"];
  const cats = await db.select().from(providerCategory).where(eq(providerCategory.providerId, providerId));
  const slots = await db.select().from(availabilitySlot).where(eq(availabilitySlot.providerId, providerId));
  const missing: string[] = [];
  if (!p.baseLat) missing.push("base");
  if (!cats.length) missing.push("categories");
  if (!slots.length) missing.push("availability");
  if (!p.bio) missing.push("bio");
  return missing;
}

export async function submitVerification(providerId: string, kind: VerificationKind, reference: string, documentPath: string | null) {
  await db
    .insert(providerVerification)
    .values({ providerId, kind, reference: reference || null, documentPath, status: "pending" })
    .onConflictDoUpdate({ target: [providerVerification.providerId, providerVerification.kind], set: { reference: reference || null, documentPath, status: "pending", note: null, reviewedAt: null, reviewedBy: null } });
}

export async function getProviderDashboardData(providerId: string) {
  const now = new Date();
  const matches = await db
    .select({ match: requestMatch, request: jobRequest, category })
    .from(requestMatch)
    .innerJoin(jobRequest, eq(jobRequest.id, requestMatch.requestId))
    .innerJoin(category, eq(category.id, jobRequest.categoryId))
    .where(and(eq(requestMatch.providerId, providerId), eq(jobRequest.status, "open")))
    .orderBy(desc(jobRequest.createdAt));
  const myProposals = await db.select().from(proposal).where(eq(proposal.providerId, providerId));
  const bookings = await db
    .select({ booking, request: jobRequest })
    .from(booking)
    .innerJoin(jobRequest, eq(jobRequest.id, booking.requestId))
    .where(eq(booking.providerId, providerId))
    .orderBy(desc(booking.scheduledStart));
  const open = matches.filter((m) => m.request.expiresAt > now);
  const responded = new Set(myProposals.map((p) => p.requestId));
  return {
    newRequests: open.filter((m) => !responded.has(m.request.id)),
    respondedRequests: open.filter((m) => responded.has(m.request.id)),
    proposals: myProposals,
    upcoming: bookings.filter((b) => ["confirmed", "in_progress"].includes(b.booking.status)),
    completed: bookings.filter((b) => b.booking.status === "completed"),
    other: bookings.filter((b) => ["cancelled", "disputed"].includes(b.booking.status)),
  };
}

/** Publiek profiel (secundaire route: zelf zoeken). Geen contactgegevens, geen basisadres. */
export async function getPublicProvider(providerId: string) {
  const [p] = await db.select().from(provider).where(and(eq(provider.id, providerId), eq(provider.status, "active"))).limit(1);
  if (!p) return null;
  const cats = await db.select({ pc: providerCategory, category }).from(providerCategory).innerJoin(category, eq(category.id, providerCategory.categoryId)).where(eq(providerCategory.providerId, providerId));
  const reviews = await db.select().from(review).where(and(eq(review.providerId, providerId), eq(review.visible, true))).orderBy(desc(review.createdAt)).limit(20);
  const stats = (await providerPublicStats([providerId]))[providerId];
  return { provider: p, categories: cats, reviews, stats };
}

export async function searchProviders(opts: { categoryId?: string | null; lat?: number | null; lng?: number | null }) {
  const { distanceKm } = await import("@/lib/geo");
  const q = db
    .select({ provider, pc: providerCategory })
    .from(provider)
    .innerJoin(providerCategory, eq(providerCategory.providerId, provider.id))
    .where(and(eq(provider.status, "active"), opts.categoryId ? eq(providerCategory.categoryId, opts.categoryId) : undefined))
    .$dynamic();
  const rows = await q;
  const byId = new Map<string, { provider: typeof provider.$inferSelect; distance: number | null }>();
  for (const r of rows) {
    if (byId.has(r.provider.id)) continue;
    const d = opts.lat != null && opts.lng != null && r.provider.baseLat != null && r.provider.baseLng != null ? distanceKm(opts.lat, opts.lng, r.provider.baseLat, r.provider.baseLng) : null;
    if (d != null && d > r.provider.radiusKm) continue;
    byId.set(r.provider.id, { provider: r.provider, distance: d == null ? null : Math.round(d * 10) / 10 });
  }
  const list = [...byId.values()].sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));
  const stats = await providerPublicStats(list.map((x) => x.provider.id));
  const cats = list.length ? await db.select({ pc: providerCategory, category }).from(providerCategory).innerJoin(category, eq(category.id, providerCategory.categoryId)).where(inArray(providerCategory.providerId, list.map((x) => x.provider.id))) : [];
  return list.map((x) => ({ ...x, stats: stats[x.provider.id], categories: cats.filter((c) => c.pc.providerId === x.provider.id) }));
}
