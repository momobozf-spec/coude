// GET ?session_id=cs_... -> { url } : tijdelijke downloadlink na geverifieerde betaling.
import { createClient } from "npm:@supabase/supabase-js@2";
import { downloadDecision, isValidSessionId } from "../_shared/lib.ts";
import { corsHeaders, env, json, stripe } from "../_shared/http.ts";

const BUCKET = "tafelmoord-pakketten";
const LINK_SECONDS = 600;

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "GET") return json({ error: "Alleen GET" }, 405, cors);

  const sessionId = new URL(req.url).searchParams.get("session_id");
  if (!isValidSessionId(sessionId)) return json({ error: "Ongeldige bestelling / Commande invalide" }, 400, cors);

  try {
    const session = await stripe(`checkout/sessions/${sessionId}`);
    const decision = downloadDecision(session, Date.now());
    if (!decision.ok) return json({ error: decision.reason }, decision.status, cors);

    const file = decision.product.file;
    const supabase = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(file, LINK_SECONDS, { download: file });
    if (error || !data) throw error ?? new Error("Geen signed URL");

    await supabase.from("tafelmoord_orders").update({ last_download_at: new Date().toISOString() }).eq("stripe_session_id", sessionId);
    return json({ url: data.signedUrl }, 200, cors);
  } catch (e) {
    console.error("download", e);
    return json({ error: "Download lukt nu niet / Le téléchargement ne fonctionne pas pour le moment." }, 500, cors);
  }
});
