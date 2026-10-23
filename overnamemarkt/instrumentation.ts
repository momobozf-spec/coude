/**
 * Draait één keer bij het starten van de server. In productie (niet bij previews) weigert de app te werken
 * met placeholders of lokale Supabase-instellingen; zie lib/production-guard.mjs en instrumentation-node.ts.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { runProductionGuard } = await import("./instrumentation-node");
    runProductionGuard();
  }
}
