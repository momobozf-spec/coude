import { checkProductionEnv, guardApplies } from "./lib/production-guard.mjs";

/** Productie-guard bij serverstart (Node.js-runtime). Zelf gehost: proces stopt. Op Vercel: elke aanvraag faalt. */
export function runProductionGuard() {
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (!guardApplies(process.env, "start")) return;
  const { errors, warnings } = checkProductionEnv(process.env);
  for (const w of warnings) console.warn(`[productie-guard] LET OP: ${w}`);
  if (errors.length === 0) return;
  for (const e of errors) console.error(`[productie-guard] FOUT: ${e}`);
  console.error("[productie-guard] De app start niet in productie met deze instellingen.");
  if (!process.env.VERCEL) process.exit(1);
  throw new Error("[productie-guard] Ongeldige productieconfiguratie.");
}
