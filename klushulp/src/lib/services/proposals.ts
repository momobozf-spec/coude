import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { booking, jobRequest, proposal, requestMatch, type PriceType } from "@/db/schema";
import { feeReference, platformFee } from "@/lib/money";
import { getFeeConfig } from "@/lib/fees";
import { logEvent } from "@/lib/events";
import { getPaymentProvider } from "@/lib/payments";

export const proposalInputSchema = z
  .object({
    priceType: z.enum(["fixed", "hourly", "estimate", "inspection"]),
    amountCents: z.number().int().min(0).max(10_000_000).nullable().default(null),
    amountMinCents: z.number().int().min(0).max(10_000_000).nullable().default(null),
    amountMaxCents: z.number().int().min(0).max(10_000_000).nullable().default(null),
    hourlyRateCents: z.number().int().min(0).max(1_000_000).nullable().default(null),
    estimatedHoursMin: z.number().int().min(1).max(500).nullable().default(null),
    estimatedHoursMax: z.number().int().min(1).max(500).nullable().default(null),
    travelFeeCents: z.number().int().min(0).max(1_000_000).default(0),
    materialsIncluded: z.boolean().default(false),
    materialsNote: z.string().trim().max(500).optional().or(z.literal("")),
    included: z.string().trim().max(1000).default(""),
    excluded: z.string().trim().max(1000).default(""),
    proposedStart: z.string().datetime({ offset: true }),
    durationHours: z.number().min(0.5).max(48),
    message: z.string().trim().max(2000).default(""),
  })
  .superRefine((p, ctx) => {
    const bad = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if ((p.priceType === "fixed" || p.priceType === "inspection") && p.amountCents == null) bad("amountCents", "invalid_amount");
    if (p.priceType === "fixed" && (p.amountCents ?? 0) <= 0) bad("amountCents", "invalid_amount");
    if (p.priceType === "estimate") {
      if (p.amountMinCents == null || p.amountMaxCents == null || p.amountMinCents <= 0) bad("amountMinCents", "invalid_amount");
      else if (p.amountMaxCents < p.amountMinCents) bad("amountMaxCents", "invalid_range");
    }
    if (p.priceType === "hourly") {
      if (!p.hourlyRateCents || p.hourlyRateCents <= 0) bad("hourlyRateCents", "invalid_amount");
      if (p.estimatedHoursMin == null || p.estimatedHoursMax == null) bad("estimatedHoursMin", "invalid_amount");
      else if (p.estimatedHoursMax < p.estimatedHoursMin) bad("estimatedHoursMax", "invalid_range");
    }
  });
export type ProposalInput = z.infer<typeof proposalInputSchema>;

export class ProposalError extends Error {
  constructor(public code: "not_matched" | "request_closed" | "already_sent" | "invalid_start" | "not_found" | "already_booked" | "not_open") {
    super(code);
  }
}

/** Dienstverlener mag enkel reageren op aanvragen waarvoor een match bestaat (autorisatie steunt op request_match). */
export async function assertProviderCanSeeRequest(providerId: string, requestId: string) {
  const [m] = await db.select().from(requestMatch).where(and(eq(requestMatch.requestId, requestId), eq(requestMatch.providerId, providerId))).limit(1);
  if (!m) throw new ProposalError("not_matched");
  return m;
}

export async function sendProposal(providerId: string, requestId: string, input: ProposalInput, now = new Date()) {
  await assertProviderCanSeeRequest(providerId, requestId);
  const [req] = await db.select().from(jobRequest).where(eq(jobRequest.id, requestId)).limit(1);
  if (!req || req.status !== "open" || req.expiresAt < now) throw new ProposalError("request_closed");
  const start = new Date(input.proposedStart);
  if (!(start.getTime() > now.getTime())) throw new ProposalError("invalid_start");
  const end = new Date(start.getTime() + input.durationHours * 3600 * 1000);
  const fee = await getFeeConfig();
  const feeCents = platformFee(feeReference(input), fee.feeBps, fee.feeMinCents);

  try {
    return await db.transaction(async (tx) => {
      const [p] = await tx
        .insert(proposal)
        .values({
          requestId,
          providerId,
          priceType: input.priceType as PriceType,
          amountCents: input.amountCents,
          amountMinCents: input.amountMinCents,
          amountMaxCents: input.amountMaxCents,
          hourlyRateCents: input.hourlyRateCents,
          estimatedHoursMin: input.estimatedHoursMin,
          estimatedHoursMax: input.estimatedHoursMax,
          travelFeeCents: input.travelFeeCents,
          materialsIncluded: input.materialsIncluded,
          materialsNote: input.materialsNote || null,
          included: input.included,
          excluded: input.excluded,
          proposedStart: start,
          proposedEnd: end,
          message: input.message,
          platformFeeCents: feeCents,
        })
        .returning();
      await logEvent(tx, { entityType: "proposal", entityId: p.id, type: "sent", actorRole: "provider", payload: { requestId, priceType: input.priceType, feeCents } });
      return p;
    });
  } catch (e) {
    // Drizzle verpakt de pg-fout; de unieke index is de harde grens tegen dubbele voorstellen.
    const cause = (e as { cause?: { code?: string; constraint?: string } })?.cause;
    if (cause?.code === "23505" || /proposal_request_provider_uq/.test(String(cause?.constraint ?? (e as Error)?.message ?? ""))) throw new ProposalError("already_sent");
    throw e;
  }
}

