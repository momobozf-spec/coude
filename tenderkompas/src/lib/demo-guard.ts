/**
 * Demodata mag nooit automatisch in productie belanden:
 *  - migraties bevatten geen gegevens;
 *  - demo-scripts vereisen ALLOW_DEMO_DATA=true én weigeren altijd bij NODE_ENV=production;
 *  - in productiemodus toont het beheerdersdashboard een blokkerende waarschuwing als er toch demodata is.
 */
export function assertDemoSeedAllowed(env: Record<string, string | undefined> = process.env) {
  if (env.NODE_ENV === "production") throw new Error("Demodata laden is geweigerd: NODE_ENV=production (productie).");
  if (env.ALLOW_DEMO_DATA !== "true") throw new Error("Demodata laden vereist expliciet ALLOW_DEMO_DATA=true (enkel lokaal/test).");
}

export function isProductionMode(env: Record<string, string | undefined> = process.env) {
  return env.NODE_ENV === "production" && env.APP_ENV !== "staging";
}
