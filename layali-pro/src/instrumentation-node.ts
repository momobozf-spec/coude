import { checkProductionEnv } from "./lib/env";

export function checkEnvOrExit(): void {
  const { errors, warnings } = checkProductionEnv();
  for (const w of warnings) console.warn(`[config] ${w}`);
  if (errors.length > 0) {
    console.error(`[config] De app start niet:\n - ${errors.join("\n - ")}`);
    process.exit(1);
  }
}
