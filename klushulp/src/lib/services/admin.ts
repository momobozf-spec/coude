import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  booking,
  category,
  jobRequest,
  provider,
  providerCategory,
  providerVerification,
  region,
  report,
  review,
  user,
  type ReportStatus,
  type VerificationKind,
} from "@/db/schema";
import { logEvent } from "@/lib/events";

export class AdminError extends Error {
  constructor(public code: "missing_verifications" | "not_found") {
    super(code);
  }
}

export async function reviewVerification(verificationId: string, decision: "approved" | "rejected", adminUserId: string, note?: string) {
  await db
    .update(providerVerification)
    .set({ status: decision, note: note ?? null, reviewedBy: adminUserId, reviewedAt: new Date() })
    .where(eq(providerVerification.id, verificationId));
  const [v] = await db.select().from(providerVerification).where(eq(providerVerification.id, verificationId)).limit(1);
  if (v) await logEvent(db, { entityType: "provider", entityId: v.providerId, type: `verification_${decision}`, actorRole: "admin", actorUserId: adminUserId, payload: { kind: v.kind } });
}

/** Vereiste verificaties voor een dienstverlener = unie van de vereisten van zijn categorieën. */
export async function requiredVerificationsFor(providerId: string): Promise<VerificationKind[]> {
  const rows = await db.select({ category }).from(providerCategory).innerJoin(category, eq(category.id, providerCategory.categoryId)).where(eq(providerCategory.providerId, providerId));
  const set = new Set<VerificationKind>();
  for (const r of rows) for (const k of r.category.requiredVerifications) set.add(k);
  return [...set];
}

export async function missingRequiredVerifications(providerId: string): Promise<VerificationKind[]> {
  const required = await requiredVerificationsFor(providerId);
  if (!required.length) return [];
  const approved = await db
    .select({ kind: providerVerification.kind })
    .from(providerVerification)
    .where(and(eq(providerVerification.providerId, providerId), eq(providerVerification.status, "approved"), inArray(providerVerification.kind, required)));
  const ok = new Set(approved.map((a) => a.kind));
  return required.filter((k) => !ok.has(k));
}

/** Activeren kan enkel als alle vereiste verificaties goedgekeurd zijn. Badges volgen uit goedgekeurde verificaties, nooit uit status. */
export async function activateProvider(providerId: string, adminUserId: string) {
  const missing = await missingRequiredVerifications(providerId);
  if (missing.length) throw new AdminError("missing_verifications");
  await db.update(provider).set({ status: "active", suspendedReason: null, updatedAt: new Date() }).where(eq(provider.id, providerId));
  await logEvent(db, { entityType: "provider", entityId: providerId, type: "activated", actorRole: "admin", actorUserId: adminUserId });
}

export async function suspendProvider(providerId: string, adminUserId: string, reason: string) {
  await db.update(provider).set({ status: "suspended", suspendedReason: reason || null, updatedAt: new Date() }).where(eq(provider.id, providerId));
  await logEvent(db, { entityType: "provider", entityId: providerId, type: "suspended", actorRole: "admin", actorUserId: adminUserId, payload: { reason } });
}

export async function setReviewVisibility(reviewId: string, visible: boolean, adminUserId: string, note?: string) {
  await db.update(review).set({ visible, moderationNote: note ?? null }).where(eq(review.id, reviewId));
  await logEvent(db, { entityType: "review", entityId: reviewId, type: visible ? "shown" : "hidden", actorRole: "admin", actorUserId: adminUserId });
}

export async function updateReport(reportId: string, status: ReportStatus, adminNote: string, adminUserId: string) {
  await db.update(report).set({ status, adminNote: adminNote || null, updatedAt: new Date() }).where(eq(report.id, reportId));
  await logEvent(db, { entityType: "report", entityId: reportId, type: status, actorRole: "admin", actorUserId: adminUserId });
}

export async function toggleCategory(categoryId: string, active: boolean) {
  await db.update(category).set({ active }).where(eq(category.id, categoryId));
}

export async function toggleRegion(regionId: string, active: boolean) {
  await db.update(region).set({ active }).where(eq(region.id, regionId));
}

export async function adminOverview() {
  const count = async (q: Promise<{ n: number }[]>) => (await q)[0]?.n ?? 0;
  const [pendingProviders, pendingVerifications, openRequests, activeBookings, openReports] = await Promise.all([
    count(db.select({ n: sql<number>`count(*)::int` }).from(provider).where(eq(provider.status, "pending"))),
    count(db.select({ n: sql<number>`count(*)::int` }).from(providerVerification).where(eq(providerVerification.status, "pending"))),
    count(db.select({ n: sql<number>`count(*)::int` }).from(jobRequest).where(eq(jobRequest.status, "open"))),
    count(db.select({ n: sql<number>`count(*)::int` }).from(booking).where(inArray(booking.status, ["confirmed", "in_progress"]))),
    count(db.select({ n: sql<number>`count(*)::int` }).from(report).where(inArray(report.status, ["open", "in_review"]))),
  ]);
  return { pendingProviders, pendingVerifications, openRequests, activeBookings, openReports };
}

export async function listProvidersForAdmin() {
  return db.select({ provider, user }).from(provider).innerJoin(user, eq(user.id, provider.userId)).orderBy(desc(provider.createdAt));
}

export async function getProviderForAdmin(providerId: string) {
  const [row] = await db.select({ provider, user }).from(provider).innerJoin(user, eq(user.id, provider.userId)).where(eq(provider.id, providerId)).limit(1);
  if (!row) return null;
  const verifications = await db.select().from(providerVerification).where(eq(providerVerification.providerId, providerId));
  const cats = await db.select({ pc: providerCategory, category }).from(providerCategory).innerJoin(category, eq(category.id, providerCategory.categoryId)).where(eq(providerCategory.providerId, providerId));
  const missing = await missingRequiredVerifications(providerId);
  const required = await requiredVerificationsFor(providerId);
  return { ...row, verifications, categories: cats, missing, required };
}