export async function withdrawProposal(providerId: string, proposalId: string) {
  await db.transaction(async (tx) => {
    const [p] = await tx.select().from(proposal).where(and(eq(proposal.id, proposalId), eq(proposal.providerId, providerId))).for("update");
    if (!p) throw new ProposalError("not_found");
    if (p.status !== "sent") throw new ProposalError("not_open");
    await tx.update(proposal).set({ status: "withdrawn", updatedAt: new Date() }).where(eq(proposal.id, proposalId));
    await logEvent(tx, { entityType: "proposal", entityId: proposalId, type: "withdrawn", actorRole: "provider" });
  });
}

/**
 * Klant accepteert een voorstel. Garanties:
 * - aanvraag wordt gelockt (FOR UPDATE), moet open zijn;
 * - unieke booking.request_id maakt een tweede boeking fysiek onmogelijk;
 * - andere voorstellen gaan naar 'declined'.
 * Platformkosten worden geregistreerd via de betalingsgrens (nu gesimuleerd en zo gemarkeerd).
 */
export async function acceptProposal(requestId: string, proposalId: string, actorUserId?: string | null) {
  const pay = getPaymentProvider();
  const created = await db.transaction(async (tx) => {
    const [req] = await tx.select().from(jobRequest).where(eq(jobRequest.id, requestId)).for("update");
    if (!req) throw new ProposalError("not_found");
    if (req.status !== "open") throw new ProposalError("already_booked");
    const [p] = await tx.select().from(proposal).where(and(eq(proposal.id, proposalId), eq(proposal.requestId, requestId))).for("update");
    if (!p) throw new ProposalError("not_found");
    if (p.status !== "sent") throw new ProposalError("not_open");

    const [bk] = await tx
      .insert(booking)
      .values({
        requestId,
        proposalId,
        providerId: p.providerId,
        customerUserId: req.customerUserId,
        scheduledStart: p.proposedStart,
        scheduledEnd: p.proposedEnd,
        platformFeeCents: p.platformFeeCents,
        paymentStatus: "not_applicable",
        paymentProvider: "none",
      })
      .returning();
    await tx.update(proposal).set({ status: "accepted", updatedAt: new Date() }).where(eq(proposal.id, proposalId));
    await tx.update(proposal).set({ status: "declined", updatedAt: new Date() }).where(and(eq(proposal.requestId, requestId), ne(proposal.id, proposalId), eq(proposal.status, "sent")));
    await tx.update(jobRequest).set({ status: "booked", updatedAt: new Date() }).where(eq(jobRequest.id, requestId));
    await logEvent(tx, { entityType: "booking", entityId: bk.id, type: "confirmed", actorRole: "customer", actorUserId, payload: { proposalId, providerId: p.providerId } });
    return bk;
  });

  // Platformkosten registreren buiten de transactie: een falende betaalprovider mag de afspraak niet ongedaan maken.
  try {
    const charge = await pay.chargePlatformFee({ bookingId: created.id, providerId: created.providerId, amountCents: created.platformFeeCents });
    await db.update(booking).set({ paymentStatus: charge.status, paymentProvider: charge.provider, paymentReference: charge.reference, updatedAt: new Date() }).where(eq(booking.id, created.id));
  } catch (e) {
    await db.update(booking).set({ paymentStatus: "failed", paymentProvider: pay.name, updatedAt: new Date() }).where(eq(booking.id, created.id));
    await logEvent(db, { entityType: "booking", entityId: created.id, type: "fee_charge_failed", payload: { error: String(e) } });
  }
  return created;
}
