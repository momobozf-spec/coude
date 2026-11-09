import "server-only";
import { randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/server";

export interface SearchProfileRow {
  user_id: string;
  max_monthly: number | null;
  municipalities: string[];
  min_bedrooms: number;
  pets: boolean;
  inbound_token: string;
  forward_verification: string | null;
  forward_verification_at: string | null;
  last_mail_at: string | null;
}

export async function getOrCreateSearchProfile(userId: string): Promise<SearchProfileRow> {
  const db = supabaseAdmin();
  const { data } = await db.from("search_profiles").select("*").eq("user_id", userId).maybeSingle();
  if (data) return data as SearchProfileRow;
  const { data: created, error } = await db
    .from("search_profiles")
    .upsert({ user_id: userId, inbound_token: randomBytes(9).toString("hex") }, { onConflict: "user_id", ignoreDuplicates: true })
    .select("*")
    .maybeSingle();
  if (created) return created as SearchProfileRow;
  // Gelijktijdige aanmaak: lees opnieuw.
  const { data: again } = await db.from("search_profiles").select("*").eq("user_id", userId).single();
  if (!again) throw error ?? new Error("Zoekprofiel kon niet aangemaakt worden");
  return again as SearchProfileRow;
}

/** Het persoonlijke doorstuuradres, bv. zoek+3f9a…@in.huurklaar.be */
export function inboundAddress(token: string): string {
  const mailbox = process.env.INBOUND_MAILBOX || "zoek";
  const domain = process.env.INBOUND_DOMAIN || "in.huurklaar.be";
  return `${mailbox}+${token}@${domain}`;
}
