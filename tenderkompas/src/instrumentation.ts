/**
 * Draait één keer bij het starten van de Next.js-server.
 * In productie weigert de app te starten met dev-/testinstellingen of demo-accounts (zie instrumentation-node.ts).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { runProductionGuard } = await import("./instrumentation-node");
    await runProductionGuard();
  }
}
