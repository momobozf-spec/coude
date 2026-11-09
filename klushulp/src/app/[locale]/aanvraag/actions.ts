"use server";
import { z } from "zod";
import { requestInputSchema, createRequest, RequestError } from "@/lib/services/requests";
import { allowSubmission } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request-ip";
import { getCurrentUser } from "@/lib/session";

export type SubmitResult = { ok: true; token: string; matchCount: number } | { ok: false; error: string; field?: string };

export async function submitRequestAction(raw: unknown): Promise<SubmitResult> {
  const parsed = requestInputSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: "validation", field: String(issue?.path?.[0] ?? "") };
  }
  if (!(await allowSubmission(await clientIp(), "request"))) return { ok: false, error: "rate_limited" };
  const user = await getCurrentUser();
  try {
    const { request, matchCount } = await createRequest(parsed.data, { customerUserId: user?.id ?? null });
    return { ok: true, token: request.accessToken, matchCount };
  } catch (e) {
    if (e instanceof RequestError) return { ok: false, error: e.code };
    if (e instanceof z.ZodError) return { ok: false, error: "validation" };
    throw e;
  }
}
