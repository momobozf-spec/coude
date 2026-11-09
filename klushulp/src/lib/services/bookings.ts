import "server-only";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { booking, jobRequest, report, review, type BookingStatus } from "@/db/schema";
import { logEvent } from "@/lib/events";

export class BookingError extends Error {
  constructor(public code: "not_found" | "bad_transition" | "not_completed" | "already_reviewed" | "forbidden") {
    super(code);
  }
}

const TRANSITIONS: Record<string, BookingStatus[]> = {
  confirmed: ["in_progress", "completed", "cancelled"],
  in_progress: ["completed", "cancelled", "disputed"],
  completed: ["disputed"],
  cancelled: [],
  disputed: ["completed", "cancelled"],
};

export async function transitionBooking(
  bookingId: string,
  to: BookingStatus,
  actor: { role: "customer" | "provider" | "admin"; userId?: string | null; providerId?: string | null },
  extra?: { reason?: string },
) {
  await db.transaction(async (tx) => {
    const [bk] = await tx.select().from(booking).where(eq(booking.id, bookingId)).for("update");
    if (!bk) throw new BookingError("not_found");
    if (actor.role === "provider" && bk.providerId !== actor.providerId) throw new BookingError("forbidden");
    // Klant mag enkel annuleren of een geschil openen; dienstverlener mag starten/afronden/annuleren.
    if (actor.role === "customer" && !["cancelled", "disputed"].includes(to)) throw new BookingError("forbidden");
    if (!TRANSITIONS[bk.status]?.includes(to)) throw new BookingError("bad_transition");
    const now = new Date();
    await tx
      .update(booking)
      .set({
        status: to,
        updatedAt: now,
        completedAt: to === "completed" ? now : bk.completedAt,
        cancelledBy: to === "cancelled" ? actor.role : bk.cancelledBy,
        cancelReason: to === "cancelled" ? extra?.reason ?? null : bk.cancelReason,
      })
      .where(eq(booking.id, bookingId));
    if (to === "completed") await tx.update(jobRequest).set({ status: "completed", updatedAt: now }).where(eq(jobRequest.id, bk.requestId));
    if (to === "cancelled") await tx.update(jobRequest).set({ status: "cancelled", updatedAt: now }).where(eq(jobRequest.id, bk.requestId));
    await logEvent(tx, { entityType: "booking", entityId: bookingId, type: to, actorRole: actor.role, actorUserId: actor.userId, payload: extra ?? {} });
  });
}

export const reviewInputSchema = z.object({ rating: z.number().int().min(1).max(5), body: z.string().trim().max(2000).default("") });

/** Eén beoordeling per boeking, enkel bij status 'completed'. Unieke index op booking_id is de harde grens. */
export async function createReview(bookingId: string, input: z.infer<typeof reviewInputSchema>, authorName: string) {
  return db.transaction(async (tx) => {
    const [bk] = await tx.select().from(booking).where(eq(booking.id, bookingId)).for("update");
    if (!bk) throw new BookingError("not_found");
    if (bk.status !== "completed") throw new BookingError("not_completed");
    const [existing] = await tx.select().from(review).where(eq(review.bookingId, bookingId)).limit(1);
    if (existing) throw new BookingError("already_reviewed");
    const [r] = await tx.insert(review).values({ bookingId, providerId: bk.providerId, rating: input.rating, body: input.body, authorName }).returning();
    await logEvent(tx, { entityType: "review", entityId: r.id, type: "created", actorRole: "customer", payload: { bookingId, rating: input.rating } });
    return r;
  });
}

export const reportInputSchema = z.object({
  reason: z.enum(["no_show", "quality", "price", "behaviour", "other"]),
  details: z.string().trim().max(3000).default(""),
});

export async function createReport(input: z.infer<typeof reportInputSchema> & { requestId?: string | null; bookingId?: string | null; providerId?: string | null; reporterRole: "customer" | "provider"; reporterUserId?: string | null; reporterContact?: string | null }) {
  const [r] = await db
    .insert(report)
    .values({
      requestId: input.requestId ?? null,
      bookingId: input.bookingId ?? null,
      providerId: input.providerId ?? null,
      reporterRole: input.reporterRole,
      reporterUserId: input.reporterUserId ?? null,
      reporterContact: input.reporterContact ?? null,
      reason: input.reason,
      details: input.details,
    })
    .returning();
  await logEvent(db, { entityType: "report", entityId: r.id, type: "created", actorRole: input.reporterRole, payload: { reason: input.reason } });
  return r;
}

export async function getBookingForProvider(providerId: string, bookingId: string) {
  const [bk] = await db.select().from(booking).where(and(eq(booking.id, bookingId), eq(booking.providerId, providerId))).limit(1);
  return bk ?? null;
}
