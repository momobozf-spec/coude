import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { site } from "@/lib/site";

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", site.url), { status: 303 });
}
