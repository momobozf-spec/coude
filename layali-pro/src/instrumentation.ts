/**
 * Draait één keer bij het opstarten van de server. De controle zit in een
 * aparte module die alleen in de Node-runtime geladen wordt, zodat de
 * Edge-bundel nooit process.exit bevat.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { checkEnvOrExit } = await import("./instrumentation-node");
    checkEnvOrExit();
  }
}
