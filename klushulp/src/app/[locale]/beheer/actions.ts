"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/session";
import { activateProvider, suspendProvider, reviewVerification, setReviewVisibility, updateReport, toggleCategory, toggleRegion, AdminError } from "@/lib/services/admin";
import { setSetting } from "@/lib/fees";
import { cancelRequest } from "@/lib/services/requests";
import { transitionBooking } from "@/lib/services/bookings";
import type { ReportStatus } from "@/db/schema";
import { db } from "@/db";
import { provider } from "@/db/schema";
import { eq } from "drizzle-orm";

function str(fd: FormData, k: string) {
  return String(fd.get(k) ?? "").trim();
}

export async function adminVerificationAction(fd: FormData) {
  const admin = await requireRole("admin");
  const decision = str(fd, "decision") === "approved" ? "approved" : "rejected";
  await reviewVerification(str(fd, "id"), decision, admin.id, str(fd, "note"));
  revalidatePath("/", "layout");
}

export async function adminProviderStatusAction(fd: FormData): Promise<void> {
  const admin = await requireRole("admin");
  const id = str(fd, "id");
  const action = str(fd, "action");
  try {
    if (action === "activate") await activateProvider(id, admin.id);
    else if (action === "suspend") await suspendProvider(id, admin.id, str(fd, "reason"));
    else if (action === "unsuspend") await db.update(provider).set({ status: "pending", suspendedReason: null, updatedAt: new Date() }).where(eq(provider.id, id));
  } catch (e) {
    if (!(e instanceof AdminError)) throw e;
  }
  revalidatePath("/", "layout");
}

export async function adminReviewAction(fd: FormData) {
  const admin = await requireRole("admin");
  await setReviewVisibility(str(fd, "id"), str(fd, "visible") === "1", admin.id, str(fd, "note"));
  revalidatePath("/", "layout");
}

export async function adminReportAction(fd: FormData) {
  const admin = await requireRole("admin");
  const status = str(fd, "status") as ReportStatus;
  if (!["open", "in_review", "resolved", "dismissed"].includes(status)) return;
  await updateReport(str(fd, "id"), status, str(fd, "note"), admin.id);
  revalidatePath("/", "layout");
}

export async function adminCatalogAction(fd: FormData) {
  await requireRole("admin");
  const kind = str(fd, "kind");
  const active = str(fd, "active") === "1";
  if (kind === "category") await toggleCategory(str(fd, "id"), active);
  if (kind === "region") await toggleRegion(str(fd, "id"), active);
  revalidatePath("/", "layout");
}

export async function adminSettingsAction(fd: FormData) {
  await requireRole("admin");
  const bps = Number.parseInt(str(fd, "fee_bps"), 10);
  const min = Number.parseInt(str(fd, "fee_min_cents"), 10);
  if (Number.isFinite(bps) && bps >= 0 && bps <= 5000) await setSetting("fee_bps", String(bps));
  if (Number.isFinite(min) && min >= 0 && min <= 100_000) await setSetting("fee_min_cents", String(min));
  revalidatePath("/", "layout");
}

export async function adminCancelRequestAction(fd: FormData) {
  const admin = await requireRole("admin");
  await cancelRequest(str(fd, "id"), "admin", admin.id);
  revalidatePath("/", "layout");
}

export async function adminBookingAction(fd: FormData) {
  const admin = await requireRole("admin");
  const to = str(fd, "to");
  if (!["completed", "cancelled"].includes(to)) return;
  try {
    await transitionBooking(str(fd, "id"), to as "completed" | "cancelled", { role: "admin", userId: admin.id }, { reason: str(fd, "reason") });
  } catch {}
  revalidatePath("/", "layout");
}
