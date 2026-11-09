export type GuardResult = { errors: string[]; warnings: string[] };
export function checkProductionEnv(env: Record<string, string | undefined>): GuardResult;
export function guardApplies(env: Record<string, string | undefined>, phase: "build" | "start"): boolean;
