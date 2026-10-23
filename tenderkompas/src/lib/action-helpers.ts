import "server-only";
import { redirect, unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";

function withParam(path: string, key: string, value: string) {
  const [base, qs] = path.split("?");
  const p = new URLSearchParams(qs);
  p.delete("ok");
  p.delete("fout");
  p.set(key, value.slice(0, 400));
  return `${base}?${p.toString()}`;
}

export function errorMessage(e: unknown): string {
  if (e instanceof ZodError) return e.issues.map((i) => `${i.path.join(".") || "invoer"}: ${i.message}`).join("; ");
  if (e instanceof Error) return e.message;
  return "Onbekende fout";
}

/**
 * Voert een server action uit en stuurt terug met een zichtbare melding.
 * Fouten worden nooit stil ingeslikt.
 */
export async function runAction(returnTo: string, fn: () => Promise<string | { redirect: string; message?: string } | void>) {
  let target: string;
  try {
    const res = await fn();
    if (res && typeof res === "object") target = withParam(res.redirect, "ok", res.message ?? "Opgeslagen");
    else target = withParam(returnTo, "ok", res || "Opgeslagen");
  } catch (e) {
    unstable_rethrow(e);
    console.error("[action]", returnTo, e instanceof Error ? e.message : e);
    target = withParam(returnTo, "fout", errorMessage(e));
  }
  revalidatePath(target.split("?")[0]);
  redirect(target);
}

export function str(fd: FormData, k: string): string {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim() : "";
}
export function optStr(fd: FormData, k: string): string | null {
  const v = str(fd, k);
  return v ? v : null;
}
export function list(fd: FormData, k: string): string[] {
  return str(fd, k)
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
export function optNum(fd: FormData, k: string): number | null {
  const v = str(fd, k).replace(/\s/g, "").replace(",", ".");
  if (!v) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`Ongeldig getal bij ${k}`);
  return n;
}
