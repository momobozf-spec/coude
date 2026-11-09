import "server-only";
import { and, eq, inArray, desc } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  category,
  jobPhoto,
  jobRequest,
  provider,
  proposal,
  requestMatch,
  review,
  booking,
  type TimePreference,
} from "@/db/schema";
import { findMunicipality } from "@/lib/catalog";
import { newAccessToken } from "@/lib/tokens";
import { logEvent } from "@/lib/events";
import { computeMatches } from "./matching";
import { isoDate } from "@/lib/availability";

export const REQUEST_TTL_DAYS = 14;
export const MAX_PHOTOS = 5;
export const MIN_DESCRIPTION = 20;

export const requestInputSchema = z.object({
  categorySlug: z.string().min(1),
  description: z.string().trim().min(MIN_DESCRIPTION).max(3000),
  answers: z.record(z.string(), z.string().max(500)).default({}),
  postcode: z.string().regex(/^[1-9]\d{3}$/),
  municipality: z.string().trim().min(1).max(80).optional(),
  streetAddress: z.string().trim().max(200).optional().or(z.literal("")),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  timePreference: z.enum(["any", "morning", "afternoon", "evening"]).default("any"),
  urgent: z.boolean().default(false),
  contactName: z.string().trim().min(2).max(80),
  contactEmail: z.string().trim().email().max(200),
  contactPhone: z.string().trim().max(40).optional().or(z.literal("")),
  locale: z.enum(["nl", "fr"]).default("nl"),
  consent: z.literal(true),
  /** Secundaire route: aanvraag gericht aan één dienstverlener. */
  targetProviderId: z.string().optional(),
  photoPaths: z.array(z.object({ path: z.string(), mimeType: z.string(), sizeBytes: z.number().int() })).max(MAX_PHOTOS).default([]),
});
export type RequestInput = z.infer<typeof requestInputSchema>;

export class RequestError extends Error {
  constructor(public code: "unknown_postcode" | "region_inactive" | "unknown_category" | "bad_dates" | "unknown_provider" | "provider_not_matching") {
    super(code);
  }
}

function validateDates(dateFrom?: string, dateTo?: string, today = new Date()) {
  const from = dateFrom || null;
  const to = dateTo || null;
  if (!from && !to) return { from: null, to: null };
  const t = isoDate(today);
  const f = from ?? t;
  const e = to ?? f;
  if (f < t || e < f) throw new RequestError("bad_dates");
  return { from: f, to: e };
}

export async function createRequest(input: RequestInput, opts?: { customerUserId?: string | null; isDemo?: boolean; now?: Date }) {
  const now = opts?.now ?? new Date();
  const cat = (await db.select().from(category).where(and(eq(category.slug, input.categorySlug), eq(category.active, true))).limit(1))[0];
  if (!cat) throw new RequestError("unknown_category");
  const muni = await findMunicipality(input.postcode, input.municipality);
  if (!muni) throw new RequestError("unknown_postcode");
  if (!muni.regionActive) throw new RequestError("region_inactive");
  const { from, to } = validateDates(input.dateFrom || undefined, input.dateTo || undefined, now);

  let targetProvider: typeof provider.$inferSelect | null = null;
  if (input.targetProviderId) {
    targetProvider = (await db.select().from(provider).where(and(eq(provider.id, input.targetProviderId), eq(provider.status, "active"))).limit(1))[0] ?? null;
    if (!targetProvider) throw new RequestError("unknown_provider");
  }

  const matches = await computeMatches({
    categoryId: cat.id,
    lat: muni.lat,
    lng: muni.lng,
    dateFrom: from,
    dateTo: to,
    timePreference: input.timePreference as TimePreference,
    // Gerichte aanvraag: ook tonen als de datum niet in de gewone beschikbaarheid valt; de dienstverlener beslist zelf.
    ignoreDates: Boolean(targetProvider),
  });
  const selected = targetProvider ? matches.filter((m) => m.providerId === targetProvider!.id) : matches;
  if (targetProvider && !selected.length) throw new RequestError("provider_not_matching");

  const token = newAccessToken();
  const expiresAt = new Date(now.getTime() + REQUEST_TTL_DAYS * 24 * 3600 * 1000);

  const created = await db.transaction(async (tx) => {
    const [req] = await tx
      .insert(jobRequest)
      .values({
        accessToken: token,
        customerUserId: opts?.customerUserId ?? null,
        categoryId: cat.id,
        regionId: muni.regionId,
        description: input.description,
        answers: input.answers,
        postcode: muni.postcode,
        municipality: muni.nameNl,
        lat: muni.lat,
        lng: muni.lng,
        streetAddress: input.streetAddress || null,
        dateFrom: from,
        dateTo: to,
        timePreference: input.timePreference as TimePreference,
        urgent: input.urgent,
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone || null,
        locale: input.locale,
        matchCount: selected.length,
        isDemo: opts?.isDemo ?? false,
        expiresAt,
      })
      .returning();
    if (input.photoPaths.length) {
      await tx.insert(jobPhoto).values(input.photoPaths.map((p) => ({ requestId: req.id, path: p.path, mimeType: p.mimeType, sizeBytes: p.sizeBytes })));
    }
    if (selected.length) {
      await tx.insert(requestMatch).values(
        selected.map((m) => ({ requestId: req.id, providerId: m.providerId, distanceKm: m.distanceKm, availableInWindow: m.availableInWindow, source: targetProvider ? "customer" : "auto" })),
      );
    }
    await logEvent(tx, { entityType: "request", entityId: req.id, type: "created", actorRole: "customer", payload: { matches: selected.length, targeted: Boolean(targetProvider) } });
    return req;
  });
  return { request: created, matchCount: selected.length };
}

