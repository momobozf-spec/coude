import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  const form = await req.formData().catch(() => null);
  const lang = form?.get("lang") === "fr" ? "fr" : "nl";
  return NextResponse.redirect(new URL(`/${lang}`, req.url), { status: 303 });
}
