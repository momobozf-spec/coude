"use server";
import { registerSchema, registerProvider, ProviderError } from "@/lib/services/providers";
import { allowSubmission } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request-ip";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function registerProviderAction(raw: unknown): Promise<{ ok: true } | { ok: false; error: string; field?: string }> {
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "validation", field: String(parsed.error.issues[0]?.path?.[0] ?? "") };
  if (!(await allowSubmission(await clientIp(), "register"))) return { ok: false, error: "rate_limited" };
  try {
    await registerProvider(parsed.data);
    // Meteen inloggen (cookie wordt gezet via nextCookies-plugin).
    await auth.api.signInEmail({ body: { email: parsed.data.email, password: parsed.data.password }, headers: await headers() });
    return { ok: true };
  } catch (e) {
    if (e instanceof ProviderError) return { ok: false, error: e.code };
    throw e;
  }
}
