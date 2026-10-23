"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { friendlyDbError, getViewer } from "@/lib/auth";
import { safeNext } from "@/lib/format";
import { site } from "@/lib/site";
import {
  flattenErrors, formToObject, INTEREST_KEYS, interestSchema, LISTING_KEYS, listingSchema, loginSchema,
  type FieldErrors,
} from "@/lib/validation";

export type FormState = { ok?: boolean; message?: string; errors?: FieldErrors; values?: Record<string, string>; attempt?: number };

function echo(form: FormData, keys: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = form.get(k);
    if (typeof v === "string") out[k] = v.slice(0, 4000);
  }
  return out;
}

/* ------------------------------------------------------------------ login */
export async function requestLogin(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({ email: form.get("email"), next: form.get("next") ?? undefined });
  if (!parsed.success) return { errors: flattenErrors(parsed.error) };
  const { supabase } = await getViewer();
  const next = safeNext(parsed.data.next, "/account");
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: `${site.url}/auth/callback?next=${encodeURIComponent(next)}`, shouldCreateUser: true },
  });
  if (error) {
    if (error.status === 429) return { message: "Te veel pogingen. Wacht een minuut en probeer opnieuw." };
    console.error("Login error", error.status, error.message);
    return { message: "De aanmeldlink kon niet verstuurd worden. Probeer het opnieuw." };
  }
  return { ok: true, message: "Check je mailbox. We stuurden een aanmeldlink naar " + parsed.data.email + "." };
}

/* --------------------------------------------------------------- verkopen */
export async function submitListing(prev: FormState, form: FormData): Promise<FormState> {
  const attempt = (prev.attempt ?? 0) + 1;
  const values = echo(form, LISTING_KEYS);
  const { supabase, user } = await getViewer();
  if (!user) return { message: "Meld je eerst aan.", values, attempt };
  const parsed = listingSchema.safeParse(formToObject(form, LISTING_KEYS));
  if (!parsed.success) return { errors: flattenErrors(parsed.error), message: "Controleer de gemarkeerde velden.", values, attempt };
  const d = parsed.data;
  const { error } = await supabase.rpc("submit_listing", {
    p_title: d.title, p_type: d.type, p_country: d.country, p_founded_year: d.founded_year ?? null,
    p_asking_price: d.asking_price, p_revenue_12m: d.revenue_12m, p_profit_12m: d.profit_12m,
    p_customers: d.customers ?? null, p_tech_stack: d.tech_stack, p_sale_reason: d.sale_reason,
    p_description: d.description, p_contact_email: d.contact_email,
    p_consent_accuracy: d.consent_accuracy, p_consent_publish: d.consent_publish,
  });
  if (error) return { message: friendlyDbError(error, "Indienen lukte niet. Probeer het opnieuw."), values, attempt };
  revalidatePath("/account");
  revalidatePath("/beheer");
  redirect("/account?ingediend=1");
}

/* -------------------------------------------------------------- interesse */
export async function expressInterest(prev: FormState, form: FormData): Promise<FormState> {
  const attempt = (prev.attempt ?? 0) + 1;
  const values = echo(form, INTEREST_KEYS);
  const { supabase, user } = await getViewer();
  if (!user) return { message: "Meld je eerst aan.", values, attempt };
  const parsed = interestSchema.safeParse(formToObject(form, INTEREST_KEYS));
  if (!parsed.success) return { errors: flattenErrors(parsed.error), message: "Controleer de gemarkeerde velden.", values, attempt };
  const d = parsed.data;
  const { error } = await supabase.from("interests").insert({
    listing_id: d.listing_id, message: d.message, contact_email: d.contact_email, budget: d.budget ?? null,
    consent_confidential: d.consent_confidential, consent_share: d.consent_share,
  });
  if (error) {
    if (error.code === "23505") return { message: "Je toonde al interesse voor deze aanbieding.", attempt };
    if (error.code === "42501") return { message: "Interesse tonen kan niet voor deze aanbieding (eigen aanbieding of niet meer beschikbaar).", values, attempt };
    return { message: friendlyDbError(error, "Versturen lukte niet. Probeer het opnieuw."), values, attempt };
  }
  revalidatePath(`/aanbod/${d.listing_id}`);
  revalidatePath("/account");
  revalidatePath("/beheer");
  return { ok: true, message: "Verstuurd. We bekijken je bericht en leggen het contact met de verkoper." };
}

/* ---------------------------------------------------------------- account */
const idSchema = z.string().uuid();

export async function withdrawListing(form: FormData): Promise<void> {
  const { supabase, user } = await getViewer();
  if (!user) redirect("/login?next=/account");
  const id = idSchema.safeParse(form.get("id"));
  if (!id.success) redirect("/account?fout=1");
  const { error } = await supabase.rpc("withdraw_listing", { p_id: id.data });
  if (error) redirect("/account?fout=1");
  revalidatePath("/account");
  revalidatePath("/");
  redirect("/account");
}

/* ------------------------------------------------------------------ beheer */
async function requireAdmin() {
  const viewer = await getViewer();
  if (!viewer.user || !viewer.isAdmin) redirect("/");
  return viewer;
}

const statusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pending", "published", "rejected", "under_offer", "sold", "withdrawn"]),
  note: z.string().trim().max(500).optional().default(""),
});

export async function adminSetListingStatus(form: FormData): Promise<void> {
  const { supabase } = await requireAdmin();
  const parsed = statusSchema.safeParse({ id: form.get("id"), status: form.get("status"), note: form.get("note") ?? "" });
  if (!parsed.success) redirect("/beheer?fout=1");
  const { error } = await supabase
    .from("listings")
    .update({ status: parsed.data.status, rejection_note: parsed.data.status === "rejected" ? parsed.data.note : "" })
    .eq("id", parsed.data.id);
  if (error) {
    console.error("Status update failed", error.code, error.message);
    redirect("/beheer?fout=1");
  }
  revalidatePath("/beheer");
  revalidatePath("/");
  revalidatePath(`/aanbod/${parsed.data.id}`);
  redirect("/beheer");
}

export async function adminDeleteListing(form: FormData): Promise<void> {
  const { supabase } = await requireAdmin();
  const id = idSchema.safeParse(form.get("id"));
  if (!id.success || form.get("confirm") !== "on") redirect("/beheer?fout=bevestig");
  const { error } = await supabase.from("listings").delete().eq("id", id.data);
  if (error) {
    console.error("Delete failed", error.code, error.message);
    redirect("/beheer?fout=1");
  }
  revalidatePath("/beheer");
  revalidatePath("/");
  redirect("/beheer");
}

export async function adminSetInterestStatus(form: FormData): Promise<void> {
  const { supabase } = await requireAdmin();
  const parsed = z
    .object({ id: z.string().uuid(), status: z.enum(["new", "forwarded", "closed"]) })
    .safeParse({ id: form.get("id"), status: form.get("status") });
  if (!parsed.success) redirect("/beheer?fout=1");
  const { error } = await supabase.from("interests").update({ status: parsed.data.status }).eq("id", parsed.data.id);
  if (error) {
    console.error("Interest update failed", error.code, error.message);
    redirect("/beheer?fout=1");
  }
  revalidatePath("/beheer");
  revalidatePath("/account");
  redirect("/beheer");
}
