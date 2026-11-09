import { env } from "./env";

/**
 * Weigert te starten in productie met demo-/ontwikkelwaarden.
 * Wordt aangeroepen vanuit instrumentation.ts bij het opstarten van de server.
 */
export function assertProductionSafe() {
  if (!env.isProduction) return;
  const problems: string[] = [];
  const secret = process.env.BETTER_AUTH_SECRET ?? "";
  if (secret.length < 32 || /lokaal|demo|niet-voor-productie/i.test(secret)) problems.push("BETTER_AUTH_SECRET is te kort of een demowaarde");
  if (!/^https:\/\//.test(env.baseUrl)) problems.push("BETTER_AUTH_URL moet https zijn");
  if (process.env.ALLOW_DEMO_DATA === "true") problems.push("ALLOW_DEMO_DATA mag niet aan staan");
  if (/lokaal@localhost/.test(process.env.DATABASE_URL ?? "")) problems.push("DATABASE_URL wijst naar de lokale demo-database");
  if (problems.length) {
    throw new Error(`Productiestart geweigerd:\n- ${problems.join("\n- ")}`);
  }
}
