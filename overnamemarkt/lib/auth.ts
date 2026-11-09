import "server-only";
import { createClient } from "./supabase/server";

export async function getViewer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, isAdmin: false } as const;
  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return { supabase, user, isAdmin: data?.role === "admin" } as const;
}

/** Zet een databasefout om naar een bericht voor de gebruiker, zonder interne details te tonen. */
export function friendlyDbError(error: { code?: string; message?: string } | null | undefined, fallback: string): string {
  if (!error) return fallback;
  if (error.code === "P0001" && error.message) return error.message;
  if (error.code === "23505") return "Dit bestaat al.";
  if (error.code === "42501") return "Je hebt hier geen rechten voor. Meld je opnieuw aan.";
  if (error.code === "23514") return "Een van de velden voldoet niet aan de regels. Controleer je invoer.";
  console.error("Database error", error.code, error.message);
  return fallback;
}
