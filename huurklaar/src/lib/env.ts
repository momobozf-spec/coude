import "server-only";

/** Leest een verplichte server-variabele en faalt duidelijk als ze ontbreekt. */
export function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Ontbrekende omgevingsvariabele: ${name}`);
  return v;
}

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function intEnv(name: string, fallback: number): number {
  const n = parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