/** Klant breidt een aanvraag uit: grotere straal en/of andere data. Voegt enkel nieuwe matches toe. */
export async function expandRequest(requestId: string, opts: { extraRadiusKm: number; ignoreDates: boolean }) {
  const req = (await db.select().from(jobRequest).where(eq(jobRequest.id, requestId)).limit(1))[0];
  if (!req || req.status !== "open" || req.lat == null || req.lng == null) return 0;
  const existing = await db.select({ providerId: requestMatch.providerId }).from(requestMatch).where(eq(requestMatch.requestId, requestId));
  const matches = await computeMatches({
    categoryId: req.categoryId,
    lat: req.lat,
    lng: req.lng,
    dateFrom: req.dateFrom,
    dateTo: req.dateTo,
    timePreference: req.timePreference,
    extraRadiusKm: opts.extraRadiusKm,
    ignoreDates: opts.ignoreDates,
    excludeProviderIds: existing.map((e) => e.providerId),
  });
  if (!matches.length) return 0;
  await db.transaction(async (tx) => {
    await tx.insert(requestMatch).values(matches.map((m) => ({ requestId, providerId: m.providerId, distanceKm: m.distanceKm, availableInWindow: m.availableInWindow, source: "expanded" })));
    await tx.update(jobRequest).set({ matchCount: req.matchCount + matches.length, updatedAt: new Date() }).where(eq(jobRequest.id, requestId));
    await logEvent(tx, { entityType: "request", entityId: requestId, type: "expanded", actorRole: "customer", payload: { added: matches.length, ...opts } });
  });
  return matches.length;
}

/** Volledige klantweergave via toegangstoken. Geeft null bij ongeldig token. */
export async function getRequestByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{40,50}$/.test(token)) return null;
  const req = (await db.select().from(jobRequest).where(eq(jobRequest.accessToken, token)).limit(1))[0];
  if (!req) return null;
  return loadRequestView(req);
}

export async function getRequestById(id: string) {
  const req = (await db.select().from(jobRequest).where(eq(jobRequest.id, id)).limit(1))[0];
  return req ? loadRequestView(req) : null;
}

async function loadRequestView(req: typeof jobRequest.$inferSelect) {
  const [cat] = await db.select().from(category).where(eq(category.id, req.categoryId)).limit(1);
  const photos = await db.select().from(jobPhoto).where(eq(jobPhoto.requestId, req.id));
  const props = await db
    .select({ proposal, provider })
    .from(proposal)
    .innerJoin(provider, eq(provider.id, proposal.providerId))
    .where(eq(proposal.requestId, req.id))
    .orderBy(desc(proposal.createdAt));
  const bk = (await db.select().from(booking).where(eq(booking.requestId, req.id)).limit(1))[0] ?? null;
  const rv = bk ? ((await db.select().from(review).where(eq(review.bookingId, bk.id)).limit(1))[0] ?? null) : null;
  const providerIds = props.map((p) => p.provider.id);
  const stats = providerIds.length ? await providerPublicStats(providerIds) : {};
  return { request: req, category: cat, photos, proposals: props.map((p) => ({ ...p, stats: stats[p.provider.id] })), booking: bk, review: rv };
}

export type ProviderStats = { reviewCount: number; avgRating: number | null; completedJobs: number; verifications: string[] };

/** Publieke, controleerbare cijfers per dienstverlener: enkel uit afgeronde platformboekingen en goedgekeurde verificaties. */
export async function providerPublicStats(providerIds: string[]): Promise<Record<string, ProviderStats>> {
  if (!providerIds.length) return {};
  const { providerVerification } = await import("@/db/schema");
  const [reviews, bookings, vers] = await Promise.all([
    db.select({ providerId: review.providerId, rating: review.rating }).from(review).where(and(inArray(review.providerId, providerIds), eq(review.visible, true))),
    db.select({ providerId: booking.providerId }).from(booking).where(and(inArray(booking.providerId, providerIds), eq(booking.status, "completed"))),
    db.select({ providerId: providerVerification.providerId, kind: providerVerification.kind }).from(providerVerification).where(and(inArray(providerVerification.providerId, providerIds), eq(providerVerification.status, "approved"))),
  ]);
  const out: Record<string, ProviderStats> = {};
  for (const id of providerIds) {
    const r = reviews.filter((x) => x.providerId === id);
    out[id] = {
      reviewCount: r.length,
      avgRating: r.length ? Math.round((r.reduce((s, x) => s + x.rating, 0) / r.length) * 10) / 10 : null,
      completedJobs: bookings.filter((b) => b.providerId === id).length,
      verifications: vers.filter((v) => v.providerId === id).map((v) => v.kind),
    };
  }
  return out;
}

export async function cancelRequest(requestId: string, actorRole: "customer" | "admin", actorUserId?: string | null) {
  await db.transaction(async (tx) => {
    const [req] = await tx.select().from(jobRequest).where(eq(jobRequest.id, requestId)).for("update");
    if (!req || req.status !== "open") return;
    await tx.update(jobRequest).set({ status: "cancelled", updatedAt: new Date() }).where(eq(jobRequest.id, requestId));
    await tx.update(proposal).set({ status: "expired", updatedAt: new Date() }).where(and(eq(proposal.requestId, requestId), eq(proposal.status, "sent")));
    await logEvent(tx, { entityType: "request", entityId: requestId, type: "cancelled", actorRole, actorUserId });
  });
}
