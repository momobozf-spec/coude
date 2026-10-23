/**
 * Draait één keer bij het opstarten van de Next-server, vóór de eerste request.
 *
 * Hier valt de productiecontrole: geen fixture-prijzen, e-mail ingesteld, een
 * echt AUTH_SECRET, https. Bij een fout stopt het proces met exitcode 1 in
 * plaats van een server te laten draaien die verkeerde Zakat-bedragen toont;
 * het hostingplatform ziet een mislukte deploy en houdt de vorige versie online.
 * De worker doet dezelfde controle (src/worker/index.ts).
 *
 * De controle zelf zit in instrumentation-node.ts, zodat de Edge-bundel nooit
 * `process.exit` bevat.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { checkProductionConfigOrExit } = await import('./instrumentation-node')
    await checkProductionConfigOrExit()
  }
}
