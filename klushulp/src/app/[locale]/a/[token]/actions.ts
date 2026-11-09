"use server";
import { revalidatePath } from "next/cache";
import { getRequestByToken, cancelRequest, expandRequest } from "@/lib/services/requests";
import { acceptProposal, ProposalError } from "@/lib/services/proposals";
import { transitionBooking, createReview, createReport, reviewInputSchema, reportInputSchema, BookingError } from "@/lib/services/bookings";
import { sendMessage, MessageError } from "@/lib/services/messages";
import { allowSubmission } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request-ip";

type Result = { ok: true } | { ok: false; error: string };

/** Alle klantacties lopen via het toegangstoken van de aanvraag: bezit van het token = toegang tot die ene aanvraag. */
async function withRequest(token: string) {
  const view = await getRequestByToken(token);
  if (!view) throw new Error("invalid_token");
  return view;
}

function refresh(locale: string, token: string) {
  revalidatePath(`/${locale}/a/${token}`);
}

export async function acceptProposalAction(locale: string, token: string, proposalId: string): Promise<Result> {
  try {
    const v = await withRequest(token);
    if (!v.proposals.some((p) => p.proposal.id === proposalId)) return { ok: false, error: "not_found" };
    await acceptProposal(v.request.id, proposalId, v.request.customerUserId);
    refresh(locale, token);
    return { ok: true };
  } catch (e) {
    if (e instanceof ProposalError) return { ok: false, error: e.code };
    return { ok: false, error: "generic" };
  }
}

export async function cancelRequestAction(locale: string, token: string): Promise<Result> {
  try {
    const v = await withRequest(token);
    await cancelRequest(v.request.id, "customer", v.request.customerUserId);
    refresh(locale, token);
    return { ok: true };
  } catch {
    return { ok: false, error: "generic" };
  }
}

export async function expandRequestAction(locale: string, token: string, opts: { extraRadiusKm: number; ignoreDates: boolean }): Promise<{ ok: true; added: number } | { ok: false; error: string }> {
  try {
    const v = await withRequest(token);
    const added = await expandRequest(v.request.id, { extraRadiusKm: Math.min(Math.max(opts.extraRadiusKm, 0), 30), ignoreDates: opts.ignoreDates });
    refresh(locale, token);
    return { ok: true, added };
  } catch {
    return { ok: false, error: "generic" };
  }
}

export async function sendCustomerMessageAction(locale: string, token: string, providerId: string, body: string): Promise<Result> {
  try {
    if (!(await allowSubmission(await clientIp(), "message"))) return { ok: false, error: "rate_limited" };
    const v = await withRequest(token);
    await sendMessage({ requestId: v.request.id, providerId, senderRole: "customer", senderUserId: v.request.customerUserId, body });
    refresh(locale, token);
    return { ok: true };
  } catch (e) {
    if (e instanceof MessageError) return { ok: false, error: e.code };
    return { ok: false, error: "generic" };
  }
}

export async function cancelBookingAction(locale: string, token: string, reason: string): Promise<Result> {
  try {
    const v = await withRequest(token);
    if (!v.booking) return { ok: false, error: "not_found" };
    await transitionBooking(v.booking.id, "cancelled", { role: "customer", userId: v.request.customerUserId }, { reason: reason.slice(0, 500) });
    refresh(locale, token);
    return { ok: true };
  } catch (e) {
    if (e instanceof BookingError) return { ok: false, error: e.code };
    return { ok: false, error: "generic" };
  }
}

export async function submitReviewAction(locale: string, token: string, input: { rating: number; body: string }): Promise<Result> {
  try {
    const v = await withRequest(token);
    if (!v.booking) return { ok: false, error: "not_found" };
    const parsed = reviewInputSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "validation" };
    await createReview(v.booking.id, parsed.data, v.request.contactName.split(" ")[0]);
    refresh(locale, token);
    return { ok: true };
  } catch (e) {
    if (e instanceof BookingError) return { ok: false, error: e.code };
    return { ok: false, error: "generic" };
  }
}

export async function submitReportAction(locale: string, token: string, input: { reason: string; details: string }): Promise<Result> {
  try {
    if (!(await allowSubmission(await clientIp(), "report"))) return { ok: false, error: "rate_limited" };
    const v = await withRequest(token);
    const parsed = reportInputSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "validation" };
    await createReport({ ...parsed.data, requestId: v.request.id, bookingId: v.booking?.id ?? null, providerId: v.booking?.providerId ?? null, reporterRole: "customer", reporterUserId: v.request.customerUserId, reporterContact: v.request.contactEmail });
    if (v.booking && ["confirmed", "in_progress", "completed"].includes(v.booking.status)) {
      try {
        await transitionBooking(v.booking.id, "disputed", { role: "customer", userId: v.request.customerUserId });
      } catch {}
    }
    refresh(locale, token);
    return { ok: true };
  } catch {
    return { ok: false, error: "generic" };
  }
}
