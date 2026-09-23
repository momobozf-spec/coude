"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth/tenant";
import { toSafeErrorMessage } from "@/lib/errors";
import { addTerritory, removeTerritory } from "@/repositories/territories";

function isRedirect(err: unknown): boolean {
  return !!err && typeof err === "object" && "digest" in err && String((err as { digest?: string }).digest).startsWith("NEXT_REDIRECT");
}

export async function addTerritoryAction(formData: FormData): Promise<void> {
  const { ctx } = await requireTenant();
  try {
    const type = z.enum(["POSTAL_CODE", "MUNICIPALITY", "PROVINCE"]).parse(formData.get("type"));
    const values = z.string().min(1).max(500).parse(formData.get("value"));
    for (const v of values.split(/[,\n;]+/).map((s) => s.trim()).filter(Boolean)) await addTerritory(db, ctx, type, v);
    redirect("/territories?ok=Territory+added");
  } catch (err) {
    if (isRedirect(err)) throw err;
    redirect(`/territories?error=${encodeURIComponent(toSafeErrorMessage(err))}`);
  }
}

export async function removeTerritoryAction(formData: FormData): Promise<void> {
  const { ctx } = await requireTenant();
  try {
    await removeTerritory(db, ctx, z.string().min(1).parse(formData.get("id")));
    redirect("/territories?ok=Territory+removed");
  } catch (err) {
    if (isRedirect(err)) throw err;
    redirect(`/territories?error=${encodeURIComponent(toSafeErrorMessage(err))}`);
  }
}
