import { checkProductionConfig, demoAccountFilter } from "@/lib/production-guard";
import { isProductionMode } from "@/lib/demo-guard";

/** Productie-guard bij serverstart (enkel Node.js-runtime). Stopt het proces bij blokkerende fouten. */
export async function runProductionGuard() {
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { errors, warnings } = checkProductionConfig(process.env);
  for (const w of warnings) console.warn(`[productie-guard] LET OP: ${w}`);
  if (errors.length === 0 && isProductionMode()) {
    try {
      const { db } = await import("@/db");
      const { user } = await import("@/db/schema");
      const { like, count } = await import("drizzle-orm");
      const [row] = await db.select({ n: count() }).from(user).where(like(user.email, demoAccountFilter()));
      if (row && Number(row.n) > 0) errors.push(`Er bestaan ${row.n} demo-accounts (${demoAccountFilter()}) met standaardwachtwoord. Verwijder ze vóór productie.`);
    } catch (e) {
      console.warn(`[productie-guard] demo-accountcontrole overgeslagen: ${e instanceof Error ? e.message : e}`);
    }
  }
  if (errors.length > 0) {
    for (const e of errors) console.error(`[productie-guard] FOUT: ${e}`);
    console.error("[productie-guard] De app start niet in productie met deze instellingen.");
    process.exit(1);
  }
}
