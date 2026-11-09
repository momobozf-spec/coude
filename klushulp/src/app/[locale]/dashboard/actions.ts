"use server";
import { revalidatePath } from "next/cache";
import { getCurrentProvider } from "@/lib/session";
import { proposalInputSchema, sendProposal, withdrawProposal, ProposalError, assertProviderCanSeeRequest } from "@/lib/services/proposals";
import { transitionBooking, BookingError, getBookingForProvider } from "@/lib/services/bookings";
import { sendMessage, MessageError } from "@/lib/services/messages";
import { profileSchema, updateProfile, availabilitySchema, updateAvailability, submitForReview, submitVerification, ProviderError, missingProfileFields } from "@/lib/services/providers";
import { saveUpload, UploadError } from "@/lib/uploads";
import type { BookingStatus, VerificationKind } from "@/db/schema";

type Result = { ok: true } | { ok: false; error: string; field?: string };

async function me() {
  const cp = await getCurrentProvider();
  if (!cp) throw new Error("unauthenticated");
  return cp;
}

export async function sendProposalAction(locale: string, requestId: string, raw: unknown): Promise<Result> {
  const parsed = proposalInputSchema.safeParse(raw);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { ok: false, error: i?.message === "invalid_range" ? "invalid_range" : "invalid_amount", field: String(i?.path?.[0] ?? "") };
  }
  try {
    const { provider } = await me();
    if (provider.status !== "active") return { ok: false, error: "not_active" };
    await sendProposal(provider.id, requestId, parsed.data);
    revalidatePath(`/${locale}/dashboard`, "layout");
    return { ok: true };
  } catch (e) {
    if (e instanceof ProposalError) return { ok: false, error: e.code };
    throw e;
  }
}

export async function withdrawProposalAction(locale: string, proposalId: string): Promise<Result> {
  try {
    const { provider } = await me();
    await withdrawProposal(provider.id, proposalId);
    revalidatePath(`/${locale}/dashboard`, "layout");
    return { ok: true };
  } catch (e) {
    if (e instanceof ProposalError) return { ok: false, error: e.code };
    throw e;
  }
}

export async function providerMessageAction(locale: string, requestId: string, body: string): Promise<Result> {
  try {
    const { provider, user } = await me();
    await assertProviderCanSeeRequest(provider.id, requestId);
    await sendMessage({ requestId, providerId: provider.id, senderRole: "provider", senderUserId: user.id, body });
    revalidatePath(`/${locale}/dashboard`, "layout");
    return { ok: true };
  } catch (e) {
    if (e instanceof MessageError || e instanceof ProposalError) return { ok: false, error: e.code };
    throw e;
  }
}

export async function bookingTransitionAction(locale: string, bookingId: string, to: BookingStatus, reason?: string): Promise<Result> {
  try {
    const { provider, user } = await me();
    if (!(await getBookingForProvider(provider.id, bookingId))) return { ok: false, error: "forbidden" };
    await transitionBooking(bookingId, to, { role: "provider", userId: user.id, providerId: provider.id }, { reason });
    revalidatePath(`/${locale}/dashboard`, "layout");
    return { ok: true };
  } catch (e) {
    if (e instanceof BookingError) return { ok: false, error: e.code };
    throw e;
  }
}

export async function updateProfileAction(locale: string, raw: unknown): Promise<Result> {
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "validation", field: String(parsed.error.issues[0]?.path?.[0] ?? "") };
  try {
    const { provider } = await me();
    await updateProfile(provider.id, parsed.data);
    revalidatePath(`/${locale}/dashboard`, "layout");
    return { ok: true };
  } catch (e) {
    if (e instanceof ProviderError) return { ok: false, error: e.code };
    throw e;
  }
}

export async function uploadProfilePhotoAction(formData: FormData): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  await me();
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "no_file" };
  try {
    const saved = await saveUpload(file, "photo");
    return { ok: true, path: saved.path };
  } catch (e) {
    if (e instanceof UploadError) return { ok: false, error: e.message };
    throw e;
  }
}

export async function updateAvailabilityAction(locale: string, raw: unknown): Promise<Result> {
  const parsed = availabilitySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "validation" };
  const { provider } = await me();
  await updateAvailability(provider.id, parsed.data);
  revalidatePath(`/${locale}/dashboard`, "layout");
  return { ok: true };
}

export async function submitForReviewAction(locale: string): Promise<Result & { missing?: string[] }> {
  const { provider } = await me();
  const missing = await missingProfileFields(provider.id);
  if (missing.length) return { ok: false, error: "incomplete", missing };
  await submitForReview(provider.id);
  revalidatePath(`/${locale}/dashboard`, "layout");
  return { ok: true };
}

export async function submitVerificationAction(locale: string, formData: FormData): Promise<Result> {
  const { provider } = await me();
  const kind = String(formData.get("kind")) as VerificationKind;
  if (!["identity", "kbo", "insurance", "certificate"].includes(kind)) return { ok: false, error: "validation" };
  const reference = String(formData.get("reference") ?? "").slice(0, 200);
  const file = formData.get("file");
  let documentPath: string | null = null;
  if (file instanceof File && file.size > 0) {
    try {
      documentPath = (await saveUpload(file, "document")).path;
    } catch (e) {
      if (e instanceof UploadError) return { ok: false, error: e.message };
      throw e;
    }
  }
  if (!reference && !documentPath) return { ok: false, error: "validation" };
  await submitVerification(provider.id, kind, reference, documentPath);
  revalidatePath(`/${locale}/dashboard`, "layout");
  return { ok: true };
}
