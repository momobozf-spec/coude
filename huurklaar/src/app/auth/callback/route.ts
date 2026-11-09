import { NextResponse } from "next/server";
import { safeRedirectPath } from "@/lib/security";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = safeRedirectPath(url.searchParams.get("next"), "/nl/dossier");

  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  const lang = next.startsWith("/fr") ? "fr" : "nl";
  return NextResponse.redirect(new URL(`/${lang}/login?error=1`, url.origin));
}

