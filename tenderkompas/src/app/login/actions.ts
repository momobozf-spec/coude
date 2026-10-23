"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { user } from "@/db/schema";

export async function signInAction(fd: FormData) {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  let ok = false;
  try {
    await auth.api.signInEmail({ body: { email, password }, headers: await headers() });
    ok = true;
  } catch {
    ok = false;
  }
  if (!ok) redirect("/login?fout=" + encodeURIComponent("Aanmelden mislukt: controleer e-mailadres en wachtwoord."));
  const u = await db.query.user.findFirst({ where: eq(user.email, email) });
  redirect(u?.platformRole === "admin" ? "/admin" : "/portal");
}

export async function signOutAction() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/login");
}
