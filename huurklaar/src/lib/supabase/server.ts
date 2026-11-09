import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { required } from "@/lib/env";

/** Supabase-client met de sessie van de ingelogde gebruiker (RLS geldt). */
export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(required("NEXT_PUBLIC_SUPABASE_URL"), required("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // In een Server Component kunnen cookies niet gezet worden; de proxy ververst de sessie.
        }
      },
    },
  });
}

/** Service-role client. Omzeilt RLS: alleen gebruiken in vertrouwde server-code (webhooks, tellers). */
export function supabaseAdmin() {
  return createClient(required("NEXT_PUBLIC_SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
