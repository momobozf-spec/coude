"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth/tenant";
import { toSafeErrorMessage } from "@/lib/errors";
import { addOpportunityNote, assignOpportunity, dismissOpportunity, markContacted, snoozeOpportunity, updateOpportunityStatus } from "@/services/workflow";
import { rescoreOpportunity } from "@/services/opportunity-engine";

const statusSchema = z.enum(["NEW", "ASSIGNED", "TO_CONTACT", "CONTACTED", "INTERESTED", "VALUATION_BOOKED", "MANDATE_PROPOSED", "MANDATE_WON", "LOST", "DISMISSED"]);

function back(formData: FormData, fallback: string): string {
  const raw = formData.get("returnTo");
  const target = typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//") ? raw : fallback;
  return target;
}

function withMessage(url: string, key: "ok" | "error", message: string): string {
  const u = new URL(url, "http://local");
  u.searchParams.set(key, message);
  return `${u.pathname}${u.search}`;
}

async function run(formData: FormData, fallback: string, fn: () => Promise<string>): Promise<never> {
  const target = back(formData, fallback);
  try {
    const ok = await fn();
    redirect(withMessage(target, "ok", ok));
  } catch (err) {
    if (err && typeof err === "object" && "digest" in err && String((err as { digest?: string }).digest).startsWith("NEXT_REDIRECT")) throw err;
    redirect(withMessage(target, "error", toSafeErrorMessage(err)));
  }
}

export async function assignAction(formData: FormData): Promise<void> {
  const { ctx } = await requireTenant();
  const id = z.string().min(1).parse(formData.get("opportunityId"));
  const userIdRaw = formData.get("userId");
  const userId = typeof userIdRaw === "string" && userIdRaw ? userIdRaw : null;
  await run(formData, `/opportunities/${id}`, async () => {
    await assignOpportunity(db, ctx, id, userId ?? (formData.get("self") ? ctx.userId : null));
    return userId || formData.get("self") ? "Opportunity assigned" : "Opportunity unassigned";
  });
}

export async function statusAction(formData: FormData): Promise<void> {
  const { ctx } = await requireTenant();
  const id = z.string().min(1).parse(formData.get("opportunityId"));
  const status = statusSchema.parse(formData.get("status"));
  const note = typeof formData.get("note") === "string" ? String(formData.get("note")) : null;
  await run(formData, `/opportunities/${id}`, async () => {
    if (status === "CONTACTED") await markContacted(db, ctx, id, note);
    else if (status === "DISMISSED") await dismissOpportunity(db, ctx, id, note);
    else await updateOpportunityStatus(db, ctx, id, status, note);
    return `Marked as ${status.toLowerCase().replace("_", " ")}`;
  });
}

export async function snoozeAction(formData: FormData): Promise<void> {
  const { ctx } = await requireTenant();
  const id = z.string().min(1).parse(formData.get("opportunityId"));
  const days = z.coerce.number().int().min(1).max(365).parse(formData.get("days") ?? 7);
  await run(formData, `/opportunities/${id}`, async () => {
    await snoozeOpportunity(db, ctx, id, new Date(Date.now() + days * 86400000));
    return `Snoozed for ${days} day${days === 1 ? "" : "s"}`;
  });
}

export async function noteAction(formData: FormData): Promise<void> {
  const { ctx } = await requireTenant();
  const id = z.string().min(1).parse(formData.get("opportunityId"));
  const note = z.string().min(1).max(2000).parse(formData.get("note"));
  await run(formData, `/opportunities/${id}`, async () => {
    await addOpportunityNote(db, ctx, id, note);
    return "Note added";
  });
}

export async function rescoreAction(formData: FormData): Promise<void> {
  const { ctx } = await requireTenant();
  const id = z.string().min(1).parse(formData.get("opportunityId"));
  await run(formData, `/opportunities/${id}`, async () => {
    const opp = await db.opportunity.findFirst({ where: { id, agencyId: ctx.agencyId } });
    if (!opp) throw new Error("Opportunity not found");
    await rescoreOpportunity(db, id);
    return "Score recomputed";
  });
}
