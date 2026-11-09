import "server-only";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { can, isRole, type Permission, type Role } from "@/lib/roles";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

export interface Staff {
  userId: string;
  email: string | null;
  role: Role;
  aal: "aal1" | "aal2" | null;
  hasFactor: boolean;
}

export function mfaRequired(): boolean {
  return process.env.ADMIN_REQUIRE_MFA !== "false";
}

/** Huidige teamlid, of null. Leest de rol altijd vers uit de database (geen rol in de sessie). */
export async function getStaff(): Promise<Staff | null> {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data: row } = await supabaseAdmin().from("staff_roles").select("role").eq("user_id", auth.user.id).maybeSingle();
  if (!row || !isRole(row.role)) return null;
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return {
    userId: auth.user.id,
    email: auth.user.email ?? null,
    role: row.role,
    aal: (aal?.currentLevel as Staff["aal"]) ?? null,
    hasFactor: aal?.nextLevel === "aal2",
  };
}

export function mfaOk(s: Staff): boolean {
  return !mfaRequired() || s.aal === "aal2";
}

/** Voor beheerpagina's: stuurt door naar login of MFA, of toont 404 zonder recht. */
export async function requirePage(p: Permission): Promise<Staff> {
  const s = await getStaff();
  if (!s) redirect("/admin/login");
  if (!mfaOk(s)) redirect("/admin/mfa");
  if (!can(s.role, p)) redirect("/admin?geen-toegang=1");
  return s;
}

/** Voor beheer-API's. Geeft de Staff terug of een foutantwoord. */
export async function requireApi(p: Permission): Promise<Staff | NextResponse> {
  const s = await getStaff();
  if (!s) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!mfaOk(s)) return NextResponse.json({ error: "mfa_required" }, { status: 403 });
  if (!can(s.role, p)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return s;
}

export async function audit(
  actor: Staff, action: string,
  target?: { id?: string | null; email?: string | null }, details: Record<string, unknown> = {},
) {
  const { error } = await supabaseAdmin().from("audit_log").insert({
    actor_id: actor.userId,
    actor_email: actor.email,
    action,
    target_user_id: target?.id ?? null,
    target_email: target?.email ?? null,
    details,
  });
  if (error) console.error("Auditlog schrijven mislukt", action, error.message);
}
