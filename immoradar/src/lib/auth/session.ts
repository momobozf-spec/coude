/**
 * Stateless signed session tokens: base64url(JSON payload) + "." + HMAC-SHA256.
 * Stored in an httpOnly, SameSite=Lax cookie (CSRF-safe for navigation, and
 * all mutations go through Next server actions which enforce origin checks).
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/config";

export interface SessionPayload {
  userId: string;
  exp: number; // unix seconds
}

export const SESSION_COOKIE = "immoradar_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function sign(data: string): string {
  return createHmac("sha256", env().SESSION_SECRET).update(data).digest("base64url");
}

export function createSessionToken(userId: string, nowMs = Date.now()): string {
  const payload: SessionPayload = {
    userId,
    exp: Math.floor(nowMs / 1000) + SESSION_TTL_SECONDS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifySessionToken(token: string, nowMs = Date.now()): SessionPayload | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionPayload;
    if (typeof payload.userId !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp * 1000 < nowMs) return null;
    return payload;
  } catch {
    return null;
  }
}
